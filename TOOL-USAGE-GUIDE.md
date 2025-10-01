# 📚 Canvas MCP Server - Tool Usage Guide for LLMs

This guide helps AI assistants (like Claude) effectively use the Canvas MCP Server's 45 tools to help users with their Canvas LMS needs.

## 🎯 Quick Start for LLMs

### Core Principle: Always Start with Context
```
User asks about course → get_courses first to find course ID
User asks about specific assignment → get_assignments to list them
User asks vague question → smart_search for intelligent discovery
```

### Tool Discovery
Use the new **`get_tool_help`** tool to:
- Get detailed help for any specific tool
- Search for tools by keywords
- See complete tool overview with examples

**Examples:**
```
get_tool_help(toolName="smart_search") → Detailed documentation
get_tool_help(searchQuery="grades") → Find all grade-related tools  
get_tool_help(toolName="all") → Complete tool reference
```

## 📊 Tool Categories

### 🧭 Course Discovery & Navigation
**Start here when:**
- User doesn't specify course ID
- User wants course overview
- User needs to understand course structure

**Tools:**
- `get_courses` - List all courses (ALWAYS use first if no course ID)
- `get_course_navigation` - Module structure with prerequisites
- `get_course_syllabus` - Course policies and overview
- `list_modules` - List course modules
- `get_module_details` - Detailed module information

**Example Flow:**
```
User: "What's in my Biology course?"
1. get_courses → find "Biology 101" (ID: 12345)
2. get_course_navigation → show module structure
3. get_course_syllabus → show policies
```

### 📝 Assignment Management
**Start here when:**
- User mentions homework, projects, or assignments
- User wants to review requirements
- User needs submission information

**Tools:**
- `get_assignments` - List assignments in course
- `get_assignment_details` - Full assignment description + files
- `get_assignment_rubric` - Grading criteria
- `get_previous_submission_content` - Your submitted files
- `list_submitted_assignments` - See what's been submitted
- `get_submission_comments` - Feedback from instructor
- `get_detailed_submission` - Complete submission + feedback

**Example Flow:**
```
User: "Show me my Essay 2 submission and feedback"
1. get_courses → find English course
2. list_submitted_assignments → confirm Essay 2 was submitted
3. get_previous_submission_content → get submitted files
4. get_detailed_submission → get feedback + rubric scores
```

### 📊 Grades & Analytics
**Start here when:**
- User asks "what's my grade?"
- User asks "what grade do I need?"
- User wants performance analysis

**Tools:**
- `calculate_course_analytics` - **BEST for grade questions** (comprehensive analysis)
- `get_grades` - Simple grade retrieval
- `generate_what_if_scenarios` - "What grade do I need?" calculator
- `get_grade_trends` - Performance over time
- `get_gradebook_categories` - Grade weighting

**Example Flow:**
```
User: "What's my current grade in Chemistry?"
1. get_courses → find Chemistry course
2. calculate_course_analytics → get complete analysis
   Response includes: current grade, category breakdown, trends

User: "What do I need on the final to get an A?"
1. calculate_course_analytics → get current standing
2. generate_what_if_scenarios(targetGrade=90) → calculate needed score
```

### 📚 Quiz & Assessment Review
**Start here when:**
- User wants to study from past quizzes
- User mentions quiz review
- User wants to see quiz mistakes

**Tools:**
- `list_quizzes` - List quizzes in course
- `get_quiz_details` - Quiz information
- `get_quiz_submission_content` - **BEST for studying** (questions + answers + feedback)
- `get_quiz_submissions` - Quiz attempts history

**Example Flow:**
```
User: "Help me review my last Biology quiz"
1. get_courses → find Biology course
2. list_quizzes → find recent quizzes
3. get_quiz_submission_content → get questions, answers, feedback
4. Analyze: highlight incorrect answers, suggest review topics
```

### 📁 File Management
**Start here when:**
- User needs lecture slides/notes
- User wants to read course documents
- User asks "find [file]"

**Tools:**
- `smart_search` - **BEST for finding files** (AI-powered, handles restrictions)
- `find_files` - List files in course
- `read_file` - Read specific file by name
- `read_file_by_id` - Read file by Canvas ID
- `process_file` - Process file for Q&A
- `download_submission_file` - Download submission files

**Example Flow:**
```
User: "Find lecture slides about photosynthesis"
1. get_courses → find Biology course (if not specified)
2. smart_search(query="photosynthesis slides") → ranked results
3. read_file_by_id(fileId=...) → read content if needed

Alternative if smart_search not available:
1. find_files(searchTerm="photosynthesis") → list matching files
2. read_file_by_id → read content
```

### 📖 Course Content
**Start here when:**
- User wants to read course pages
- User mentions discussions/forums
- User wants to participate in discussions

**Tools:**
- `get_pages` - List pages in course
- `read_page` - Read specific page content
- `get_discussions` - List discussion topics
- `read_discussion` - Read discussion with replies
- `post_discussion_reply` - Post to discussion
- `reply_to_discussion_entry` - Reply to specific post

**Example Flow:**
```
User: "What does the syllabus page say?"
1. get_courses → find course
2. get_pages(searchTerm="syllabus") → find syllabus page
3. read_page(pageUrl="syllabus") → read content
```

### 💬 Communication
**Start here when:**
- User wants to send messages
- User mentions Canvas inbox
- User needs to contact someone

**Tools:**
- `send_message` - Send new message
- `reply_to_conversation` - Reply to existing conversation
- `list_conversations` - View inbox
- `get_conversation_details` - Read conversation
- `find_people` - Find users in course
- `search_recipients` - Search for message recipients
- `get_user_profile` - View user profile

### 📅 Calendar & Scheduling
**Start here when:**
- User asks "what's due?"
- User mentions deadlines
- User wants to see schedule

**Tools:**
- `get_calendar_events` - Get calendar events and due dates

**Example Flow:**
```
User: "What assignments are due this week?"
1. get_courses → get all active courses
2. For each course: get_calendar_events(startDate=today, endDate=+7days)
3. Sort all events by date
4. Present organized list
```

### 🔍 Advanced Features
**Start here when:**
- Basic searches fail
- Canvas APIs are restricted
- User has vague queries

**Tools:**
- `smart_search` - **Most powerful search tool**
  - Handles API restrictions
  - Web discovery fallback
  - Semantic ranking
  - Intent classification

**When to use smart_search:**
- ✅ "Find homework 3 files"
- ✅ "Get assignment instructions"
- ✅ User says "I can't find..."
- ✅ Other file tools fail
- ✅ Vague queries

**Example:**
```
smart_search(
  query="homework 3 instructions", 
  courseId="12345",
  returnMode="refs"  // More efficient
)
```

## 🔄 Common Workflows

### Workflow 1: Check What's Due
```
User: "What do I have due this week?"

Steps:
1. get_courses (enrollmentState="active")
2. For each course:
   - get_calendar_events(startDate=today, endDate=+7days)
   OR
   - get_assignments → filter by due_at
3. Combine and sort by date
4. Present: "You have 5 assignments due this week:"
   - [Date] Course: Assignment Name (Points)
```

### Workflow 2: Grade Check
```
User: "What's my grade in Chemistry?"

Steps:
1. get_courses → find Chemistry (courseId: 67890)
2. calculate_course_analytics(courseId="67890")
3. Present:
   - Current Grade: 87.5% (B+)
   - Category Breakdown (with weights)
   - Upcoming assignments
   - Performance trend
4. Offer: "Would you like to know what grade you need on remaining work?"
```

### Workflow 3: Grade Prediction
```
User: "What do I need on the final to get an A?"

Steps:
1. get_courses → find course
2. calculate_course_analytics → get current standing
3. generate_what_if_scenarios(targetGrade=90 or targetLetterGrade="A")
4. Present: "To get an A (90%), you need:"
   - Final Exam: 92% or higher
   - Explanation of calculation
   - Feasibility assessment
```

### Workflow 4: Assignment Review
```
User: "What do I need to do for the final project?"

Steps:
1. get_courses → find course
2. get_assignments → find "final project"
3. get_assignment_details(assignmentName="final project")
   - Gets description + attached files
4. get_assignment_rubric (optional but helpful)
5. Present:
   - Due date & points
   - Requirements
   - Attached files (with IDs for reading)
   - Grading criteria
```

### Workflow 5: Submission Review
```
User: "Show me my last essay and what feedback I got"

Steps:
1. get_courses → find course
2. list_submitted_assignments → see what's been submitted
3. get_previous_submission_content(assignmentName="essay")
   - Gets submitted files
4. get_detailed_submission(assignmentName="essay")
   - Gets feedback, comments, rubric
5. Present:
   - Submitted files (with content preview)
   - Score and grade
   - Instructor comments
   - Rubric assessment
```

### Workflow 6: Quiz Study Session
```
User: "Help me review my Biology quiz so I can study"

Steps:
1. get_courses → find Biology
2. list_quizzes → find recent quiz
3. get_quiz_submission_content(quizName="Quiz 3")
4. Analyze results:
   - Overall score
   - Correct vs incorrect questions
   - Topics with mistakes
5. Present:
   - Performance summary
   - Each question with your answer and correct answer
   - "Focus on these topics: [list]"
```

### Workflow 7: Find Content
```
User: "Find the lecture slides about quantum mechanics"

Steps:
1. get_courses → find Physics course (if not specified)
2. smart_search(query="quantum mechanics lecture slides", returnMode="refs")
3. Present ranked results:
   - "Found 5 relevant files:"
   - File 1: "Lecture_Quantum_Mechanics.pdf" (Relevance: 0.95)
   - File 2: "QM_Slides_Week3.pptx" (Relevance: 0.87)
4. Offer: "Would you like me to read any of these files?"
```

## 🚨 Error Handling

### Course Not Found
```javascript
Error: "Could not find course 'bio'"

Recovery:
1. Call get_courses
2. Show user list: "I found these courses: [list]"
3. Ask: "Which course did you mean?"
4. Use fuzzy matching: "bio" → "Biology 101"
```

### API Restrictions
```javascript
Error: "Access denied" or "Permission denied"

Recovery:
1. Explain: "Some Canvas APIs are restricted at your institution"
2. Try smart_search as alternative
3. It uses web discovery fallback
```

### File Not Found
```javascript
Error: "File not found"

Recovery:
1. Use smart_search instead of specific file tools
2. Or use find_files to list all files
3. Suggest: "I couldn't find that exact file, but here are similar files..."
```

### Assignment Not Found
```javascript
Error: "Assignment not found: 'hw3'"

Recovery:
1. Call get_assignments to list all
2. Use fuzzy matching: "hw3" → "Homework 3: Thermodynamics"
3. Ask user to clarify
```

## 💡 Best Practices

### 1. Always Confirm Course Selection
When course name is ambiguous:
```
User: "Check my math homework"
You: "I found 2 math courses:"
     - MATH 140: Calculus I
     - MATH 251: Linear Algebra
     "Which one?"
```

### 2. Be Specific with Dates
```
❌ Bad: "due soon"
✅ Good: "due October 15, 2024 at 11:59 PM (5 days from now)"
```

### 3. Provide Context in Responses
```
❌ Bad: "Your grade is 87.5%"
✅ Good: "Your current grade in Chemistry is 87.5% (B+)
         - Exams: 85% (40% weight)
         - Homework: 92% (30% weight)
         - Labs: 88% (20% weight)
         You're doing well! 🎉"
```

### 4. Offer Next Steps
```
After showing grades:
"Would you like me to:
- Calculate what you need on remaining assignments?
- Show your grade trends over time?
- Check upcoming due dates?"
```

### 5. Use smart_search for Efficiency
```
Instead of:
1. find_files
2. For each file: read_file
3. Filter and rank manually

Use:
smart_search(query="homework 3", returnMode="refs")
→ Returns pre-ranked, relevant results
```

### 6. Handle Multi-Course Queries Efficiently
```
User: "What's due this week?"

Instead of querying each course sequentially:
- Get all courses once
- Query calendars in parallel (conceptually)
- Combine and sort results
- Present organized by date
```

## 🎓 Advanced Tips

### Efficient Parameter Usage

**smart_search parameters:**
```typescript
{
  returnMode: "refs", // Faster, more efficient (default)
  maxResults: 5,      // Limit results for speed (default)
  useSmallModel: true // Intent classification + reranking (default)
}
```

### When to Use What

**For grades:**
- Use `calculate_course_analytics` (not just `get_grades`)
- It provides comprehensive analysis in one call

**For files:**
- Use `smart_search` first (handles restrictions, ranks results)
- Fall back to `find_files` + `read_file` if needed

**For assignments:**
- Use `get_assignment_details` (includes files)
- Not just `get_assignments` (which only lists)

**For quiz review:**
- Use `get_quiz_submission_content` (complete study tool)
- Not just `get_quiz_submissions` (which only shows attempts)

## 🔧 Tool Selection Decision Tree

```
START: What does the user want?

├─ Grades?
│  ├─ Current grade → calculate_course_analytics
│  ├─ "What if?" → generate_what_if_scenarios
│  └─ Over time → get_grade_trends
│
├─ Assignments?
│  ├─ List them → get_assignments
│  ├─ Details → get_assignment_details
│  ├─ Past submission → get_previous_submission_content
│  └─ Feedback → get_detailed_submission
│
├─ Files/Content?
│  ├─ Vague query → smart_search
│  ├─ Specific file → read_file_by_id
│  └─ List files → find_files
│
├─ Quiz review?
│  └─ get_quiz_submission_content (comprehensive)
│
├─ What's due?
│  └─ get_calendar_events
│
├─ Course info?
│  ├─ Structure → get_course_navigation
│  ├─ Syllabus → get_course_syllabus
│  └─ Modules → list_modules
│
└─ Need help?
   └─ get_tool_help (this tool!)
```

## 📖 Getting Help

Use the `get_tool_help` tool anytime:

```javascript
// Get help for specific tool
get_tool_help({ toolName: "smart_search" })

// Search for tools
get_tool_help({ searchQuery: "grades" })

// See all tools
get_tool_help({ toolName: "all" })
```

## 🎯 Remember

1. **Start with get_courses** if you need a course ID
2. **Use smart_search** for intelligent file discovery
3. **calculate_course_analytics** is best for grade questions
4. **get_detailed_submission** combines submission + feedback
5. **get_quiz_submission_content** is perfect for studying
6. **Always offer next steps** to the user
7. **Handle errors gracefully** with alternatives
8. **Be specific** with dates and context

---

**This guide was created to help LLMs like Claude use Canvas MCP Server effectively. For more details on any tool, use `get_tool_help(toolName="[tool]")`.**
