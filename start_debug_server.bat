@echo off
echo Starting local HTTP server for audio-debug.html...
echo.
echo Server will be available at: http://localhost:8000
echo Open in browser: http://localhost:8000/audio-debug.html
echo.
echo Press Ctrl+C to stop the server
echo.

python -m http.server 8000

