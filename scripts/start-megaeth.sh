#!/bin/bash
# Start MegaETH metadata server (port 3001) + API server (port 3003)

echo "Starting metadata server on port 3001..."
node backend/server.js &

echo "Starting API server on port 3003..."
node server/index.js
