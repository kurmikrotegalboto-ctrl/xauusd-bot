@echo off
REM ============================================================
REM XAUUSD Bot - Push ke GitHub (Windows CMD)
REM Klik 2x file ini untuk jalan, atau jalankan di Command Prompt
REM ============================================================
setlocal enabledelayedexpansion

echo ============================================================
echo   XAUUSD Bot - Push ke GitHub
echo ============================================================
echo.
echo Pastikan:
echo   1. Git sudah terinstall (https://git-scm.com/download/win)
echo   2. Bundle xauusd-bot-bundle.tar.gz sudah di-extract
echo      (klik kanan file .tar.gz ^> 7-Zip ^> Extract here,
echo       atau buka dengan WinRAR/WinZIP)
echo   3. Anda sudah buat repo kosong di GitHub
echo      (https://github.com/new - JANGAN centang README)
echo   4. Ada Personal Access Token dari GitHub
echo      (https://github.com/settings/tokens - scope: repo)
echo.
pause

REM Cari folder hasil extract
set "BOTDIR=xauusd-bot"
if not exist "%BOTDIR%" (
  echo.
  echo ERROR: Folder '%BOTDIR%' tidak ditemukan di sini.
  echo Extract dulu file xauusd-bot-bundle.tar.gz di folder ini.
  echo.
  pause
  exit /b 1
)

cd "%BOTDIR%"
echo.
echo Masuk ke folder: %CD%
echo.

REM Minta input dari user
set /p GH_USER="GitHub username (contoh: johndoe): "
set /p GH_TOKEN="Personal Access Token (ghp_xxx...): "
set /p REPO_NAME="Repository name (Enter untuk default 'xauusd-bot'): "
if "%REPO_NAME%"=="" set "REPO_NAME=xauusd-bot"

echo.
echo Memambahkan remote...
git remote remove origin 2>nul
git remote add origin "https://%GH_USER%:%GH_TOKEN%@github.com/%GH_USER%/%REPO_NAME%.git"

echo.
echo Pushing ke GitHub...
git push -u origin main

if errorlevel 1 (
  echo.
  echo ============================================================
  echo   PUSH GAGAL!
  echo ============================================================
  echo Cek error di atas. Penyebab umum:
  echo   - Token salah / expired
  echo   - Token tidak punya scope 'repo'
  echo   - Repo '%REPO_NAME%' belum dibuat di GitHub
  echo   - Repo sudah ada isinya (bukan kosong)
  echo.
  pause
  exit /b 1
)

REM Bersihkan token dari git config (security)
git remote set-url origin "https://github.com/%GH_USER%/%REPO_NAME%.git"

echo.
echo ============================================================
echo   PUSH BERHASIL!
echo ============================================================
echo.
echo Repository: https://github.com/%GH_USER%/%REPO_NAME%
echo.
echo NEXT: Deploy gratis ke Render
echo   1. Buka https://upstash.com ^> Sign up ^> Create Redis DB
echo      Copy URL: rediss://default:PASSWORD@HOST:PORT
echo   2. Buka https://render.com ^> Sign up with GitHub
echo      New + ^> Blueprint ^> pilih repo '%REPO_NAME%'
echo   3. Set variables di Render:
echo      REDIS_URL = (URL Upstash tadi)
echo      TWELVEDATA_API_KEY = 2f7f8b157aee4c619ce29f293d34b1cd
echo   4. Tunggu 3-5 menit, buka URL Render
echo.
pause
