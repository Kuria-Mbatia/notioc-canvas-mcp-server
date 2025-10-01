# Notioc Canvas MCP Server

**The AI-powered Canvas assistant that transforms your academic experience**

A comprehensive Model Context Protocol (MCP) server providing seamless Canvas LMS integration through Claude Desktop. Turn your Canvas data into intelligent academic insights with 44 powerful tools and natural language interactions.

## What Makes This Special

### Complete Canvas Integration
- **44 MCP Tools** covering every aspect of Canvas
- **Real-time grade analytics** with "what-if" calculations
- **Previous submission access** - review all your past work
- **Quiz content analysis** - study from completed quizzes
- **Advanced document processing** - extract content from 94+ file types (PDF, DOCX, XLSX, PPTX, images, audio)
- **AI-powered insights** through Claude integration

### Key Features

**Academic Analytics**
- Grade tracking with performance insights
- "What grade do I need on the final?" calculations
- Course progress analysis and predictions

**Document Management** 
- Access all previous submissions and feedback
- Extract text from 94+ document types via LlamaParse
- Smart file search and content processing
- OCR for images, transcription for audio files

**Quiz & Study Tools**
- Complete quiz review after submission
- Question analysis with correct answers
- Performance tracking across all quizzes

**Planning & Organization**
- Calendar integration with due dates
- Course navigation and module tracking
- Syllabus analysis and policy extraction

**Communication**
- Canvas messaging integration
- Discussion participation
- **Group collaboration** - Access group discussions and members
- Professional email drafting

## Quick Start

### Easy Setup (3 Steps)

1. **See [SETUP.md](SETUP.md) for complete installation guide**
2. **Configure your Canvas API credentials**  
3. **Connect with Claude Desktop**

### Docker Setup (Recommended)

```bash
# 1. Copy environment template
cp .env.docker .env

# 2. Edit .env with your Canvas credentials
# 3. Start the server
./docker.sh prod     # macOS/Linux  
docker.bat prod      # Windows
```

### Manual Installation

```bash
git clone https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server.git
cd notioc-canvas-mcp-server
npm install && npm run build
```

**Complete setup instructions in [SETUP.md](SETUP.md)**

### Claude Desktop Configuration Preview

Add to your `claude_desktop_config.json`:

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
        "CANVAS_ACCESS_TOKEN": "your_canvas_access_token_here"
      }
    }
  }
}
```

**Complete configuration guide in [SETUP.md](SETUP.md)**

## Available Tools (44 Total)

### Grades & Analytics
- `get_grades` - Complete grade overview
- `calculate_course_analytics` - Performance insights  
- `generate_what_if_scenarios` - Grade predictions
- `get_grade_trends` - Progress tracking
- `get_gradebook_categories` - Weighted categories

### Assignments & Submissions
- `get_assignments` - Assignment listings with details
- `get_assignment_submissions` - Previous submissions
- `get_user_submissions` - Personal submission history
- `get_submission_comments` - Feedback and comments
- `submit_assignment` - Submit work programmatically

### Course Management
- `get_courses` - Course listings and details
- `get_course_modules` - Module structure
- `get_course_syllabus` - Syllabus content
- `get_course_navigation` - Navigation structure
- `search_courses` - Course search functionality

### Files & Documents
- `get_files` - File listings and access
- `get_file_content` - Document content extraction
- `upload_file` - File uploads
- `search_files` - File search capabilities
- `get_folders` - Folder organization

### Calendar & Due Dates
- `get_calendar_events` - Upcoming events
- `get_assignment_due_dates` - Due date tracking
- `get_course_calendar` - Course-specific calendars

### Communication
- `get_discussions` - Discussion forums
- `get_discussion_topics` - Topic details
- `get_conversation_history` - Message history
- `send_message` - Send messages
- `get_announcements` - Course announcements

### Groups & Collaboration
- `list_groups` - List all groups or groups in a course
- `get_group_details` - Detailed group information
- `list_group_members` - See group membership
- `list_group_discussions` - Group discussion topics
- `get_group_discussion` - Read group discussions
- `post_group_discussion` - Create group posts

### Quizzes & Assessments
- `get_quizzes` - Quiz listings
- `get_quiz_questions` - Question details
- `get_quiz_submissions` - Quiz attempts
- `get_quiz_statistics` - Performance analytics

### User & Profile
- `get_user_profile` - Profile information
- `get_user_activity` - Activity tracking
- `get_course_users` - Class rosters
- `get_enrollments` - Enrollment details

### Advanced Features
- `smart_search` - AI-powered content search
- `extract_document_content` - Advanced document processing
- `analyze_course_structure` - Course organization analysis
- `generate_study_guide` - AI study assistance

## Example Usage

### Natural Language Queries

**Grade Analysis:**
- "What's my current grade in Biology?"
- "What grade do I need on the final to get an A?"
- "Show me my grade trends this semester"

**Assignment Management:**
- "What assignments are due this week?"
- "Show me my latest essay submission"
- "What feedback did I get on my last assignment?"

**Study Assistance:**
- "Help me review my last quiz"
- "What topics should I study for the midterm?"
- "Generate a study guide for Chapter 5"

**Document Processing:**
- "Extract text from this PDF syllabus"
- "What are the key points in this lecture slide?"
- "Summarize this research paper"

## System Requirements

- **Node.js 18+** or **Docker Desktop**
- **Claude Desktop** application
- **Canvas API access token**
- **LlamaParse API key** (optional, for advanced document processing)

## Security & Privacy

- All data remains local to your machine
- API tokens are stored securely in environment variables
- No data is sent to external services (except LlamaParse for document processing)
- Full control over your academic information

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support & Documentation

- **Setup Guide:** [SETUP.md](SETUP.md)
- **Docker Guide:** [DOCKER-README.md](DOCKER-README.md)
- **Issues:** [GitHub Issues](https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server/issues)

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Transform your Canvas experience with AI-powered academic assistance through Claude Desktop integration.**
