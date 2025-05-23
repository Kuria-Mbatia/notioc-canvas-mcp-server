#!/bin/bash

# Notioc Canvas MCP Server - GitHub Setup Helper
echo "📤 Notioc Canvas MCP Server - GitHub Setup"
echo "========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the canvas-mcp-server directory"
    exit 1
fi

echo "✅ Running from correct directory"

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📝 Initializing git repository..."
    git init
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

# Check for .env file
if [ -f ".env" ]; then
    echo "⚠️  Found .env file - make sure it's in .gitignore"
    if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
        echo "❌ .env is not in .gitignore! This is a security risk."
        echo "   Add '.env' to your .gitignore file before committing."
        exit 1
    else
        echo "✅ .env is properly ignored in .gitignore"
    fi
fi

# Stage all files
echo "📦 Staging files for commit..."
git add .

# Check status
echo ""
echo "📊 Git status:"
git status

echo ""
echo "🚀 Ready to commit and push!"
echo ""
echo "Next steps:"
echo "1. Review the staged files above"
echo "2. Commit your changes:"
echo "   git commit -m \"Initial commit: Notioc Canvas MCP Server\""
echo ""
echo "3. Add your GitHub remote:"
echo "   git remote add origin https://github.com/notioc/canvas-mcp-server.git"
echo ""
echo "4. Push to GitHub:"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""

# Ask if user wants to proceed with commit
read -p "Do you want to commit now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📝 Creating initial commit..."
    git commit -m "Initial commit: Notioc Canvas MCP Server

Features:
- Claude Desktop integration via Model Context Protocol
- Canvas LMS API integration with 8 tools
- LlamaParse integration for document extraction  
- Privacy-first design with local processing
- Comprehensive documentation and setup guides
- Future ChatGPT integration planned"
    
    echo "✅ Commit created successfully!"
    echo ""
    echo "🔗 Now add your GitHub remote and push:"
    echo "   git remote add origin https://github.com/notioc/canvas-mcp-server.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
else
    echo "⏸️  Commit skipped. Files are staged and ready when you are!"
fi
