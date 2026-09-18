@echo off
echo ======================================================
echo Iniciando Ecossistema ContabFlow All-in-One 2.0
echo ======================================================

echo [1/3] Iniciando Backend FastAPI na porta 8000...
cd /d "%~dp0backend"
start "ContabFlow Backend" "%~dp0backend\.venv\Scripts\python.exe" run.py

echo [2/3] Iniciando WhatsApp Bridge (Baileys) na porta 8085...
cd /d "%~dp0whatsapp-bridge"
start "ContabFlow WhatsApp Bridge" node server.js

echo [3/3] Iniciando Frontend Next.js 15 na porta 3000...
cd /d "%~dp0frontend"
start "ContabFlow Frontend" npm.cmd run dev

echo ======================================================
echo Todos os serviços inicializados com sucesso!
echo Frontend: http://localhost:3000
echo Backend API / Docs: http://localhost:8000/docs
echo WhatsApp QR Code: http://localhost:8085
echo ======================================================
