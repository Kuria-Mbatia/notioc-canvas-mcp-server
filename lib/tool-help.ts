/**
 * Enhanced Tool Help System
 * Provides detailed help and examples for Canvas MCP tools
 */

import { TOOL_CATEGORIES, TOOL_WORKFLOWS, getToolCategory, findWorkflowsForTool } from './tool-metadata.js';

export interface ToolHelpInfo {
  name: string;
  description: string;
  category: string;
  useCases: string[];
  examples: Array<{
    scenario: string;
    query: string;
    expected: string;
  }>;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  relatedTools: string[];
  workflows: string[];
  tips: string[];
  commonErrors: Array<{
    error: string;
    solution: string;
  }>;
}

export const TOOL_HELP_DATABASE: Record<string, ToolHelpInfo> = {
  get_current_courses: {
    name: "get_current_courses",
    category: "discovery",
    description: "🎯 SMART TOOL: Get ONLY currently active courses (running this semester/term)",
    
    useCases: [
      "User asks 'what are my courses' or 'my current courses'",
      "User asks 'what's due this week' (use this FIRST to identify courses)",
      "User asks about assignments, grades, or content in their 'active' courses",
      "You need to know which courses are actually running right now (not past/future)",
      "User wants to see courses relevant to the current academic term"
    ],
    
    examples: [
      {
        scenario: "User wants to see current courses",
        query: "What are my current courses?",
        expected: "Returns ONLY courses running this semester with term dates and context"
      },
      {
        scenario: "User asks what's due this week",
        query: "Use get_current_courses FIRST to identify active courses, then query assignments",
        expected: "Get course IDs from this tool, then use get_assignments for each course"
      }
    ],
    
    parameters: [
      {
        name: "includeUpcoming",
        type: "boolean",
        required: false,
        description: "Set to true to also show courses starting in next 4 weeks"
      },
      {
        name: "includeRecentlyCompleted",
        type: "boolean",
        required: false,
        description: "Set to true to also show courses that ended recently"
      }
    ],
    
    relatedTools: ["get_courses", "get_assignments", "smart_search"],
    workflows: ["check_assignments_workflow", "grade_checking_workflow"],
    
    tips: [
      "🔥 USE THIS INSTEAD OF get_courses for 'what's due' queries!",
      "This tool automatically filters to ONLY courses running right now",
      "It provides context about which courses are current vs upcoming vs past",
      "Start with this tool before querying assignments/grades in 'my courses'",
      "The output tells you exactly which Course IDs to use for follow-up queries"
    ],
    
    commonErrors: [
      {
        error: "No current courses found",
        solution: "User might be between semesters. Set includeUpcoming=true or ask user which specific course"
      }
    ]
  },
  
  get_courses: {
    name: "get_courses",
    category: "discovery",
    description: "Get ALL Canvas courses (including past and future). ⚠️ Consider using get_current_courses instead for 'my courses' queries.",
    useCases: [
      "Starting point for any course-related query",
      "Finding course IDs for subsequent tool calls",
      "Checking which courses you're enrolled in",
      "Finding completed courses for reference"
    ],
    examples: [
      {
        scenario: "User wants to see their current classes",
        query: "What courses am I taking this semester?",
        expected: "Returns list of active courses with IDs, names, and course codes"
      },
      {
        scenario: "User wants to reference a past course",
        query: "Show me my completed courses",
        expected: "Use enrollmentState='completed' to get past courses"
      }
    ],
    parameters: [
      {
        name: "enrollmentState",
        type: "string",
        required: false,
        description: "Filter by 'active', 'completed', or 'all'. Defaults to 'active'"
      }
    ],
    relatedTools: ["get_course_navigation", "get_course_syllabus", "list_modules"],
    workflows: ["Most workflows start here to get course ID"],
    tips: [
      "Always use this first if you don't have a course ID",
      "Course names can be fuzzy-matched for user convenience",
      "Returns course codes which users often refer to (e.g., 'MATH 451')"
    ],
    commonErrors: [
      {
        error: "No courses found",
        solution: "Check Canvas API token permissions or enrollment status"
      }
    ]
  },
  
  smart_search: {
    name: "smart_search",
    description: "AI-powered intelligent search across course content with automatic API restriction handling",
    category: "Advanced Features",
    useCases: [
      "Finding files with vague descriptions",
      "When specific file/page tools fail",
      "Discovering content when APIs are restricted",
      "Semantic search across course materials"
    ],
    examples: [
      {
        scenario: "User needs homework files",
        query: "Find homework 3 files in Math 451",
        expected: "Intelligently searches for relevant files, pages, and links related to 'homework 3'"
      },
      {
        scenario: "User needs topic-specific materials",
        query: "Get lecture slides about photosynthesis",
        expected: "Finds and ranks all materials related to photosynthesis"
      },
      {
        scenario: "Canvas APIs restricted",
        query: "Find any assignment instructions",
        expected: "Uses web discovery as fallback to find content even when APIs blocked"
      }
    ],
    parameters: [
      {
        name: "query",
        type: "string",
        required: true,
        description: "Natural language search query"
      },
      {
        name: "courseId",
        type: "string",
        required: false,
        description: "Course ID or use courseName instead"
      },
      {
        name: "courseName",
        type: "string",
        required: false,
        description: "Course name as alternative to courseId"
      },
      {
        name: "maxResults",
        type: "number",
        required: false,
        description: "Limit results (default: 5 for efficiency)"
      },
      {
        name: "returnMode",
        type: "string",
        required: false,
        description: "'refs' for compact citations, 'full' for detailed results (default: 'refs')"
      }
    ],
    relatedTools: ["find_files", "get_pages", "get_discussions", "read_file_by_id"],
    workflows: ["Use as primary search tool", "Fallback when specific tools fail"],
    tips: [
      "Most powerful search tool - uses AI and web discovery",
      "Works even when Canvas APIs are restricted",
      "Use returnMode='refs' for faster, more efficient responses",
      "Automatically ranks results by relevance",
      "Can process 94+ file types with LlamaParse integration"
    ],
    commonErrors: [
      {
        error: "No results found",
        solution: "Try broader search terms or check if course has restricted APIs"
      },
      {
        error: "Course ID required",
        solution: "Use get_courses first to find the course ID"
      }
    ]
  },
  
  calculate_course_analytics: {
    name: "calculate_course_analytics",
    description: "Comprehensive grade analysis including current grades, category breakdown, and performance insights",
    category: "Grades & Analytics",
    useCases: [
      "Checking current grade in a course",
      "Understanding grade breakdown by category",
      "Seeing which assignments impact grade most",
      "Getting overall performance summary"
    ],
    examples: [
      {
        scenario: "User wants their current grade",
        query: "What's my current grade in Biology?",
        expected: "Returns overall grade percentage, category breakdown, upcoming assignments"
      },
      {
        scenario: "User wants to understand grade composition",
        query: "How is my Chemistry grade calculated?",
        expected: "Shows weighted categories, points earned vs possible in each category"
      }
    ],
    parameters: [
      {
        name: "courseId",
        type: "string",
        required: false,
        description: "Course ID or use courseName"
      },
      {
        name: "courseName",
        type: "string",
        required: false,
        description: "Course name to search for"
      },
      {
        name: "userId",
        type: "string",
        required: false,
        description: "User ID (defaults to current user)"
      }
    ],
    relatedTools: ["get_grades", "get_gradebook_categories", "generate_what_if_scenarios", "get_grade_trends"],
    workflows: ["Used in grade checking workflow", "Followed by what-if scenarios"],
    tips: [
      "Use this instead of get_grades for comprehensive analysis",
      "Shows both current and projected grades",
      "Identifies missing assignments affecting grade",
      "Provides context for grade trends"
    ],
    commonErrors: [
      {
        error: "Course not found",
        solution: "Use get_courses to find correct course ID or name"
      },
      {
        error: "Grades not available",
        solution: "Check if grades are published in Canvas or if user has permission"
      }
    ]
  },
  
  generate_what_if_scenarios: {
    name: "generate_what_if_scenarios",
    description: "Calculate required grades on future assignments to achieve target grade",
    category: "Grades & Analytics",
    useCases: [
      "Answering 'what grade do I need?' questions",
      "Planning study priorities",
      "Understanding impact of upcoming assignments",
      "Goal setting for final grades"
    ],
    examples: [
      {
        scenario: "User wants to get an A",
        query: "What grade do I need on the final to get an A in Physics?",
        expected: "Calculates exact score needed on remaining assignments to reach 90%+"
      },
      {
        scenario: "User wants to maintain current grade",
        query: "What scores do I need to keep my B+ in English?",
        expected: "Shows minimum scores needed to maintain 87-89% range"
      }
    ],
    parameters: [
      {
        name: "courseId",
        type: "string",
        required: false,
        description: "Course ID or use courseName"
      },
      {
        name: "targetGrade",
        type: "number",
        required: false,
        description: "Target percentage (e.g., 90 for 90%)"
      },
      {
        name: "targetLetterGrade",
        type: "string",
        required: false,
        description: "Target letter grade (e.g., 'A', 'B+')"
      }
    ],
    relatedTools: ["calculate_course_analytics", "get_grades", "get_gradebook_categories"],
    workflows: ["Follows calculate_course_analytics in grade prediction workflow"],
    tips: [
      "Use calculate_course_analytics first to get current standing",
      "Can target specific percentage or letter grade",
      "Accounts for weighted categories",
      "Shows scenarios for each remaining assignment"
    ],
    commonErrors: [
      {
        error: "Target grade unreachable",
        solution: "Explain mathematically why target can't be achieved and suggest realistic alternatives"
      }
    ]
  },
  
  get_previous_submission_content: {
    name: "get_previous_submission_content",
    description: "Access previously submitted assignment files and content for review",
    category: "Assignment Management",
    useCases: [
      "Reviewing what you submitted",
      "Accessing past work for reference",
      "Checking submission history",
      "Verifying file uploads"
    ],
    examples: [
      {
        scenario: "User wants to see their essay",
        query: "Show me what I submitted for Essay 2",
        expected: "Returns submitted files with content extracted"
      },
      {
        scenario: "User needs past project for reference",
        query: "Get my Project 1 submission files",
        expected: "Lists all submitted files with download links and content"
      }
    ],
    parameters: [
      {
        name: "courseId",
        type: "string",
        required: false,
        description: "Course ID or use courseName"
      },
      {
        name: "assignmentId",
        type: "string",
        required: false,
        description: "Assignment ID or use assignmentName"
      },
      {
        name: "assignmentName",
        type: "string",
        required: false,
        description: "Assignment name to search for"
      },
      {
        name: "includeFileContent",
        type: "boolean",
        required: false,
        description: "Extract file content (default: false for performance)"
      }
    ],
    relatedTools: ["get_detailed_submission", "get_submission_comments", "list_submitted_assignments"],
    workflows: ["Part of submission review workflow"],
    tips: [
      "Use list_submitted_assignments first to see what's available",
      "Set includeFileContent=true only if you need to read file content",
      "Supports multiple file types with LlamaParse integration",
      "Shows submission history if multiple attempts"
    ],
    commonErrors: [
      {
        error: "No submission found",
        solution: "Check if assignment was actually submitted or use list_submitted_assignments"
      },
      {
        error: "Cannot extract file content",
        solution: "File type may not be supported or file may be corrupted"
      }
    ]
  },
  
  get_quiz_submission_content: {
    name: "get_quiz_submission_content",
    description: "Access completed quiz questions, answers, and feedback for educational review",
    category: "Quiz & Assessment Review",
    useCases: [
      "Studying from past quizzes",
      "Understanding mistakes",
      "Preparing for future assessments",
      "Reviewing correct answers"
    ],
    examples: [
      {
        scenario: "User wants to study from quiz",
        query: "Help me review my last Biology quiz",
        expected: "Returns all questions, user's answers, correct answers, and feedback"
      },
      {
        scenario: "User preparing for final",
        query: "Show me what I got wrong on Quiz 3",
        expected: "Highlights incorrect answers with explanations"
      }
    ],
    parameters: [
      {
        name: "courseId",
        type: "string",
        required: false,
        description: "Course ID or use courseName"
      },
      {
        name: "quizId",
        type: "string",
        required: false,
        description: "Quiz ID or use quizName"
      },
      {
        name: "quizName",
        type: "string",
        required: false,
        description: "Quiz name to search for"
      },
      {
        name: "includeAnswers",
        type: "boolean",
        required: false,
        description: "Include correct answers (default: true)"
      }
    ],
    relatedTools: ["list_quizzes", "get_quiz_details", "get_quiz_submissions"],
    workflows: ["Part of quiz review workflow for studying"],
    tips: [
      "Only works for completed/graded quizzes",
      "Shows questions, user answers, correct answers, and feedback",
      "Analyzes performance to identify weak areas",
      "Perfect for studying before finals"
    ],
    commonErrors: [
      {
        error: "Quiz not yet graded",
        solution: "Wait for instructor to grade quiz before reviewing"
      },
      {
        error: "Quiz content not available",
        solution: "Instructor may have hidden quiz after due date"
      }
    ]
  },
  
  list_groups: {
    name: "list_groups",
    category: "collaboration",
    description: "List Canvas groups for collaboration, group projects, and discussions",
    
    useCases: [
      "User asks 'what groups am I in?'",
      "Finding group information for a specific course",
      "Discovering all groups the user is a member of",
      "Need to get group IDs for further operations"
    ],
    
    examples: [
      {
        scenario: "List all user's groups",
        query: "What groups am I in?",
        expected: "Returns all groups across all courses with member counts and roles"
      },
      {
        scenario: "List groups for a specific course",
        query: "Show me the groups in my Data Structures course",
        expected: "Returns only the groups within that specific course"
      }
    ],
    
    parameters: [
      { name: "courseId", type: "string", required: false, description: "Optional: Filter groups by course ID" },
      { name: "courseName", type: "string", required: false, description: "Optional: Filter groups by course name (fuzzy search)" }
    ],
    
    relatedTools: ["get_group_details", "list_group_members", "list_group_discussions"],
    workflows: [
      "list_groups → get_group_details → list_group_members",
      "list_groups → list_group_discussions → get_group_discussion"
    ],
    tips: [
      "Omit both courseId and courseName to see ALL groups",
      "Groups often have separate discussion boards from courses",
      "Use for finding group project collaborators"
    ],
    commonErrors: [
      {
        error: "No groups found",
        solution: "User may not be enrolled in any groups. Check with course instructor."
      }
    ]
  },
  
  get_group_details: {
    name: "get_group_details",
    category: "collaboration",
    description: "Get detailed information about a specific Canvas group",
    
    useCases: [
      "Need full details about a group including permissions",
      "Check if user can post discussions in a group",
      "Get group description and member count"
    ],
    
    examples: [
      {
        scenario: "Get group information",
        query: "Tell me about group 12345",
        expected: "Returns group name, description, members, permissions, and join settings"
      }
    ],
    
    parameters: [
      { name: "groupId", type: "string", required: true, description: "The Canvas group ID" }
    ],
    
    relatedTools: ["list_groups", "list_group_members", "list_group_discussions"],
    workflows: [
      "list_groups → get_group_details (to get full info on specific group)"
    ],
    tips: [
      "Shows permissions like discussion posting rights",
      "Useful before attempting to post group discussions"
    ],
    commonErrors: [
      {
        error: "Group not found",
        solution: "Verify the group ID is correct using list_groups"
      }
    ]
  },
  
  list_group_members: {
    name: "list_group_members",
    category: "collaboration",
    description: "List all members of a Canvas group",
    
    useCases: [
      "See who else is in your project group",
      "Find contact information for group members",
      "Check group membership before starting collaboration"
    ],
    
    examples: [
      {
        scenario: "List group members",
        query: "Who's in my project group?",
        expected: "Returns list of members with names, login IDs, and profile info"
      }
    ],
    
    parameters: [
      { name: "groupId", type: "string", required: true, description: "The Canvas group ID" }
    ],
    
    relatedTools: ["list_groups", "get_group_details", "find_people_in_course"],
    workflows: [
      "list_groups → list_group_members (to see who you'll be working with)"
    ],
    tips: [
      "Includes pronouns if users have set them",
      "Use to coordinate group project work"
    ],
    commonErrors: []
  },
  
  list_group_discussions: {
    name: "list_group_discussions",
    category: "collaboration",
    description: "List discussion topics in a Canvas group's discussion board",
    
    useCases: [
      "See what's been discussed in your group",
      "Check for new group announcements",
      "Find specific group discussion topics"
    ],
    
    examples: [
      {
        scenario: "Check group discussions",
        query: "What discussions are in my project group?",
        expected: "Returns list of discussion topics with reply counts and timestamps"
      }
    ],
    
    parameters: [
      { name: "groupId", type: "string", required: true, description: "The Canvas group ID" },
      { name: "orderBy", type: "string", required: false, description: "Order by position, recent_activity, or title" }
    ],
    
    relatedTools: ["list_groups", "get_group_discussion", "post_group_discussion"],
    workflows: [
      "list_groups → list_group_discussions → get_group_discussion (to read specific posts)"
    ],
    tips: [
      "Group discussions are separate from course discussions",
      "Check unread counts to stay updated",
      "Use recent_activity ordering to see latest posts"
    ],
    commonErrors: []
  },
  
  get_group_discussion: {
    name: "get_group_discussion",
    category: "collaboration",
    description: "Get a specific discussion topic from a group",
    
    useCases: [
      "Read a specific group discussion post",
      "Get details about a group announcement",
      "Check discussion replies and engagement"
    ],
    
    examples: [
      {
        scenario: "Read group discussion",
        query: "Show me discussion 98765 from my group",
        expected: "Returns full discussion content, author, timestamp, and reply count"
      }
    ],
    
    parameters: [
      { name: "groupId", type: "string", required: true, description: "The Canvas group ID" },
      { name: "topicId", type: "string", required: true, description: "The discussion topic ID" }
    ],
    
    relatedTools: ["list_group_discussions", "post_group_discussion"],
    workflows: [
      "list_group_discussions → get_group_discussion (to read specific posts)"
    ],
    tips: [
      "Shows reply count and unread status",
      "Useful for catching up on group communication"
    ],
    commonErrors: []
  },
  
  post_group_discussion: {
    name: "post_group_discussion",
    category: "collaboration",
    description: "Create a new discussion topic in a Canvas group",
    
    useCases: [
      "Start a discussion with your group",
      "Post announcements to group members",
      "Initiate collaboration on group projects"
    ],
    
    examples: [
      {
        scenario: "Create group discussion",
        query: "Post a discussion to my group about meeting times",
        expected: "Creates new discussion thread in the group discussion board"
      }
    ],
    
    parameters: [
      { name: "groupId", type: "string", required: true, description: "The Canvas group ID" },
      { name: "title", type: "string", required: true, description: "Discussion title" },
      { name: "message", type: "string", required: true, description: "Discussion message/content" },
      { name: "discussionType", type: "string", required: false, description: "Type: side_comment or threaded (default)" }
    ],
    
    relatedTools: ["list_groups", "list_group_discussions", "get_group_details"],
    workflows: [
      "list_groups → get_group_details (check permissions) → post_group_discussion"
    ],
    tips: [
      "Check permissions with get_group_details first",
      "Use threaded type for better organization",
      "Title should be descriptive for easy finding later"
    ],
    commonErrors: [
      {
        error: "Permission denied",
        solution: "Check group permissions with get_group_details - you may not have discussion posting rights"
      }
    ]
  }
};

/**
 * Get comprehensive help for a tool
 */
export function getToolHelp(toolName: string): string {
  const help = TOOL_HELP_DATABASE[toolName];
  
  if (!help) {
    return `# Tool: ${toolName}\n\nNo detailed help available yet. This is a valid Canvas MCP tool - check the tool list for basic description.`;
  }
  
  let markdown = `# 🔧 ${help.name}\n\n`;
  markdown += `**Category**: ${help.category}\n\n`;
  markdown += `## Description\n\n${help.description}\n\n`;
  
  // Use Cases
  markdown += `## 💡 Use Cases\n\n`;
  help.useCases.forEach(useCase => {
    markdown += `- ${useCase}\n`;
  });
  markdown += `\n`;
  
  // Examples
  markdown += `## 📝 Examples\n\n`;
  help.examples.forEach((example, index) => {
    markdown += `### Example ${index + 1}: ${example.scenario}\n`;
    markdown += `**User Query**: "${example.query}"\n\n`;
    markdown += `**What Happens**: ${example.expected}\n\n`;
  });
  
  // Parameters
  markdown += `## ⚙️ Parameters\n\n`;
  markdown += `| Parameter | Type | Required | Description |\n`;
  markdown += `|-----------|------|----------|-------------|\n`;
  help.parameters.forEach(param => {
    const required = param.required ? '✅ Yes' : '❌ No';
    markdown += `| ${param.name} | ${param.type} | ${required} | ${param.description} |\n`;
  });
  markdown += `\n`;
  
  // Related Tools
  if (help.relatedTools.length > 0) {
    markdown += `## 🔗 Related Tools\n\n`;
    help.relatedTools.forEach(tool => {
      markdown += `- \`${tool}\`\n`;
    });
    markdown += `\n`;
  }
  
  // Workflows
  if (help.workflows.length > 0) {
    markdown += `## 🔄 Common Workflows\n\n`;
    help.workflows.forEach(workflow => {
      markdown += `- ${workflow}\n`;
    });
    markdown += `\n`;
  }
  
  // Tips
  if (help.tips.length > 0) {
    markdown += `## 💎 Pro Tips\n\n`;
    help.tips.forEach(tip => {
      markdown += `- ${tip}\n`;
    });
    markdown += `\n`;
  }
  
  // Common Errors
  if (help.commonErrors.length > 0) {
    markdown += `## ⚠️ Common Errors & Solutions\n\n`;
    help.commonErrors.forEach(error => {
      markdown += `**Error**: ${error.error}\n\n`;
      markdown += `**Solution**: ${error.solution}\n\n`;
    });
  }
  
  return markdown;
}

/**
 * Get overview of all tools organized by category
 */
export function getAllToolsOverview(): string {
  let markdown = `# 📚 Canvas MCP Server - Complete Tool Reference\n\n`;
  markdown += `This guide provides a comprehensive overview of all 44+ tools available in the Canvas MCP Server.\n\n`;
  
  // Add categories
  Object.entries(TOOL_CATEGORIES).forEach(([key, category]) => {
    markdown += `## ${category.label}\n\n`;
    markdown += `${category.description}\n\n`;
    markdown += `**When to use**: ${category.when}\n\n`;
    markdown += `**Tools**:\n`;
    category.tools.forEach(tool => {
      markdown += `- \`${tool}\`\n`;
    });
    markdown += `\n`;
  });
  
  // Add common workflows
  markdown += `## 🔄 Common Workflows\n\n`;
  Object.entries(TOOL_WORKFLOWS).forEach(([key, workflow]) => {
    markdown += `### ${workflow.name}\n`;
    markdown += `${workflow.description}\n\n`;
    markdown += `**Example**: ${workflow.example}\n\n`;
    markdown += `**Steps**:\n`;
    workflow.steps.forEach((step, index) => {
      const optional = step.optional ? ' (optional)' : '';
      markdown += `${index + 1}. \`${step.tool}\`${optional} - ${step.purpose}\n`;
    });
    markdown += `\n`;
  });
  
  return markdown;
}

/**
 * Search for tools by keywords
 */
export function searchTools(query: string): string[] {
  const queryLower = query.toLowerCase();
  const matches: string[] = [];
  
  Object.entries(TOOL_HELP_DATABASE).forEach(([toolName, help]) => {
    // Search in name, description, use cases
    if (
      toolName.toLowerCase().includes(queryLower) ||
      help.description.toLowerCase().includes(queryLower) ||
      help.useCases.some(uc => uc.toLowerCase().includes(queryLower)) ||
      help.category.toLowerCase().includes(queryLower)
    ) {
      matches.push(toolName);
    }
  });
  
  return matches;
}
