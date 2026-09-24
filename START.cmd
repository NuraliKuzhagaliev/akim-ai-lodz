@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" goto local_python
py -3.12 scripts\start.py %*
goto done
:local_python
".venv\Scripts\python.exe" scripts\start.py %*
:done
if errorlevel 1 pause
