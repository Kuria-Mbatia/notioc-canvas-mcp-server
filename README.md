# Notioc Canvas MCP Server

A Model Context Protocol (MCP) server that provides AI assistants with seamless access to Canvas LMS data. This server features intelligent indexing, natural language processing, and autonomous file discovery to provide fast, contextually-aware, and accurate information.

> ⚠️ **IMPORTANT**: This project requires you to use your own Canvas API token. Never share your `.env` file or API keys with others.

## ✨ Features

- **📚 Course Management**: List and access Canvas courses with automatic course name recognition
- **📄 Pages & Content**: Browse and read course pages with full content parsing
- **💬 Discussions**: Access discussion topics and announcements with intelligent filtering
- **📝 Smart Assignment Access**: Automatically find homework assignments and their associated files
- **📁 Intelligent File Discovery**: Search, access, and process course files with automatic PDF parsing
- **🔍 Natural Language Search**: Ask questions like "find homework 3 in math 451" and get instant results
- **📄 File Processing & Q&A**: Process PDFs and documents for in-chat discussion without downloads
- **🤖 Homework File Auto-Discovery**: Automatically finds and extracts files from assignment descriptions

---

### 🧠 Agentic Capabilities

- **🚀 Smart Indexing Agent**: Run the indexer once to create a high-speed local database of all your course content. Subsequent queries are lightning-fast and don't require hitting the Canvas API.
- **🧠 Semantic Q&A**: Ask natural language questions about your courses (e.g., "What is the late policy for my history class?") and get intelligent, contextually-aware answers. The server understands the *meaning* of your question and finds the most relevant excerpts from the syllabus, assignments, and course files.
- **🕸️ Course Knowledge Graph**: Build a complete, structured model of a course, including its syllabus, assignments, and files, for comprehensive analysis or review.
- **🤖 Autonomous Operation**: Enable the background service to automatically and periodically update its own knowledge base. It's a "set it and forget it" way to ensure your agent always has the latest course information.
- **🔍 Natural Language Queries**: Use plain English to find content: "get homework 3 for math 451", "what's due this week", "process the assignment files"
- **📄 Smart File Processing**: Automatically extracts text from PDFs, makes files discussable in chat, and discovers embedded assignment files

## 🚀 Quick Start

### 1. Setup
```bash
# Clone and enter directory
git clone https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server.git
cd notioc-canvas-mcp-server

# Install dependencies and build the server
npm install && npm run build
```

### 2. Configure
```bash
# Create your environment file
cp .env.example .env

# Edit the .env file with your Canvas API token and base URL
# See "Get Your Canvas API Token" section below for instructions
```

### 3. Run the Server

**Production Mode (with indexing):**
```bash
npm start
```

**Development Mode (fast startup):**
```bash
npm run dev  # Skips indexing for instant startup during development
```

**For Autonomous Operation (Recommended):**
Set these in your `.env` file before starting:
```bash
ENABLE_BACKGROUND_INDEXING=true
RUN_INDEXER_ON_STARTUP=true
INDEXING_INTERVAL_HOURS=12
```
With these settings, the server will automatically index all your course data on startup and keep it updated every 12 hours. No manual intervention needed!

### 4. Connect Your MCP Client
Now the server is running and ready to be connected to your MCP client (like Claude Desktop).

## 🛠️ Available Tools

### 🔍 **Smart Discovery Tools**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `smart_search` | Natural language search for assignments and files | "find homework 3 in math 451" |
| `get_homework` | Automatically find homework with associated files | "get homework 3 for math 451" |
| `process_file` | Process files for in-chat discussion and Q&A | "process file 176870249" |

### 📚 **Course Content Tools**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `get_courses` | Lists your Canvas courses | "show me my active courses" |
| `get_assignments` | Gets course assignments with file discovery | "what assignments do I have in CMPEN 431?" |
| `find_files` | Searches for course files with smart filtering | "find all PDF files in math 451" |
| `read_file` | Read file content with automatic processing | "read homework3.pdf" |
| `read_file_by_id` | Direct file access by Canvas file ID | "read file 176870249" |

### 📄 **Pages & Discussions**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `get_pages` | Gets pages in a course | "what pages are in my english course?" |
| `read_page` | Reads a specific page | "read the syllabus page" |
| `get_discussions` | Lists course discussions and announcements | "show me recent announcements" |
| `read_discussion` | Reads a discussion topic | "what's in the latest announcement?" |

### 🧠 **AI-Powered Tools**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `run_indexer` | Creates local high-speed index of course data | (usually runs automatically) |
| `generate_qa_prompt` | Intelligent Q&A using indexed data | "what is the late policy?" |
| `build_knowledge_graph` | Structured course overview | "build knowledge graph for intro to cs" |

## 🎯 **Natural Language Examples**

The server now understands natural language queries:

**Homework & Assignments:**
- "Find homework 3 in math 451"
- "Get homework 3 for math 451 with file processing"
- "What assignments are due this week in CMPEN 431?"
- "Show me homework 2 files"

**File Processing:**
- "Process file 176870249 for discussion"
- "Read the PDF file and make it discussable"
- "Get homework 3 and process all attached files"

**Course Content:**
- "What pages are in my operating systems course?"
- "Show me discussions in technical writing"
- "Find all files in my circuits class"

## 📄 **File Processing Features**

### **Automatic PDF Parsing**
- ✅ PDFs are automatically converted to readable text
- ✅ Content becomes discussable in chat
- ✅ No downloads required - everything happens in the conversation

### **Smart File Discovery**
- 🔍 Automatically finds files attached to assignments
- 🔗 Extracts embedded file links from assignment descriptions
- 📎 Discovers files from multiple sources (attachments, embedded links, course files)

### **Processing Options**
- `summary` - Brief overview of file content
- `key_points` - Extract important points and bullet lists
- `full_content` - Complete file text
- `qa_ready` - Optimized for questions and discussion (default)

## ⚙️ Configuration

### Get Your Canvas API Token

1. Log into your Canvas instance
2. Go to Account → Settings
3. Scroll down to "Approved Integrations"
4. Click "+ New Access Token"
5. Give it a purpose name (e.g., "Notioc MCP Server") and an expiration date.
6. Copy the generated token to your `.env` file's `CANVAS_ACCESS_TOKEN` field.
7. Also, ensure the `CANVAS_BASE_URL` in your `.env` file is correct for your institution (e.g., `https://psu.instructure.com`).

### 🤖 Autonomous Operation (Recommended)

**Enable "Set It and Forget It" Mode:**

Add these settings to your `.env` file for fully autonomous operation:

```bash
# Enable automatic background updates
ENABLE_BACKGROUND_INDEXING=true

# Auto-index on server startup (ensures fresh data)
RUN_INDEXER_ON_STARTUP=true

# How often to refresh (in hours) - default is 12 (twice daily)
INDEXING_INTERVAL_HOURS=12
```

**Benefits of Autonomous Mode:**
- 🚀 **Zero Maintenance**: Server keeps itself updated automatically
- ⚡ **Always Fresh**: Gets latest assignments, announcements, and files
- 🧠 **Smart Queries**: Q&A and knowledge graphs use up-to-date information
- 💾 **Local Speed**: All queries run from local cache for instant responses

### 🛠️ **Development Mode**

For faster development and testing:

```bash
npm run dev  # Fast startup without indexing
```

**Manual Mode:**
Set `ENABLE_BACKGROUND_INDEXING=false` if you prefer to run the indexer manually via the `run_indexer` tool.

---

## 🎉 **What's New in v1.1**

- **📊 Clean Progress Display**: Beautiful single-line progress bar during indexing with real-time updates
- **🔇 Silent Processing**: Suppressed verbose logging for a cleaner indexing experience
- **📏 Smart Text Truncation**: Long course and file names are intelligently shortened to prevent line wrapping
- **⚡ Enhanced UX**: Smoother, more professional indexing process with clear visual feedback

## 🎯 **Previous Features (v1.0)**

- **🔍 Natural Language Search**: Ask in plain English to find homework and files
- **📄 PDF Processing**: Automatic PDF text extraction and in-chat discussion
- **🤖 Smart File Discovery**: Automatically finds homework files from multiple sources
- **⚡ Fast Dev Mode**: `npm run dev` for instant startup during development
- **📝 Enhanced Homework Tools**: Better assignment discovery with automatic file processing
- **🔗 Embedded Link Detection**: Finds files referenced in assignment descriptions

---
*This README covers the core autonomous and smart discovery features. The server now provides a seamless, intelligent interface to all your Canvas content.*
