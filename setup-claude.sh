#!/bin/bash

# Claude Desktop Configuration Updater
echo "🔧 Updating Claude Desktop configuration for notioc-canvas MCP server..."

# Get the current directory (project root)
PROJECT_DIR="$(pwd)"
SERVER_PATH="$PROJECT_DIR/dist/src/server.js"

# Check if the server file exists
if [ ! -f "$SERVER_PATH" ]; then
    echo "❌ Error: Server file not found at $SERVER_PATH"
    echo "   Please run 'npm run build' first to compile the TypeScript"
    exit 1
fi

# Claude Desktop config path
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

# Create Claude config directory if it doesn't exist
mkdir -p "$CLAUDE_CONFIG_DIR"

# Backup existing config if it exists
if [ -f "$CLAUDE_CONFIG_FILE" ]; then
    cp "$CLAUDE_CONFIG_FILE" "$CLAUDE_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    echo "📁 Backed up existing config to $CLAUDE_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Create the new configuration
cat > "$CLAUDE_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "notioc-canvas": {
      "command": "node",
      "args": ["$SERVER_PATH"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
EOF

echo "✅ Claude Desktop configuration updated!"
echo "📍 Server path: $SERVER_PATH"
echo "🔄 Please restart Claude Desktop to apply the changes"
echo ""
echo "📖 To verify the configuration:"
echo "   cat '$CLAUDE_CONFIG_FILE'"
echo ""
echo "🧪 To test the server manually:"
echo "   node '$SERVER_PATH'"
