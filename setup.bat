@echo off
REM HS Code Expert - Setup Script for Windows

echo.
echo ========================================
echo  HS Code Expert - Installation Guide
echo ========================================
echo.

echo Step 1: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is NOT installed
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/ (Download v18+ LTS)
    echo.
    echo After installation, run this script again.
    pause
    exit /b 1
) else (
    echo ✓ Node.js found:
    node --version
    npm --version
    echo.
)

echo Step 2: Installing dependencies...
call npm install
if errorlevel 1 (
    echo ❌ npm install failed
    pause
    exit /b 1
)
echo ✓ Dependencies installed successfully
echo.

echo Step 3: Verifying PDF file...
if exist "Customs Tariff of India.pdf" (
    echo ✓ PDF file found
) else (
    echo ⚠️  Warning: PDF file not found in current directory
    echo   Make sure "Customs Tariff of India.pdf" is in this folder
)
echo.

echo Step 4: Environment setup...
if exist ".env" (
    echo ✓ .env file exists with Gemini API key configured
) else (
    echo ⚠️  .env file not found
)
echo.

echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo To start the server, run:
echo   npm start
echo.
echo Then open your browser to:
echo   http://localhost:3000
echo.
pause
