# Раздаёт приложение по локальной сети, чтобы открыть его с телефона.
#
# Ничего не устанавливает и никуда не выходит в интернет: телефон и компьютер
# просто должны быть в одной сети Wi-Fi. Пока окно открыто — адрес работает,
# закрыли окно — раздача прекратилась.
#
# Почему не HttpListener: он требует прав администратора на любой адрес,
# кроме localhost, а localhost с телефона недоступен. Обычный TCP-слушатель
# таких прав не требует, поэтому HTTP разбирается здесь вручную —
# ровно в том объёме, который нужен для отдачи статических файлов.

param(
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot          # ...\Приложение
$utf8 = New-Object System.Text.UTF8Encoding($false)

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.txt'  = 'text/plain; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
}

function Get-LocalAddress {
  # Берём адрес того интерфейса, через который машина реально ходит в сеть:
  # у ноутбука с VPN или виртуальными адаптерами их бывает несколько.
  $candidates = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    }
  $wifi = $candidates | Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|Беспровод' } | Select-Object -First 1
  if ($wifi) { return $wifi.IPAddress }
  $eth = $candidates | Where-Object { $_.InterfaceAlias -match 'Ethernet|Подключение по локальной' } | Select-Object -First 1
  if ($eth) { return $eth.IPAddress }
  $any = $candidates | Select-Object -First 1
  if ($any) { return $any.IPAddress }
  return '127.0.0.1'
}

function Send-Response {
  param($Stream, [int]$Code, [string]$Status, [string]$Type, [byte[]]$Body)
  $head = "HTTP/1.1 $Code $Status`r`n" +
          "Content-Type: $Type`r`n" +
          "Content-Length: $($Body.Length)`r`n" +
          "Cache-Control: no-store`r`n" +
          "Connection: close`r`n`r`n"
  $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
  $Stream.Write($headBytes, 0, $headBytes.Length)
  if ($Body.Length) { $Stream.Write($Body, 0, $Body.Length) }
  $Stream.Flush()
}

$ip = Get-LocalAddress
$url = "http://${ip}:$Port"

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
try {
  $listener.Start()
} catch {
  Write-Host ''
  Write-Host "  Не удалось занять порт $Port." -ForegroundColor Red
  Write-Host "  Скорее всего он занят другой программой. Запустите с другим портом:" -ForegroundColor Gray
  Write-Host "     powershell -File `"$PSCommandPath`" -Port 8081" -ForegroundColor Gray
  Write-Host ''
  Read-Host 'Enter — закрыть'
  exit 1
}

Write-Host ''
Write-Host '  ПОДГОТОВКА ГОРНОСПАСАТЕЛЕЙ ПОГСВ АСС' -ForegroundColor Cyan
Write-Host '  ------------------------------------------------------------'
Write-Host '  Откройте на телефоне этот адрес:'
Write-Host ''
Write-Host "      $url" -ForegroundColor Yellow
Write-Host ''
Write-Host '  Телефон должен быть в той же сети Wi-Fi, что и компьютер.'
Write-Host '  Если Windows спросит про доступ в сеть — разрешите для частной сети.'
Write-Host ''
Write-Host '  Пока это окно открыто, адрес работает. Закройте окно — раздача'
Write-Host '  прекратится. Ctrl+C — остановить.'
Write-Host '  ------------------------------------------------------------'
Write-Host ''

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $client.ReceiveTimeout = 4000
      $client.SendTimeout = 8000
      $stream = $client.GetStream()

      # Заголовок запроса читаем до пустой строки. Тело нам не нужно:
      # приложение статическое, кроме GET ничего не бывает.
      $buffer = New-Object byte[] 4096
      $text = ''
      while ($text -notmatch "`r`n`r`n") {
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -le 0) { break }
        $text += [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
        if ($text.Length -gt 16384) { break }
      }
      if (-not $text) { continue }

      $requestLine = ($text -split "`r`n")[0]
      $parts = $requestLine -split ' '
      $method = $parts[0]
      $target = if ($parts.Length -gt 1) { $parts[1] } else { '/' }

      # Метка версии ?v=... к файлу отношения не имеет.
      $target = ($target -split '\?')[0]
      $target = [System.Uri]::UnescapeDataString($target)
      if ($target -eq '/' -or $target -eq '') { $target = '/index.html' }

      $relative = $target.TrimStart('/').Replace('/', '\')
      $full = Join-Path $root $relative

      # Защита от выхода за пределы папки приложения (../../).
      $resolved = $null
      try { $resolved = (Resolve-Path -LiteralPath $full -ErrorAction Stop).Path } catch { }
      $inside = $resolved -and $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)

      if ($method -ne 'GET') {
        Send-Response $stream 405 'Method Not Allowed' 'text/plain; charset=utf-8' $utf8.GetBytes('Только GET')
      }
      elseif (-not $inside -or -not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        Write-Host ("  нет файла: " + $target) -ForegroundColor DarkYellow
        Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' $utf8.GetBytes('Файл не найден: ' + $target)
      }
      else {
        $ext = [System.IO.Path]::GetExtension($resolved).ToLower()
        $type = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($resolved)
        Send-Response $stream 200 'OK' $type $bytes
      }
    } catch {
      # Телефон часто рвёт соединение сам — это не повод останавливать раздачу.
    } finally {
      if ($client) { $client.Close() }
    }
  }
} finally {
  $listener.Stop()
  Write-Host ''
  Write-Host '  Раздача остановлена.' -ForegroundColor Gray
}
