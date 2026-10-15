@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 (
  echo Python launcher 'py' nao encontrado. Instale Python 3.11+.
  exit /b 1
)
if not exist data mkdir data
echo CryptoBots PAPER ONLY - nenhum dinheiro real sera movimentado.
:restart
py -3 autonomous.py --interval 3600 --state data/paper-state.json
echo O processo encerrou. Reiniciando em 30 segundos. Ctrl+C para parar.
timeout /t 30 /nobreak >nul
goto restart
