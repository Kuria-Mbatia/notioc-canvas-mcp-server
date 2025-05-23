# Notioc Canvas MCP Server - Usage Examples

This file contains examples of how to use the Notioc Canvas MCP Server with AI assistants like Claude.

## Setup

Before using these examples, ensure you have:
1. Configured your Canvas API credentials in `.env`
2. Built the MCP server with `npm run build`
3. Configured your AI assistant to use the MCP server

## Example Conversations

### Getting Started - List Your Courses

**You:** "What courses am I enrolled in?"

**AI Assistant:** The assistant will use the `list_courses` tool to show your active Canvas courses.

**Expected Output:**
```json
{
  "success": true,
  "courses": [
    {
      "id": "12345",
      "name": "Introduction to Computer Science",
      "courseCode": "CS101",
      "enrollmentState": "active"
    },
    {
      "id": "12346", 
      "name": "Calculus I",
      "courseCode": "MATH101",
      "enrollmentState": "active"
    }
  ],
  "message": "Found 2 courses"
}
```

### Course Assignments

**You:** "Show me the assignments for my Computer Science course"

**AI Assistant:** The assistant will:
1. First list your courses to find the Computer Science course ID
2. Then use `list_assignments` with that course ID

**Expected Output:**
```json
{
  "success": true,
  "assignments": [
    {
      "id": "67890",
      "name": "Programming Assignment 1",
      "description": "Write a Python program that...",
      "dueAt": "2024-01-15T23:59:00Z",
      "pointsPossible": 100,
      "submissionTypes": ["online_text_entry", "online_upload"]
    }
  ],
  "message": "Found 5 assignments in course 12345"
}
```

### File Search

**You:** "Find all files related to 'homework' in my CS course"

**AI Assistant:** Uses `search_files` to find homework-related files.

**Expected Output:**
```json
{
  "success": true,
  "files": [
    {
      "id": "54321",
      "name": "Homework 1 - Variables and Data Types.pdf",
      "type": "File",
      "moduleId": "111",
      "moduleName": "Week 1: Introduction"
    },
    {
      "id": "54322",
      "name": "Homework 2 Solution Guide.pdf", 
      "type": "File",
      "moduleId": "112",
      "moduleName": "Week 2: Control Structures"
    }
  ],
  "message": "Found 2 files matching \"homework\" in course 12345"
}
```

### Getting File Content

**You:** "What does the syllabus say about the grading policy?"

**AI Assistant:** Will:
1. Search for the syllabus file using `get_file_content` with fileName "syllabus"
2. Extract the content and provide information about grading policy

**You:** "Get the content of the Week 3 lecture notes"

**AI Assistant:** Uses `get_file_content` to find and retrieve the lecture notes.

### Advanced Queries

**You:** "Are there any assignments due this week in my math course?"

**AI Assistant:** Will:
1. List courses to find the math course
2. Get assignments for that course
3. Filter and analyze due dates
4. Provide a summary of upcoming assignments

**You:** "Compare the grading policies across all my courses"

**AI Assistant:** Will:
1. List all courses
2. Search for syllabus files in each course
3. Extract grading policy information from each
4. Provide a comparison

## Common Use Cases

### Academic Planning
- "What assignments do I have due next week?"
- "Show me the schedule for my biology course"
- "What's the final exam date for calculus?"

### Content Access
- "Find the reading list for this week"
- "Get the lab instructions for chemistry"
- "What resources are available for the midterm?"

### Course Overview
- "Summarize the learning objectives for my psychology course"
- "What topics will be covered in the next module?"
- "How is participation graded in my literature class?"

### Research and Study
- "Find all lecture slides about neural networks"
- "Get the research paper requirements for my history course"
- "What are the key concepts from Week 5 materials?"

## Tips for Effective Use

### Be Specific
Instead of: "Show me files"
Try: "Find PDF files related to assignments in my computer science course"

### Use Natural Language
The AI can understand context:
- "syllabus" → Will find course syllabus files
- "assignments due soon" → Will check due dates
- "lecture notes from last week" → Will search recent materials

### Combine Requests
You can ask complex questions that require multiple tool calls:
- "Compare assignment weights across all my courses"
- "Find study materials for my upcoming exams"
- "What readings are assigned for next week in all courses?"

## Troubleshooting Examples

### When Files Can't Be Found
**You:** "Get the content of the assignment rubric"

**AI Response:** "I couldn't find a file matching 'assignment rubric' in the course. Available files include: 'Assignment 1 Guidelines.pdf', 'Grading Criteria.docx', 'Project Rubric Template.pdf'"

### When Courses Aren't Accessible
**AI Response:** "Access denied: Cannot access course modules. This might be due to token permissions or course settings."

### When Content Can't Be Processed
**AI Response:** "I found the file 'Lecture Recording.mp4', but I cannot process its format (video/mp4). I can only process text files and PDFs."

## Best Practices

1. **Start Simple**: Begin with basic requests like listing courses
2. **Be Patient**: Complex requests may require multiple API calls
3. **Provide Context**: Mention course names or specific files when possible
4. **Check Permissions**: Ensure your Canvas token has appropriate access
5. **Use Descriptive Names**: When referencing files, use descriptive terms

## Error Handling

The MCP server provides detailed error messages:

- **Configuration Issues**: Check your `.env` file
- **Permission Errors**: Verify Canvas API token permissions  
- **Network Issues**: Check Canvas instance URL and connectivity
- **File Access**: Ensure files are published and accessible

For more detailed troubleshooting, see the README.md file.
