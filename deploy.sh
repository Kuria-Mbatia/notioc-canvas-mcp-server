#!/bin/bash

# Notioc Canvas MCP Server - Claude Desktop Setup Script
echo "🚀 Notioc Canvas MCP Server - Claude Desktop Setup"
echo "================================================="

# Load environment variables from .env file
if [ -f ".env" ]; then
    echo "📄 Loading configuration from .env file..."
    export $(grep -v '^#' .env | xargs)
fi

# Check if required environment variables are set
if [ -z "$CANVAS_BASE_URL" ] || [ -z "$CANVAS_ACCESS_TOKEN" ]; then
    echo "❌ Missing environment variables!"
    echo ""
    echo "Please ensure your .env file contains:"
    echo "CANVAS_BASE_URL='https://your-institution.instructure.com'"
    echo "CANVAS_ACCESS_TOKEN='your_canvas_api_token_here'"
    echo "LLAMA_CLOUD_API_KEY='your_llama_cloud_api_key_here'"
    echo ""
    echo "See .env.example for reference."
    exit 1
fi

# Check for LlamaParse API key
if [ -z "$LLAMA_CLOUD_API_KEY" ]; then
    echo "⚠️  Warning: LLAMA_CLOUD_API_KEY not found"
    echo "   Document content extraction may not work properly"
    echo "   Get your API key from https://cloud.llamaindex.ai/"
    echo ""
fi

echo "✅ Environment variables found"
echo "Canvas URL: $CANVAS_BASE_URL"
echo "Token: ${CANVAS_ACCESS_TOKEN:0:10}..."
if [ ! -z "$LLAMA_CLOUD_API_KEY" ]; then
    echo "LlamaParse: ${LLAMA_CLOUD_API_KEY:0:10}..."
fi
echo ""

# Build the project
echo "🔨 Building MCP server..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Test MCP server
echo "🧪 Testing MCP server..."
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/src/server.js | grep -q "getting courses"

if [ $? -eq 0 ]; then
    echo "✅ MCP server is working"
else
    echo "❌ MCP server test failed"
    exit 1
fi

echo ""

# Claude Desktop configuration
echo "🤖 Claude Desktop Configuration:"
echo ""

# Get the absolute path to the current directory
CURRENT_DIR=$(pwd)
SERVER_PATH="$CURRENT_DIR/dist/src/server.js"

echo "📋 Add this configuration to your Claude Desktop config:"
echo ""
echo "Config file locations:"
echo "  macOS: ~/Library/Application Support/Anthropic/claude/claude_desktop_config.json"
echo "  Windows: %APPDATA%\\Anthropic\\claude\\claude_desktop_config.json"
echo "  Linux: ~/.config/Anthropic/claude/claude_desktop_config.json"
echo ""
echo "Configuration to add:"
echo "{"
echo "  \"mcpServers\": {"
echo "    \"notioc-canvas\": {"
echo "      \"command\": \"node\","
echo "      \"args\": [\"$SERVER_PATH\"],"
echo "      \"env\": {"
echo "        \"CANVAS_BASE_URL\": \"$CANVAS_BASE_URL\","
echo "        \"CANVAS_ACCESS_TOKEN\": \"$CANVAS_ACCESS_TOKEN\""
if [ ! -z "$LLAMA_CLOUD_API_KEY" ]; then
echo "        ,\"LLAMA_CLOUD_API_KEY\": \"$LLAMA_CLOUD_API_KEY\""
fi
echo "      }"
echo "    }"
echo "  }"
echo "}"
echo ""

# Ask user what they want to do
read -p "What would you like to do? (1=copy config to clipboard, 2=create config file, 3=show manual setup): " choice

case $choice in
    1)
        # Try to copy to clipboard (macOS)
        if command -v pbcopy >/dev/null 2>&1; then
            CONFIG_JSON="{\n  \"mcpServers\": {\n    \"notioc-canvas\": {\n      \"command\": \"node\",\n      \"args\": [\"$SERVER_PATH\"],\n      \"env\": {\n        \"CANVAS_BASE_URL\": \"$CANVAS_BASE_URL\",\n        \"CANVAS_ACCESS_TOKEN\": \"$CANVAS_ACCESS_TOKEN\""
            if [ ! -z "$LLAMA_CLOUD_API_KEY" ]; then
                CONFIG_JSON="$CONFIG_JSON,\n        \"LLAMA_CLOUD_API_KEY\": \"$LLAMA_CLOUD_API_KEY\""
            fi
            CONFIG_JSON="$CONFIG_JSON\n      }\n    }\n  }\n}"
            echo -e "$CONFIG_JSON" | pbcopy
            echo "✅ Configuration copied to clipboard!"
            echo "Paste it into your Claude Desktop config file."
        else
            echo "❌ Clipboard not available. Please copy the configuration manually."
        fi
        ;;
    2)
        # Detect OS and create config file
        if [[ "$OSTYPE" == "darwin"* ]]; then
            CONFIG_DIR="$HOME/Library/Application Support/Anthropic/claude"
            CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
        elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
            CONFIG_DIR="$APPDATA/Anthropic/claude"
            CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
        else
            CONFIG_DIR="$HOME/.config/Anthropic/claude"
            CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
        fi
        
        echo "📁 Creating config directory: $CONFIG_DIR"
        mkdir -p "$CONFIG_DIR"
        
        CONFIG_JSON="{\n  \"mcpServers\": {\n    \"notioc-canvas\": {\n      \"command\": \"node\",\n      \"args\": [\"$SERVER_PATH\"],\n      \"env\": {\n        \"CANVAS_BASE_URL\": \"$CANVAS_BASE_URL\",\n        \"CANVAS_ACCESS_TOKEN\": \"$CANVAS_ACCESS_TOKEN\""
        if [ ! -z "$LLAMA_CLOUD_API_KEY" ]; then
            CONFIG_JSON="$CONFIG_JSON,\n        \"LLAMA_CLOUD_API_KEY\": \"$LLAMA_CLOUD_API_KEY\""
        fi
        CONFIG_JSON="$CONFIG_JSON\n      }\n    }\n  }\n}"
        
        echo -e "$CONFIG_JSON" > "$CONFIG_FILE"
        echo "✅ Configuration file created: $CONFIG_FILE"
        echo "🔄 Please restart Claude Desktop to apply the changes."
        ;;
    3)
        echo ""
        echo "📖 Manual Setup Instructions:"
        echo "1. Open your Claude Desktop config file (see paths above)"
        echo "2. Copy the JSON configuration shown above"
        echo "3. If the file is empty, paste the entire configuration"
        echo "4. If the file has existing content, merge the 'notioc-canvas' entry into the 'mcpServers' object"
        echo "5. Save the file and restart Claude Desktop"
        echo "6. You should see the Notioc Canvas tools available in Claude"
        ;;
    *)
        echo ""
        echo "❓ Invalid choice. Please run the script again and choose 1, 2, or 3."
        ;;
esac

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Restart Claude Desktop"
echo "2. Look for the Notioc Canvas tools in Claude"
echo "3. Try asking: 'Show me my Canvas courses'"
echo ""
echo "For more help, see CLAUDE-SETUP.md"
        echo "ℹ️ Run this script again and choose a valid option (1-4)"
        ;;
esac

echo ""
echo "📚 Next steps:"
echo "1. Deploy your API to get an HTTPS URL"
echo "2. Update openapi-schema.yaml with your deployment URL"
echo "3. Follow CUSTOM-GPT-SETUP.md to create your Custom GPT"
echo "4. Test with Canvas course queries!"
