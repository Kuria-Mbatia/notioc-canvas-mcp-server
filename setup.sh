#!/bin/bash

# Notioc Canvas MCP Server - Production Setup Script
# This script helps set up the MCP server for Claude Desktop integration

set -e  # Exit on any error

echo "🚀 Notioc Canvas MCP Server - Production Setup"
echo "=============================================="
echo ""
echo -e "${BLUE}📱 First time using Terminal?${NC}"
echo "No worries! Just follow along - we'll guide you through everything."
echo "You can copy and paste commands, and we'll explain each step."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Pre-flight system checks
echo -e "${YELLOW}🔍 Step 0: System Requirements Check${NC}"

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/ (version 18 or higher)"
    exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//')
MIN_VERSION="18.0.0"
if [ "$(printf '%s\n' "$MIN_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$MIN_VERSION" ]; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION is too old (minimum: $MIN_VERSION)${NC}"
    echo "Please update Node.js from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version $NODE_VERSION (compatible)${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not available${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm is available${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the notioc-canvas-mcp-server directory${NC}"
    echo "Current directory: $(pwd)"
    echo "Make sure you've downloaded and extracted the project files first."
    exit 1
fi

echo -e "${GREEN}✅ Running from correct directory${NC}"
echo ""

# Function to prompt for input with validation
prompt_for_input() {
    local prompt="$1"
    local var_name="$2"
    local validation_regex="$3"
    local error_message="$4"
    
    while true; do
        echo -e "${BLUE}$prompt${NC}"
        read -r input
        
        if [[ $input =~ $validation_regex ]]; then
            eval "$var_name='$input'"
            break
        else
            echo -e "${RED}$error_message${NC}"
        fi
    done
}

# Function to show Canvas API token instructions
show_canvas_instructions() {
    echo -e "${BLUE}📋 How to get your Canvas API Token:${NC}"
    echo ""
    echo -e "${YELLOW}🎓 Need visual help? Check our documentation:${NC}"
    echo "   • README.md has screenshots and step-by-step guides"
    echo "   • Look for the 'Canvas API Token Setup' section"
    echo ""
    echo "Step-by-step instructions:"
    echo "1. Log in to your Canvas account"
    echo "2. Go to Account → Settings"
    echo "3. Scroll down to 'Approved Integrations'"
    echo "4. Click '+ New Access Token'"
    echo "5. Enter a purpose (e.g., 'Claude MCP Integration')"
    echo "6. Click 'Generate Token'"
    echo "7. Copy the token (starts with a number, then ~, then letters)"
    echo ""
    echo -e "${YELLOW}⚠️  Important: You need Canvas admin/teacher permissions to create API tokens${NC}"
    echo "   If you're a student, ask your IT department or instructor for help."
    echo ""
}

# Step 1: Install dependencies and build
echo -e "${YELLOW}📦 Step 1: Installing dependencies and building...${NC}"
npm install
npm run build

if [ ! -f "dist/src/server.js" ]; then
    echo -e "${RED}❌ Build failed - dist/src/server.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"
echo ""

# Step 2: Environment configuration
echo -e "${YELLOW}🔧 Step 2: Environment Configuration${NC}"

# Check if .env already exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file already exists${NC}"
    echo "Do you want to:"
    echo "1) Keep existing .env file"
    echo "2) Reconfigure .env file"
    read -p "Enter choice (1 or 2): " choice
    
    if [ "$choice" = "2" ]; then
        rm .env
        configure_env=true
    else
        configure_env=false
    fi
else
    configure_env=true
fi

if [ "$configure_env" = true ]; then
    echo "Setting up environment variables..."
    echo ""
    echo -e "${BLUE}🔧 We need two pieces of information from Canvas:${NC}"
    echo "1. Your Canvas website URL"
    echo "2. Your Canvas API token (like a password for programs)"
    echo ""
    
    # Show Canvas instructions first
    show_canvas_instructions
    
    # Canvas Base URL
    prompt_for_input \
        "Enter your Canvas instance URL (e.g., https://university.instructure.com):" \
        "canvas_url" \
        "^https://.*\.instructure\.com/?$" \
        "Please enter a valid Canvas URL (must start with https:// and end with .instructure.com)"
    
    # Remove trailing slash if present
    canvas_url=${canvas_url%/}
    
    # Canvas Access Token
    prompt_for_input \
        "Enter your Canvas API token:" \
        "canvas_token" \
        "^[0-9]+~[A-Za-z0-9]+$" \
        "Please enter a valid Canvas API token (format: number~letters)"
    
    # LlamaParse API Key
    echo -e "${BLUE}Enter your LlamaParse API key (leave empty to skip):${NC}"
    read -r llama_key
    
    # Create .env file
    cat > .env << EOF
# Notioc Canvas MCP Server Configuration
# Generated by setup script on $(date)

# Canvas API Configuration (REQUIRED)
CANVAS_BASE_URL=$canvas_url
CANVAS_ACCESS_TOKEN=$canvas_token

# LlamaParse API Configuration (OPTIONAL - for document extraction)
EOF
    
    if [ -n "$llama_key" ]; then
        echo "LLAMA_CLOUD_API_KEY=$llama_key" >> .env
    else
        echo "# LLAMA_CLOUD_API_KEY=your_llama_cloud_api_key_here" >> .env
    fi
    
    echo "" >> .env
    echo "# Development settings" >> .env
    echo "NODE_ENV=production" >> .env
    echo "DEBUG=false" >> .env
    
    echo -e "${GREEN}✅ .env file created successfully${NC}"
fi

# Step 3: Test the server
echo -e "${YELLOW}🧪 Step 3: Testing MCP server...${NC}"
echo "   Testing server build and Canvas API connection..."

# Test server response
TEST_OUTPUT=$(echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/src/server.js 2>&1)
if echo "$TEST_OUTPUT" | grep -q "get_courses"; then
    echo -e "${GREEN}✅ MCP server test successful${NC}"
    echo "   Found all 8 Canvas tools available"
else
    echo -e "${RED}❌ MCP server test failed${NC}"
    echo ""
    echo -e "${YELLOW}🔍 Troubleshooting Information:${NC}"
    echo "Server output:"
    echo "$TEST_OUTPUT"
    echo ""
    echo -e "${BLUE}Common issues:${NC}"
    echo "• Check Canvas URL (should not end with /)"
    echo "• Verify Canvas API token is correct and not expired"
    echo "• Ensure you have Canvas course access"
    echo "• Token should have format: 12345~AbC123XyZ..."
    echo ""
    echo "Please check your Canvas credentials and try again."
    exit 1
fi

# Step 4: Claude Desktop configuration
echo ""
echo -e "${YELLOW}⚙️  Step 4: Claude Desktop Configuration${NC}"

# Get absolute path
PROJECT_PATH=$(pwd)

# Function to find Claude Desktop config location
find_claude_config() {
    local potential_paths=()
    
    # Detect OS and add potential paths
    case "$(uname -s)" in
        Darwin*)    # macOS
            potential_paths+=(
                "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
                "$HOME/Library/Application Support/Anthropic/claude/claude_desktop_config.json"
            )
            ;;
        Linux*)     # Linux
            potential_paths+=(
                "$HOME/.config/Claude/claude_desktop_config.json"
                "$HOME/.config/Anthropic/claude/claude_desktop_config.json"
                "$HOME/.local/share/Claude/claude_desktop_config.json"
            )
            ;;
        CYGWIN*|MINGW*|MSYS*)    # Windows
            potential_paths+=(
                "$APPDATA/Claude/claude_desktop_config.json"
                "$APPDATA/Anthropic/claude/claude_desktop_config.json"
                "$LOCALAPPDATA/Claude/claude_desktop_config.json"
            )
            ;;
        *)
            echo -e "${RED}❌ Unsupported operating system: $(uname -s)${NC}"
            echo "Please manually configure Claude Desktop using the instructions in README.md"
            exit 1
            ;;
    esac
    
    # Check if any config file already exists
    for path in "${potential_paths[@]}"; do
        if [ -f "$path" ]; then
            echo "$path"
            return 0
        fi
    done
    
    # If no existing config found, check for directories and use the first valid one
    for path in "${potential_paths[@]}"; do
        local dir=$(dirname "$path")
        if [ -d "$dir" ] || mkdir -p "$dir" 2>/dev/null; then
            echo "$path"
            return 0
        fi
    done
    
    # Fallback to first path if we can't create any
    echo "${potential_paths[0]}"
}

# Find Claude config path
CLAUDE_CONFIG_PATH=$(find_claude_config)
echo -e "${BLUE}🔍 Claude Desktop config location:${NC} $CLAUDE_CONFIG_PATH"

# Verify or create the config directory
CLAUDE_CONFIG_DIR=$(dirname "$CLAUDE_CONFIG_PATH")
if [ ! -d "$CLAUDE_CONFIG_DIR" ]; then
    echo -e "${YELLOW}📁 Creating Claude config directory...${NC}"
    if mkdir -p "$CLAUDE_CONFIG_DIR" 2>/dev/null; then
        echo -e "${GREEN}✅ Directory created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create directory: $CLAUDE_CONFIG_DIR${NC}"
        echo ""
        echo -e "${BLUE}💡 Troubleshooting:${NC}"
        echo "• Check if Claude Desktop is installed"
        echo "• Try running Claude Desktop once to create config directories"
        echo "• Check file permissions in your home directory"
        echo ""
        echo "Manual setup instructions:"
        echo "1. Create directory: mkdir -p \"$CLAUDE_CONFIG_DIR\""
        echo "2. Create config file manually using README.md instructions"
        exit 1
    fi
fi

# Generate Claude config
echo "Do you want to:"
echo "1) Use .env file for credentials (More Secure - Recommended)"
echo "2) Put credentials directly in Claude config (Less Secure)"
read -p "Enter choice (1 or 2): " config_choice

if [ "$config_choice" = "1" ]; then
    # Secure option - use .env file
    CLAUDE_CONFIG=$(cat << EOF
{
  "mcpServers": {
    "notioc-canvas": {
      "command": "node",
      "args": ["$PROJECT_PATH/dist/src/server.js"],
      "cwd": "$PROJECT_PATH"
    }
  }
}
EOF
)
else
    # Load from .env file for the config
    source .env
    CLAUDE_CONFIG=$(cat << EOF
{
  "mcpServers": {
    "notioc-canvas": {
      "command": "node",
      "args": ["$PROJECT_PATH/dist/src/server.js"],
      "cwd": "$PROJECT_PATH",
      "env": {
        "CANVAS_BASE_URL": "$CANVAS_BASE_URL",
        "CANVAS_ACCESS_TOKEN": "$CANVAS_ACCESS_TOKEN"$([ -n "$LLAMA_CLOUD_API_KEY" ] && echo ",
        \"LLAMA_CLOUD_API_KEY\": \"$LLAMA_CLOUD_API_KEY\"")
      }
    }
  }
}
EOF
)
fi

# Backup existing config if it exists
if [ -f "$CLAUDE_CONFIG_PATH" ]; then
    echo "Backing up existing Claude config..."
    cp "$CLAUDE_CONFIG_PATH" "${CLAUDE_CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Write new config
echo "$CLAUDE_CONFIG" > "$CLAUDE_CONFIG_PATH"
echo -e "${GREEN}✅ Claude Desktop configuration updated${NC}"

# Step 5: Final instructions and troubleshooting
echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. ${BLUE}Restart Claude Desktop completely${NC}"
echo "   - Close Claude Desktop entirely (⌘+Q on Mac)"
echo "   - Wait 5 seconds"
echo "   - Reopen Claude Desktop"
echo "   - Wait 10-15 seconds for MCP servers to initialize"
echo ""
echo "2. ${BLUE}Test the integration${NC}"
echo "   Try asking Claude: 'What Canvas courses am I enrolled in?'"
echo "   Or: 'Show me my assignments'"
echo ""
echo "3. ${BLUE}Configuration Summary:${NC}"
echo "   • MCP Server: $PROJECT_PATH/dist/src/server.js"
echo "   • Config file: $CLAUDE_CONFIG_PATH"
echo "   • Environment: $([ -f ".env" ] && echo ".env file" || echo "embedded credentials")"
echo ""
echo "4. ${BLUE}If you encounter issues:${NC}"
echo ""
echo "   ${YELLOW}🔍 Common Problems & Solutions:${NC}"
echo "   • Claude doesn't see Canvas tools:"
echo "     → Restart Claude Desktop completely"
echo "     → Check config file exists: ls -la \"$CLAUDE_CONFIG_PATH\""
echo "     → Verify JSON syntax is valid"
echo ""
echo "   • 'Canvas API error' messages:"
echo "     → Check Canvas URL and token in .env file"
echo "     → Test with: curl -H \"Authorization: Bearer \$CANVAS_ACCESS_TOKEN\" \"\$CANVAS_BASE_URL/api/v1/courses\""
echo "     → Ensure token has proper permissions"
echo ""
echo "   • 'Permission denied' errors:"
echo "     → Check file permissions: ls -la $PROJECT_PATH/dist/src/server.js"
echo "     → Ensure Claude can access the project directory"
echo ""
echo "   ${YELLOW}📊 Debug Commands:${NC}"
echo "   • Test MCP server: echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}' | node dist/src/server.js"
echo "   • Check logs: tail -f ~/Library/Logs/Claude/mcp-server-notioc-canvas.log"
echo "   • Verify Canvas API: ./verify.sh"
echo ""
echo "   ${YELLOW}📚 Additional Help:${NC}"
echo "   • Full documentation: README.md"
echo "   • Troubleshooting guide: README.md (Troubleshooting section)"
echo "   • Report issues: https://github.com/notioc/canvas-mcp-server/issues"
echo ""
echo -e "${GREEN}Happy learning with your Canvas MCP server! 🎓✨${NC}"
