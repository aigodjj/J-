
@echo off
setlocal
title JGamers Platform Fighter - Git Push

set "PROJECT_DIR=D:\develop-3d-platform-fighter"

echo ==========================================
echo   JGamers Platform Fighter - GitHub Push
echo ==========================================
echo.

if not exist "%PROJECT_DIR%\package.json" (
    echo [ERROR] Cannot find package.json:
    echo %PROJECT_DIR%
    pause
    exit /b 1
)

cd /d "%PROJECT_DIR%"

echo Project: %CD%
echo.

where git
if errorlevel 1 (
    echo [ERROR] Git command not found.
    pause
    exit /b 1
)

echo.
echo Checking Git repository...

git status
if errorlevel 1 (
    echo [ERROR] Git status failed.
    pause
    exit /b 1
)

echo.
echo GitHub remote:
git remote -v

echo.
echo Changed files:
git status --short

echo.
set /p "confirm=Continue and push these changes? (Y/N): "

if /i not "%confirm%"=="Y" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo [1/3] Adding files...
git add -A

if errorlevel 1 (
    echo [ERROR] git add failed.
    pause
    exit /b 1
)

git diff --cached --quiet

if not errorlevel 1 (
    echo Nothing to commit.
    pause
    exit /b 0
)

echo.
set /p "commitmsg=Commit message (Enter for Update game): "

if "%commitmsg%"=="" set "commitmsg=Update game"

echo.
echo [2/3] Creating commit...
git commit -m "%commitmsg%"

if errorlevel 1 (
    echo [ERROR] Commit failed.
    pause
    exit /b 1
)

echo.
echo [3/3] Pushing to GitHub...
git push origin HEAD

if errorlevel 1 (
    echo [ERROR] Push failed. Commit is saved locally.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   PUSH SUCCESSFUL!
echo   Vercel deployment should start.
echo ==========================================
pause
