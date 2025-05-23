#!/bin/bash

# Notioc Canvas MCP Server Installation Script
# This script helps set up the MCP server for Claude Desktop integration

set -e

echo "🚀 Notioc Canvas MCP Server Installation"
echo "========================================"
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old!"
    echo "Please upgrade to Node.js 18+ from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Build the project
echo "🔨 Building the project..."
npm run build
echo "✅ Project built successfully"
echo ""

# Configuration setup
echo "⚙️  Setting up configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from template"
else
    echo "⚠️  .env file already exists, keeping current configuration"
fi
echo ""

# Prompt for Canvas configuration
echo "🎯 Canvas Configuration"
echo "----------------------"
echo "You need to configure your Canvas API credentials."
echo ""

read -p "Enter your Canvas base URL (e.g., https://university.instructure.com): " CANVAS_URL
read -p "Enter your Canvas API token: " CANVAS_TOKEN

# Validate inputs
if [ -z "$CANVAS_URL" ] || [ -z "$CANVAS_TOKEN" ]; then
    echo "❌ Canvas URL and token are required!"
    echo "Please run the installation again with valid credentials."
    exit 1
fi

# Prompt for LlamaParse API key (optional)
echo ""
echo "🔍 LlamaParse Configuration (Optional)"
echo "-------------------------------------"
echo "LlamaParse is used for advanced document text extraction."
echo "Get your API key from https://cloud.llamaindex.ai/"
echo ""

read -p "Enter your LlamaParse API key (press Enter to skip): " LLAMA_API_KEY

# Remove trailing slash from URL if present
CANVAS_URL=$(echo "$CANVAS_URL" | sed 's/\/$//')

# Update .env file
cat > .env << EOF
# Notioc Canvas MCP Server Configuration
CANVAS_BASE_URL=$CANVAS_URL
CANVAS_ACCESS_TOKEN=$CANVAS_TOKEN

# LlamaParse API key for document extraction
LLAMA_CLOUD_API_KEY=$LLAMA_API_KEY

# Optional: Development settings
NODE_ENV=production
DEBUG=false
EOF

echo "✅ Configuration saved to .env file"
echo ""

# Test the configuration
echo "🧪 Testing Canvas connection..."
if npm run test; then
    echo ""
    echo "🎉 Installation completed successfully!"
    echo ""
    echo "Next steps:"
    echo "----------"
    echo "1. Configure Claude Desktop:"
    echo "   • Run: ./deploy.sh for guided Claude Desktop setup"
    echo "   • Or see CLAUDE-SETUP.md for manual configuration"
    echo ""
    echo "2. Your MCP server is located at:"
    echo "   $(pwd)/dist/src/server.js"
    echo ""
    echo "3. Test commands to try in Claude:"
    echo "   • 'What courses am I enrolled in?'"
    echo "   • 'Show me assignments for my [course name] course'"
    echo "   • 'Find files about [topic] in my courses'"
    echo ""
    echo "For support, visit: https://github.com/notioc/canvas-mcp-server"
else
    echo ""
    echo "❌ Configuration test failed!"
    echo ""
    echo "Common issues:"
    echo "• Check your Canvas base URL (should not end with /)"
    echo "• Verify your API token is correct and not expired"
    echo "• Ensure you have access to Canvas and are enrolled in courses"
    echo ""
    echo "You can manually test later with: npm run test"
fi
