@echo off
REM Start MegaETH metadata server (port 3001) + API server (port 3003)

echo Starting metadata server on port 3001...
start "Metadata Server" cmd /c "node backend/server.js"

echo Starting API server on port 3003...
node server/index.js
