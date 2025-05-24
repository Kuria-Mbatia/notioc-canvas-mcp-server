# Notioc Canvas MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with access to Canvas LMS data. Currently optimized for Claude Desktop with local integration.

> ⚠️ **IMPORTANT**: This project requires you to use your own API keys, including a Canvas API token and LlamaParse API key. Never share your `.env` file or API keys with others.

## ✨ Features

- **📚 Course Management**: List and access Canvas courses
- **📄 Pages & Content**: Browse and read course pages with full content
- **💬 Discussions**: Access discussion topics and announcements  
- **📝 Assignment Access**: Retrieve assignment details and requirements
- **📁 File System**: Search and access course files with intelligent matching
- **🔍 Content Extraction**: Read PDFs, documents, and text files with LlamaParse
- **🔒 Secure Authentication**: Uses your Canvas API tokens for maximum privacy
- **🤖 Privacy-First Design**: 100% local processing with Claude Desktop
- **🚀 Enhanced Setup**: Intelligent config detection and comprehensive troubleshooting
- **🛠️ Beginner-Friendly**: Step-by-step guidance with Terminal newcomer support

## 🚀 Quick Start

### Claude Desktop Integration

## 🚀 Quick Start

### Automated Setup (Recommended)
```bash
# 1. Clone and enter directory
git clone https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server.git
cd notioc-canvas-mcp-server

# 2. Run enhanced production setup script
./setup.sh

# 3. Restart Claude Desktop and test with: "What Canvas courses am I enrolled in?"
```

> ✨ **New in v2.0**: Enhanced setup script with automatic Claude Desktop config detection, comprehensive troubleshooting, and beginner-friendly guidance!

> 🔧 **No Node.js?** The setup script will detect if Node.js is missing and provide OS-specific installation instructions to get you started quickly.

### Manual Setup
For local development with privacy-focused processing:

```bash
# 1. Setup and build
npm install && npm run build

# 2. Configure .env file
cp .env.example .env
# Edit .env with your Canvas API token and LlamaParse API key

# 3. Configure Claude Desktop (see detailed instructions below)
```

### What Makes Our Setup Special?

🎯 **Smart Configuration Detection**
- Automatically finds Claude Desktop config across different OS and installation types
- Handles multiple potential config locations gracefully
- Creates necessary directories with proper permissions

🔍 **Enhanced Troubleshooting**
- Detailed error messages with specific solutions
- Real-time validation of Canvas API connectivity
- Comprehensive system requirements checking

🛡️ **Security Best Practices**
- Recommends secure `.env` file usage over embedded credentials
- Validates token formats and API connectivity
- Automatic config file backups

👥 **Beginner-Friendly Experience**
- Terminal newcomer guidance and explanations
- Step-by-step Canvas API token instructions
- Clear next steps and success indicators

# 3. Configure Claude Desktop
# Follow steps in the Usage section below
```

## 🛠️ Installation

### 1. Prerequisites

**System Requirements:**
- **Node.js 18+**: JavaScript runtime for the MCP server
- **Canvas LMS access**: With API token generation permissions
- **Claude Desktop**: Latest version installed
- **LlamaParse API key**: For document content extraction (optional)

**🚀 First Time? No Problem!**
> Our setup script automatically checks for Node.js and provides installation guidance if needed. Just run `./setup.sh` and follow the prompts!

#### Installing Node.js (For Beginners)

**🎯 Easiest Method: Official Installer**
1. Visit [nodejs.org](https://nodejs.org/)
2. Download the **LTS (Long Term Support)** version
3. Run the installer and follow the prompts
4. Works on Windows, macOS, and Linux

**Alternative Methods:**

<details>
<summary>📱 macOS Installation Options</summary>

```bash
# Option 1: Homebrew (if you have it)
brew install node

# Option 2: MacPorts (if you have it)
sudo port install nodejs18

# Option 3: Node Version Manager (for developers)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```
</details>

<details>
<summary>🐧 Linux Installation Options</summary>

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install nodejs npm

# RHEL/CentOS/Fedora
sudo dnf install nodejs npm

# Arch Linux
sudo pacman -S nodejs npm

# Using Node Version Manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```
</details>

<details>
<summary>🪟 Windows Installation Options</summary>

```bash
# Official installer (recommended)
# Download from https://nodejs.org/

# Chocolatey package manager
choco install nodejs

# Winget package manager
winget install OpenJS.NodeJS

# Node Version Manager for Windows
# Visit: https://github.com/coreybutler/nvm-windows
```
</details>

**Verify Installation:**
```bash
# Check if Node.js is installed
node --version

# Check if npm is available
npm --version
```

### 2. Installation

```bash
# Clone or download this directory
cd mcp-server

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

### 3. Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Edit `.env` with your Canvas and LlamaParse credentials:
```env
# Notioc Canvas MCP Server Configuration
CANVAS_BASE_URL=https://your-canvas-instance.instructure.com
CANVAS_ACCESS_TOKEN=your-canvas-access-token-here
LLAMA_CLOUD_API_KEY=your-llama-cloud-api-key-here
```

### 4. Get Your Canvas API Token

1. Log into your Canvas instance
2. Go to Account → Settings
3. Scroll down to "Approved Integrations"
4. Click "+ New Access Token"
5. Give it a purpose name (e.g., "Notioc MCP Server")
6. Copy the generated token to your `.env` file

### 5. Get Your LlamaParse API Key

1. Sign up at https://cloud.llamaindex.ai/
2. Generate an API key from your account
3. Copy the API key to your `.env` file (LLAMA_CLOUD_API_KEY)

## 🔧 Available Tools

The Notioc Canvas MCP Server provides 8 tools with MCP-compliant names:

| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `get_courses` | List your Canvas courses | "Show me my active courses" |
| `get_pages` | Get pages in a course | "What pages are in my English course?" |
| `read_page` | Read a specific page | "Read the syllabus page" |
| `get_discussions` | List course discussions | "Show me the announcements" |
| `read_discussion` | Read a discussion topic | "What's in the latest announcement?" |
| `get_assignments` | Get course assignments | "What assignments do I have?" |
| `find_files` | Search for course files | "Find all PDF files" |
| `read_file` | Read file content | "Read the homework instructions" |

### 5. Test the Server

```bash
# Test the MCP server locally
npm run test

# Or test with a simple request
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/src/server.js
```

## 📝 Usage with Claude Desktop

### Production-Level Setup Guide

#### Step 1: Complete Installation & Build
```bash
# Ensure you're in the project directory
cd /path/to/notioc-canvas-mcp-server

# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Verify build completed successfully
ls -la dist/src/server.js
```

#### Step 2: Configure Environment Variables

**Option A: Using .env file (Recommended)**
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

Your `.env` file should contain:
```env
CANVAS_BASE_URL=https://your-institution.instructure.com
CANVAS_ACCESS_TOKEN=your_canvas_api_token_here
LLAMA_CLOUD_API_KEY=your_llama_cloud_api_key_here
```

**Option B: Direct environment variables in Claude config**
If you prefer to set environment variables directly in the Claude configuration (less secure but more explicit).

#### Step 3: Test the MCP Server
```bash
# Test server functionality
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/src/server.js

# Should return a JSON response with available tools
```

#### Step 4: Configure Claude Desktop

**The setup script automatically detects your Claude Desktop config location:**
- **macOS**: Multiple potential locations checked automatically
- **Windows**: Multiple AppData paths supported
- **Linux**: XDG and local config directories supported

> 💡 **Smart Detection**: The setup script now automatically finds your Claude Desktop configuration file across different versions and installation types.

**Configuration Options:**

**Option A: Using .env file (Most Secure)**
```json
{
  "mcpServers": {
    "notioc-canvas": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/notioc-canvas-mcp-server/dist/src/server.js"],
      "cwd": "/ABSOLUTE/PATH/TO/notioc-canvas-mcp-server"
    }
  }
}
```

**Option B: Environment variables in config (Less Secure)**
```json
{
  "mcpServers": {
    "notioc-canvas": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/notioc-canvas-mcp-server/dist/src/server.js"],
      "cwd": "/ABSOLUTE/PATH/TO/notioc-canvas-mcp-server",
      "env": {
        "CANVAS_BASE_URL": "https://your-institution.instructure.com",
        "CANVAS_ACCESS_TOKEN": "your_canvas_api_token_here",
        "LLAMA_CLOUD_API_KEY": "your_llama_cloud_api_key_here"
      }
    }
  }
}
```

⚠️ **IMPORTANT**: Replace `/ABSOLUTE/PATH/TO/notioc-canvas-mcp-server` with the actual absolute path to your installation.

#### Step 5: Restart Claude Desktop
1. **Completely close** Claude Desktop
2. **Reopen** Claude Desktop
3. **Wait 10-15 seconds** for the MCP server to initialize

#### Step 6: Verify Integration
Ask Claude: **"What Canvas courses am I enrolled in?"**

If successful, Claude will list your Canvas courses. If not, check the troubleshooting section below.

### 🚨 Troubleshooting

> 🔧 **Enhanced Diagnostics**: The setup script now provides detailed troubleshooting information and suggested solutions for common issues.

#### Check Claude Desktop Logs
```bash
# macOS - Check MCP logs
tail -f ~/Library/Logs/Claude/mcp-server-notioc-canvas.log

# Look for errors in the logs
cat ~/Library/Logs/Claude/mcp-server-notioc-canvas.log | grep -i error
```

#### Quick Diagnostic Commands
```bash
# Test MCP server directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/src/server.js

# Verify Canvas API connection
curl -H "Authorization: Bearer $CANVAS_ACCESS_TOKEN" "$CANVAS_BASE_URL/api/v1/courses"

# Run comprehensive verification
./verify.sh
```

#### Common Issues & Solutions

1. **"Canvas configuration missing" error**
   ```bash
   # The setup script now provides detailed Canvas token instructions
   # Re-run setup if needed: ./setup.sh
   cat .env  # Verify file exists and format is correct
   ```

2. **"Server disconnected" error**
   ```bash
   # Enhanced error reporting shows exact server output
   cd /path/to/notioc-canvas-mcp-server
   echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/src/server.js
   ```

3. **Claude Desktop config not found**
   ```bash
   # Setup script now automatically detects multiple config locations
   # Manual fallback if auto-detection fails:
   ls -la "$HOME/Library/Application Support/Claude/"
   ls -la "$HOME/Library/Application Support/Anthropic/"
   ```

4. **Permission denied errors**
   ```bash
   # Setup script now checks and creates directories with proper permissions
   # Manual fix if needed:
   chmod +x setup.sh
   chmod 755 dist/src/server.js
   ```

5. **Environment variable loading issues**
   ```bash
   # Enhanced .env loading with explicit path resolution
   # Verify .env is in project root:
   ls -la .env
   # Test environment loading:
   node -e "require('dotenv').config(); console.log('CANVAS_BASE_URL:', process.env.CANVAS_BASE_URL ? 'SET' : 'NOT SET')"
   ```

#### Advanced Troubleshooting

**Debug Mode:**
```bash
# Run setup with verbose output
DEBUG=true ./setup.sh

# Check all system requirements
./setup.sh --check-only
```

**Config Validation:**
```bash
# Validate Claude Desktop config syntax
cat ~/.../claude_desktop_config.json | jq '.'

# Test MCP server in isolation
node dist/src/server.js < /dev/null
```

#### Environment Variables Verification
```bash
# Test environment loading
cd /path/to/notioc-canvas-mcp-server
node -e "require('dotenv').config(); console.log('CANVAS_BASE_URL:', process.env.CANVAS_BASE_URL ? 'SET' : 'NOT SET')"
```

#### Manual Canvas API Test
```bash
# Test Canvas API directly
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-institution.instructure.com/api/v1/courses"
```

#### Production Deployment Considerations

**Performance Optimization:**
- The server caches minimal data to respect Canvas API rate limits
- File content extraction uses LlamaParse for Office documents
- Large files are processed with timeout handling
- Enhanced error reporting for faster debugging

**Security Best Practices:**
- Store API tokens in `.env` file, not in Claude config
- Setup script recommends secure configuration options
- Regularly rotate Canvas API tokens
- Monitor Claude Desktop logs for unusual activity
- Use the principle of least privilege for Canvas API tokens

**Monitoring & Maintenance:**
```bash
# Check server health
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/src/server.js | jq '.result.tools | length'

# Monitor log file size
ls -lh ~/Library/Logs/Claude/mcp-server-notioc-canvas.log

# Run comprehensive system check
./verify.sh

# Clear large log files if needed
echo > ~/Library/Logs/Claude/mcp-server-notioc-canvas.log
```

**Backup & Recovery:**
```bash
# Backup your configuration
cp .env .env.backup.$(date +%Y%m%d)
cp ~/.../claude_desktop_config.json ~/claude_config_backup_$(date +%Y%m%d).json

# Quick recovery test
./setup.sh --verify-only
```

## 💬 Example Conversations

Once set up, you can ask your AI assistant questions like:

### Course Management
- "What Canvas courses am I enrolled in?"
- "Show me my active courses"

### Content Access  
- "What pages are available in my English course?"
- "Read the syllabus for course 123456"
- "Show me the latest announcements"

### Assignments
- "What assignments do I have in my Computer Science course?"
- "Are there any assignments due this week?"
- "Show me assignment details for 'Essay 1'"

### File Management
- "Find all PDF files in my course" 
- "Search for files containing 'midterm'"
- "Read the content of the homework instructions"

## 📁 Project Structure

```
canvas-mcp-server/
├── src/
│   └── server.ts          # Main MCP server
├── tools/                 # Individual tool implementations
│   ├── courses.ts         # Course listing
│   ├── assignments.ts     # Assignment access
│   ├── files.ts          # File operations
│   └── pages-discussions.ts # Pages and discussions
├── lib/
│   ├── canvas-api.ts     # Canvas API wrapper
│   └── logger.ts         # Logging utilities
├── deploy.sh            # Deployment helper script
```
Retrieves the content of a specific file.





## 🔐 Security & Privacy

- **Local Processing**: Your Canvas data stays on your machine with Claude Desktop
- **Secure API Access**: Uses your personal Canvas API token
- **No Data Storage**: No course data is stored on external servers
- **Direct Integration**: Communicates directly with Canvas APIs
- **Environment Variables**: API keys are stored safely in environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with both ChatGPT and Claude integrations
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙋 Support

- **Issues**: Report bugs and request features on GitHub
- **Documentation**: Check our comprehensive setup guides

---

**Notioc Canvas MCP Server** - Bringing your Canvas courses to your AI assistant. 🎓✨
