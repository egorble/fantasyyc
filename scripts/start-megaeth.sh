#!/bin/bash
# Start MegaETH API backend (port 3004) + metadata server (port 3002)
# The Etherlink backend runs on port 3003 + metadata on port 3001 (defaults)

echo "Starting MegaETH metadata server on port 3002..."
PORT=3002 RPC_URL=https://carrot.megaeth.com/rpc NFT_CONTRACT_ADDRESS=0x45E817D93915D484bac01d27E26d19F30715B6Bc node backend/server.js &

echo "Starting MegaETH API server on port 3004..."
CHAIN_NETWORK=megaeth PORT=3004 node server/index.js
