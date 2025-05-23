# Setting Up Notioc Canvas MCP Server with Claude Desktop

This guide will walk you through setting up the Notioc Canvas MCP Server for use with Claude Desktop, allowing you to access and interact with your Canvas LMS courses through Claude.

## Prerequisites

Before you begin, make sure you have:
- Claude Desktop application installed
- Node.js 18+ installed
- Canvas LMS access with API token capabilities
- LlamaParse API key for document extraction

## Step-by-Step Setup Process

### 1. Install and Build the MCP Server

```bash
# Clone the repository
git clone https://github.com/notioc/canvas-mcp-server.git
cd canvas-mcp-server

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

### 2. Configure Your Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your credentials
# Use your favorite text editor to add:
# - Your Canvas URL
# - Your Canvas API token
# - Your LlamaParse API key
```

Example `.env` file:
```
CANVAS_BASE_URL=https://university.instructure.com
CANVAS_ACCESS_TOKEN=1234~abcdefghijklmnopqrstuvwxyz
LLAMA_CLOUD_API_KEY=ll-123456789abcdefg
```

### 3. Test the MCP Server

Verify that your server works correctly:

```bash
# Test the MCP server
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/src/server.js
```

You should see a list of available tools in the response.

### 4. Configure Claude Desktop

Claude Desktop uses a configuration file to integrate with MCP servers. You need to create or edit this file:

**1. Location of Configuration File:**
- **macOS**: `~/Library/Application Support/Anthropic/claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Anthropic\claude\claude_desktop_config.json`
- **Linux**: `~/.config/Anthropic/claude/claude_desktop_config.json`

**2. Create or Edit the Config File:**

Add this configuration to the file (create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "notioc-canvas": {
      "command": "node",
      "args": ["/absolute/path/to/canvas-mcp-server/dist/src/server.js"],
      "env": {
        "CANVAS_BASE_URL": "https://your-canvas-instance.instructure.com",
        "CANVAS_ACCESS_TOKEN": "your-token-here",
        "LLAMA_CLOUD_API_KEY": "your-llama-cloud-api-key-here"
      }
    }
  }
}
```

Make these important changes:
- Replace `/absolute/path/to/canvas-mcp-server` with the actual full path to your server directory
- Replace the environment variables with your actual values
- You can copy these from your `.env` file

### 5. Restart Claude Desktop

After configuring the MCP server:
1. Close Claude Desktop completely
2. Restart Claude Desktop to load the new configuration

### 6. Testing the Integration

Once Claude Desktop is restarted, you should be able to use Canvas functionality by asking questions like:

- "What Canvas courses am I enrolled in?"
- "Show me the pages in course 12345"
- "What assignments do I have in my Computer Science course?"
- "Find PDF files in my Biology course"

## Troubleshooting

### Common Issues

1. **Claude doesn't recognize Canvas commands**
   - Verify your `claude_desktop_config.json` file is correctly formatted
   - Make sure you've restarted Claude Desktop
   - Check that the paths in the config are absolute paths

2. **"Cannot connect to MCP server" errors**
   - Make sure your MCP server builds correctly
   - Verify Node.js is in your PATH environment variable
   - Check that the paths in your config file are correct

3. **"Canvas API error" messages**
   - Verify your Canvas API token is valid and hasn't expired
   - Check that your Canvas instance URL is correct
   - Confirm you have permissions for the courses you're trying to access

4. **"LlamaParse API error" messages**
   - Verify your LlamaParse API key is valid
   - Check that you have remaining credits/quota on your LlamaParse account

### Debugging Techniques

If you encounter issues:

1. **Enable debug mode**:
   - Set `DEBUG=true` in your `.env` file

2. **Check Claude Desktop logs**:
   - Look for logs in the Claude application's log directory
   - These may contain error messages from the MCP server

3. **Test without Claude**:
   - Run manual JSON-RPC requests against the server to test functionality
   - Example: `echo '{"jsonrpc": "2.0", "id": 1, "method": "getting_courses", "params": {}}' | node dist/src/server.js`

## Security Best Practices

- Never share your API tokens or keys with others
- Regularly rotate your Canvas API token for better security
- Store your configuration file with appropriate permissions
- Be careful about which Canvas courses you access through Claude

## Next Steps

After setting up the integration:
1. Test with different types of Canvas content
2. Explore the different tool capabilities
3. Try accessing files and documents to see how LlamaParse extraction works

Your Notioc Canvas MCP Server is now ready to use with Claude Desktop!
