# Notioc Canvas MCP Server

A comprehensive Model Context Protocol (MCP) server that provides programmatic access to Canvas LMS through Claude Desktop and other MCP-compatible AI assistants. Notioc enables natural language interaction with Canvas Learning Management System, transforming how students and educators interact with their academic data.

## About Notioc

Notioc is an intelligent Canvas LMS integration platform built on the Model Context Protocol (MCP), a standardized protocol for connecting AI assistants to external data sources and tools. This server implementation provides 49 specialized tools that expose Canvas LMS functionality through a unified interface, enabling AI assistants like Claude to retrieve, analyze, and manipulate Canvas data on behalf of users.

### Technical Overview

**Architecture**: Node.js/TypeScript MCP server implementing the Model Context Protocol specification
**Integration**: Direct Canvas REST API integration with intelligent caching and rate limiting
**Protocol**: Model Context Protocol (MCP) v1.0 compatible
**AI Platform**: Optimized for Claude Desktop, compatible with any MCP-supporting AI assistant
**Document Processing**: Optional LlamaParse integration for advanced content extraction

### Core Capabilities

**Grade Management and Analytics**
- Retrieve comprehensive grade data across all courses
- Calculate grade statistics and performance trends
- Generate predictive "what-if" scenarios for grade projections
- Analyze weighted category performance
- Track grade history and changes over time

**Assignment and Submission Tracking**
- Access assignment details, requirements, and rubrics
- Retrieve previous submission content and attachments
- View instructor feedback and submission comments
- Track submission history across all courses
- Programmatic assignment submission capabilities

**Document Processing and File Management**
- Enhanced file browser with hierarchical folder navigation
- Support for 94+ file formats including PDF, Office documents, images, and audio
- Intelligent content extraction using LlamaParse (PDF, DOCX, XLSX, PPTX, images, audio)
- Smart file search with type-aware filtering and processing recommendations
- OCR capabilities for image-based documents
- Audio transcription for recorded lectures and media

**Quiz and Assessment Analysis**
- Access completed quiz content and questions
- Review quiz submissions with answers and scoring
- Analyze quiz performance across multiple attempts
- Extract quiz statistics and question-level analytics
- Study from previous assessments

**Course Structure and Navigation**
- Parse course syllabi and extract policies
- Navigate module hierarchies and prerequisites
- Track course progress and completion status
- Access course announcements and updates
- Analyze course organization and structure

**Communication and Collaboration**
- Send and receive Canvas messages
- Participate in discussion forums programmatically
- Access group information and membership
- Read and create group discussion posts
- Retrieve conversation history and threads

**Calendar and Time Management**
- Retrieve calendar events and due dates
- Track assignment deadlines across all courses
- Access course-specific calendar information
- Generate timeline views of academic obligations

## Installation and Setup

### Prerequisites

- Node.js 18 or higher (or Docker Desktop for containerized deployment)
- Canvas LMS API access token
- Claude Desktop application or other MCP-compatible AI assistant
- LlamaParse API key (optional, for advanced document processing)

### Docker Deployment (Recommended)

Docker provides the simplest deployment method with cross-platform compatibility.

```bash
# Clone the repository
git clone https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server.git
cd notioc-canvas-mcp-server

# Configure environment variables
cp .env.docker .env
# Edit .env with your Canvas API credentials

# Start the server
./docker.sh prod     # macOS/Linux
docker.bat prod      # Windows
```

Refer to [DOCKER-README.md](DOCKER-README.md) for detailed Docker configuration options.

### Manual Installation

For development environments or custom deployments:

```bash
# Clone the repository
git clone https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server.git
cd notioc-canvas-mcp-server

# Install dependencies
npm install

# Build the TypeScript source
npm run build

# Configure environment variables
cp .env.example .env
# Edit .env with your Canvas API credentials
```

### Claude Desktop Integration

Configure Claude Desktop to connect with the Notioc MCP server by editing your `claude_desktop_config.json`:

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**

```json
{
  "mcpServers": {
    "notioc-canvas": {
      "command": "node",
      "args": ["/absolute/path/to/notioc-canvas-mcp-server/dist/mcp.js"],
      "cwd": "/absolute/path/to/notioc-canvas-mcp-server",
      "env": {
        "NODE_ENV": "production",
        "CANVAS_BASE_URL": "https://your-institution.instructure.com",
        "CANVAS_ACCESS_TOKEN": "your_canvas_api_token"
      }
    }
  }
}
```

After configuration, restart Claude Desktop. The Notioc tools will be available for natural language queries.

For complete setup instructions including API token generation, environment configuration, and troubleshooting, refer to [SETUP.md](SETUP.md).

## MCP Tools Reference

Notioc provides 49 specialized MCP tools organized by functional category:

### Course Management Tools

**get_courses** - List all accessible courses with enrollment details
**get_current_courses** - Retrieve active courses for the current term
**get_course_navigation** - Access course navigation menu and structure
**get_course_syllabus** - Extract course syllabus and policies
**list_modules** - List course modules with items and prerequisites
**get_module_details** - Retrieve detailed module information
**search_courses** - Search courses by name or course code

### Grade and Analytics Tools

**get_grades** - Comprehensive grade retrieval across all courses
**calculate_course_analytics** - Statistical analysis of course performance
**generate_what_if_scenarios** - Predictive grade calculations
**get_grade_trends** - Historical grade progression analysis
**get_gradebook_categories** - Weighted category information

### Assignment Tools

**get_assignments** - List assignments with filtering options
**get_assignment_details** - Detailed assignment information and requirements
**get_assignment_rubric** - Retrieve grading rubrics
**get_previous_submission_content** - Access past submission text and files
**get_submission_comments** - Instructor feedback and comments
**submit_assignment** - Programmatic assignment submission

### File and Document Tools

**get_files** - Enhanced file browser with folder hierarchy and processing recommendations
**find_files** - Search files by name with fuzzy matching
**read_file** - Extract content from course files with LlamaParse support
**read_file_by_id** - Direct file access using Canvas file ID
**process_file** - Advanced document processing with LlamaParse integration

### Quiz and Assessment Tools

**list_quizzes** - List quizzes and assessments
**get_quiz_details** - Detailed quiz information and settings
**get_quiz_submission_content** - Access quiz questions and submitted answers
**get_quiz_statistics** - Statistical analysis of quiz performance

### Calendar and Planning Tools

**get_calendar_events** - Retrieve upcoming calendar events
**get_dashboard** - Dashboard information and upcoming items
**get_course_analytics** - Course-level analytics and insights
**get_planner_items** - Unified TODO/planner view across all courses
**create_planner_note** - Create personal reminders and planning notes
**update_planner_note** - Edit existing planner notes
**delete_planner_note** - Remove planner notes
**mark_planner_item_complete** - Check off completed planner items

### Communication Tools

**send_message** - Send Canvas messages to users
**list_conversations** - Retrieve message conversations
**get_discussions** - Access discussion forums and topics
**read_discussion** - Read discussion thread content
**post_discussion_reply** - Create discussion posts and replies

### Group Collaboration Tools

**list_groups** - List user groups or course groups
**get_group_details** - Detailed group information
**list_group_members** - Group membership roster
**list_group_discussions** - Group discussion topics
**get_group_discussion** - Read group discussion content
**post_group_discussion** - Create group discussion posts

### Notifications and Alerts

**get_account_notifications** - Retrieve active campus-wide announcements and alerts

### User and Profile Tools

**get_user_profile** - User profile information
**find_people** - Search for users in courses
**list_course_users** - Course roster and enrollment list

### Advanced Tools

**smart_search** - AI-powered semantic search across Canvas content
**get_tool_help** - Interactive tool documentation and examples

## Usage Examples

Notioc enables natural language interaction with Canvas through Claude Desktop. The following examples demonstrate typical use cases:

### Grade Analysis

```
Query: "What is my current grade in Biology 101?"
Response: Retrieves comprehensive grade breakdown including category weights, 
          current percentage, and individual assignment scores.

Query: "What grade do I need on the final exam to achieve an A in the course?"
Response: Calculates required final exam score based on current grades and 
          syllabus weighting using what-if scenario analysis.

Query: "Show me my grade trends across all courses this semester"
Response: Generates statistical analysis of grade progression with 
          performance insights and trend identification.
```

### Assignment Management

```
Query: "What assignments are due this week?"
Response: Lists upcoming assignments across all courses with due dates, 
          point values, and submission status.

Query: "Show me my essay submission from last week with instructor feedback"
Response: Retrieves submission content, attached files, instructor comments, 
          and grading rubric scores.

Query: "What are the requirements for the research paper in English 202?"
Response: Extracts assignment description, rubric criteria, submission 
          guidelines, and due date information.
```

### Document Processing

```
Query: "Extract the text content from this week's lecture slides"
Response: Uses LlamaParse to extract text, images, and formatting from 
          PowerPoint presentations or PDFs.

Query: "Summarize the key points from the uploaded research paper"
Response: Processes PDF through LlamaParse and provides AI-generated 
          summary of main concepts and findings.

Query: "Transcribe the audio from the recorded lecture"
Response: Converts audio files to text using LlamaParse transcription 
          capabilities.
```

### Quiz Review

```
Query: "Show me my answers from the Chapter 5 quiz"
Response: Retrieves quiz questions, submitted answers, correct answers, 
          and scoring information for post-assessment review.

Query: "What topics did I struggle with on recent quizzes?"
Response: Analyzes quiz performance data to identify weak areas and 
          suggest focus topics for studying.
```

### Course Planning

```
Query: "What modules do I need to complete before the midterm?"
Response: Parses course module structure, identifies prerequisites, and 
          lists incomplete required modules.

Query: "Show me the attendance and participation requirements from the syllabus"
Response: Extracts and formats relevant policy sections from course 
          syllabus documentation.
```

## Technical Architecture

### Technology Stack

**Runtime Environment:** Node.js 18+
**Language:** TypeScript 5.x with strict type checking
**Protocol:** Model Context Protocol (MCP) SDK v1.0
**API Integration:** Canvas REST API v1 with intelligent rate limiting
**Document Processing:** LlamaParse API for multi-format content extraction
**Caching:** In-memory caching with TTL-based invalidation
**Logging:** Structured logging with configurable verbosity levels

### Design Patterns

**Tool-Based Architecture:** Each Canvas API capability exposed as discrete MCP tool
**Lazy Loading:** Resources loaded on-demand to minimize API calls
**Intelligent Caching:** Aggressive caching of static data with smart invalidation
**Pagination Handling:** Automatic pagination for large result sets
**Error Recovery:** Graceful degradation with informative error messages
**Type Safety:** Comprehensive TypeScript interfaces for all Canvas API responses

### Performance Optimizations

- Request batching for related API calls
- Parallel requests where Canvas API permits
- Response compression for large payloads
- Smart cache warming for frequently accessed data
- Rate limit awareness with automatic backoff

## Security and Privacy

### Data Handling

**Local Processing:** All data processing occurs locally on the user's machine. No Canvas data is transmitted to external services except when explicitly using LlamaParse for document processing.

**API Token Security:** Canvas API tokens are stored in environment variables or secure configuration files, never committed to version control or transmitted in plaintext.

**No Data Collection:** Notioc does not collect, store, or transmit user data, analytics, or telemetry. All Canvas API calls are direct between the user's machine and their Canvas instance.

**Minimal Permissions:** Canvas API tokens should be configured with minimal required permissions. Read-only access is sufficient for most features.

### Best Practices

- Store API tokens in `.env` files excluded from version control
- Use separate API tokens for development and production environments
- Regularly rotate Canvas API tokens following institutional security policies
- Review Canvas API token permissions to ensure principle of least privilege
- Monitor Canvas API audit logs for unexpected access patterns
- Keep the Notioc server updated for security patches

### LlamaParse Integration

When using LlamaParse for document processing:
- Documents are temporarily uploaded to LlamaParse servers for processing
- LlamaParse maintains SOC 2 Type II compliance
- Documents are deleted after processing completes
- LlamaParse integration is optional and can be disabled via configuration

## Configuration

### Environment Variables

Required configuration:

```bash
CANVAS_BASE_URL=https://institution.instructure.com
CANVAS_ACCESS_TOKEN=your_canvas_api_token
```

Optional configuration:

```bash
# LlamaParse integration (optional)
ENABLE_LLAMAPARSE=true
LLAMA_CLOUD_API_KEY=your_llamaparse_api_key
LLAMA_PARSE_ALLOW_UPLOAD=true
LLAMA_PARSE_RESULT_FORMAT=markdown
LLAMA_PARSE_TIMEOUT_MS=120000
LLAMA_PARSE_MAX_MB=50

# Performance tuning
NODE_ENV=production
CACHE_TTL_SECONDS=300
MAX_CONCURRENT_REQUESTS=5

# Logging
LOG_LEVEL=info
```

### Canvas API Token Generation

1. Log in to your Canvas instance
2. Navigate to Account > Settings
3. Select "New Access Token" under "Approved Integrations"
4. Provide a purpose description (e.g., "Notioc MCP Server")
5. Optionally set an expiration date
6. Copy the generated token and store securely in your `.env` file

Detailed configuration instructions available in [SETUP.md](SETUP.md).

## Development

### Project Structure

```
notioc-canvas-mcp-server/
├── src/                    # TypeScript source files
│   ├── server.ts          # MCP server initialization
│   └── health-check.ts    # Health monitoring
├── lib/                    # Core library modules
│   ├── canvas-api.ts      # Canvas API client
│   ├── pagination.ts      # Pagination handling
│   ├── search.ts          # Search functionality
│   ├── llamaparse.ts      # Document processing
│   ├── file-cache.ts      # Caching system
│   └── llm-guidance.ts    # AI assistant guidance
├── tools/                  # MCP tool implementations
│   ├── courses.ts         # Course management tools
│   ├── grades.ts          # Grade and analytics tools
│   ├── assignments.ts     # Assignment tools
│   ├── files.ts           # File management tools
│   └── ...                # Additional tool modules
├── dist/                   # Compiled JavaScript output
├── config/                 # Configuration files
└── examples/              # Usage examples and templates
```

### Building from Source

```bash
# Install dependencies
npm install

# Development build with watch mode
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

### Contributing

Contributions are welcome. Please review the contributing guidelines in [CONTRIBUTING.md](CONTRIBUTING.md) before submitting pull requests.

Key areas for contribution:
- Additional MCP tool implementations
- Enhanced error handling and recovery
- Performance optimizations
- Documentation improvements
- Test coverage expansion
- Canvas API version compatibility

## Support and Resources

### Documentation

- **Setup Guide:** [SETUP.md](SETUP.md) - Complete installation and configuration instructions
- **Docker Guide:** [DOCKER-README.md](DOCKER-README.md) - Containerized deployment documentation
- **Contributing Guide:** [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines and development workflow
- **Usage Examples:** [examples/usage-examples.md](examples/usage-examples.md) - Detailed usage scenarios

### Support Channels

- **Issues:** Report bugs and request features via [GitHub Issues](https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server/issues)
- **Discussions:** Community support and questions via GitHub Discussions
- **Documentation:** Comprehensive guides in the repository documentation

## License

MIT License - see [LICENSE](LICENSE) file for complete terms and conditions.

## Acknowledgments

Built on the Model Context Protocol (MCP) developed by Anthropic. Canvas LMS is a trademark of Instructure, Inc. LlamaParse is a product of LlamaIndex.

---

Notioc Canvas MCP Server - Intelligent Canvas LMS integration through the Model Context Protocol
