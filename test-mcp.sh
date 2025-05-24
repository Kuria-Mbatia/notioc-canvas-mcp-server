#!/bin/bash

# Quick test script for MCP server
echo "🧪 Testing Notioc Canvas MCP Server..."

cd "$(dirname "$0")"

# Test 1: Check if server builds and responds
echo "1. Testing server response..."
if echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/src/server.js | grep -q "getting courses"; then
    echo "   ✅ Server responds correctly"
else
    echo "   ❌ Server not responding correctly"
    exit 1
fi

# Test 2: Check Canvas API connection
echo "2. Testing Canvas API connection..."
if echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "getting courses", "arguments": {}}}' | node dist/src/server.js 2>/dev/null | grep -q 'courses'; then
    echo "   ✅ Canvas API connection successful"
else
    echo "   ❌ Canvas API connection failed"
    exit 1
fi

echo ""
echo "🎉 All tests passed! MCP server is ready for Claude Desktop."
echo ""
echo "Next steps:"
echo "1. Restart Claude Desktop completely"
echo "2. Ask Claude: 'What Canvas courses am I enrolled in?'"
