# Отправка приложения на GitHub и подсказка, что делать дальше.
#
# Запускается в своём окне: при первой отправке GitHub попросит войти
# в аккаунт — откроется окно браузера с кнопкой Authorize. Пароль вводится
# в самом GitHub, скрипт его не видит и не хранит: этим занимается
# менеджер учётных данных Windows.
#
# Повторные запуски входа уже не требуют.

param(
  [string]$Repo = 'https://github.com/stas07130713-debug/pogsv-ass.git'
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Запрос логина включаем явно. Дочернее окно наследует переменные окружения
# от того, кто его запустил, а автоматические среды выставляют
# GIT_TERMINAL_PROMPT=0 и GCM_INTERACTIVE=never, чтобы git не завис на вопросе.
# Здесь вопрос как раз нужен: без него отправка обрывается с
# «Cannot prompt because user interactivity has been disabled».
$env:GIT_TERMINAL_PROMPT = '1'
$env:GCM_INTERACTIVE = 'auto'
$env:GCM_GUI_PROMPT = 'true'

Write-Host ''
Write-Host '  ОТПРАВКА ПРИЛОЖЕНИЯ НА GITHUB' -ForegroundColor Cyan
Write-Host '  ------------------------------------------------------------'
Write-Host "  Папка:       $root"
Write-Host "  Репозиторий: $Repo"
Write-Host ''
Write-Host '  Сейчас откроется окно входа в GitHub. Нажмите Authorize —'
Write-Host '  пароль вводится в самом GitHub, скрипт его не видит.'
Write-Host '  ------------------------------------------------------------'
Write-Host ''

git remote remove origin 2>$null | Out-Null
git remote add origin $Repo

git push -u origin main
$ok = $LASTEXITCODE -eq 0

Write-Host ''
if ($ok) {
  # Из адреса репозитория собираем адрес будущего сайта.
  $m = [regex]::Match($Repo, 'github\.com/([^/]+)/(.+?)(\.git)?$')
  $user = $m.Groups[1].Value
  $name = $m.Groups[2].Value

  Write-Host '  ГОТОВО — файлы на GitHub.' -ForegroundColor Green
  Write-Host ''
  Write-Host '  Остался последний шаг: включить сайт.'
  Write-Host ''
  Write-Host "     1. Откройте https://github.com/$user/$name/settings/pages"
  Write-Host '     2. Source: Deploy from a branch'
  Write-Host '     3. Branch: main, папка / (root) — и Save'
  Write-Host ''
  Write-Host '  Через 1-2 минуты заработает ссылка:'
  Write-Host ''
  Write-Host "     https://$user.github.io/$name/" -ForegroundColor Yellow
  Write-Host ''
  Write-Host '  Её и раздавайте. Открывается на любом телефоне.'
} else {
  Write-Host '  ОТПРАВИТЬ НЕ УДАЛОСЬ.' -ForegroundColor Red
  Write-Host ''
  Write-Host '  Частые причины:'
  Write-Host '   - в окне входа не нажали Authorize;'
  Write-Host '   - имя репозитория отличается от указанного выше;'
  Write-Host '   - репозиторий не пустой (создан с README) — тогда выполните:'
  Write-Host '       git pull --rebase origin main'
  Write-Host '       git push -u origin main'
}
Write-Host ''
Read-Host '  Enter — закрыть окно'
