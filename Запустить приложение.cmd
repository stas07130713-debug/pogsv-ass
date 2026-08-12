@echo off
chcp 866 >nul
rem Запуск приложения в браузере.
rem Нужен потому, что в системе .html может быть назначен на Internet Explorer:
rem тогда двойной щелчок по index.html либо ничего не открывает, либо запускает
rem браузер, который приложение не поддерживает.

set "APP=%~dp0index.html"

set "B=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%B%" goto run
set "B=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%B%" goto run
set "B=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%B%" goto run
set "B=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%B%" goto run
set "B=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%B%" goto run
set "B=%LocalAppData%\Yandex\YandexBrowser\Application\browser.exe"
if exist "%B%" goto run
set "B=%ProgramFiles%\Mozilla Firefox\firefox.exe"
if exist "%B%" goto run

echo Не найден поддерживаемый браузер.
echo Откройте файл index.html вручную через Chrome, Edge, Firefox или Яндекс.Браузер.
pause
exit /b 1

:run
start "" "%B%" "%APP%"
exit /b 0