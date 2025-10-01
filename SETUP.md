# Canvas MCP Server - Complete Setup Guide

This guide will help you set up the Canvas MCP Server with Claude Desktop for seamless Canvas LMS integration.

## Prerequisites

1. **Node.js 18+** or **Docker Desktop**
2. **Claude Desktop** application
3. **Canvas API access token**
4. **LlamaParse API key** (optional, for advanced document processing)

## Installation Methods

### Method 1: Docker Setup (Recommended)

**Why Docker?** Works identically on Windows, macOS, Linux, and cloud platforms.

```bash
# 1. Clone the repository
git clone https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server.git
cd notioc-canvas-mcp-server

# 2. Copy environment template
cp .env.docker .env

# 3. Edit .env file with your credentials (see configuration section below)

# 4. Start the server
./docker.sh prod     # macOS/Linux
docker.bat prod      # Windows
```

### Method 2: Manual Installation

```bash
# 1. Clone the repository
git clone https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server.git
cd notioc-canvas-mcp-server

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Set up environment variables (see configuration section below)
```

## Configuration

### Step 1: Get Your Canvas API Token

1. Log into your Canvas instance
2. Go to **Account → Settings**
3. Scroll to **Approved Integrations**
4. Click **+ New Access Token**
5. Give it a purpose: "Canvas MCP Server"
6. Click **Generate Token**
7. **Copy the token immediately** (you won't see it again)

### Step 2: Get LlamaParse API Key (Optional)

1. Visit [LlamaIndex Cloud](https://cloud.llamaindex.ai/)
2. Sign up/login
3. Go to API Keys section
4. Create a new API key
5. Copy the key

### Step 3: Configure Environment Variables

**For Docker users:** Edit the `.env` file:

```env
# Canvas LMS Configuration (REQUIRED)
CANVAS_BASE_URL=https://your-canvas-instance.instructure.com
CANVAS_ACCESS_TOKEN=your_canvas_access_token_here

# LlamaParse Configuration (OPTIONAL - for advanced document processing)
LLAMA_CLOUD_API_KEY=your_llamaparse_api_key_here
ENABLE_LLAMAPARSE=true
LLAMA_ONLY=true
LLAMA_PARSE_ALLOW_UPLOAD=true
LLAMA_PARSE_TIMEOUT_MS=300000

# Advanced Features (OPTIONAL)
OPENROUTER_API_KEY=your_openrouter_key_here
SMALL_MODEL_ENABLED=true
SMART_SEARCH_MAX_RESULTS=5
SMART_SEARCH_RETURN_MODE=refs
FILE_CONTENT_DEFAULT_MODE=preview
FILE_CONTENT_MAX_CHARS=1500

# Server Configuration
NODE_ENV=production
```

**For manual installation:** Set environment variables or create a `.env` file with the same content.

## Claude Desktop Integration

### Step 1: Locate Claude Desktop Config

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```cmd
%APPDATA%\Claude\claude_desktop_config.json
```

### Step 2: Configure Claude Desktop

Open the config file and add the Canvas MCP Server configuration:

#### For Docker Installation:

```json
{
  "mcpServers": {
    "notioc-canvas": {
      "command": "docker",
      "args": [
        "run", "--rm", 
        "--env-file", "/path/to/your/project/.env",
        "canvas-mcp-server"
      ],
      "cwd": "/path/to/your/project"
    }
  }
}
```

#### For Manual Installation:

```json
{
  "mcpServers": {
    "notioc-canvas": {
      "command": "node",
      "args": ["/path/to/your/project/dist/mcp.js"],
      "cwd": "/path/to/your/project",
      "env": {
        "NODE_ENV": "production",
        "CANVAS_BASE_URL": "https://your-canvas-instance.instructure.com",
        "CANVAS_ACCESS_TOKEN": "your_canvas_access_token_here",
        "LLAMA_CLOUD_API_KEY": "your_llamaparse_api_key_here",
        "ENABLE_LLAMAPARSE": "true",
        "LLAMA_ONLY": "true",
        "LLAMA_PARSE_ALLOW_UPLOAD": "true",
        "LLAMA_PARSE_TIMEOUT_MS": "300000",
        "OPENROUTER_API_KEY": "your_openrouter_key_here",
        "SMALL_MODEL_ENABLED": "true",
        "SMART_SEARCH_MAX_RESULTS": "5",
        "SMART_SEARCH_RETURN_MODE": "refs",
        "FILE_CONTENT_DEFAULT_MODE": "preview",
        "FILE_CONTENT_MAX_CHARS": "1500"
      }
    }
  }
}
```

**Important:** Replace the following placeholders:
- `/path/to/your/project` → Actual path to your project directory
- `your-canvas-instance.instructure.com` → Your Canvas URL
- `your_canvas_access_token_here` → Your Canvas API token
- `your_llamaparse_api_key_here` → Your LlamaParse API key (optional)

### Step 3: Restart Claude Desktop

Close and reopen Claude Desktop to load the new configuration.

## Verification

### Test the Connection

1. Open Claude Desktop
2. Start a new conversation
3. Type: "What Canvas courses do I have?"
4. You should see your Canvas courses listed

### Available Commands

Once configured, you can ask Claude to:

- **Grades:** "What's my current grade in Biology?"
- **Assignments:** "What assignments are due this week?"
- **Files:** "Show me my latest submission for the essay assignment"
- **Calendar:** "What's on my Canvas calendar today?"
- **Messages:** "Check my Canvas messages"
- **Quizzes:** "Review my last quiz performance"

## Troubleshooting

### Common Issues

1. **"MCP server not found"**
   - Check the path in your claude_desktop_config.json
   - Ensure the project is built (`npm run build`)
   - Restart Claude Desktop

2. **"Canvas API error"**
   - Verify your Canvas URL and access token
   - Check that your token has proper permissions
   - Ensure your Canvas instance is accessible

3. **"Permission denied"**
   - Check file permissions on the project directory
   - Ensure Claude Desktop can access the specified paths

4. **Docker issues**
   - Make sure Docker Desktop is running
   - Check if the image built successfully: `./docker.sh build`
   - View logs: `./docker.sh logs`

### Debug Mode

To enable debug logging, add this to your environment:

```env
DEBUG=canvas-mcp:*
```

### Logs Location

- **Docker:** Use `./docker.sh logs` or `docker.bat logs`
- **Manual:** Check console output when Claude Desktop starts

## Advanced Features

### Document Processing with LlamaParse

If you configure LlamaParse, the server can:
- Extract text from 94+ file types (PDF, DOCX, XLSX, PPTX, images)
- Perform OCR on images
- Transcribe audio files
- Process complex document layouts

### Smart Search

Enable intelligent content search across your Canvas materials:

```env
SMART_SEARCH_MAX_RESULTS=10
SMART_SEARCH_RETURN_MODE=full
```

## Security Notes

- **Never commit your API tokens** to version control
- Store sensitive credentials in environment variables
- Use read-only Canvas tokens when possible
- Regularly rotate your API keys

## Support

If you encounter issues:

1. Check this setup guide first
2. Review the troubleshooting section
3. Check the [GitHub repository](https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server) for updates
4. Open an issue with detailed error messages

## You're Ready!

Once configured, you'll have access to 44+ Canvas tools through natural language with Claude Desktop. Ask Claude anything about your Canvas courses, and it will help you stay organized and successful in your studies!
