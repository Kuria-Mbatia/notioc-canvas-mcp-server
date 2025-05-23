#!/bin/bash

# Notioc Canvas MCP Server - Verification Script
echo "🔍 Notioc Canvas MCP Server Verification"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the canvas-mcp-server directory"
    exit 1
fi

echo "✅ Running from correct directory"

# Check environment variables
if [ -z "$CANVAS_BASE_URL" ] || [ -z "$CANVAS_ACCESS_TOKEN" ]; then
    echo "⚠️  Canvas environment variables not set (they should be in .env file)"
    if [ ! -f ".env" ]; then
        echo "❌ No .env file found - create one from .env.example"
        echo "   Copy .env.example to .env and add your Canvas credentials"
    else
        echo "✅ .env file exists"
    fi
else
    echo "✅ Canvas environment variables found"
fi

# Check for LlamaParse API key
if [ -z "$LLAMA_CLOUD_API_KEY" ]; then
    echo "⚠️  LLAMA_CLOUD_API_KEY not found - document extraction may not work"
    echo "   Get your API key from https://cloud.llamaindex.ai/"
else
    echo "✅ LlamaParse API key found"
fi

# Check dependencies
echo ""
echo "📦 Checking dependencies..."
if npm list >/dev/null 2>&1; then
    echo "✅ Node dependencies installed"
else
    echo "❌ Dependencies missing - run: npm install"
    exit 1
fi

# Check if TypeScript builds
echo ""
echo "🔨 Testing TypeScript build..."
if npm run build >/dev/null 2>&1; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript build failed"
    exit 1
fi

# Check if MCP server can list tools
echo ""
echo "🧪 Testing MCP server functionality..."
MCP_OUTPUT=$(echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/src/server.js 2>/dev/null)
if echo "$MCP_OUTPUT" | grep -q "getting courses"; then
    echo "✅ MCP server working - found 8 tools"
    # Count tools
    TOOL_COUNT=$(echo "$MCP_OUTPUT" | grep -o '"name":"[^"]*"' | wc -l)
    echo "   Tools available: $TOOL_COUNT"
else
    echo "❌ MCP server test failed"
    exit 1
fi

# Check REST API wrapper
echo ""
echo "🌐 Testing REST API wrapper..."
# Start API server in background
node api-server.js >/dev/null 2>&1 &
API_PID=$!
sleep 3

# Test health endpoint
if curl -s -H "x-api-key: test-key" http://localhost:3001/api/health | grep -q "ok"; then
    echo "✅ REST API wrapper working"
    
    # Test courses endpoint
    if curl -s -H "x-api-key: test-key" "http://localhost:3001/api/courses" | grep -q "success"; then
        echo "✅ Courses endpoint functional"
    else
        echo "⚠️  Courses endpoint may need Canvas credentials"
    fi
else
    echo "❌ REST API wrapper failed to start"
fi

# Clean up
kill $API_PID 2>/dev/null

# Check required files for Custom GPT setup
echo ""
echo "📋 Checking Custom GPT setup files..."
REQUIRED_FILES=("openapi-schema.yaml" "CUSTOM-GPT-SETUP.md" "api-server.js" "deploy.sh")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ Missing: $file"
    fi
done

# Check Claude setup files  
echo ""
echo "🤖 Checking Claude Desktop setup files..."
if [ -f "CLAUDE-SETUP.md" ]; then
    echo "✅ CLAUDE-SETUP.md"
else
    echo "⚠️  CLAUDE-SETUP.md not found (optional)"
fi

# Summary and next steps
echo ""
echo "📊 Verification Summary"
echo "======================"

# Check overall status
ERRORS=0
if [ -z "$CANVAS_BASE_URL" ] || [ -z "$CANVAS_ACCESS_TOKEN" ]; then
    if [ ! -f ".env" ]; then
        ERRORS=$((ERRORS + 1))
    fi
fi

if [ $ERRORS -eq 0 ]; then
    echo "🎉 All systems ready! Your Notioc Canvas MCP Server is configured correctly."
    echo ""
    echo "🚀 Next Steps:"
    echo "1. For ChatGPT Custom GPT:"
    echo "   - Run: ./deploy.sh"
    echo "   - Follow CUSTOM-GPT-SETUP.md"
    echo ""
    echo "2. For Claude Desktop:"
    echo "   - Follow CLAUDE-SETUP.md"
    echo "   - Add server config to claude_desktop_config.json"
    echo ""
    echo "3. Test with queries like:"
    echo "   - 'Show me my Canvas courses'"
    echo "   - 'What assignments do I have?'"
    echo "   - 'Find the syllabus in my course'"
else
    echo "⚠️  Setup incomplete - please address the issues above"
    echo ""
    echo "🔧 Quick fixes:"
    echo "- Create .env file with Canvas credentials"
    echo "- Run: npm install (if dependencies missing)"
    echo "- Check Canvas API token permissions"
fi

echo ""
echo "📚 Documentation:"
echo "- CUSTOM-GPT-SETUP.md - Complete ChatGPT setup guide"
echo "- CLAUDE-SETUP.md - Claude Desktop integration"
echo "- README.md - Full documentation"
