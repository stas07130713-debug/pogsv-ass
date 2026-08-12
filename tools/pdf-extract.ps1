<#
    Извлечение текстового слоя из PDF без внешних зависимостей.

    Разовый инструмент авторского этапа: в системе нет ни poppler, ни Python, ни Node,
    а Справочник командира отделения ВГСЧ свёрстан subset-шрифтами — коды глифов
    не совпадают с Unicode, поэтому нужна расшифровка карт /ToUnicode.

    Что делает:
      1. разбирает объекты PDF, включая упакованные в /ObjStm;
      2. для каждого шрифта читает /ToUnicode CMap (bfchar / bfrange);
      3. декодирует операторы показа текста (Tj, TJ, ', ") с учётом активного шрифта;
      4. пишет текст постранично.

    Использование:
      .\pdf-extract.ps1 -Pdf "..\База знаний\Справочник.pdf" -Out ".\spravochnik.txt"
      .\pdf-extract.ps1 -Pdf "...pdf" -Grep 'расход|л/мин'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Pdf,
    [string]$Out,
    [string]$Grep,
    [int]$FirstPage = 1,
    [int]$LastPage = 0
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

$script:Latin1 = [System.Text.Encoding]::GetEncoding(28591)

function Inflate-Bytes {
    param([byte[]]$Buffer, [int]$Offset, [int]$Length)
    if ($Length -le 0) { return [byte[]]@() }
    $slice = New-Object byte[] $Length
    [Array]::Copy($Buffer, $Offset, $slice, 0, $Length)
    $ms = New-Object System.IO.MemoryStream(, $slice)
    # DeflateStream ожидает raw deflate, поэтому zlib-заголовок (RFC 1950) пропускаем.
    # Опознаём его по правилу: младшие 4 бита CMF равны 8 (deflate)
    # и контрольная сумма (CMF<<8 | FLG) кратна 31.
    # Проверять только 0x78 нельзя: при меньшем окне заголовок равен 0x48, 0x58, 0x68.
    # Приведение к [int] обязательно: у PowerShell оператор -shl сохраняет тип
    # операнда, поэтому [byte] -shl 8 даёт 0, и проверка никогда не срабатывает.
    if ($Length -ge 2) {
        $cmf = [int]$slice[0]; $flg = [int]$slice[1]
        if ((($cmf -band 0x0F) -eq 8) -and (((($cmf -shl 8) -bor $flg) % 31) -eq 0)) {
            $null = $ms.Seek(2, 'Begin')
        }
    }
    $ds = New-Object System.IO.Compression.DeflateStream($ms, [System.IO.Compression.CompressionMode]::Decompress)
    $outMs = New-Object System.IO.MemoryStream
    $tmp = New-Object byte[] 16384
    while ($true) {
        try { $n = $ds.Read($tmp, 0, $tmp.Length) } catch { break }
        if ($n -le 0) { break }
        $outMs.Write($tmp, 0, $n)
    }
    $ds.Dispose()
    return $outMs.ToArray()
}

Write-Host "Чтение $Pdf ..." -ForegroundColor Cyan
$bytes = [System.IO.File]::ReadAllBytes($Pdf)
$raw = $script:Latin1.GetString($bytes)
Write-Host ("  {0:N0} байт" -f $bytes.Length)

# ---------------------------------------------------------------- объекты ----
# objects[номер] = @{ Dict = '<<...>>'; Data = byte[] или $null }
$objects = @{}

$objRx = [regex]'(?sm)(\d+)\s+(\d+)\s+obj\b'
foreach ($m in $objRx.Matches($raw)) {
    $num = [int]$m.Groups[1].Value
    $bodyStart = $m.Index + $m.Length
    $endIdx = $raw.IndexOf('endobj', $bodyStart)
    if ($endIdx -lt 0) { continue }

    $streamIdx = $raw.IndexOf('stream', $bodyStart)
    $dict = $null
    $data = $null

    if ($streamIdx -ge 0 -and $streamIdx -lt $endIdx) {
        $dict = $raw.Substring($bodyStart, $streamIdx - $bodyStart)
        $dataStart = $streamIdx + 6
        while ($dataStart -lt $raw.Length -and ($raw[$dataStart] -eq "`r" -or $raw[$dataStart] -eq "`n")) { $dataStart++ }
        $dataEnd = $raw.IndexOf('endstream', $dataStart)
        if ($dataEnd -ge 0) {
            $len = $dataEnd - $dataStart
            if ($dict -match '/FlateDecode') { $data = Inflate-Bytes $bytes $dataStart $len }
            else {
                $data = New-Object byte[] $len
                [Array]::Copy($bytes, $dataStart, $data, 0, $len)
            }
        }
    } else {
        $dict = $raw.Substring($bodyStart, $endIdx - $bodyStart)
    }
    $objects[$num] = @{ Dict = $dict; Data = $data }
}
Write-Host ("  объектов верхнего уровня: {0:N0}" -f $objects.Count)

# ------------------------------------------------- объекты внутри /ObjStm ----
$fromObjStm = 0
foreach ($num in @($objects.Keys)) {
    $o = $objects[$num]
    if ($null -eq $o.Data -or $o.Dict -notmatch '/Type\s*/ObjStm') { continue }
    $txt = $script:Latin1.GetString($o.Data)
    $n = 0; $first = 0
    if ($o.Dict -match '/N\s+(\d+)') { $n = [int]$Matches[1] }
    if ($o.Dict -match '/First\s+(\d+)') { $first = [int]$Matches[1] }
    if ($n -le 0) { continue }

    $header = $txt.Substring(0, [Math]::Min($first, $txt.Length))
    $nums = [regex]::Matches($header, '\d+') | ForEach-Object { [int]$_.Value }
    for ($i = 0; $i -lt $n -and ($i * 2 + 1) -lt $nums.Count; $i++) {
        $objNum = $nums[$i * 2]
        $offset = $first + $nums[$i * 2 + 1]
        $end = if (($i * 2 + 3) -lt $nums.Count) { $first + $nums[$i * 2 + 3] } else { $txt.Length }
        if ($offset -ge $txt.Length) { continue }
        $end = [Math]::Min($end, $txt.Length)
        if ($end -le $offset) { continue }
        if (-not $objects.ContainsKey($objNum)) {
            $objects[$objNum] = @{ Dict = $txt.Substring($offset, $end - $offset); Data = $null }
            $fromObjStm++
        }
    }
}
Write-Host ("  распаковано из /ObjStm: {0:N0}" -f $fromObjStm)

# ----------------------------------------------------------- карты ToUnicode ----
# cmaps[номер объекта шрифта] = @{ Map = @{код -> строка}; TwoByte = bool }
$cmapCache = @{}

function Parse-CMap {
    param([int]$ObjNum)
    if ($cmapCache.ContainsKey($ObjNum)) { return $cmapCache[$ObjNum] }
    $map = @{}
    $o = $objects[$ObjNum]
    if ($null -ne $o -and $null -ne $o.Data) {
        $t = $script:Latin1.GetString($o.Data)

        foreach ($blk in [regex]::Matches($t, '(?s)beginbfchar(.*?)endbfchar')) {
            foreach ($p in [regex]::Matches($blk.Groups[1].Value, '<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>')) {
                $code = [Convert]::ToInt32($p.Groups[1].Value, 16)
                $map[$code] = ConvertFrom-UtfHex $p.Groups[2].Value
            }
        }
        foreach ($blk in [regex]::Matches($t, '(?s)beginbfrange(.*?)endbfrange')) {
            $body = $blk.Groups[1].Value
            foreach ($p in [regex]::Matches($body, '<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>')) {
                $lo = [Convert]::ToInt32($p.Groups[1].Value, 16)
                $hi = [Convert]::ToInt32($p.Groups[2].Value, 16)
                $dst = [Convert]::ToInt32($p.Groups[3].Value, 16)
                for ($c = $lo; $c -le $hi -and ($c - $lo) -lt 65536; $c++) {
                    $map[$c] = [char]($dst + ($c - $lo))
                }
            }
            foreach ($p in [regex]::Matches($body, '(?s)<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*?)\]')) {
                $lo = [Convert]::ToInt32($p.Groups[1].Value, 16)
                $k = 0
                foreach ($d in [regex]::Matches($p.Groups[3].Value, '<([0-9A-Fa-f]+)>')) {
                    $map[$lo + $k] = ConvertFrom-UtfHex $d.Groups[1].Value
                    $k++
                }
            }
        }
    }
    $cmapCache[$ObjNum] = $map
    return $map
}

function ConvertFrom-UtfHex {
    param([string]$Hex)
    $sb = New-Object System.Text.StringBuilder
    for ($i = 0; $i + 3 -lt $Hex.Length + 1; $i += 4) {
        if ($i + 4 -gt $Hex.Length) { break }
        $null = $sb.Append([char][Convert]::ToInt32($Hex.Substring($i, 4), 16))
    }
    return $sb.ToString()
}

# -------------------------------------------------------- ресурсы страницы ----
function Resolve-Ref {
    param([string]$Text, [string]$Key)
    if ($Text -match ('/' + $Key + '\s+(\d+)\s+\d+\s+R')) { return [int]$Matches[1] }
    return $null
}

function Get-FontMap {
    <# Возвращает @{ '/F0' = @{ Map = ...; TwoByte = bool } } для словаря ресурсов #>
    param([string]$ResourcesText)
    $result = @{}
    $fontBlock = $null
    $fi = $ResourcesText.IndexOf('/Font')
    if ($fi -lt 0) { return $result }

    $refNum = Resolve-Ref $ResourcesText.Substring($fi) 'Font'
    if ($null -ne $refNum -and $objects.ContainsKey($refNum)) {
        $fontBlock = $objects[$refNum].Dict
    } else {
        $open = $ResourcesText.IndexOf('<<', $fi)
        if ($open -lt 0) { return $result }
        $depth = 0; $i = $open
        while ($i -lt $ResourcesText.Length - 1) {
            if ($ResourcesText.Substring($i, 2) -eq '<<') { $depth++; $i += 2; continue }
            if ($ResourcesText.Substring($i, 2) -eq '>>') { $depth--; $i += 2; if ($depth -eq 0) { break }; continue }
            $i++
        }
        $fontBlock = $ResourcesText.Substring($open, $i - $open)
    }
    if (-not $fontBlock) { return $result }

    foreach ($m in [regex]::Matches($fontBlock, '/([A-Za-z0-9#\._\-]+)\s+(\d+)\s+\d+\s+R')) {
        $name = '/' + $m.Groups[1].Value
        $fontObj = [int]$m.Groups[2].Value
        if (-not $objects.ContainsKey($fontObj)) { continue }
        $fd = $objects[$fontObj].Dict
        $twoByte = ($fd -match '/Type0') -or ($fd -match '/Identity-H')
        $tuNum = Resolve-Ref $fd 'ToUnicode'
        $map = if ($null -ne $tuNum) { Parse-CMap $tuNum } else { @{} }
        $result[$name] = @{ Map = $map; TwoByte = $twoByte }
    }
    return $result
}

# ------------------------------------------------------- декод содержимого ----
function Decode-PdfString {
    <# Массив кодов из литерала (...) с учётом экранирования #>
    param([string]$Literal)
    $codes = New-Object System.Collections.ArrayList
    $i = 0
    while ($i -lt $Literal.Length) {
        $ch = $Literal[$i]
        if ($ch -eq '\') {
            $i++
            if ($i -ge $Literal.Length) { break }
            $e = $Literal[$i]
            switch ($e) {
                'n' { $null = $codes.Add(10); $i++ }
                'r' { $null = $codes.Add(13); $i++ }
                't' { $null = $codes.Add(9);  $i++ }
                'b' { $null = $codes.Add(8);  $i++ }
                'f' { $null = $codes.Add(12); $i++ }
                default {
                    if ($e -match '[0-7]') {
                        $oct = ''
                        while ($i -lt $Literal.Length -and $Literal[$i] -match '[0-7]' -and $oct.Length -lt 3) {
                            $oct += $Literal[$i]; $i++
                        }
                        $null = $codes.Add([Convert]::ToInt32($oct, 8))
                    } else { $null = $codes.Add([int][char]$e); $i++ }
                }
            }
        } else {
            $null = $codes.Add([int][char]$ch); $i++
        }
    }
    return $codes
}

function Map-Codes {
    param($Codes, $Font)
    if ($null -eq $Font) { return '' }
    $sb = New-Object System.Text.StringBuilder
    if ($Font.TwoByte) {
        for ($i = 0; $i + 1 -lt $Codes.Count; $i += 2) {
            $c = ($Codes[$i] -shl 8) -bor $Codes[$i + 1]
            if ($Font.Map.ContainsKey($c)) { $null = $sb.Append($Font.Map[$c]) }
        }
    } else {
        foreach ($c in $Codes) {
            if ($Font.Map.ContainsKey($c)) { $null = $sb.Append($Font.Map[$c]) }
            elseif ($c -ge 32 -and $c -lt 127) { $null = $sb.Append([char]$c) }
        }
    }
    return $sb.ToString()
}

function Extract-PageText {
    param([string]$Content, $Fonts)
    $sb = New-Object System.Text.StringBuilder
    $current = $null
    $lastY = [double]::NaN

    $tokenRx = [regex]'(?s)/([A-Za-z0-9#\._\-]+)\s+[\d\.\-]+\s+Tf|\(((?:[^()\\]|\\.|\((?:[^()\\]|\\.)*\))*)\)\s*Tj|\[((?:[^\[\]\\]|\\.)*)\]\s*TJ|<([0-9A-Fa-f\s]+)>\s*Tj|([\d\.\-]+)\s+([\d\.\-]+)\s+(?:Td|TD)|(T\*)'

    foreach ($m in $tokenRx.Matches($Content)) {
        if ($m.Groups[1].Success) {
            $key = '/' + $m.Groups[1].Value
            $current = if ($Fonts.ContainsKey($key)) { $Fonts[$key] } else { $null }
            continue
        }
        if ($m.Groups[6].Success) {
            $y = 0.0
            if ([double]::TryParse($m.Groups[7].Value, [Globalization.NumberStyles]::Float,
                                   [Globalization.CultureInfo]::InvariantCulture, [ref]$y)) {
                if (-not [double]::IsNaN($lastY) -and [Math]::Abs($y - $lastY) -gt 0.01) { $null = $sb.Append("`n") }
                $lastY = $y
            }
            continue
        }
        if ($m.Groups[8].Success) { $null = $sb.Append("`n"); continue }

        if ($m.Groups[2].Success) {
            $null = $sb.Append((Map-Codes (Decode-PdfString $m.Groups[2].Value) $current))
        } elseif ($m.Groups[3].Success) {
            foreach ($part in [regex]::Matches($m.Groups[3].Value, '(?s)\(((?:[^()\\]|\\.)*)\)|(-?[\d\.]+)')) {
                if ($part.Groups[1].Success) {
                    $null = $sb.Append((Map-Codes (Decode-PdfString $part.Groups[1].Value) $current))
                } elseif ($part.Groups[2].Success) {
                    # крупный отрицательный сдвиг кернинга трактуем как пробел
                    $adj = 0.0
                    if ([double]::TryParse($part.Groups[2].Value, [Globalization.NumberStyles]::Float,
                                           [Globalization.CultureInfo]::InvariantCulture, [ref]$adj)) {
                        if ($adj -lt -180) { $null = $sb.Append(' ') }
                    }
                }
            }
        } elseif ($m.Groups[4].Success) {
            $hex = ($m.Groups[4].Value -replace '\s', '')
            $codes = New-Object System.Collections.ArrayList
            for ($i = 0; $i + 1 -lt $hex.Length; $i += 2) {
                $null = $codes.Add([Convert]::ToInt32($hex.Substring($i, 2), 16))
            }
            $null = $sb.Append((Map-Codes $codes $current))
        }
    }
    return $sb.ToString()
}

# ------------------------------------------------------------------ обход ----
$pageNums = @()
foreach ($num in ($objects.Keys | Sort-Object)) {
    if ($objects[$num].Dict -match '/Type\s*/Page[^s]') { $pageNums += $num }
}
Write-Host ("  страниц найдено: {0:N0}" -f $pageNums.Count)

if ($LastPage -le 0) { $LastPage = $pageNums.Count }
$result = New-Object System.Text.StringBuilder
$hits = 0
$script:EmptyPages = @()

for ($pi = $FirstPage - 1; $pi -lt [Math]::Min($LastPage, $pageNums.Count); $pi++) {
    $pnum = $pageNums[$pi]
    $pdict = $objects[$pnum].Dict

    $resText = $pdict
    $resRef = Resolve-Ref $pdict 'Resources'
    if ($null -ne $resRef -and $objects.ContainsKey($resRef)) { $resText = $objects[$resRef].Dict }
    $fonts = Get-FontMap $resText

    $contentRefs = @()
    if ($pdict -match '/Contents\s+(\d+)\s+\d+\s+R') { $contentRefs += [int]$Matches[1] }
    elseif ($pdict -match '(?s)/Contents\s*\[(.*?)\]') {
        foreach ($r in [regex]::Matches($Matches[1], '(\d+)\s+\d+\s+R')) { $contentRefs += [int]$r.Groups[1].Value }
    }

    $content = ''
    foreach ($cr in $contentRefs) {
        if ($objects.ContainsKey($cr) -and $null -ne $objects[$cr].Data) {
            $content += $script:Latin1.GetString($objects[$cr].Data)
        }
    }
    if (-not $content) { continue }

    $text = Extract-PageText $content $fonts
    $text = $text -replace '[ \t]+', ' '
    $text = ($text -split "`n" | Where-Object { $_.Trim() } | ForEach-Object { $_.Trim() }) -join "`n"
    if (-not $text) {
        $desc = @()
        foreach ($fn in ($fonts.Keys | Sort-Object)) {
            $desc += ('{0}:{1}{2}' -f $fn, $fonts[$fn].Map.Count, $(if ($fonts[$fn].TwoByte) { '/2b' } else { '' }))
        }
        $script:EmptyPages += [pscustomobject]@{
            Page       = $pi + 1
            ContentLen = $content.Length
            HasBT      = [bool]($content -match '\bBT\b')
            Fonts      = ($desc -join ' ')
        }
        continue
    }

    if ($Grep) {
        if ($text -match $Grep) {
            $hits++
            Write-Host "`n=== стр. $($pi + 1) ===" -ForegroundColor Yellow
            foreach ($line in ($text -split "`n")) {
                if ($line -match $Grep) { Write-Host "  $line" -ForegroundColor Green }
            }
        }
    }
    $null = $result.Append("`n=== стр. $($pi + 1) ===`n").Append($text).Append("`n")

    if (($pi + 1) % 25 -eq 0) { Write-Host "  обработано страниц: $($pi + 1)" }
}

if ($Grep) { Write-Host "`nСтраниц с совпадением: $hits" -ForegroundColor Cyan }

if ($script:EmptyPages.Count) {
    Write-Host ("`nСтраниц без извлечённого текста: {0}" -f $script:EmptyPages.Count) -ForegroundColor Yellow
    $script:EmptyPages | Select-Object -First 12 | Format-Table -AutoSize | Out-String | Write-Host
}

if ($Out) {
    [System.IO.File]::WriteAllText($Out, $result.ToString(), (New-Object System.Text.UTF8Encoding $true))
    Write-Host "Записано: $Out" -ForegroundColor Cyan
}
