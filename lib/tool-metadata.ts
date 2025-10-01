/**
 * Tool Metadata & Categorization System
 * Helps LLMs understand tool capabilities and relationships
 */

export interface ToolCategory {
  label: string;
  description: string;
  tools: string[];
  when: string;
}

export interface ToolWorkflow {
  name: string;
  description: string;
  steps: Array<{
    tool: string;
    purpose: string;
    optional?: boolean;
  }>;
  example: string;
}

export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  discovery: {
    label: "Course Discovery & Navigation",
    description: "Find and explore available courses and their structure",
    tools: [
      "get_current_courses",
      "get_courses",
      "get_course_navigation",
      "get_course_syllabus",
      "list_modules",
      "get_module_details"
    ],
    when: "Start here to explore what's available in a course or understand course structure",
  },
  
  assignments: {
    label: "Assignment Management",
    description: "Access assignments, submissions, and feedback",
    tools: [
      "get_assignments",
      "get_assignment_details",
      "get_assignment_rubric",
      "get_assignment_feedback",
      "get_previous_submission_content",
      "list_submitted_assignments",
      "get_submission_comments",
      "get_detailed_submission"
    ],
    when: "Use when working with homework, projects, submissions, or assignment feedback",
  },
  
  grades: {
    label: "Grades & Analytics",
    description: "Track grades, analyze performance, and predict outcomes",
    tools: [
      "get_grades",
      "get_gradebook_categories",
      "calculate_course_analytics",
      "generate_what_if_scenarios",
      "get_grade_trends"
    ],
    when: "Use for grade checking, performance analysis, or 'what grade do I need?' questions",
  },
  
  quizzes: {
    label: "Quiz & Assessment Review",
    description: "Access quiz content, submissions, and study from past assessments",
    tools: [
      "list_quizzes",
      "get_quiz_details",
      "get_quiz_submissions",
      "get_quiz_submission_content"
    ],
    when: "Use to review quiz performance, study from past quizzes, or analyze assessment results",
  },
  
  files: {
    label: "File Management",
    description: "Search, read, and process course files and documents",
    tools: [
      "get_files",
      "find_files",
      "read_file",
      "read_file_by_id",
      "process_file",
      "download_submission_file"
    ],
    when: "Use to access lecture notes, slides, readings, or any course documents",
  },
  
  content: {
    label: "Course Content",
    description: "Access pages, discussions, and course materials",
    tools: [
      "get_pages",
      "read_page",
      "get_discussions",
      "read_discussion",
      "post_discussion_reply",
      "reply_to_discussion_entry"
    ],
    when: "Use to read course content, participate in discussions, or access course pages",
  },
  
  communication: {
    label: "Communication & Messages",
    description: "Send messages, manage conversations, and find people",
    tools: [
      "send_message",
      "reply_to_conversation",
      "list_conversations",
      "get_conversation_details",
      "find_people",
      "search_recipients",
      "get_user_profile"
    ],
    when: "Use to communicate with instructors/classmates or manage Canvas messages",
  },
  
  collaboration: {
    label: "Groups & Collaboration",
    description: "Access group information, members, and group discussions",
    tools: [
      "list_groups",
      "get_group_details",
      "list_group_members",
      "list_group_discussions",
      "get_group_discussion",
      "post_group_discussion"
    ],
    when: "Use when working on group projects, accessing group discussions, or coordinating with team members",
  },
  
  calendar: {
    label: "Calendar & Scheduling",
    description: "View upcoming events, due dates, and course schedule",
    tools: [
      "get_calendar_events"
    ],
    when: "Use to check what's due, view upcoming events, or plan your schedule",
  },
  
  advanced: {
    label: "Advanced Features",
    description: "AI-powered search and intelligent content discovery",
    tools: [
      "smart_search"
    ],
    when: "Use when basic search fails, APIs are restricted, or you need intelligent content discovery",
  }
};

export const TOOL_WORKFLOWS: Record<string, ToolWorkflow> = {
  reviewing_assignment: {
    name: "Review Assignment Requirements",
    description: "Understand what's needed for an assignment",
    steps: [
      { tool: "get_courses", purpose: "Find the course ID" },
      { tool: "get_assignments", purpose: "List assignments in the course" },
      { tool: "get_assignment_details", purpose: "Get full assignment description and files" },
      { tool: "get_assignment_rubric", purpose: "Review grading criteria", optional: true },
      { tool: "read_file_by_id", purpose: "Read attached instruction files", optional: true }
    ],
    example: "User asks: 'What do I need to do for the final project in Biology?'"
  },
  
  checking_grades: {
    name: "Check Current Grades",
    description: "View grades and analyze performance",
    steps: [
      { tool: "get_courses", purpose: "Find the course ID" },
      { tool: "calculate_course_analytics", purpose: "Get comprehensive grade analysis" },
      { tool: "get_grade_trends", purpose: "See performance trends", optional: true },
      { tool: "get_gradebook_categories", purpose: "Understand grade weighting", optional: true }
    ],
    example: "User asks: 'What's my current grade in Chemistry?'"
  },
  
  grade_prediction: {
    name: "Predict Final Grade",
    description: "Calculate what grade is needed on future assignments",
    steps: [
      { tool: "get_courses", purpose: "Find the course ID" },
      { tool: "calculate_course_analytics", purpose: "Get current standing" },
      { tool: "generate_what_if_scenarios", purpose: "Calculate required grades for target" }
    ],
    example: "User asks: 'What grade do I need on the final to get an A?'"
  },
  
  reviewing_submission: {
    name: "Review Previous Submission",
    description: "Access what you submitted and received feedback",
    steps: [
      { tool: "get_courses", purpose: "Find the course ID" },
      { tool: "list_submitted_assignments", purpose: "See what's been submitted" },
      { tool: "get_previous_submission_content", purpose: "Get submitted files" },
      { tool: "get_detailed_submission", purpose: "Get feedback, comments, and rubric scores" }
    ],
    example: "User asks: 'Show me what I submitted for Essay 2 and the feedback I got'"
  },
  
  quiz_review: {
    name: "Review Quiz Performance",
    description: "Study from a completed quiz",
    steps: [
      { tool: "get_courses", purpose: "Find the course ID" },
      { tool: "list_quizzes", purpose: "List quizzes in the course" },
      { tool: "get_quiz_submission_content", purpose: "Get questions, answers, and feedback" }
    ],
    example: "User asks: 'Help me review my last quiz so I can study for the final'"
  },
  
  finding_content: {
    name: "Find Course Content",
    description: "Search for specific files or materials",
    steps: [
      { tool: "get_courses", purpose: "Find the course ID" },
      { tool: "smart_search", purpose: "Intelligently search for content" },
      { tool: "read_file_by_id", purpose: "Read found files", optional: true }
    ],
    example: "User asks: 'Find the lecture slides about photosynthesis'"
  },
  
  checking_due_dates: {
    name: "Check What's Due",
    description: "See upcoming assignments and events",
    steps: [
      { tool: "get_courses", purpose: "Find all active courses" },
      { tool: "get_calendar_events", purpose: "Get upcoming events for each course" },
      { tool: "get_assignments", purpose: "Get detailed assignment info", optional: true }
    ],
    example: "User asks: 'What assignments do I have due this week?'"
  },
  
  course_planning: {
    name: "Understand Course Structure",
    description: "Navigate course organization and requirements",
    steps: [
      { tool: "get_courses", purpose: "Find the course ID" },
      { tool: "get_course_syllabus", purpose: "Get course policies and structure" },
      { tool: "get_course_navigation", purpose: "See module structure and prerequisites" },
      { tool: "get_gradebook_categories", purpose: "Understand grade weighting" }
    ],
    example: "User asks: 'What's the structure of my Physics course and how are grades calculated?'"
  }
};

/**
 * Get related tools for a given tool
 */
export function getRelatedTools(toolName: string): string[] {
  const related: string[] = [];
  
  // Find which category this tool belongs to
  for (const [categoryKey, category] of Object.entries(TOOL_CATEGORIES)) {
    if (category.tools.includes(toolName)) {
      // Add other tools from the same category
      related.push(...category.tools.filter(t => t !== toolName));
      break;
    }
  }
  
  return related;
}

/**
 * Get suggested workflow for a tool
 */
export function getSuggestedWorkflow(toolName: string): ToolWorkflow | null {
  for (const workflow of Object.values(TOOL_WORKFLOWS)) {
    if (workflow.steps.some(step => step.tool === toolName)) {
      return workflow;
    }
  }
  return null;
}

/**
 * Get tool category
 */
export function getToolCategory(toolName: string): ToolCategory | null {
  for (const category of Object.values(TOOL_CATEGORIES)) {
    if (category.tools.includes(toolName)) {
      return category;
    }
  }
  return null;
}

/**
 * Find workflows that use a specific tool
 */
export function findWorkflowsForTool(toolName: string): ToolWorkflow[] {
  return Object.values(TOOL_WORKFLOWS).filter(workflow =>
    workflow.steps.some(step => step.tool === toolName)
  );
}
