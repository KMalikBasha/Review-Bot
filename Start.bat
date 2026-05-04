@echo off
title Review Bot Launcher
cd /d "%~dp0"
PowerShell -ExecutionPolicy Bypass -File "%~dp0setup-and-start.ps1"
