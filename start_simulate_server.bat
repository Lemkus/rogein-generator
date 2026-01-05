@echo off
title Audio Navigation Simulator Server
cls

echo ============================================================
echo.
echo        AUDIO NAVIGATION SIMULATOR SERVER
echo.
echo        Test navigation sounds interactively!
echo.
echo ============================================================
echo.

echo Starting server for audio-navigation-simulator.html...
echo.
echo Server will be available at: http://localhost:8000
echo Simulator: http://localhost:8000/audio-navigation-simulator.html
echo.
echo Quick Guide:
echo   - Use Arrow Keys or WASD to move the player
echo   - Click on canvas to teleport  
echo   - Navigate to yellow targets in order
echo   - Audio feedback helps guide you
echo   - Press Space to test sound
echo.
echo Press Ctrl+C to stop the server
echo.
echo ============================================================
echo.

REM Try to use the Python script first (better features)
python start_simulate_server.py 2>NUL

REM If Python script fails, fall back to basic server
if errorlevel 1 (
    echo Python script failed, trying basic HTTP server...
    echo.
    python -m http.server 8000
    
    REM If Python not found, try with python3
    if errorlevel 1 (
        python3 -m http.server 8000
    )
)

pause
