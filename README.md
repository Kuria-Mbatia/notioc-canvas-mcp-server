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

## 🚀 Quick Start

### Claude Desktop Integration

## 🚀 Quick Start

### Automated Setup (Recommended)
```bash
# 1. Clone and enter directory
git clone https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server.git
cd notioc-canvas-mcp-server

# 2. Run production setup script
./setup.sh

# 3. Restart Claude Desktop and test with: "What Canvas courses am I enrolled in?"
```

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

# 3. Configure Claude Desktop
# Follow steps in the Usage section below
```

## 🛠️ Installation

### 1. Prerequisites

- Node.js 18+ installed
- Canvas LMS access with API token  
- Claude Desktop application
- LlamaParse API key for document content extraction

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

The Notioc Canvas MCP Server provides 8 tools with simplified names:

| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `getting courses` | List your Canvas courses | "Show me my active courses" |
| `getting pages` | Get pages in a course | "What pages are in my English course?" |
| `reading page` | Read a specific page | "Read the syllabus page" |
| `getting discussions` | List course discussions | "Show me the announcements" |
| `reading discussion` | Read a discussion topic | "What's in the latest announcement?" |
| `getting assignments` | Get course assignments | "What assignments do I have?" |
| `finding files` | Search for course files | "Find all PDF files" |
| `reading file` | Read file content | "Read the homework instructions" |

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

**Locate your Claude Desktop config file:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

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

#### Check Claude Desktop Logs
```bash
# macOS - Check MCP logs
tail -f ~/Library/Logs/Claude/mcp-server-notioc-canvas.log

# Look for errors in the logs
cat ~/Library/Logs/Claude/mcp-server-notioc-canvas.log | grep -i error
```

#### Common Issues & Solutions

1. **"Canvas configuration missing" error**
   ```bash
   # Solution: Verify .env file exists and has correct format
   cat .env
   # Ensure no quotes around values and correct variable names
   ```

2. **"Server disconnected" error**
   ```bash
   # Solution: Test server manually
   cd /path/to/notioc-canvas-mcp-server
   echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/src/server.js
   ```

3. **"Unexpected token" errors**
   ```bash
   # Solution: Rebuild the server
   npm run build
   ```

4. **Path-related errors**
   ```bash
   # Solution: Use absolute paths in Claude config
   pwd  # Get current absolute path
   # Update claude_desktop_config.json with absolute paths
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



## 🐛 Troubleshooting

### Common Issues

1. **"Canvas configuration missing" error**
   - Ensure `.env` file exists with correct `CANVAS_BASE_URL` and `CANVAS_ACCESS_TOKEN`

2. **"Access denied" errors**
   - Verify your Canvas API token has the necessary permissions
   - Check that you're enrolled in the course you're trying to access

3. **"Course not found" errors**
   - Ensure the course ID is correct
   - Verify you have access to the specified course

4. **File content not loading**
   - Make sure your LlamaParse API key is correctly configured
   - Large files may be truncated for performance
   - Some file types may only provide metadata

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

3. **"Course not found" errors**
   - Ensure the course ID is correct
   - Verify you have access to the specified course

### Debug Mode

Enable debug logging by setting `DEBUG=true` in your `.env` file.

### Testing Canvas Connection

You can test your Canvas connection manually:

```bash
# Test API connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-canvas-instance.instructure.com/api/v1/courses"
```

## Security Notes

- Keep your Canvas API token secure and never share it
- Use environment variables for configuration
- Regularly rotate your API tokens
- Review Canvas API permissions for your tokens

## Development

### Project Structure

```
mcp-server/
├── src/
│   └── server.ts          # Main MCP server
├── lib/
│   └── canvas-api.ts      # Canvas API integration
├── tools/
│   ├── courses.ts         # Course management tools
│   ├── assignments.ts     # Assignment tools
│   └── files.ts          # File system tools
├── config/
├── examples/
└── package.json
```

### Building

```bash
npm run build    # Compile TypeScript
npm run dev      # Development mode with file watching
npm test         # Run tests (when available)
```

## Support

For support and documentation, visit the [GitHub repository](https://github.com/notioc/canvas-mcp-server).

## License

MIT License - see LICENSE file for details.
