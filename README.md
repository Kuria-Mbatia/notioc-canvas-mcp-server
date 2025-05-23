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

For local development with privacy-focused processing:

```bash
# 1. Setup and build
npm install && npm run build

# 2. Configure .env file
cp .env.example .env
# Edit .env with your Canvas API token and LlamaParse API key

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

### Setting up Claude Desktop Integration

1. **Configure Claude**: Add to your `claude_desktop_config.json`:
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

2. **Locate your Claude Desktop config file**:
   - On macOS: `~/Library/Application Support/Anthropic/claude/claude_desktop_config.json`
   - On Windows: `%APPDATA%\Anthropic\claude\claude_desktop_config.json`
   - On Linux: `~/.config/Anthropic/claude/claude_desktop_config.json`

3. **Create or edit this file** with the configuration above, replacing paths and API tokens with your own values.

4. **Restart Claude Desktop** to apply the changes.

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
