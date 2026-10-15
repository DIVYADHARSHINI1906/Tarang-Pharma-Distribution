@echo off
title Tarang Expense Intelligence Launcher
echo ====================================================================
echo Starting Tarang Expense Intelligence (Backend + Frontend Together)
echo ====================================================================

REM Set PATH for Python and Node
set "PATH=D:\swb\shell\bin;D:\swb\shell\lib\Python3.13;D:\swb\shell\lib\Python3.13\DLLs;D:\;%PATH%"
set "PYTHONPATH=%~dp0"

cd /d "%~dp0"
python run.py
pause
