# 🎓 Notioc Canvas MCP Server

> **The AI-powered Canvas assistant that transforms your academic experience**

A comprehensive Model Context Protocol (MCP) server providing seamless Canvas LMS integration through Claude Desktop. Turn your Canvas data into intelligent academic insights with 45 powerful tools and natural language interactions.

## ✨ **What Makes This Special**

### 🚀 **Complete Canvas Integration**
- **45 MCP Tools** covering every aspect of Canvas
- **Real-time grade analytics** with "what-if" calculations
- **Previous submission access** - review all your past work
- **Quiz content analysis** - study from completed quizzes
- **Smart file processing** - automatically read 60+ document types (PDF, DOCX, XLSX, PPTX, images, audio)
- **AI-powered insights** through Claude integration

### 🎯 **Key Features**

**📊 Academic Analytics**
- Grade tracking with performance insights
- "What grade do I need on the final?" calculations
- Course progress analysis and predictions

**� Assignment Management** 
- Access all previous submissions and feedback
- Download and review submitted files (PDF, DOCX, etc.)
- Smart assignment search and processing

**🎓 Quiz & Study Tools**
- Complete quiz review after submission
- Question analysis with correct answers
- Performance tracking across all quizzes

**📅 Planning & Organization**
- Calendar integration with due dates
- Course navigation and module tracking
- Syllabus analysis and policy extraction

**💬 Communication**
- Canvas messaging integration
- Discussion participation
- Professional email drafting

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- Canvas API access token
- Claude Desktop application

### **Installation**

```bash
# 1. Clone the repository
git clone https://github.com/Kuria-Mbatia/notioc-canvas-mcp-server.git
cd notioc-canvas-mcp-server

# 2. Install dependencies
npm install

# 3. Configure your Canvas credentials
cp .env.example .env
# Edit .env with your Canvas URL and API token

# 4. Build the project
npm run build

# 5. Configure Claude Desktop (see setup guide)
```

## ⚙️ **Configuration**

### **1. Get Your Canvas API Token**
1. Log into Canvas → Account → Settings
2. Scroll to "Approved Integrations" → "+ New Access Token"  
3. Name: "Notioc MCP Server", set expiration date
4. Copy the generated token

### **2. Environment Setup**
Create `.env` file:
```bash
CANVAS_BASE_URL=https://your-school.instructure.com
CANVAS_ACCESS_TOKEN=your_api_token_here

# Optional: LlamaParse for advanced document processing
LLAMA_CLOUD_API_KEY=your_llamaparse_api_key_here
ENABLE_LLAMAPARSE=false
LLAMA_PARSE_ALLOW_UPLOAD=false

NODE_ENV=production
```

**Optional LlamaParse Configuration:**
- `LLAMA_CLOUD_API_KEY`: API key from LlamaIndex for processing 60+ document types
- `ENABLE_LLAMAPARSE=true`: Enable advanced document extraction (requires API key)
- `LLAMA_PARSE_ALLOW_UPLOAD=true`: Allow uploading files to LlamaParse (privacy consideration)
- `LLAMA_ONLY=true`: Use only LlamaParse (disable local PDF parsing)

> **📄 Document Support**: With LlamaParse enabled, the server can process PDFs, Word docs, Excel sheets, PowerPoints, images (OCR), HTML, and 50+ other formats.

### **3. Claude Desktop Integration**
Add to Claude Desktop settings (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "notioc-canvas": {
      "command": "node",
      "args": ["path/to/notioc-canvas-mcp-server/dist/src/server.js"],
      "env": {
        "CANVAS_BASE_URL": "https://your-school.instructure.com",
        "CANVAS_ACCESS_TOKEN": "your_token_here"
      }
    }
  }
}
```

> � **Need help?** Check out our detailed setup guides:
> - [📖 Claude Desktop Setup](./CLAUDE-SETUP.md)
> - [🤖 ChatGPT Integration](./CHATGPT-SETUP.md) 
> - [🔧 Custom GPT Setup](./CUSTOM-GPT-SETUP.md)

## 🛠️ **Available Tools (45 Total)**

### **📊 Grades & Analytics**
- `get_grades` - Complete grade overview
- `calculate_course_analytics` - Performance insights  
- `generate_what_if_scenarios` - Grade predictions
- `get_grade_trends` - Progress tracking
- `get_gradebook_categories` - Weighted categories

### **📝 Assignments & Submissions**
- `get_assignments` - Assignment listings
- `get_assignment_details` - Detailed assignment info
- `get_previous_submission_content` - Review past work
- `list_submitted_assignments` - Submission history
- `download_submission_file` - File access
- `get_assignment_feedback` - Instructor comments
- `get_submission_comments` - Detailed feedback

### **🎓 Quiz & Study Tools**
- `list_quizzes` - Quiz listings
- `get_quiz_details` - Quiz information
- `get_quiz_submissions` - Your submissions
- `get_quiz_submission_content` - Complete quiz review

### **📅 Planning & Navigation**
- `get_calendar_events` - Due dates and events
- `list_modules` - Course modules
- `get_module_details` - Module information
- `get_course_navigation` - Course structure
- `get_course_syllabus` - Syllabus analysis

### **📁 Content & Files**
- `find_files` - Smart file search
- `read_file` - File content processing
- `process_file` - AI-powered file analysis
- `smart_search` - Intelligent content search

### **💬 Communication**
- `send_message` - Canvas messaging
- `list_conversations` - Message history
- `get_discussions` - Discussion access
- `post_discussion_reply` - Participate in discussions

### **🎯 Rubrics & Feedback**
- `get_assignment_rubric` - Rubric analysis
- `get_rubric_analysis` - Performance insights

## � **Example Conversations**

### **Academic Performance**
> *"What's my current grade in Computer Engineering and what do I need on the final to get an A?"*

> *"Show me all assignments due this week across my courses with urgency levels"*

> *"Review my last physics quiz - what did I get wrong and help me study for the next one"*

### **Assignment Management**  
> *"Find and process all files from my Math 451 homework submissions"*

> *"What feedback did my professor give on my latest programming assignment?"*

> *"Download my submitted file from yesterday's physics recitation"*

### **Course Planning**
> *"What modules do I need to complete in Operating Systems and what are the prerequisites?"*

> *"Extract the grading policy from my course syllabi"*

> *"Show my progress across all courses and identify areas needing attention"*

## 🎯 **Perfect For**

✅ **Students** seeking academic excellence  
✅ **Researchers** managing course workflows  
✅ **Anyone** wanting smarter Canvas interaction  
✅ **Power users** needing advanced academic analytics  

## 🤝 **Contributing**

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 **License**

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🎓 **Transform Your Academic Experience**

Turn Canvas from a basic LMS into your intelligent academic partner. Get insights, automate workflows, and achieve better grades through AI-powered analysis.

**Ready to revolutionize your Canvas experience?** 🚀
