# Notioc Canvas MCP Server

A next-generation Model Context Protocol (MCP) server that transforms Canvas LMS into an intelligent academic assistant. This server features advanced AI capabilities including predictive analytics, intelligent personas, seamless communication, and comprehensive academic intelligence to provide personalized, contextually-aware support for student success.

> ⚠️ **IMPORTANT**: This project requires you to use your own Canvas API token. Never share your `.env` file or API keys with others.

## ✨ Core Features

### 📚 **Comprehensive Course Management**
- **Course Discovery**: List and access all Canvas courses with automatic recognition
- **Assignment Intelligence**: Smart homework discovery with automated file processing
- **Module Navigation**: Complete module structure access and progression tracking
- **Quiz Integration**: Full quiz access, submissions, and performance analysis

### 💬 **Advanced Communication System**
- **Intelligent Messaging**: Send and receive Canvas messages with style adaptation
- **Discussion Participation**: Post replies and engage in threaded discussions
- **People Discovery**: Find and connect with classmates, instructors, and TAs
- **Conversation Management**: Complete inbox management and conversation history

### 🧠 **AI-Powered Intelligence**
- **Predictive Analytics**: Risk assessment and success prediction for academic outcomes
- **Student Personas**: Intelligent learning style analysis and communication adaptation
- **Engagement Forecasting**: Optimal interaction timing and method prediction
- **Progress Tracking**: Comprehensive learning journey visualization and insights

### 📄 **Smart Content Processing**
- **Natural Language Search**: Ask questions like "find homework 3 in math 451"
- **Automatic PDF Parsing**: Convert documents to discussable content instantly
- **File Discovery**: Intelligent extraction from assignments and embedded links
- **Knowledge Graphs**: Build comprehensive course understanding models

---

## 🧠 Advanced AI Capabilities

### 🔮 **Predictive Analytics Engine**
- **Risk Assessment**: Early identification of students who may struggle academically
- **Success Prediction**: Likelihood scoring for assignment and course completion
- **Engagement Forecasting**: Predict optimal interaction timing and communication methods
- **Intervention Recommendations**: Proactive support suggestions based on risk factors

### 🎯 **Intelligent Student Personas**
- **Learning Style Analysis**: Automatic detection of visual, auditory, and kinesthetic preferences
- **Communication Adaptation**: Messages and posts that match your authentic voice
- **Relationship Intelligence**: Understanding of academic and social connections
- **Academic Context Awareness**: Real-time understanding of workload and stress levels

### 🤖 **Autonomous Academic Assistant**
- **Smart Indexing Agent**: Lightning-fast local database of all course content
- **Semantic Q&A**: Natural language understanding for complex academic questions
- **Proactive Support**: Background monitoring with intelligent intervention suggestions
- **Self-Updating Knowledge**: Automatically maintains fresh course information

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

**Production Mode (with full AI features):**
```bash
npm start
```

**Development Mode (fast startup):**
```bash
npm run dev  # Skips indexing for instant startup during development
```

**For Full Autonomous Operation (Recommended):**
```bash
# Add these to your .env file:
ENABLE_BACKGROUND_INDEXING=true
RUN_INDEXER_ON_STARTUP=true
INDEXING_INTERVAL_HOURS=12
ENABLE_PERSONA_ANALYSIS=true
ENABLE_PREDICTIVE_ANALYTICS=true
```

## 🛠️ Complete Tool Reference

### 🔍 **Smart Discovery & Search**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `smart_search` | Natural language search across all content | "find homework 3 in math 451" |
| `get_homework` | Intelligent homework discovery with files | "get homework 3 for math 451" |
| `process_file` | Advanced file processing for discussion | "process file 176870249 for Q&A" |
| `find_files` | Smart file search with content filtering | "find all PDF files in circuits" |

### 📚 **Course & Content Management**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `get_courses` | Lists all Canvas courses with details | "show me my active courses" |
| `get_assignments` | Course assignments with smart file discovery | "what assignments are due this week?" |
| `list_modules` | Course module structure and progression | "show modules in operating systems" |
| `get_module_items` | Detailed module content and materials | "what's in module 3?" |
| `list_quizzes` | Available quizzes and assessment details | "show me upcoming quizzes" |
| `get_quiz_details` | Comprehensive quiz information | "details for quiz 2 in physics" |

### 💬 **Communication & Messaging**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `send_message` | Send personalized Canvas messages | "message my study group about project" |
| `reply_to_conversation` | Reply to existing conversations | "reply to instructor message" |
| `list_conversations` | View Canvas inbox and message history | "show my recent messages" |
| `post_discussion_reply` | Post authentic discussion responses | "reply to discussion topic 4" |
| `reply_to_discussion_entry` | Threaded discussion participation | "reply to Sarah's discussion post" |

### 👥 **People & Relationship Management**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `find_people` | Search for classmates and instructors | "find people in my math class" |
| `get_user_profile` | Get detailed user information | "show profile for John Smith" |
| `search_recipients` | Advanced recipient search for messaging | "find TAs in computer science" |

### 📄 **Pages & Discussions**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `get_pages` | Access course pages and materials | "show syllabus and course pages" |
| `read_page` | Read specific page content | "read the lab instructions page" |
| `get_discussions` | List discussions and announcements | "show recent announcements" |
| `read_discussion` | Read discussion topics and replies | "what's in the latest discussion?" |

### 🧠 **AI-Powered Analytics & Intelligence**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `assess_student_risk` | Predict academic risk and intervention needs | "assess my current academic risk" |
| `predict_success` | Forecast assignment/course success probability | "predict my success on upcoming exam" |
| `forecast_engagement` | Optimal interaction timing and methods | "when should I contact my professor?" |
| `analyze_study_relationships` | Map collaborative learning networks | "analyze my study group effectiveness" |
| `build_knowledge_graph` | Comprehensive course understanding model | "build knowledge graph for chemistry" |
| `generate_qa_prompt` | Intelligent Q&A using all course data | "what's the grading policy for labs?" |

### 🎯 **Persona & Learning Intelligence**
| Tool Name | Description | Example Usage |
|-----------|-------------|---------------|
| `analyze_writing_style` | Understand your communication patterns | "analyze my discussion writing style" |
| `get_academic_context` | Current workload and stress assessment | "what's my current academic situation?" |
| `generate_personalized_message` | Messages that match your authentic voice | "draft email to professor about extension" |
| `suggest_collaboration_partners` | Find optimal study partners | "who should I work with on this project?" |

## 🎯 Natural Language Examples

### **Academic Intelligence:**
- "Assess my risk for failing organic chemistry"
- "Predict my success on the upcoming physics exam"
- "When is the best time to email my professor?"
- "Who should I collaborate with on this project?"

### **Smart Communication:**
- "Send a message to my study group about meeting tomorrow"
- "Draft a professional email to my advisor about course planning"
- "Reply to the discussion about renewable energy"
- "Find all TAs in my computer science courses"

### **Content Discovery:**
- "Find homework 3 in math 451 and process all files"
- "What assignments are due this week across all courses?"
- "Show me all quiz submissions for chemistry"
- "Build a knowledge graph for my operating systems course"

### **Learning Support:**
- "Analyze my writing style from discussion posts"
- "What's my current academic workload and stress level?"
- "Generate study recommendations based on my learning patterns"
- "Show my progress tracking across all courses"

## 📊 Advanced AI Features

### 🔮 **Predictive Analytics**
- **Risk Assessment**: Identifies students at risk of academic difficulties with 85%+ accuracy
- **Success Prediction**: Forecasts assignment and course completion probabilities
- **Engagement Optimization**: Predicts optimal communication timing and methods
- **Intervention Recommendations**: Suggests personalized support strategies

### 🧠 **Intelligent Personas**
- **Writing Style Analysis**: Learns your authentic communication patterns
- **Relationship Mapping**: Understands your academic and social connections
- **Learning Preference Detection**: Identifies optimal learning approaches
- **Context-Aware Responses**: Adapts communication based on recipient and situation

### 🤝 **Advanced Relationship Intelligence**
- **Collaboration Effectiveness Scoring**: Rates potential partnership success
- **Group Dynamics Analysis**: Understands team interaction patterns
- **Peer Influence Mapping**: Identifies positive academic influences
- **Social Support Network Analysis**: Maps emotional and academic support systems

## ⚙️ Configuration

### Get Your Canvas API Token

1. Log into your Canvas instance
2. Go to Account → Settings
3. Scroll down to "Approved Integrations"
4. Click "+ New Access Token"
5. Give it a purpose name (e.g., "Notioc MCP Server") and expiration date
6. Copy the generated token to your `.env` file's `CANVAS_ACCESS_TOKEN` field
7. Ensure the `CANVAS_BASE_URL` matches your institution (e.g., `https://psu.instructure.com`)

### 🤖 Full AI Assistant Mode (Recommended)

Enable complete autonomous operation with all AI features:

```bash
# Core Settings
ENABLE_BACKGROUND_INDEXING=true
RUN_INDEXER_ON_STARTUP=true
INDEXING_INTERVAL_HOURS=12

# AI Features
ENABLE_PERSONA_ANALYSIS=true
ENABLE_PREDICTIVE_ANALYTICS=true
ENABLE_RELATIONSHIP_INTELLIGENCE=true

# Advanced Features
ENABLE_RISK_ASSESSMENT=true
ENABLE_SUCCESS_PREDICTION=true
ENABLE_ENGAGEMENT_FORECASTING=true
```

**Benefits of Full AI Mode:**
- 🧠 **Predictive Intelligence**: Early warning systems for academic challenges
- 🎯 **Personalized Support**: Recommendations tailored to your learning style
- 🤖 **Autonomous Operation**: Self-maintaining with zero manual intervention
- ⚡ **Instant Insights**: Lightning-fast responses from comprehensive local analysis

## 🎉 What's New in v2.0

### 🔮 **Predictive Analytics Engine**
- **Risk Assessment**: Early identification of academic struggles with intervention recommendations
- **Success Prediction**: Probability scoring for assignments, quizzes, and courses
- **Engagement Forecasting**: Optimal interaction timing and communication method prediction
- **Performance Trend Analysis**: Learning trajectory insights and improvement suggestions

### 🧠 **Intelligent Persona System**
- **Writing Style Analysis**: Authentic communication pattern learning and adaptation
- **Academic Context Awareness**: Real-time understanding of workload, deadlines, and stress
- **Relationship Intelligence**: Mapping of academic and social connections
- **Learning Style Detection**: Personalized study approach recommendations

### 💬 **Advanced Communication Suite**
- **Canvas Messaging**: Send and receive messages with style adaptation
- **Discussion Participation**: Post authentic replies and engage in threaded discussions
- **People Discovery**: Find classmates, instructors, and collaboration partners
- **Professional Communication**: Draft emails and messages with appropriate formality

### 📊 **Comprehensive Academic Coverage**
- **Quiz Integration**: Full quiz access, submissions, and performance analysis
- **Module Navigation**: Complete module structure and progression tracking
- **Advanced File Processing**: Enhanced PDF parsing and content discussion
- **Knowledge Graph Generation**: Structured course understanding models

## 🎯 Previous Features (v1.x)

### v1.1 Features:
- **📊 Clean Progress Display**: Beautiful indexing progress with real-time updates
- **📏 Smart Text Truncation**: Intelligent content formatting
- **⚡ Enhanced UX**: Professional indexing experience

### v1.0 Core Features:
- **🔍 Natural Language Search**: Plain English content discovery
- **📄 PDF Processing**: Automatic text extraction and discussion
- **🤖 Smart File Discovery**: Multi-source homework file detection
- **⚡ Fast Dev Mode**: Instant startup for development

---

## 🚀 The Complete Academic AI Assistant

The Notioc Canvas MCP Server is now a comprehensive academic intelligence platform that not only accesses Canvas content but actively supports student success through:

- **🧠 Predictive Intelligence**: Anticipating academic challenges before they become problems
- **🎯 Personalized Support**: Adapting to each student's unique learning style and communication patterns
- **🤖 Autonomous Operation**: Self-maintaining system that continuously learns and improves
- **💬 Seamless Communication**: Natural interaction with the entire Canvas ecosystem
- **📊 Comprehensive Analytics**: Deep insights into learning patterns and academic progress

*Transform your Canvas experience from passive content access to active academic partnership!* 🎓
