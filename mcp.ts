#!/usr/bin/env node

// Notioc Canvas MCP Server
// Model Context Protocol server for Canvas LMS integration

import { Server } from "@modelcontextprotocol/sdk/server/index";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types";
import dotenv from "dotenv";

// Import our Canvas tools
import { listCourses, CourseListParams } from "@/tools/courses";
import {
  listAssignments,
  getAssignmentDetails,
  AssignmentListParams,
} from "@/tools/assignments";
import {
  searchFiles,
  getFileContent,
  readFileById,
  FileSearchParams,
  FileContentParams,
} from "@/tools/files";
import {
  listPages,
  getPageContent,
  listDiscussions,
  getDiscussionContent,
  PagesListParams,
  PageContentParams,
  DiscussionsListParams,
  DiscussionContentParams,
} from "@/tools/pages-discussions";
import {
  postDiscussionReply,
  replyToDiscussionEntry,
  PostDiscussionReplyParams,
} from "@/tools/discussions";
import {
  createConversation,
  replyToConversation,
  listConversations,
  getConversationDetails,
  SendMessageParams,
  ReplyToConversationParams,
  ListConversationsParams,
} from "@/tools/messages";
import {
  performSmartSearch,
  getCourseContentOverview,
} from "@/tools/smart-search";
import {
  findPeopleInCourse,
  searchRecipients,
  getUserProfile,
  getMyProfile,
  FindPeopleParams,
  SearchRecipientsParams,
} from "@/tools/users";
import {
  listQuizzes,
  getQuizDetails,
  getQuizSubmissions,
  ListQuizzesParams,
  QuizDetailsParams,
  QuizSubmissionsParams,
} from "@/tools/quizzes";
import {
  listModules,
  getModuleItems,
  getModuleDetails,
  ListModulesParams,
  ModuleItemsParams,
} from "@/tools/modules";
import {
  getGrades,
  getGradebookCategories,
  GetGradesParams,
  GradebookCategoriesParams,
} from "@/tools/grades";
import { listCalendarEvents, CalendarEventListParams } from "@/tools/calendar";
import {
  getAssignmentRubric,
  getRubricAnalysis,
  getAssignmentFeedback,
  RubricParams,
} from "@/tools/rubrics";
import { downloadSubmissionFile } from "@/tools/file-download";
import {
  getCourseNavigation,
  getCourseSyllabus,
  CourseStructureParams,
} from "@/tools/course-structure";
import {
  getSubmissionComments,
  getDetailedSubmission,
  GetSubmissionCommentsParams,
  GetDetailedSubmissionParams,
} from "@/tools/submission-comments";
import {
  calculateCourseAnalytics,
  generateWhatIfScenarios,
  getGradeTrends,
  CourseAnalyticsParams,
  WhatIfScenarioParams,
  GradeTrendsParams,
} from "@/tools/analytics";
import {
  getQuizSubmissionContent,
  getUserQuizSubmissionHistory,
  QuizSubmissionContentParams,
} from "@/tools/quiz-submission-content";
import {
  getPreviousSubmissionContent,
  listSubmittedAssignments,
  PreviousSubmissionParams,
} from "@/tools/previous-submissions";

// Import custom logger that writes to stderr
import { logger } from "@/lib/logger";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "../..");

// Load environment variables with explicit path
dotenv.config({ path: join(projectRoot, ".env") });

// Configuration interface
interface CanvasConfig {
  canvasBaseUrl: string;
  accessToken: string;
}

// Get Canvas configuration from environment or user input
function getCanvasConfig(): CanvasConfig {
  const baseUrl = process.env.CANVAS_BASE_URL;
  const accessToken = process.env.CANVAS_ACCESS_TOKEN;

  if (!baseUrl || !accessToken) {
    throw new Error(
      "Canvas configuration missing. Please set CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN environment variables.",
    );
  }

  return { canvasBaseUrl: baseUrl, accessToken };
}

function formatDiscussionReplies(replies: any[], level = 0): string {
  let markdown = "";
  const indent = "  ".repeat(level);

  for (const reply of replies) {
    if (!reply.message) continue;

    const author = reply.user_name || "Anonymous";
    const postedAt = reply.created_at
      ? new Date(reply.created_at).toLocaleString()
      : "No date";

    // Naively strip HTML tags and clean up message
    const message = (reply.message || "")
      .replace(/<p>/gi, "")
      .replace(/<\/p>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .trim();

    if (message) {
      markdown += `\n${indent}- **${author}** (${postedAt}):\n`;
      markdown += `${indent}  > ${message.replace(/\n/g, `\n${indent}  > `)}\n`;

      if (reply.replies && reply.replies.length > 0) {
        markdown += formatDiscussionReplies(reply.replies, level + 1);
      }
    }
  }
  return markdown;
}

async function main() {
  logger.info("🚀 Notioc Canvas MCP Server is starting...");
  let config: CanvasConfig;

  try {
    // This will throw if config is missing, and the catch block will handle it.
    config = getCanvasConfig();

    logger.info("✅ Canvas configuration loaded successfully.");
  } catch (error: any) {
    logger.error("❌ FATAL: Could not start server.", {
      message: error.message,
      advice:
        "Please ensure your .env file is correctly configured with your CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN.",
    });
    // Exit gracefully if the config is bad
    return;
  }

  // Use standard I/O for transport
  const transport = new StdioServerTransport();

  // Create MCP server
  const server = new Server(
    {
      name: "notioc-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_courses",
          description: "Get your Canvas courses for the authenticated user",
          inputSchema: {
            type: "object",
            properties: {
              enrollmentState: {
                type: "string",
                enum: ["active", "completed", "all"],
                description:
                  "Filter courses by enrollment state (default: active)",
                default: "active",
              },
            },
          },
        },
        {
          name: "get_pages",
          description: "Get pages in a Canvas course",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              sort: {
                type: "string",
                enum: ["title", "created_at", "updated_at"],
                description: "Sort pages by (default: updated_at)",
                default: "updated_at",
              },
              order: {
                type: "string",
                enum: ["asc", "desc"],
                description: "Sort order (default: desc)",
                default: "desc",
              },
              searchTerm: {
                type: "string",
                description: "Optional search term to filter pages by title",
              },
            },
          },
        },
        {
          name: "read_page",
          description: "Read the content of a specific Canvas page",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              pageUrl: {
                type: "string",
                description:
                  'The page URL or title from the URL (e.g., "self-reflective-memo-prompt")',
              },
              pageId: {
                type: "string",
                description:
                  "The Canvas page ID (if known, can be used instead of pageUrl)",
              },
            },
          },
        },
        {
          name: "get_discussions",
          description: "Get discussion topics in a Canvas course",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              onlyAnnouncements: {
                type: "boolean",
                description: "Only list announcements (default: false)",
                default: false,
              },
              orderBy: {
                type: "string",
                enum: ["position", "recent_activity", "title"],
                description: "Order discussions by (default: recent_activity)",
                default: "recent_activity",
              },
              searchTerm: {
                type: "string",
                description:
                  "Optional search term to filter discussions by title",
              },
            },
          },
        },
        {
          name: "read_discussion",
          description: "Read the content of a specific Canvas discussion topic",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              discussionId: {
                type: "string",
                description: "The Canvas discussion topic ID",
              },
              includeReplies: {
                type: "boolean",
                description: "Include discussion replies (default: true)",
                default: true,
              },
            },
            required: ["discussionId"],
          },
        },
        {
          name: "get_assignments",
          description: "Get assignments for a specific Canvas course",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              includeSubmissions: {
                type: "boolean",
                description: "Include submission information (default: false)",
                default: false,
              },
            },
          },
        },
        {
          name: "find_files",
          description: "Find files in a Canvas course",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              searchTerm: {
                type: "string",
                description: "Optional search term to filter files by name",
              },
            },
          },
        },
        {
          name: "read_file",
          description: "Read the content of a specific Canvas file",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              fileId: {
                type: "string",
                description:
                  "The Canvas file ID (optional if fileName is provided)",
              },
              fileName: {
                type: "string",
                description:
                  "The file name to search for (optional if fileId is provided)",
              },
            },
          },
        },
        {
          name: "read_file_by_id",
          description:
            "Read a Canvas file directly using its file ID (e.g., from a Canvas URL like /files/176870249)",
          inputSchema: {
            type: "object",
            properties: {
              fileId: {
                type: "string",
                description:
                  'The Canvas file ID (e.g., "176870249" from the URL)',
              },
            },
            required: ["fileId"],
          },
        },
        {
          name: "get_assignment_details",
          description:
            "Gets the full details for a single assignment, including the description, due date, points, and a list of all associated files. Use this after finding an assignment with get_assignments.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Math 451", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentName: {
                type: "string",
                description:
                  'The full name of the assignment (e.g., "Project 2: Human Behavior Insights to Sustainable Arts and Design").',
              },
              includeFileContent: {
                type: "boolean",
                description:
                  "Whether to automatically read the content of associated files (default: true)",
                default: true,
              },
              processFiles: {
                type: "boolean",
                description:
                  "Whether to process files for discussion and Q&A (default: false)",
                default: false,
              },
            },
            required: [],
          },
        },
        {
          name: "get_submission_comments",
          description:
            "📝 **NEW** Get detailed feedback and comments for a specific assignment submission including rubric assessments",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentId: {
                type: "string",
                description: "The Canvas assignment ID (numeric)",
              },
              assignmentName: {
                type: "string",
                description:
                  'The assignment name (e.g., "Final Project", "Essay 1"). If provided, assignmentId is not required.',
              },
              userId: {
                type: "string",
                description:
                  "Optional user ID to get comments for (defaults to current user)",
              },
              includeRubricAssessment: {
                type: "boolean",
                description: "Include detailed rubric grading (default: true)",
                default: true,
              },
              includeSubmissionHistory: {
                type: "boolean",
                description:
                  "Include submission attempt history (default: false)",
                default: false,
              },
            },
            anyOf: [
              { required: ["courseId", "assignmentId"] },
              { required: ["courseId", "assignmentName"] },
              { required: ["courseName", "assignmentId"] },
              { required: ["courseName", "assignmentName"] },
            ],
          },
        },
        {
          name: "get_detailed_submission",
          description:
            "📋 **NEW** Get comprehensive submission details with assignment info, feedback, comments, and rubric data in one call",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentId: {
                type: "string",
                description: "The Canvas assignment ID (numeric)",
              },
              assignmentName: {
                type: "string",
                description:
                  'The assignment name (e.g., "Final Project", "Essay 1"). If provided, assignmentId is not required.',
              },
              userId: {
                type: "string",
                description:
                  "Optional user ID to get submission for (defaults to current user)",
              },
            },
            anyOf: [
              { required: ["courseId", "assignmentId"] },
              { required: ["courseId", "assignmentName"] },
              { required: ["courseName", "assignmentId"] },
              { required: ["courseName", "assignmentName"] },
            ],
          },
        },
        {
          name: "smart_search",
          description:
            "Intelligently search for assignments, homework, files, or content using natural language. Can find homework assignments and their files automatically. Returns compact citations by default for efficiency.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  'Natural language search query (e.g., "find homework 3 in math 451", "get assignment 2 files", "what is due this week")',
              },
              includeFileContent: {
                type: "boolean",
                description:
                  "Whether to automatically read file contents (default: true)",
                default: true,
              },
              maxResults: {
                type: "number",
                description:
                  "Maximum number of results to return per category (default: 5)",
                default: 5,
              },
              returnMode: {
                type: "string",
                enum: ["refs", "answer", "full"],
                description:
                  'Output format: "refs" for compact citations (default), "answer" for AI-generated response, "full" for complete details',
                default: "refs",
              },
              useSmallModel: {
                type: "boolean",
                description:
                  "Enable AI-powered intent classification and result reranking for better relevance (default: true)",
                default: true,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "process_file",
          description:
            "Process a Canvas file for discussion and Q&A. Reads the file content and provides a summary with key points that can be discussed.",
          inputSchema: {
            type: "object",
            properties: {
              fileId: {
                type: "string",
                description: "The Canvas file ID to process",
              },
              courseId: {
                type: "string",
                description: "The Canvas course ID (optional, for context)",
              },
              courseName: {
                type: "string",
                description: "The course name (optional, for context)",
              },
              analysisType: {
                type: "string",
                enum: ["summary", "key_points", "full_content", "qa_ready"],
                description: "Type of analysis to perform (default: qa_ready)",
                default: "qa_ready",
              },
              mode: {
                type: "string",
                enum: ["preview", "full"],
                description:
                  'Content mode: "preview" for compressed version (faster, fewer tokens), "full" for complete content (default: full)',
                default: "full",
              },
              forceRefresh: {
                type: "boolean",
                description:
                  "Force refresh from source, bypassing cache (default: false)",
                default: false,
              },
            },
            required: ["fileId"],
          },
        },
        {
          name: "post_discussion_reply",
          description:
            "Post a reply to a Canvas discussion topic. This allows you to participate in course discussions.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              topicId: {
                type: "string",
                description: "The Canvas discussion topic ID",
              },
              message: {
                type: "string",
                description: "The message content to post",
              },
              attachmentIds: {
                type: "array",
                items: { type: "string" },
                description: "Optional array of Canvas file IDs to attach",
              },
            },
            required: ["topicId", "message"],
          },
        },
        {
          name: "reply_to_discussion_entry",
          description:
            "Reply to a specific entry in a Canvas discussion (threaded reply).",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              topicId: {
                type: "string",
                description: "The Canvas discussion topic ID",
              },
              parentEntryId: {
                type: "string",
                description: "The ID of the discussion entry to reply to",
              },
              message: {
                type: "string",
                description: "The message content to post",
              },
              attachmentIds: {
                type: "array",
                items: { type: "string" },
                description: "Optional array of Canvas file IDs to attach",
              },
            },
            required: ["topicId", "parentEntryId", "message"],
          },
        },
        {
          name: "send_message",
          description:
            "Create a new Canvas conversation and send the initial message.",
          inputSchema: {
            type: "object",
            properties: {
              recipientIds: {
                type: "array",
                items: { type: "string" },
                description: "Array of Canvas user IDs to send the message to",
              },
              subject: {
                type: "string",
                description: "Subject line for the conversation",
              },
              body: {
                type: "string",
                description: "Message body content",
              },
              contextCode: {
                type: "string",
                description:
                  'Optional context code (e.g., "course_123") to associate with a course',
              },
              attachmentIds: {
                type: "array",
                items: { type: "string" },
                description: "Optional array of Canvas file IDs to attach",
              },
            },
            required: ["recipientIds", "subject", "body"],
          },
        },
        {
          name: "reply_to_conversation",
          description: "Reply to an existing Canvas conversation.",
          inputSchema: {
            type: "object",
            properties: {
              conversationId: {
                type: "string",
                description: "The Canvas conversation ID",
              },
              body: {
                type: "string",
                description: "Message body content",
              },
              attachmentIds: {
                type: "array",
                items: { type: "string" },
                description: "Optional array of Canvas file IDs to attach",
              },
              includedMessages: {
                type: "array",
                items: { type: "string" },
                description:
                  "Optional array of message IDs to include in the reply",
              },
            },
            required: ["conversationId", "body"],
          },
        },
        {
          name: "list_conversations",
          description: "List Canvas conversations (inbox messages).",
          inputSchema: {
            type: "object",
            properties: {
              scope: {
                type: "string",
                enum: ["inbox", "sent", "archived", "unread"],
                description: "Filter conversations by scope (default: inbox)",
                default: "inbox",
              },
              filter: {
                type: "array",
                items: { type: "string" },
                description: "Optional filter terms",
              },
              filterMode: {
                type: "string",
                enum: ["and", "or"],
                description: "How to apply filters (default: and)",
                default: "and",
              },
            },
          },
        },
        {
          name: "get_conversation_details",
          description:
            "Get details of a specific Canvas conversation including all messages.",
          inputSchema: {
            type: "object",
            properties: {
              conversationId: {
                type: "string",
                description: "The Canvas conversation ID",
              },
              autoMarkAsRead: {
                type: "boolean",
                description:
                  "Automatically mark the conversation as read (default: true)",
                default: true,
              },
              filter: {
                type: "array",
                items: { type: "string" },
                description: "Optional filter terms",
              },
            },
            required: ["conversationId"],
          },
        },
        {
          name: "find_people",
          description: "Find people in a Canvas course to send messages to.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              searchTerm: {
                type: "string",
                description: "Optional search term to filter users by name",
              },
              enrollmentType: {
                type: "string",
                enum: ["student", "teacher", "ta", "observer", "designer"],
                description: "Filter by enrollment type",
              },
              enrollmentState: {
                type: "string",
                enum: [
                  "active",
                  "invited",
                  "rejected",
                  "completed",
                  "inactive",
                ],
                description: "Filter by enrollment state (default: active)",
                default: "active",
              },
            },
          },
        },
        {
          name: "search_recipients",
          description:
            "Search for message recipients using Canvas search API. Note: This may be restricted at some institutions.",
          inputSchema: {
            type: "object",
            properties: {
              search: {
                type: "string",
                description: "Search term for recipient names",
              },
              context: {
                type: "string",
                description:
                  'Context code (e.g., "course_123") to limit search scope',
              },
              exclude: {
                type: "array",
                items: { type: "string" },
                description: "User IDs to exclude from results",
              },
              type: {
                type: "string",
                enum: ["user", "context"],
                description: "Type of recipients to search for",
              },
            },
          },
        },
        {
          name: "get_user_profile",
          description: "Get profile information for a specific Canvas user.",
          inputSchema: {
            type: "object",
            properties: {
              userId: {
                type: "string",
                description:
                  'The Canvas user ID (use "self" for your own profile)',
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: [
                    "locale",
                    "avatar_url",
                    "permissions",
                    "email",
                    "effective_locale",
                    "bio",
                    "pronouns",
                  ],
                },
                description: "Additional information to include",
              },
            },
            required: ["userId"],
          },
        },
        {
          name: "list_quizzes",
          description: "List quizzes in a Canvas course.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              searchTerm: {
                type: "string",
                description: "Optional search term to filter quizzes by title",
              },
            },
          },
        },
        {
          name: "get_quiz_details",
          description: "Get details of a specific Canvas quiz.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              quizId: {
                type: "string",
                description: "The Canvas quiz ID",
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: [
                    "assignment",
                    "submissions",
                    "all_dates",
                    "permissions",
                  ],
                },
                description: "Additional information to include",
              },
            },
            required: ["quizId"],
          },
        },
        {
          name: "get_quiz_submissions",
          description: "Get submissions for a specific Canvas quiz.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              quizId: {
                type: "string",
                description: "The Canvas quiz ID",
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["submission", "quiz", "user"],
                },
                description: "Additional information to include",
              },
            },
            required: ["quizId"],
          },
        },
        {
          name: "get_quiz_submission_content",
          description:
            "📚 **NEW** Get completed quiz questions and answers for educational review and study assistance. Access your previously completed quiz content to help with studying, understanding mistakes, and grade questions.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              quizId: {
                type: "string",
                description: "The Canvas quiz ID (if known)",
              },
              quizName: {
                type: "string",
                description:
                  'The quiz name (e.g., "Quiz 1", "Midterm Exam"). If provided, quizId is not required.',
              },
              submissionId: {
                type: "string",
                description:
                  "Specific submission ID (optional - will find most recent completed submission if not provided)",
              },
              includeAnswers: {
                type: "boolean",
                description:
                  "Include correct answers and answer options (default: true)",
                default: true,
              },
              includeUserResponses: {
                type: "boolean",
                description: "Include your submitted answers (default: true)",
                default: true,
              },
            },
            anyOf: [
              { required: ["courseId", "quizId"] },
              { required: ["courseId", "quizName"] },
              { required: ["courseName", "quizId"] },
              { required: ["courseName", "quizName"] },
              { required: ["submissionId"] },
            ],
          },
        },
        {
          name: "get_previous_submission_content",
          description:
            "📁 **NEW** Access your previously submitted assignment files (PDF, DOCX, etc.) for review and analysis. Perfect for longer projects where you want to review what you submitted.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentId: {
                type: "string",
                description: "The Canvas assignment ID (if known)",
              },
              assignmentName: {
                type: "string",
                description:
                  'The assignment name (e.g., "Final Project", "Essay 1"). If provided, assignmentId is not required.',
              },
              includeFileContent: {
                type: "boolean",
                description:
                  "Whether to automatically read file content (default: false for performance)",
                default: false,
              },
            },
            anyOf: [
              { required: ["courseId", "assignmentId"] },
              { required: ["courseId", "assignmentName"] },
              { required: ["courseName", "assignmentId"] },
              { required: ["courseName", "assignmentName"] },
            ],
          },
        },
        {
          name: "list_submitted_assignments",
          description:
            "List all assignments you have submitted in a course, with file counts and submission dates.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
            },
            anyOf: [{ required: ["courseId"] }, { required: ["courseName"] }],
          },
        },
        {
          name: "download_submission_file",
          description:
            "Download a specific file from a Canvas submission using Canvas file URL or file ID.",
          inputSchema: {
            type: "object",
            properties: {
              submissionUrl: {
                type: "string",
                description:
                  "Full Canvas submission file URL (e.g., https://psu.instructure.com/courses/.../submissions/...?download=...)",
              },
              fileId: {
                type: "string",
                description:
                  "Direct Canvas file ID (alternative to submissionUrl)",
              },
              courseId: {
                type: "string",
                description: "Course ID (helpful for authentication context)",
              },
              assignmentId: {
                type: "string",
                description:
                  "Assignment ID (helpful for authentication context)",
              },
              submissionId: {
                type: "string",
                description:
                  "Submission ID (helpful for authentication context)",
              },
            },
            anyOf: [{ required: ["submissionUrl"] }, { required: ["fileId"] }],
          },
        },
        {
          name: "list_modules",
          description: "List course modules in a Canvas course.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["items", "content_details"],
                },
                description:
                  "Additional information to include (default: items)",
              },
              searchTerm: {
                type: "string",
                description: "Optional search term to filter modules by name",
              },
              studentId: {
                type: "string",
                description:
                  "Optional student ID to get module progress for that student",
              },
            },
          },
        },
        {
          name: "get_module_items",
          description: "Get items for a specific Canvas course module.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              moduleId: {
                type: "string",
                description: "The Canvas module ID",
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["content_details", "mastery_paths"],
                },
                description: "Additional information to include",
              },
              searchTerm: {
                type: "string",
                description: "Optional search term to filter items by title",
              },
              studentId: {
                type: "string",
                description:
                  "Optional student ID to get item progress for that student",
              },
            },
            required: ["moduleId"],
          },
        },
        {
          name: "get_module_details",
          description: "Get details of a specific Canvas course module.",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              moduleId: {
                type: "string",
                description: "The Canvas module ID",
              },
              include: {
                type: "array",
                items: {
                  type: "string",
                  enum: ["items", "content_details"],
                },
                description: "Additional information to include",
              },
              studentId: {
                type: "string",
                description:
                  "Optional student ID to get module progress for that student",
              },
            },
            required: ["moduleId"],
          },
        },
        {
          name: "get_grades",
          description:
            "Get student grades and submission status for a specific course",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID",
              },
              courseName: {
                type: "string",
                description: "The name of the course (alternative to courseId)",
              },
              studentId: {
                type: "string",
                description:
                  "Specific student ID to get grades for (optional - if not provided, gets current user grades)",
              },
              assignmentId: {
                type: "string",
                description:
                  "Specific assignment ID to get grades for (optional)",
              },
            },
            anyOf: [{ required: ["courseId"] }, { required: ["courseName"] }],
          },
        },
        {
          name: "get_gradebook_categories",
          description:
            "Get gradebook categories (assignment groups) and their weights for a course",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID",
              },
              courseName: {
                type: "string",
                description: "The name of the course (alternative to courseId)",
              },
            },
            anyOf: [{ required: ["courseId"] }, { required: ["courseName"] }],
          },
        },
        {
          name: "calculate_course_analytics",
          description:
            "📊 **NEW PHASE 2** Calculate comprehensive course analytics including current grades, projected grades, category breakdowns, and upcoming assignments",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              userId: {
                type: "string",
                description:
                  "Optional user ID to calculate analytics for (defaults to current user)",
              },
            },
            anyOf: [{ required: ["courseId"] }, { required: ["courseName"] }],
          },
        },
        {
          name: "generate_what_if_scenarios",
          description:
            '🎯 **NEW PHASE 2** Generate what-if scenarios for achieving target grades. Answers questions like "What grade do I need on the final to get an A?"',
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              targetGrade: {
                type: "number",
                description: "Target grade percentage (e.g., 90 for 90%)",
              },
              targetLetterGrade: {
                type: "string",
                description:
                  'Target letter grade (e.g., "A", "B+", "C"). If provided, targetGrade is not required.',
              },
              userId: {
                type: "string",
                description:
                  "Optional user ID to generate scenarios for (defaults to current user)",
              },
            },
            anyOf: [
              { required: ["courseId", "targetGrade"] },
              { required: ["courseId", "targetLetterGrade"] },
              { required: ["courseName", "targetGrade"] },
              { required: ["courseName", "targetLetterGrade"] },
            ],
          },
        },
        {
          name: "get_grade_trends",
          description:
            "📈 **NEW PHASE 2** Analyze grade trends over time to see if performance is improving, declining, or stable",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              userId: {
                type: "string",
                description:
                  "Optional user ID to analyze trends for (defaults to current user)",
              },
              daysBack: {
                type: "number",
                description: "How many days back to analyze (default: 90)",
                default: 90,
              },
            },
            anyOf: [{ required: ["courseId"] }, { required: ["courseName"] }],
          },
        },
        {
          name: "get_calendar_events",
          description:
            "📅 **NEW** Get calendar events for a specific Canvas course, including assignments and other scheduled events",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              startDate: {
                type: "string",
                description:
                  'Start date for events (ISO 8601 format, e.g., "2024-01-01T00:00:00Z")',
              },
              endDate: {
                type: "string",
                description:
                  'End date for events (ISO 8601 format, e.g., "2024-12-31T23:59:59Z")',
              },
              type: {
                type: "string",
                enum: ["event", "assignment"],
                description:
                  "Type of calendar events to fetch (default: event)",
                default: "event",
              },
            },
            anyOf: [{ required: ["courseId"] }, { required: ["courseName"] }],
          },
        },
        {
          name: "get_assignment_rubric",
          description:
            "Get detailed rubric criteria and grading information for a specific assignment",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentId: {
                type: "string",
                description: "The Canvas assignment ID (numeric)",
              },
              assignmentName: {
                type: "string",
                description:
                  'The assignment name (e.g., "Final Project", "Essay 1"). If provided, assignmentId is not required.',
              },
            },
            anyOf: [
              { required: ["courseId", "assignmentId"] },
              { required: ["courseId", "assignmentName"] },
              { required: ["courseName", "assignmentId"] },
              { required: ["courseName", "assignmentName"] },
            ],
          },
        },
        {
          name: "get_rubric_analysis",
          description:
            "Analyze rubric patterns and common grading criteria across multiple assignments in a course",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              limit: {
                type: "number",
                description:
                  "Maximum number of assignments to analyze (default: 10)",
                default: 10,
              },
            },
            anyOf: [{ required: ["courseId"] }, { required: ["courseName"] }],
          },
        },
        {
          name: "get_assignment_feedback",
          description:
            "Get detailed feedback and rubric assessment for a specific assignment submission",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentId: {
                type: "string",
                description: "The Canvas assignment ID (numeric)",
              },
              assignmentName: {
                type: "string",
                description:
                  'The assignment name (e.g., "Final Project", "Essay 1"). If provided, assignmentId is not required.',
              },
              userId: {
                type: "string",
                description:
                  "Optional user ID to get feedback for (defaults to current user)",
              },
            },
            anyOf: [
              { required: ["courseId", "assignmentId"] },
              { required: ["courseId", "assignmentName"] },
              { required: ["courseName", "assignmentId"] },
              { required: ["courseName", "assignmentName"] },
            ],
          },
        },
        {
          name: "get_course_navigation",
          description:
            "Get comprehensive course structure with module prerequisites and navigation paths",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
            },
            anyOf: [{ required: ["courseId"] }, { required: ["courseName"] }],
          },
        },
        {
          name: "get_course_syllabus",
          description:
            "Get course syllabus information from multiple sources with structured data extraction",
          inputSchema: {
            type: "object",
            properties: {
              courseId: {
                type: "string",
                description: "The Canvas course ID (numeric)",
              },
              courseName: {
                type: "string",
                description:
                  'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
            },
            anyOf: [{ required: ["courseId"] }, { required: ["courseName"] }],
          },
        },
      ],
    };
  });

  // Multi-course assignment search handler
  async function handleMultiCourseAssignmentSearch(
    query: string,
    courses: any[],
    canvasConfig: any,
    options: { maxResults: number; returnMode: string; useSmallModel: boolean },
  ) {
    const startTime = Date.now();
    let allAssignments: any[] = [];
    let searchResults: any[] = [];

    // Search for assignments across all active courses
    for (const course of courses) {
      try {
        // Get assignments for this course
        const assignments = await listAssignments({
          ...canvasConfig,
          courseId: course.id,
          courseName: course.name,
          includeSubmissions: true,
        });

        // Add course context to each assignment
        const courseAssignments = assignments.map((assignment: any) => ({
          ...assignment,
          courseId: course.id,
          courseName: course.name,
          courseCode: course.courseCode,
        }));

        allAssignments.push(...courseAssignments);

        // Also try smart search for content in this course if needed
        if (options.useSmallModel) {
          try {
            const contentSearch = await performSmartSearch({
              ...canvasConfig,
              courseId: course.id,
              courseName: course.name,
              query,
              maxResults: 3,
              returnMode: "refs",
              useSmallModel: true,
            });

            if (contentSearch.success && "citations" in contentSearch) {
              searchResults.push(
                ...contentSearch.citations.map((citation: any) => ({
                  ...citation,
                  courseId: course.id,
                  courseName: course.name,
                })),
              );
            }
          } catch (error) {
            // Continue if content search fails
          }
        }
      } catch (error) {
        // Continue with other courses if one fails
      }
    }

    // Filter and format results based on query intent
    const queryLower = query.toLowerCase();
    let filteredAssignments = allAssignments;

    if (
      queryLower.includes("due") &&
      (queryLower.includes("today") || queryLower.includes("this week"))
    ) {
      const today = new Date();
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      filteredAssignments = allAssignments.filter((assignment: any) => {
        if (!assignment.dueDate) return false;
        const dueDate = new Date(assignment.dueDate);
        return dueDate >= today && dueDate <= weekFromNow;
      });
    } else if (
      queryLower.includes("overdue") ||
      queryLower.includes("missing")
    ) {
      const today = new Date();
      filteredAssignments = allAssignments.filter((assignment: any) => {
        if (!assignment.dueDate) return false;
        const dueDate = new Date(assignment.dueDate);
        return (
          dueDate < today &&
          (!assignment.submittedAt || assignment.submittedAt === null)
        );
      });
    } else if (
      queryLower.includes("not submitted") ||
      queryLower.includes("haven't turned in")
    ) {
      filteredAssignments = allAssignments.filter(
        (assignment: any) =>
          !assignment.submittedAt || assignment.submittedAt === null,
      );
    }

    // Sort by due date (earliest first)
    filteredAssignments.sort((a: any, b: any) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    // Limit results
    const limitedAssignments = filteredAssignments.slice(
      0,
      options.maxResults * 2,
    );
    const limitedContent = searchResults.slice(0, options.maxResults);

    // Format response
    let markdown = `# 🔍 Multi-Course Assignment Search\n\n**Query:** "${query}"\n\n`;

    if (limitedAssignments.length > 0) {
      markdown += `## 📋 Found ${limitedAssignments.length} Assignments\n\n`;

      for (const assignment of limitedAssignments) {
        const dueText = assignment.dueDate
          ? new Date(assignment.dueDate).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "No due date";

        const submittedText = assignment.submittedAt
          ? "✅ Submitted"
          : "❌ Not submitted";
        const courseText = assignment.courseCode
          ? `${assignment.courseCode}`
          : assignment.courseName;

        markdown += `### ${assignment.name}\n`;
        markdown += `- **Course:** ${courseText}\n`;
        markdown += `- **Due:** ${dueText}\n`;
        markdown += `- **Status:** ${submittedText}\n`;
        if (assignment.points)
          markdown += `- **Points:** ${assignment.points}\n`;
        markdown += `\n`;
      }
    }

    if (limitedContent.length > 0) {
      markdown += `## 📄 Related Content\n\n`;
      for (const content of limitedContent) {
        markdown += `- **${content.title}** (${content.type}) - ${content.courseName}\n`;
      }
      markdown += `\n`;
    }

    if (limitedAssignments.length === 0 && limitedContent.length === 0) {
      markdown += `❌ No assignments or content found matching "${query}".\n\n`;
      markdown += `**Searched across ${courses.length} active courses.**\n`;
    }

    markdown += `\n---\n*Search completed in ${Date.now() - startTime}ms across ${courses.length} courses*`;

    return {
      content: [
        {
          type: "text",
          text: markdown,
        },
      ],
    };
  }

  // Call a tool
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name: toolName, arguments: input } = req.params;
    const { canvasBaseUrl, accessToken } = getCanvasConfig();

    logger.log(`Tool call: ${toolName} with args:`, input);

    try {
      switch (toolName) {
        case "get_courses": {
          const courses = await listCourses({
            ...getCanvasConfig(),
            ...(input as Omit<
              CourseListParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });
          const markdown =
            `| Course ID | Course Name | Course Code |\n|---|---|---|\n` +
            courses
              .map((c) => `| ${c.id} | ${c.name} | ${c.courseCode} |`)
              .join("\n");
          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_pages": {
          const pages = await listPages({
            ...getCanvasConfig(),
            ...(input as Omit<
              PagesListParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });
          const markdown =
            `| Page Title | URL |\n|---|---|\n` +
            pages.map((p) => `| ${p.title} | ${p.url} |`).join("\n");
          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "read_page": {
          const pageContent = await getPageContent({
            ...getCanvasConfig(),
            ...(input as Omit<
              PageContentParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });
          return {
            content: [
              {
                type: "text",
                text: pageContent.body,
              },
            ],
          };
        }

        case "get_discussions": {
          const discussions = await listDiscussions({
            ...getCanvasConfig(),
            ...(input as Omit<
              DiscussionsListParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });
          const markdown =
            `| Discussion ID | Topic Title | Last Updated |\n|---|---|---|\n` +
            discussions
              .map(
                (d) =>
                  `| ${d.id} | ${d.title} | ${d.lastReplyAt ? new Date(d.lastReplyAt).toLocaleString() : "N/A"} |`,
              )
              .join("\n");
          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "read_discussion": {
          const discussionContent = await getDiscussionContent({
            ...getCanvasConfig(),
            ...(input as Omit<
              DiscussionContentParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `## ${discussionContent.title}\n\n`;
          markdown += `${discussionContent.message}\n\n`;

          if (
            discussionContent.replies &&
            discussionContent.replies.length > 0
          ) {
            markdown += "---\n\n### Replies\n";
            markdown += formatDiscussionReplies(discussionContent.replies);
          } else {
            markdown += "*No replies found for this discussion.*";
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_assignments": {
          const assignments = await listAssignments({
            ...getCanvasConfig(),
            ...(input as Omit<
              AssignmentListParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });
          let markdown = `| Assignment Name | Due Date | Points | Files |\n|---|---|---|---|\n`;
          assignments.forEach((assignment) => {
            const dueDate = assignment.dueAt
              ? new Date(assignment.dueAt).toLocaleString()
              : "N/A";
            const points = assignment.pointsPossible || "N/A";

            // Combine all files from attachments and embedded links
            const allFiles: string[] = [];
            assignment.attachments?.forEach((att) =>
              allFiles.push(`📎 ${att.filename}`),
            );
            assignment.embeddedFileLinks?.forEach((link) =>
              allFiles.push(`🔗 ${link.text}`),
            );

            const filesDisplay =
              allFiles.length > 0 ? allFiles.join(", ") : "None";

            markdown += `| ${assignment.name} | ${dueDate} | ${points} | ${filesDisplay} |\n`;
          });
          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "find_files": {
          const files = await searchFiles({
            ...getCanvasConfig(),
            ...(input as Omit<
              FileSearchParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });
          const markdown =
            `| File Name | Module |\n|---|---|\n` +
            files
              .map((f) => `| ${f.name} | ${f.moduleName || "N/A"} |`)
              .join("\n");
          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "read_file": {
          const fileContent = await getFileContent({
            ...getCanvasConfig(),
            ...(input as Omit<
              FileContentParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });
          return {
            content: [
              {
                type: "text",
                text: `Content for ${fileContent.name}:\n\n${fileContent.content}`,
              },
            ],
          };
        }

        case "read_file_by_id": {
          const fileContent = await readFileById({
            ...getCanvasConfig(),
            ...(input as { fileId: string }),
          });
          return {
            content: [
              {
                type: "text",
                text: `**${fileContent.name}**\n\n${fileContent.content}\n\n[Download Link](${fileContent.url})`,
              },
            ],
          };
        }

        case "get_assignment_details": {
          const inputParams = input as any;
          let assignmentName = inputParams.assignmentName;
          let courseName = inputParams.courseName;
          let courseId = inputParams.courseId;

          const homework = await getAssignmentDetails({
            ...getCanvasConfig(),
            courseId,
            courseName,
            assignmentName: assignmentName,
          });

          let markdown = `# ${homework.name}\n\n`;
          markdown += `**Due Date:** ${homework.dueAt ? new Date(homework.dueAt).toLocaleString() : "N/A"}\n`;
          markdown += `**Points:** ${homework.pointsPossible}\n\n`;

          if (homework.description) {
            markdown += `## Description\n${homework.description}\n\n`;
          }

          if (homework.allFiles.length > 0) {
            markdown += `## Associated Files\n\n| File Name | Source | File ID |\n|---|---|---|\n`;
            homework.allFiles.forEach((file) => {
              markdown += `| ${file.name} | ${file.source} | ${file.id} |\n`;
            });
            markdown += `\n`;
          } else {
            markdown += `## Associated Files\n\n*No files found attached to this assignment.*\n\n`;
          }

          // If includeFileContent is true (default), read file contents
          const includeFileContent = inputParams.includeFileContent !== false; // Default to true
          const processFiles = inputParams.processFiles === true; // Default to false

          if (
            homework.allFiles.length > 0 &&
            (includeFileContent || processFiles)
          ) {
            if (processFiles) {
              markdown += `## 📄 Processed Files (Ready for Discussion)\n\n`;
              for (const file of homework.allFiles) {
                try {
                  const fileContent = await readFileById({
                    ...getCanvasConfig(),
                    fileId: file.id,
                  });

                  markdown += `### 📄 ${file.name}\n\n`;
                  markdown += `**File ID:** ${file.id} | **Source:** ${file.source}\n\n`;

                  // Process file for discussion
                  if (fileContent.content.length > 1000) {
                    markdown += `**Content Preview:**\n\`\`\`\n${fileContent.content.substring(0, 1000)}...\n\`\`\`\n\n`;
                    markdown += `*This file is ready for discussion. You can ask questions about its content.*\n\n`;
                  } else {
                    markdown += `**Full Content:**\n\`\`\`\n${fileContent.content}\n\`\`\`\n\n`;
                  }

                  markdown += `### 💬 Sample Questions You Can Ask\n\n`;
                  markdown += `- What are the main topics covered in this file?\n`;
                  markdown += `- Can you explain the key concepts?\n`;
                  markdown += `- What are the requirements mentioned?\n`;
                  markdown += `- Summarize the important points\n\n`;
                } catch (error) {
                  markdown += `### ${file.name}\n\n*Could not process file: ${error instanceof Error ? error.message : "Unknown error"}*\n\n`;
                }
              }
            } else if (includeFileContent) {
              markdown += `## File Contents\n\n`;
              for (const file of homework.allFiles) {
                try {
                  const fileContent = await readFileById({
                    ...getCanvasConfig(),
                    fileId: file.id,
                  });
                  markdown += `### ${file.name}\n\n\`\`\`\n${fileContent.content}\n\`\`\`\n\n`;
                } catch (error) {
                  markdown += `### ${file.name}\n\n*Could not read file content: ${error instanceof Error ? error.message : "Unknown error"}*\n\n`;
                }
              }
            }
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_submission_comments": {
          const submissionData = await getSubmissionComments({
            ...getCanvasConfig(),
            ...(input as Omit<
              GetSubmissionCommentsParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `# 💬 Submission Comments: ${submissionData.assignmentName}\n\n`;
          markdown += `**Assignment ID:** ${submissionData.assignmentId}\n`;
          markdown += `**Submission ID:** ${submissionData.submissionId}\n`;
          markdown += `**Score:** ${submissionData.score !== null ? `${submissionData.score} points` : "Not graded"}\n`;
          markdown += `**Grade:** ${submissionData.grade || "Not assigned"}\n`;
          markdown += `**Status:** ${submissionData.workflowState}\n`;

          if (submissionData.submittedAt) {
            markdown += `**Submitted:** ${new Date(submissionData.submittedAt).toLocaleString()}\n`;
          }

          if (submissionData.gradedAt) {
            markdown += `**Graded:** ${new Date(submissionData.gradedAt).toLocaleString()}\n`;
          }

          if (submissionData.late) {
            markdown += `**⚠️ Late Submission**\n`;
          }

          if (submissionData.excused) {
            markdown += `**✅ Excused**\n`;
          }

          markdown += `\n`;

          // Comments section
          if (submissionData.comments.length > 0) {
            markdown += `## 💬 Instructor Comments (${submissionData.comments.length})\n\n`;

            submissionData.comments.forEach((comment, index) => {
              markdown += `### Comment ${index + 1}\n`;
              markdown += `**From:** ${comment.authorName}\n`;
              markdown += `**Date:** ${new Date(comment.createdAt).toLocaleString()}\n\n`;
              markdown += `> ${comment.comment}\n\n`;

              if (comment.attachments && comment.attachments.length > 0) {
                markdown += `**Attachments:**\n`;
                comment.attachments.forEach((att) => {
                  markdown += `- [${att.filename}](${att.url}) (${att.contentType})\n`;
                });
                markdown += `\n`;
              }

              markdown += `---\n\n`;
            });
          } else {
            markdown += `## 💬 Comments\n\n*No instructor comments found for this submission.*\n\n`;
          }

          // Rubric assessment section
          if (
            submissionData.rubricAssessment &&
            submissionData.rubricAssessment.length > 0
          ) {
            markdown += `## 🎯 Rubric Assessment\n\n`;
            markdown += `| Criterion | Score | Performance Level | Comments |\n|---|---|---|---|\n`;

            submissionData.rubricAssessment.forEach((criterion) => {
              const score =
                criterion.pointsEarned !== null
                  ? `${criterion.pointsEarned} / ${criterion.pointsPossible}`
                  : `Not scored / ${criterion.pointsPossible}`;
              const performance = criterion.ratingDescription || "Not assessed";
              const comments = criterion.comments || "No comments";

              markdown += `| ${criterion.criterionDescription} | ${score} | ${performance} | ${comments} |\n`;
            });

            const totalEarned = submissionData.rubricAssessment.reduce(
              (sum, c) => sum + (c.pointsEarned || 0),
              0,
            );
            const totalPossible = submissionData.rubricAssessment.reduce(
              (sum, c) => sum + c.pointsPossible,
              0,
            );
            markdown += `\n**Total Rubric Score:** ${totalEarned} / ${totalPossible} points\n\n`;
          }

          // Submission history if included
          if (
            submissionData.submissionHistory &&
            submissionData.submissionHistory.length > 0
          ) {
            markdown += `## 📚 Submission History\n\n`;
            markdown += `| Attempt | Submitted | Score | Grade |\n|---|---|---|---|\n`;

            submissionData.submissionHistory.forEach((attempt) => {
              const submitted = attempt.submittedAt
                ? new Date(attempt.submittedAt).toLocaleString()
                : "Not submitted";
              const score =
                attempt.score !== null ? attempt.score.toString() : "N/A";
              const grade = attempt.grade || "N/A";

              markdown += `| ${attempt.attempt} | ${submitted} | ${score} | ${grade} |\n`;
            });

            markdown += `\n`;
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_detailed_submission": {
          const detailedData = await getDetailedSubmission({
            ...getCanvasConfig(),
            ...(input as Omit<
              GetDetailedSubmissionParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `# 📋 Detailed Submission: ${detailedData.assignment.name}\n\n`;

          // Assignment Overview
          markdown += `## 📝 Assignment Details\n\n`;
          markdown += `**Assignment ID:** ${detailedData.assignment.id}\n`;
          markdown += `**Points Possible:** ${detailedData.assignment.pointsPossible}\n`;
          markdown += `**Due Date:** ${detailedData.assignment.dueAt ? new Date(detailedData.assignment.dueAt).toLocaleString() : "No due date"}\n`;
          markdown += `**Submission Types:** ${detailedData.assignment.submissionTypes.join(", ")}\n\n`;

          if (detailedData.assignment.description) {
            markdown += `**Description:**\n${detailedData.assignment.description}\n\n`;
          }

          // Submission Details
          markdown += `## 📊 Submission Status\n\n`;
          markdown += `**Submission ID:** ${detailedData.submission.id}\n`;
          markdown += `**Score:** ${detailedData.submission.score !== null ? `${detailedData.submission.score} / ${detailedData.assignment.pointsPossible}` : "Not graded"}\n`;
          markdown += `**Grade:** ${detailedData.submission.grade || "Not assigned"}\n`;
          markdown += `**Status:** ${detailedData.submission.workflowState}\n`;

          if (detailedData.submission.submittedAt) {
            markdown += `**Submitted:** ${new Date(detailedData.submission.submittedAt).toLocaleString()}\n`;
          }

          if (detailedData.submission.gradedAt) {
            markdown += `**Graded:** ${new Date(detailedData.submission.gradedAt).toLocaleString()}\n`;
          }

          if (detailedData.submission.late) {
            markdown += `**⚠️ Late Submission**\n`;
          }

          if (detailedData.submission.excused) {
            markdown += `**✅ Excused**\n`;
          }

          markdown += `\n`;

          // Submission Content
          if (detailedData.submission.body) {
            markdown += `## 📄 Submission Content\n\n`;
            markdown += `${detailedData.submission.body}\n\n`;
          }

          if (detailedData.submission.url) {
            markdown += `**Submission URL:** [${detailedData.submission.url}](${detailedData.submission.url})\n\n`;
          }

          if (
            detailedData.submission.attachments &&
            detailedData.submission.attachments.length > 0
          ) {
            markdown += `**Attachments:**\n`;
            detailedData.submission.attachments.forEach((att) => {
              const sizeKB = Math.round(att.size / 1024);
              markdown += `- [${att.filename}](${att.url}) (${att.contentType}, ${sizeKB}KB)\n`;
            });
            markdown += `\n`;
          }

          // Comments section
          if (detailedData.comments.length > 0) {
            markdown += `## 💬 Instructor Feedback (${detailedData.comments.length} comments)\n\n`;

            detailedData.comments.forEach((comment, index) => {
              markdown += `### Comment ${index + 1}\n`;
              markdown += `**From:** ${comment.authorName}\n`;
              markdown += `**Date:** ${new Date(comment.createdAt).toLocaleString()}\n\n`;
              markdown += `> ${comment.comment}\n\n`;

              if (comment.attachments && comment.attachments.length > 0) {
                markdown += `**Attachments:**\n`;
                comment.attachments.forEach((att) => {
                  markdown += `- [${att.filename}](${att.url})\n`;
                });
                markdown += `\n`;
              }

              markdown += `---\n\n`;
            });
          } else {
            markdown += `## 💬 Instructor Feedback\n\n*No instructor comments found for this submission.*\n\n`;
          }

          // Rubric Assessment
          if (
            detailedData.rubricAssessment &&
            detailedData.rubricAssessment.length > 0
          ) {
            markdown += `## 🎯 Rubric Assessment\n\n`;
            markdown += `| Criterion | Score | Performance Level | Feedback |\n|---|---|---|---|\n`;

            detailedData.rubricAssessment.forEach((criterion) => {
              const score =
                criterion.pointsEarned !== null
                  ? `${criterion.pointsEarned} / ${criterion.pointsPossible}`
                  : `Not scored / ${criterion.pointsPossible}`;
              const performance = criterion.ratingDescription || "Not assessed";
              const feedback = criterion.comments || "No feedback";

              markdown += `| ${criterion.criterionDescription} | ${score} | ${performance} | ${feedback} |\n`;
            });

            const totalEarned = detailedData.rubricAssessment.reduce(
              (sum, c) => sum + (c.pointsEarned || 0),
              0,
            );
            const totalPossible = detailedData.rubricAssessment.reduce(
              (sum, c) => sum + c.pointsPossible,
              0,
            );
            markdown += `\n**Total Rubric Score:** ${totalEarned} / ${totalPossible} points\n\n`;
          }

          // Full Rubric Reference
          if (
            detailedData.rubricCriteria &&
            detailedData.rubricCriteria.length > 0
          ) {
            markdown += `## 📋 Complete Rubric Reference\n\n`;

            detailedData.rubricCriteria.forEach((criterion, index) => {
              markdown += `### ${index + 1}. ${criterion.description} (${criterion.points} pts)\n\n`;

              if (criterion.longDescription) {
                markdown += `*${criterion.longDescription}*\n\n`;
              }

              if (criterion.ratings.length > 0) {
                markdown += `**Performance Levels:**\n\n`;
                markdown += `| Level | Points | Description |\n|---|---|---|\n`;

                criterion.ratings.forEach((rating) => {
                  const description =
                    rating.longDescription || rating.description;
                  markdown += `| ${rating.description} | ${rating.points} | ${description} |\n`;
                });

                markdown += `\n`;
              }
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "smart_search": {
          const inputParams = input as any;
          const query = inputParams.query;
          const includeFileContent = inputParams.includeFileContent !== false;
          const maxResults = inputParams.maxResults ?? 5;
          const returnMode = inputParams.returnMode ?? "refs";
          const useSmallModel = inputParams.useSmallModel ?? true;

          try {
            // Get all courses first - use 'all' to get comprehensive course list
            const courses = await listCourses({
              ...getCanvasConfig(),
              enrollmentState: "all",
            });

            // Filter for truly active/current courses (2025+ only)
            const currentYear = new Date().getFullYear();
            const activeCourses = courses.filter((c) => {
              // Check enrollment state
              const hasActiveState =
                !c.enrollmentState ||
                c.enrollmentState === "active" ||
                c.enrollmentState === "current_and_future" ||
                c.enrollmentState === "current_and_concluded";

              if (!hasActiveState) return false;

              // Filter by semester and year context
              const courseName = (c.name || "").toLowerCase();
              const currentDate = new Date();
              const currentMonth = currentDate.getMonth() + 1; // 1-12

              // Determine what semesters are considered "current" based on current date
              // Spring: Jan-May, Summer: June-Aug, Fall: Sep-Dec
              let currentSemester = "spring";
              if (currentMonth >= 6 && currentMonth <= 8) {
                currentSemester = "summer";
              } else if (currentMonth >= 9) {
                currentSemester = "fall";
              }

              // Look for semester + year patterns
              const semesterYearPatterns = [
                // Full semester names
                /\b(spring|summer|fall)\s+(20\d{2})\b/g,
                // Short forms (SP25, SU25, FA25, etc.)
                /\b(sp|su|fa)(\d{2})\b/g,
                // Year-semester codes (25SP, 25SU, 25FA, etc.)
                /\b(\d{2})(sp|su|fa)\b/g,
                // Just years
                /\b(20\d{2})\b/g,
              ];

              let shouldExclude = false;

              for (const pattern of semesterYearPatterns) {
                const matches = [...courseName.matchAll(pattern)];

                for (const match of matches) {
                  let semester = "";
                  let year = 0;

                  if (pattern.source.includes("spring|summer|fall")) {
                    // Full semester names: "spring 2024", "fall 2025"
                    semester = match[1];
                    year = parseInt(match[2]);
                  } else if (pattern.source.includes("sp|su|fa.*\\d{2}")) {
                    // Short forms: "SP25", "FA24"
                    semester =
                      match[1] === "sp"
                        ? "spring"
                        : match[1] === "su"
                          ? "summer"
                          : "fall";
                    year = 2000 + parseInt(match[2]);
                  } else if (pattern.source.includes("\\d{2}.*sp|su|fa")) {
                    // Year-semester: "25SP", "24FA"
                    year = 2000 + parseInt(match[1]);
                    semester =
                      match[2] === "sp"
                        ? "spring"
                        : match[2] === "su"
                          ? "summer"
                          : "fall";
                  } else {
                    // Just year: "2024", "2025"
                    year = parseInt(match[1]);
                    semester = "unknown";
                  }

                  // Determine if this semester+year combo is outdated
                  if (year < currentYear) {
                    shouldExclude = true;
                    break;
                  } else if (year === currentYear && semester !== "unknown") {
                    // For current year, check if semester has passed
                    const semesterOrder: Record<string, number> = {
                      spring: 1,
                      summer: 2,
                      fall: 3,
                    };
                    const currentSemesterOrder = semesterOrder[currentSemester];
                    const courseSemesterOrder = semesterOrder[semester];

                    if (
                      courseSemesterOrder &&
                      courseSemesterOrder < currentSemesterOrder
                    ) {
                      // Course semester has already passed this year
                      shouldExclude = true;
                      break;
                    }
                  }
                }

                if (shouldExclude) break;
              }

              if (shouldExclude) return false;

              return true;
            });

            if (activeCourses.length === 0) {
              // Debug: Show what courses were found and their enrollment states
              const courseDebug = courses
                .map((c) => `${c.name} (${c.enrollmentState || "no state"})`)
                .join(", ");
              return {
                content: [
                  {
                    type: "text",
                    text: `# 🔍 Smart Search Results\n\n**Query:** "${query}"\n\n❌ No active courses available for search.\n\n**Debug:** Found ${courses.length} total courses: ${courseDebug}\n\nPlease check your Canvas access.`,
                  },
                ],
              };
            }

            const queryLower = query.toLowerCase();

            // Detect if this is an assignment-related query that should search across all courses
            const assignmentKeywords = [
              "due",
              "assignment",
              "homework",
              "submit",
              "turn in",
              "turned in",
              "overdue",
              "today",
              "week",
              "grade",
              "missing",
            ];
            const isAssignmentQuery = assignmentKeywords.some((keyword) =>
              queryLower.includes(keyword),
            );

            // Detect if user specified a specific course - improved matching
            let specificCourse = null;

            // Sort courses by preference - named courses first, then by relevance
            const sortedCourses = activeCourses.sort((a, b) => {
              // Prioritize courses with actual names over "Course XXXXX"
              const aHasName = !a.name.startsWith("Course ");
              const bHasName = !b.name.startsWith("Course ");
              if (aHasName && !bHasName) return -1;
              if (!aHasName && bHasName) return 1;
              return 0;
            });

            for (const course of sortedCourses) {
              const courseName = course.name.toLowerCase();
              const courseCode = (course.courseCode || "").toLowerCase();

              // Skip generic "Course XXXXX" entries unless query contains the exact ID
              if (
                course.name.startsWith("Course ") &&
                !queryLower.includes(course.id.toString())
              ) {
                continue;
              }

              // Extract course number/subject patterns (like "PHYS 214", "CMPEN 431", etc.)
              const coursePatterns = [];

              // Add full course code if available
              if (courseCode && courseCode !== "n/a") {
                coursePatterns.push(courseCode);
              }

              // Extract subject + number from course name (e.g., "PHYS 214" from "PHYS 214: Wave Motion...")
              const subjectNumberMatch = courseName.match(/([a-z]+)\s*(\d+)/);
              if (subjectNumberMatch) {
                const subject = subjectNumberMatch[1];
                const number = subjectNumberMatch[2];
                coursePatterns.push(`${subject} ${number}`);
                coursePatterns.push(`${subject}${number}`);

                // Add fuzzy subject matching ONLY for exact matches to avoid false positives
                const subjectAliases: Record<string, string[]> = {
                  phys: ["physics"],
                  cmpen: ["computer engineering", "comp eng", "cmpeng"],
                  cmpsc: ["computer science", "comp sci", "compsci"], // Removed 'cs' to avoid conflicts
                  ee: ["electrical engineering", "electrical", "elect eng"],
                  math: ["mathematics", "maths"],
                  engl: ["english"],
                  wmnst: ["womens studies", "women studies"],
                };

                if (subjectAliases[subject]) {
                  subjectAliases[subject].forEach((alias: string) => {
                    // Only add exact alias matches to avoid substring issues
                    if (
                      queryLower === alias ||
                      queryLower.includes(` ${alias} `) ||
                      queryLower.startsWith(`${alias} `) ||
                      queryLower.endsWith(` ${alias}`)
                    ) {
                      coursePatterns.push(`${alias} ${number}`);
                      coursePatterns.push(`${alias}${number}`);
                    }
                  });
                }
              }

              // Check for matches with improved logic
              let matches = false;

              // Direct name/code matches
              if (
                queryLower.includes(courseName) ||
                queryLower.includes(courseCode)
              ) {
                matches = true;
              }

              // Pattern matching with word boundaries
              if (!matches) {
                for (const pattern of coursePatterns) {
                  if (pattern.length > 0) {
                    const regex = new RegExp(
                      `\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                      "i",
                    );
                    if (regex.test(query)) {
                      matches = true;
                      break;
                    }
                  }
                }
              }

              // Exact course ID match (only if explicitly mentioned)
              if (!matches && queryLower.includes(course.id.toString())) {
                matches = true;
              }

              if (matches) {
                specificCourse = course;
                break;
              }
            }

            // Handle multi-course assignment queries
            if (isAssignmentQuery && !specificCourse) {
              return await handleMultiCourseAssignmentSearch(
                query,
                activeCourses,
                getCanvasConfig(),
                {
                  maxResults,
                  returnMode,
                  useSmallModel,
                },
              );
            }

            // Single course search (either specified or default)
            const targetCourse = specificCourse || activeCourses[0];

            // Perform smart search using our new system with all optimizations
            const searchResult = await performSmartSearch({
              ...getCanvasConfig(),
              courseId: targetCourse.id,
              courseName: targetCourse.name,
              query,
              forceRefresh: false,
              includeContent: includeFileContent,
              maxResults,
              returnMode,
              useSmallModel,
            });

            if (!searchResult.success) {
              return {
                content: [
                  {
                    type: "text",
                    text: `# 🔍 Smart Search Results\n\n**Query:** "${query}"\n\n❌ Search failed: ${searchResult.error || "Unknown error"}`,
                  },
                ],
              };
            }

            // Format results
            let markdown = `# 🔍 Smart Search Results\n\n`;
            markdown += `**Query:** "${query}"\n`;
            markdown += `**Course:** ${searchResult.courseInfo.courseName} (${searchResult.courseInfo.courseId})\n`;
            markdown += `**Results:** ${searchResult.metadata.totalResults} items found in ${searchResult.metadata.searchTime}ms\n`;
            markdown += `**Method:** ${searchResult.metadata.discoveryMethod}`;

            if (searchResult.metadata.apiRestrictions) {
              markdown += ` (${searchResult.metadata.apiRestrictions})`;
            }
            markdown += `\n\n`;

            // Handle different result formats
            if ("citations" in searchResult) {
              // Compact citations format
              const citations = searchResult.citations;
              if (citations.length > 0) {
                markdown += `## 🎯 Search Results (${citations.length} citations)\n\n`;

                citations.forEach((citation, i) => {
                  const icon =
                    citation.type === "file"
                      ? "📁"
                      : citation.type === "page"
                        ? "📄"
                        : "🔗";
                  const relevance = (citation.relevance * 100).toFixed(1) + "%";
                  const canProcessInfo =
                    citation.type === "file" && citation.canProcess
                      ? " ✅"
                      : citation.type === "file"
                        ? " ❌"
                        : "";

                  markdown += `${i + 1}. ${icon} **${citation.title}**${canProcessInfo} (${relevance} relevance)\n`;
                  markdown += `   - **ID:** \`${citation.id}\`\n`;
                  markdown += `   - **Source:** ${citation.source}\n`;
                  if (citation.type === "file" && citation.canProcess) {
                    markdown += `   - 💡 *Use \`get_file_content\` to read this file*\n`;
                  }
                  markdown += `\n`;
                });
              }
            } else {
              // Full results format (backward compatibility)
              // Show files
              if (searchResult.results.files.length > 0) {
                markdown += `## 📁 Files Found (${searchResult.results.files.length})\n\n`;
                markdown += `| File Name | File ID | Can Process | Relevance | Source |\n`;
                markdown += `|-----------|---------|-------------|-----------|--------|\n`;

                searchResult.results.files.slice(0, 10).forEach((file: any) => {
                  const canProcess = file.canProcess ? "✅" : "❌";
                  const relevance = (file.relevance * 100).toFixed(1) + "%";
                  const fileName =
                    file.fileName.length > 40
                      ? file.fileName.substring(0, 37) + "..."
                      : file.fileName;
                  markdown += `| ${fileName} | \`${file.fileId}\` | ${canProcess} | ${relevance} | ${file.source} |\n`;
                });

                if (searchResult.results.files.length > 10) {
                  markdown += `\n*Showing top 10 of ${searchResult.results.files.length} files found.*\n`;
                }
                markdown += `\n`;

                // Show top file details
                if (searchResult.results.files.length > 0) {
                  const topFile = searchResult.results.files[0];
                  markdown += `### 🎯 Top Result: ${topFile.fileName}\n\n`;
                  markdown += `- **File ID:** \`${topFile.fileId}\`\n`;
                  markdown += `- **Can Process:** ${topFile.canProcess ? "✅ Yes (LlamaParse supported)" : "❌ No"}\n`;
                  markdown += `- **Relevance:** ${(topFile.relevance * 100).toFixed(1)}%\n`;
                  markdown += `- **Source:** ${topFile.source}\n`;
                  markdown += `- **URL:** ${topFile.url}\n\n`;

                  if (topFile.canProcess) {
                    markdown += `💡 *You can use \`process_file\` with ID \`${topFile.fileId}\` to analyze this file's content.*\n\n`;
                  }
                }
              }

              // Show pages
              if (searchResult.results.pages.length > 0) {
                markdown += `## 📄 Pages Found (${searchResult.results.pages.length})\n\n`;
                searchResult.results.pages
                  .slice(0, 5)
                  .forEach((page: any, i: number) => {
                    const relevance = (page.relevance * 100).toFixed(1) + "%";
                    markdown += `${i + 1}. **${page.name}** (${relevance} relevance)\n`;
                    markdown += `   - URL: ${page.url}\n\n`;
                  });
              }

              // Show links
              if (searchResult.results.links.length > 0) {
                markdown += `## 🔗 Links Found (${searchResult.results.links.length})\n\n`;
                searchResult.results.links
                  .slice(0, 5)
                  .forEach((link: any, i: number) => {
                    const relevance = (link.relevance * 100).toFixed(1) + "%";
                    markdown += `${i + 1}. **${link.title}** (${link.type}, ${relevance} relevance)\n`;
                    markdown += `   - URL: ${link.url}\n`;
                    markdown += `   - Source: ${link.source}\n\n`;
                  });
              }
            }

            // Show suggestions
            if (
              searchResult.suggestions &&
              searchResult.suggestions.length > 0
            ) {
              markdown += `## 💡 Suggestions\n\n`;
              searchResult.suggestions.forEach((suggestion) => {
                markdown += `- ${suggestion}\n`;
              });
              markdown += `\n`;
            }

            // No results
            if (searchResult.metadata.totalResults === 0) {
              markdown += `## ❌ No Results Found\n\n`;
              markdown += `No files, pages, or links matched your search query.\n\n`;
              markdown += `**Try:**\n`;
              markdown += `- Using broader terms like "lecture", "notes", "slides"\n`;
              markdown += `- Searching for specific topics like "uncertainty", "quantum", "optics"\n`;
              markdown += `- Using file numbers like "L8", "assignment 3"\n\n`;
            }

            return {
              content: [
                {
                  type: "text",
                  text: markdown,
                },
              ],
            };
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            return {
              content: [
                {
                  type: "text",
                  text: `# 🔍 Smart Search Results\n\n**Query:** "${query}"\n\n❌ Search failed: ${errorMsg}`,
                },
              ],
            };
          }
        }

        case "process_file": {
          const inputParams = input as any;
          const fileId = inputParams.fileId;
          const analysisType = inputParams.analysisType || "qa_ready";

          try {
            const fileContent = await readFileById({
              ...getCanvasConfig(),
              fileId,
              mode: inputParams.mode || "full", // Allow mode control
              forceRefresh: inputParams.forceRefresh || false,
            });

            let markdown = `# 📄 File Analysis: ${fileContent.name}\n\n`;

            // Basic file info
            markdown += `**File ID:** ${fileId}\n`;
            markdown += `**File Name:** ${fileContent.name}\n`;
            markdown += `**Mode:** ${fileContent.metadata.mode}\n`;
            markdown += `**Content Size:** ${fileContent.metadata.originalSize || fileContent.content.length} chars\n`;
            if (fileContent.metadata.cached) {
              markdown += `**Cached:** ✅ (processing time: ${fileContent.metadata.processingTime || "instant"}ms)\n`;
            }
            if (fileContent.metadata.truncated) {
              markdown += `**Truncated:** ⚠️ Preview mode - use mode="full" for complete content\n`;
            }
            markdown += `**Download Link:** [View Original](${fileContent.url})\n\n`;

            // Content analysis based on type
            switch (analysisType) {
              case "summary":
                markdown += `## 📋 Summary\n\n`;
                if (fileContent.content.length > 500) {
                  markdown += `${fileContent.content.substring(0, 500)}...\n\n`;
                  markdown += `*This is a preview. The full document contains ${fileContent.content.length} characters.*\n\n`;
                } else {
                  markdown += `${fileContent.content}\n\n`;
                }
                break;

              case "key_points":
                markdown += `## 🔑 Key Points\n\n`;
                // Simple key point extraction - look for numbered lists, bullet points, etc.
                const lines = fileContent.content.split("\n");
                const keyLines = lines.filter(
                  (line) =>
                    line.trim().length > 20 &&
                    (line.includes("•") ||
                      line.includes("-") ||
                      /^\d+\./.test(line.trim()) ||
                      line.includes(":")),
                );
                if (keyLines.length > 0) {
                  keyLines.slice(0, 10).forEach((line) => {
                    markdown += `- ${line.trim()}\n`;
                  });
                } else {
                  markdown += `*No obvious key points detected. Showing first few sentences:*\n\n`;
                  const sentences = fileContent.content.split(".").slice(0, 3);
                  sentences.forEach((sentence) => {
                    if (sentence.trim().length > 10) {
                      markdown += `- ${sentence.trim()}.\n`;
                    }
                  });
                }
                markdown += `\n`;
                break;

              case "full_content":
                markdown += `## 📖 Full Content\n\n`;
                markdown += `\`\`\`\n${fileContent.content}\n\`\`\`\n\n`;
                break;

              case "qa_ready":
              default:
                markdown += `## 🤖 Ready for Discussion\n\n`;
                markdown += `This file has been processed and is ready for questions and discussion. `;
                markdown += `You can now ask me questions about this content.\n\n`;

                markdown += `### 📖 Content Preview\n\n`;
                if (fileContent.content.length > 1000) {
                  markdown += `\`\`\`\n${fileContent.content.substring(0, 1000)}...\n\`\`\`\n\n`;
                  markdown += `*Showing first 1000 characters. Full content is available for Q&A.*\n\n`;
                } else {
                  markdown += `\`\`\`\n${fileContent.content}\n\`\`\`\n\n`;
                }

                markdown += `### 💬 Sample Questions You Can Ask\n\n`;
                markdown += `- What are the main topics covered in this file?\n`;
                markdown += `- Can you explain the key concepts?\n`;
                markdown += `- What are the requirements mentioned?\n`;
                markdown += `- Summarize the important points\n\n`;
                break;
            }

            return {
              content: [
                {
                  type: "text",
                  text: markdown,
                },
              ],
            };
          } catch (error) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to process file: ${error instanceof Error ? error.message : "Unknown error"}`,
            );
          }
        }

        case "post_discussion_reply": {
          const reply = await postDiscussionReply({
            ...getCanvasConfig(),
            ...(input as Omit<
              PostDiscussionReplyParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          return {
            content: [
              {
                type: "text",
                text: `✅ Discussion reply posted successfully!\n\n**Reply ID:** ${reply.id}\n**Created:** ${new Date(reply.createdAt).toLocaleString()}\n**Message:** ${reply.message}`,
              },
            ],
          };
        }

        case "reply_to_discussion_entry": {
          const reply = await replyToDiscussionEntry({
            ...getCanvasConfig(),
            ...(input as Omit<
              PostDiscussionReplyParams & { parentEntryId: string },
              "canvasBaseUrl" | "accessToken"
            >),
          });

          return {
            content: [
              {
                type: "text",
                text: `✅ Threaded reply posted successfully!\n\n**Reply ID:** ${reply.id}\n**Parent Entry:** ${reply.parentId}\n**Created:** ${new Date(reply.createdAt).toLocaleString()}\n**Message:** ${reply.message}`,
              },
            ],
          };
        }

        case "send_message": {
          const message = await createConversation({
            ...getCanvasConfig(),
            ...(input as Omit<
              SendMessageParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          return {
            content: [
              {
                type: "text",
                text: `✅ Message sent successfully!\n\n**Conversation ID:** ${message.conversationId}\n**Message ID:** ${message.id}\n**Created:** ${new Date(message.createdAt).toLocaleString()}\n**Recipients:** ${(input as any).recipientIds.length} user(s)`,
              },
            ],
          };
        }

        case "reply_to_conversation": {
          const message = await replyToConversation({
            ...getCanvasConfig(),
            ...(input as Omit<
              ReplyToConversationParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          return {
            content: [
              {
                type: "text",
                text: `✅ Reply sent successfully!\n\n**Conversation ID:** ${message.conversationId}\n**Message ID:** ${message.id}\n**Created:** ${new Date(message.createdAt).toLocaleString()}`,
              },
            ],
          };
        }

        case "list_conversations": {
          const conversations = await listConversations({
            ...getCanvasConfig(),
            ...(input as Omit<
              ListConversationsParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `| Subject | Participants | Last Message | Workflow State |\n|---|---|---|---|\n`;
          conversations.forEach((conv) => {
            const participants = conv.participants
              .map((p) => p.name)
              .join(", ");
            const lastMessageDate = conv.lastMessageAt
              ? new Date(conv.lastMessageAt).toLocaleString()
              : "N/A";
            markdown += `| ${conv.subject} | ${participants} | ${lastMessageDate} | ${conv.workflowState} |\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_conversation_details": {
          const conversation = await getConversationDetails({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 💬 Conversation: ${conversation.subject}\n\n`;
          markdown += `**Participants:** ${conversation.participants.map((p) => p.name).join(", ")}\n`;
          markdown += `**Last Message:** ${conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString() : "N/A"}\n`;
          markdown += `**Message Count:** ${conversation.messageCount}\n\n`;

          if (conversation.messages && conversation.messages.length > 0) {
            markdown += `## Messages\n\n`;
            conversation.messages.reverse().forEach((msg, index) => {
              markdown += `### Message ${index + 1}\n`;
              markdown += `**From:** ${msg.authorName || "Unknown"}\n`;
              markdown += `**Date:** ${new Date(msg.createdAt).toLocaleString()}\n\n`;
              markdown += `${msg.body}\n\n`;
              if (msg.attachments && msg.attachments.length > 0) {
                markdown += `**Attachments:** ${msg.attachments.map((att) => att.filename).join(", ")}\n\n`;
              }
              markdown += `---\n\n`;
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "find_people": {
          const users = await findPeopleInCourse({
            ...getCanvasConfig(),
            ...(input as Omit<
              FindPeopleParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `| User ID | Name | Email | Enrollment Type |\n|---|---|---|---|\n`;
          users.forEach((user) => {
            const enrollmentTypes =
              user.enrollments?.map((e) => e.type).join(", ") || "N/A";
            markdown += `| ${user.id} | ${user.name} | ${user.email || "N/A"} | ${enrollmentTypes} |\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "search_recipients": {
          const recipients = await searchRecipients({
            ...getCanvasConfig(),
            ...(input as Omit<
              SearchRecipientsParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `| Recipient ID | Name | Common Courses |\n|---|---|---|\n`;
          recipients.forEach((recipient) => {
            const commonCourses = recipient.commonCourses
              ? Object.keys(recipient.commonCourses).join(", ")
              : "N/A";
            markdown += `| ${recipient.id} | ${recipient.name} | ${commonCourses} |\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_user_profile": {
          const user = await getUserProfile({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 👤 User Profile: ${user.name}\n\n`;
          markdown += `**User ID:** ${user.id}\n`;
          if (user.email) markdown += `**Email:** ${user.email}\n`;
          if (user.pronouns) markdown += `**Pronouns:** ${user.pronouns}\n`;
          if (user.bio) markdown += `**Bio:** ${user.bio}\n`;
          if (user.locale) markdown += `**Locale:** ${user.locale}\n`;

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "list_quizzes": {
          const quizzes = await listQuizzes({
            ...getCanvasConfig(),
            ...(input as Omit<
              ListQuizzesParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `| Quiz ID | Title | Due Date | Points | Question Count | Published |\n|---|---|---|---|---|---|\n`;
          quizzes.forEach((quiz) => {
            const dueDate = quiz.dueAt
              ? new Date(quiz.dueAt).toLocaleString()
              : "N/A";
            markdown += `| ${quiz.id} | ${quiz.title} | ${dueDate} | ${quiz.pointsPossible} | ${quiz.questionCount} | ${quiz.published ? "✅" : "❌"} |\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_quiz_details": {
          const quiz = await getQuizDetails({
            ...getCanvasConfig(),
            ...(input as Omit<
              QuizDetailsParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `# 📝 Quiz: ${quiz.title}\n\n`;
          if (quiz.description)
            markdown += `**Description:** ${quiz.description}\n\n`;
          markdown += `**Quiz ID:** ${quiz.id}\n`;
          markdown += `**Type:** ${quiz.quizType}\n`;
          markdown += `**Points Possible:** ${quiz.pointsPossible}\n`;
          markdown += `**Question Count:** ${quiz.questionCount}\n`;
          markdown += `**Time Limit:** ${quiz.timeLimit ? `${quiz.timeLimit} minutes` : "No limit"}\n`;
          markdown += `**Allowed Attempts:** ${quiz.allowedAttempts === -1 ? "Unlimited" : quiz.allowedAttempts}\n`;
          markdown += `**Published:** ${quiz.published ? "✅" : "❌"}\n`;
          if (quiz.dueAt)
            markdown += `**Due Date:** ${new Date(quiz.dueAt).toLocaleString()}\n`;
          if (quiz.unlockAt)
            markdown += `**Available From:** ${new Date(quiz.unlockAt).toLocaleString()}\n`;
          if (quiz.lockAt)
            markdown += `**Available Until:** ${new Date(quiz.lockAt).toLocaleString()}\n`;

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_quiz_submissions": {
          const submissions = await getQuizSubmissions({
            ...getCanvasConfig(),
            ...(input as Omit<
              QuizSubmissionsParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `| Submission ID | User ID | Attempt | Score | Started | Finished | State |\n|---|---|---|---|---|---|---|\n`;
          submissions.forEach((sub) => {
            const score =
              sub.score !== undefined ? sub.score.toString() : "N/A";
            const started = sub.startedAt
              ? new Date(sub.startedAt).toLocaleString()
              : "N/A";
            const finished = sub.finishedAt
              ? new Date(sub.finishedAt).toLocaleString()
              : "N/A";
            markdown += `| ${sub.id} | ${sub.userId || "N/A"} | ${sub.attempt} | ${score} | ${started} | ${finished} | ${sub.workflowState} |\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_quiz_submission_content": {
          const quizContent = await getQuizSubmissionContent({
            ...getCanvasConfig(),
            ...(input as Omit<
              QuizSubmissionContentParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `# 📚 Quiz Submission Review: ${quizContent.quizTitle}\n\n`;
          markdown += `**Quiz ID:** ${quizContent.quizId}\n`;
          markdown += `**Submission ID:** ${quizContent.submissionId}\n`;
          markdown += `**Attempt:** ${quizContent.attempt}\n`;
          markdown += `**Score:** ${quizContent.score} / ${quizContent.pointsPossible} points (${((quizContent.score / quizContent.pointsPossible) * 100).toFixed(1)}%)\n`;

          if (quizContent.submittedAt) {
            markdown += `**Submitted:** ${new Date(quizContent.submittedAt).toLocaleString()}\n`;
          }

          if (quizContent.timeSpent) {
            markdown += `**Time Spent:** ${Math.floor(quizContent.timeSpent / 60)} minutes ${quizContent.timeSpent % 60} seconds\n`;
          }

          markdown += `**Status:** ${quizContent.workflowState}\n\n`;

          markdown += `## 📝 Questions and Answers\n\n`;

          quizContent.questions.forEach((question, index) => {
            markdown += `### Question ${index + 1}: ${question.pointsPossible} points\n\n`;

            // Clean up question text (remove HTML tags for better readability)
            const cleanQuestionText = question.questionText
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .trim();

            markdown += `**Question:** ${cleanQuestionText}\n\n`;

            // Show question type
            markdown += `**Type:** ${question.questionType}\n\n`;

            // Show user's answer if available
            if (
              question.userAnswer !== undefined &&
              question.userAnswer !== null
            ) {
              markdown += `**Your Answer:** ${question.userAnswer}\n\n`;
            }

            // Show score for this question
            if (question.userScore !== undefined) {
              const percentage =
                question.pointsPossible > 0
                  ? (
                      (question.userScore / question.pointsPossible) *
                      100
                    ).toFixed(1)
                  : "0";
              markdown += `**Score:** ${question.userScore} / ${question.pointsPossible} points (${percentage}%)\n\n`;
            }

            // Show if correct/incorrect
            if (question.correct !== undefined) {
              markdown += `**Result:** ${question.correct ? "✅ Correct" : "❌ Incorrect"}\n\n`;
            }

            // Show answer options for multiple choice questions
            if (question.answers && question.answers.length > 0) {
              markdown += `**Answer Options:**\n`;
              question.answers.forEach((answer, answerIndex) => {
                const isCorrect = answer.weight > 0 ? " ✅" : "";
                markdown += `${String.fromCharCode(65 + answerIndex)}. ${answer.text}${isCorrect}\n`;
              });
              markdown += `\n`;
            }

            // Show feedback comments
            if (question.correct && question.correctComments) {
              markdown += `**Feedback (Correct):** ${question.correctComments}\n\n`;
            } else if (!question.correct && question.incorrectComments) {
              markdown += `**Feedback (Incorrect):** ${question.incorrectComments}\n\n`;
            } else if (question.neutralComments) {
              markdown += `**Feedback:** ${question.neutralComments}\n\n`;
            }

            markdown += `---\n\n`;
          });

          markdown += `## 📊 Study Summary\n\n`;
          const correctCount = quizContent.questions.filter(
            (q) => q.correct === true,
          ).length;
          const totalQuestions = quizContent.questions.length;
          markdown += `- **Questions Correct:** ${correctCount} / ${totalQuestions}\n`;
          markdown += `- **Overall Accuracy:** ${totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(1) : "0"}%\n`;
          markdown += `- **Points Earned:** ${quizContent.score} / ${quizContent.pointsPossible}\n\n`;

          const incorrectQuestions = quizContent.questions.filter(
            (q) => q.correct === false,
          );
          if (incorrectQuestions.length > 0) {
            markdown += `### 🎯 Areas for Review\n\n`;
            markdown += `Focus on these topics where you missed points:\n\n`;
            incorrectQuestions.forEach((question, index) => {
              const questionNum = quizContent.questions.indexOf(question) + 1;
              markdown += `- **Question ${questionNum}** (${question.pointsPossible} pts): ${question.questionType}\n`;
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_previous_submission_content": {
          const submissionContent = await getPreviousSubmissionContent({
            ...getCanvasConfig(),
            ...(input as Omit<
              PreviousSubmissionParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `# 📁 Previous Submission: ${submissionContent.assignment.name}\n\n`;

          // Assignment details
          markdown += `## 📚 Assignment Details\n\n`;
          markdown += `**Assignment ID:** ${submissionContent.assignment.id}\n`;
          markdown += `**Points Possible:** ${submissionContent.assignment.pointsPossible}\n`;
          markdown += `**Due Date:** ${submissionContent.assignment.dueAt ? new Date(submissionContent.assignment.dueAt).toLocaleString() : "No due date"}\n`;
          markdown += `**Submission Types:** ${submissionContent.assignment.submissionTypes.join(", ")}\n\n`;

          if (submissionContent.assignment.description) {
            markdown += `**Description:** ${submissionContent.assignment.description.substring(0, 200)}${submissionContent.assignment.description.length > 200 ? "..." : ""}\n\n`;
          }

          // Submission details
          markdown += `## 📊 Your Submission\n\n`;
          markdown += `**Score:** ${submissionContent.submission.score !== null ? `${submissionContent.submission.score} / ${submissionContent.assignment.pointsPossible}` : "Not graded"}\n`;
          markdown += `**Grade:** ${submissionContent.submission.grade || "Not assigned"}\n`;
          markdown += `**Submitted:** ${submissionContent.submission.submittedAt ? new Date(submissionContent.submission.submittedAt).toLocaleString() : "Not submitted"}\n`;
          markdown += `**Attempt:** ${submissionContent.submission.attempt}\n`;
          markdown += `**Status:** ${submissionContent.submission.workflowState}\n\n`;

          // Text submission content
          if (submissionContent.submission.body) {
            markdown += `### 📝 Text Submission\n\n`;
            markdown += `${submissionContent.submission.body}\n\n`;
          }

          // URL submission
          if (submissionContent.submission.url) {
            markdown += `### 🔗 URL Submission\n\n`;
            markdown += `[${submissionContent.submission.url}](${submissionContent.submission.url})\n\n`;
          }

          // File attachments
          if (submissionContent.files.length > 0) {
            markdown += `## 📎 Submitted Files (${submissionContent.files.length})\n\n`;

            submissionContent.files.forEach((file, index) => {
              markdown += `### ${index + 1}. ${file.filename}\n\n`;
              markdown += `**Type:** ${file.contentType}\n`;
              markdown += `**Size:** ${Math.round(file.size / 1024)}KB\n`;
              markdown += `**File ID:** ${file.id}\n`;
              markdown += `**Download:** [${file.filename}](${file.url})\n\n`;

              if (file.content) {
                markdown += `**Content:**\n\n`;
                if (
                  file.contentType.includes("pdf") ||
                  file.content.length > 1000
                ) {
                  markdown += `\`\`\`\n${file.content.substring(0, 1000)}${file.content.length > 1000 ? "\n... (truncated, full content available)" : ""}\n\`\`\`\n\n`;
                } else {
                  markdown += `\`\`\`\n${file.content}\n\`\`\`\n\n`;
                }
              }
            });
          } else {
            markdown += `## 📎 Files\n\n*No files were submitted with this assignment.*\n\n`;
          }

          // Submission history
          if (
            submissionContent.submissionHistory &&
            submissionContent.submissionHistory.length > 1
          ) {
            markdown += `## 📚 Submission History (${submissionContent.submissionHistory.length} attempts)\n\n`;

            submissionContent.submissionHistory.forEach((attempt, index) => {
              markdown += `### Attempt ${attempt.attempt}\n`;
              markdown += `**Submitted:** ${attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "Not submitted"}\n`;
              markdown += `**Files:** ${attempt.files.length}\n`;

              if (attempt.files.length > 0) {
                attempt.files.forEach((file) => {
                  markdown += `- ${file.filename} (${Math.round(file.size / 1024)}KB)\n`;
                });
              }
              markdown += `\n`;
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "list_submitted_assignments": {
          const submittedAssignments = await listSubmittedAssignments({
            ...getCanvasConfig(),
            ...(input as { courseId?: string; courseName?: string }),
          });

          let markdown = `# 📋 Your Submitted Assignments\n\n`;

          if (submittedAssignments.length === 0) {
            markdown += `*No submitted assignments found in this course.*\n`;
          } else {
            markdown += `Found ${submittedAssignments.length} submitted assignments:\n\n`;
            markdown += `| Assignment | Submitted | Score | Files | Type |\n|---|---|---|---|---|\n`;

            submittedAssignments.forEach((assignment) => {
              const submittedDate = new Date(
                assignment.submittedAt,
              ).toLocaleDateString();
              const score =
                assignment.score !== null
                  ? assignment.score.toString()
                  : "Not graded";
              const fileText =
                assignment.fileCount > 0
                  ? `${assignment.fileCount} file${assignment.fileCount > 1 ? "s" : ""}`
                  : "No files";
              const types = assignment.submissionTypes.join(", ");

              markdown += `| ${assignment.name} | ${submittedDate} | ${score} | ${fileText} | ${types} |\n`;
            });

            markdown += `\n💡 **Tip:** Use \`get_previous_submission_content\` with any assignment name to review your submitted files and content.\n`;
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "download_submission_file": {
          const fileData = await downloadSubmissionFile({
            ...getCanvasConfig(),
            ...(input as {
              submissionUrl?: string;
              fileId?: string;
              courseId?: string;
              assignmentId?: string;
              submissionId?: string;
            }),
          });

          let markdown = `# 📁 Downloaded File: ${fileData.filename}\n\n`;
          markdown += `**File Type:** ${fileData.contentType}\n`;
          markdown += `**File Size:** ${Math.round(fileData.size / 1024)}KB\n\n`;

          if (fileData.content.length > 0) {
            if (
              fileData.contentType.includes("pdf") ||
              fileData.contentType.includes("image") ||
              fileData.size > 50000
            ) {
              // For large files or PDFs, provide a summary
              markdown += `**Content Preview:**\n\n`;
              markdown += `\`\`\`\n${fileData.content.substring(0, 1000)}${fileData.content.length > 1000 ? "\n... (truncated for display)" : ""}\n\`\`\`\n\n`;
            } else {
              // For smaller text files, show full content
              markdown += `**Full Content:**\n\n`;
              markdown += `\`\`\`\n${fileData.content}\n\`\`\`\n\n`;
            }
          } else {
            markdown += `**Content:** File content could not be extracted or displayed.\n\n`;
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "list_modules": {
          const modules = await listModules({
            ...getCanvasConfig(),
            ...(input as Omit<
              ListModulesParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `| Module ID | Name | Position | Items Count | State | Published |\n|---|---|---|---|---|---|\n`;
          modules.forEach((module) => {
            markdown += `| ${module.id} | ${module.name} | ${module.position} | ${module.itemsCount} | ${module.state || "N/A"} | ${module.published ? "✅" : "❌"} |\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_module_items": {
          const items = await getModuleItems({
            ...getCanvasConfig(),
            ...(input as Omit<
              ModuleItemsParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `| Item ID | Title | Type | Position | Published |\n|---|---|---|---|---|\n`;
          items.forEach((item) => {
            markdown += `| ${item.id} | ${item.title} | ${item.type} | ${item.position} | ${item.published ? "✅" : "❌"} |\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_module_details": {
          const module = await getModuleDetails({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 📚 Module: ${module.name}\n\n`;
          markdown += `**Module ID:** ${module.id}\n`;
          markdown += `**Position:** ${module.position}\n`;
          markdown += `**Items Count:** ${module.itemsCount}\n`;
          markdown += `**Published:** ${module.published ? "✅" : "❌"}\n`;
          if (module.unlockAt)
            markdown += `**Unlock Date:** ${new Date(module.unlockAt).toLocaleString()}\n`;
          markdown += `**Sequential Progress Required:** ${module.requireSequentialProgress ? "✅" : "❌"}\n`;

          if (module.items && module.items.length > 0) {
            markdown += `\n## Module Items\n\n`;
            markdown += `| Title | Type | Published |\n|---|---|---|\n`;
            module.items.forEach((item) => {
              markdown += `| ${item.title} | ${item.type} | ${item.published ? "✅" : "❌"} |\n`;
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_grades": {
          const grades = await getGrades({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 📊 Grades Report\n\n`;

          if (grades.length === 0) {
            markdown += `No grades found or access denied.`;
          } else {
            // Process each course and its assignments
            grades.forEach((course) => {
              markdown += `## 📚 ${course.courseName}\n\n`;

              // Show overall course scores if available
              if (
                course.currentScore !== undefined ||
                course.finalScore !== undefined ||
                course.finalGrade !== undefined
              ) {
                markdown += `**Course Overview:**\n`;
                if (course.currentScore !== undefined)
                  markdown += `- Current Score: ${course.currentScore}%\n`;
                if (course.finalScore !== undefined)
                  markdown += `- Final Score: ${course.finalScore}%\n`;
                if (course.finalGrade !== undefined)
                  markdown += `- Final Grade: ${course.finalGrade}\n`;
                markdown += `\n`;
              }

              // Show assignments if available
              if (course.assignments && course.assignments.length > 0) {
                markdown += `| Assignment | Grade | Status | Points | Possible |\n|---|---|---|---|---|\n`;

                course.assignments.forEach((assignment) => {
                  const status =
                    assignment.submissionStatus === "graded"
                      ? "✅ Graded"
                      : assignment.submissionStatus === "submitted"
                        ? "📤 Submitted"
                        : assignment.submissionStatus === "missing"
                          ? "❌ Missing"
                          : assignment.submissionStatus === "late"
                            ? "⏰ Late"
                            : "⏳ Not Submitted";
                  const gradeDisplay =
                    assignment.score !== null ? assignment.score : "No Grade";
                  const pointsDisplay = assignment.pointsPossible
                    ? `${assignment.pointsPossible}`
                    : "N/A";

                  markdown += `| ${assignment.assignmentName} | ${gradeDisplay} | ${status} | ${assignment.score || "N/A"} | ${pointsDisplay} |\n`;
                });
              } else {
                markdown += `No assignments found for this course.\n`;
              }

              markdown += `\n`;
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_gradebook_categories": {
          const categories = await getGradebookCategories({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 📊 Gradebook Categories\n\n`;

          if (categories.length === 0) {
            markdown += `No gradebook categories found.`;
          } else {
            markdown += `| Category | Weight | Position | Drop Lowest | Drop Highest |\n|---|---|---|---|---|\n`;

            categories.forEach((category) => {
              const weightDisplay =
                category.weight > 0 ? `${category.weight}%` : "No Weight";
              markdown += `| ${category.name} | ${weightDisplay} | ${category.position} | ${category.dropLowest} | ${category.dropHighest} |\n`;
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_calendar_events": {
          const events = await listCalendarEvents({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 📅 Calendar Events\n\n`;

          if (events.length === 0) {
            markdown += `No calendar events found for the specified criteria.`;
          } else {
            markdown += `| Event | Type | Start Date | End Date | Course |\n|---|---|---|---|---|\n`;

            events.forEach((event) => {
              const startDate = event.startAt
                ? new Date(event.startAt).toLocaleString()
                : "N/A";
              const endDate = event.endAt
                ? new Date(event.endAt).toLocaleString()
                : "N/A";
              const eventType =
                event.type === "assignment" ? "📝 Assignment" : "📅 Event";

              markdown += `| [${event.title}](${event.url}) | ${eventType} | ${startDate} | ${endDate} | Course ${event.courseId} |\n`;
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_assignment_rubric": {
          const rubricData = await getAssignmentRubric({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 🎯 Rubric: ${rubricData.assignmentName}\n\n`;
          markdown += `**Assignment ID:** ${rubricData.assignmentId}\n`;
          markdown += `**Total Points:** ${rubricData.totalPoints}\n`;
          markdown += `**Criteria Count:** ${rubricData.criteria.length}\n\n`;

          markdown += `## Grading Criteria\n\n`;

          rubricData.criteria.forEach((criterion, index) => {
            markdown += `### ${index + 1}. ${criterion.description} (${criterion.points} points)\n\n`;

            if (criterion.longDescription) {
              markdown += `*${criterion.longDescription}*\n\n`;
            }

            markdown += `**Performance Levels:**\n\n`;
            markdown += `| Level | Points | Description |\n|---|---|---|\n`;

            criterion.ratings.forEach((rating) => {
              const description = rating.longDescription || rating.description;
              markdown += `| ${rating.description} | ${rating.points} | ${description} |\n`;
            });

            markdown += `\n`;
          });

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_rubric_analysis": {
          const analysis = await getRubricAnalysis({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 📊 Rubric Analysis: ${analysis.courseInfo.name}\n\n`;
          markdown += `**Course ID:** ${analysis.courseInfo.id}\n`;
          markdown += `**Assignments with Rubrics:** ${analysis.assignmentsWithRubrics} of ${analysis.totalAssignments}\n`;
          markdown += `**Total Rubric Points:** ${analysis.pointDistribution.totalRubricPoints}\n`;
          markdown += `**Average Points per Criterion:** ${analysis.pointDistribution.avgPointsPerCriterion}\n`;
          markdown += `**Total Criteria Analyzed:** ${analysis.pointDistribution.criteriaCount}\n\n`;

          if (analysis.rubricThemes.length > 0) {
            markdown += `## 🎨 Rubric Themes\n\n`;
            markdown += `| Theme | Frequency | Focus Areas |\n|---|---|---|\n`;

            analysis.rubricThemes.forEach((theme) => {
              markdown += `| ${theme.theme} | ${theme.frequency} assignments | ${theme.examples.join(", ") || "Various criteria"} |\n`;
            });

            markdown += `\n`;
          }

          if (analysis.commonCriteria.length > 0) {
            markdown += `## 🔍 Most Common Grading Criteria\n\n`;
            markdown += `| Criterion | Used in | Avg Points | Example Assignments |\n|---|---|---|---|\n`;

            analysis.commonCriteria.forEach((criterion) => {
              const examples = criterion.assignments.slice(0, 2).join(", ");
              const moreCount =
                criterion.assignments.length > 2
                  ? ` (+${criterion.assignments.length - 2} more)`
                  : "";
              markdown += `| ${criterion.description} | ${criterion.frequency} assignments | ${criterion.avgPoints} pts | ${examples}${moreCount} |\n`;
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_assignment_feedback": {
          const feedback = await getAssignmentFeedback({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 📝 Assignment Feedback: ${feedback.assignment.name}\n\n`;
          markdown += `**Assignment ID:** ${feedback.assignment.id}\n`;
          markdown += `**Total Points Possible:** ${feedback.assignment.points}\n\n`;

          if (feedback.submission) {
            markdown += `## 📊 Submission Summary\n\n`;
            markdown += `**Score:** ${feedback.submission.score || "Not graded"} / ${feedback.assignment.points}\n`;
            markdown += `**Grade:** ${feedback.submission.grade || "Not assigned"}\n`;
            markdown += `**Status:** ${feedback.submission.workflowState}\n`;

            if (feedback.submission.submittedAt) {
              markdown += `**Submitted:** ${new Date(feedback.submission.submittedAt).toLocaleString()}\n`;
            }

            markdown += `\n`;
          }

          if (
            feedback.feedback &&
            feedback.feedback.criteriaFeedback.length > 0
          ) {
            markdown += `## 🎯 Rubric Assessment\n\n`;
            markdown += `**Overall Score:** ${feedback.feedback.totalScore || "Not scored"} / ${feedback.feedback.totalPossible}\n\n`;

            markdown += `| Criterion | Score | Performance Level | Comments |\n|---|---|---|---|\n`;

            feedback.feedback.criteriaFeedback.forEach((criterion) => {
              const score =
                criterion.pointsEarned !== undefined
                  ? `${criterion.pointsEarned} / ${criterion.pointsPossible}`
                  : `Not scored / ${criterion.pointsPossible}`;
              const performance = criterion.performance || "Not assessed";
              const comments = criterion.comments || "No comments";

              markdown += `| ${criterion.criterion} | ${score} | ${performance} | ${comments} |\n`;
            });

            markdown += `\n`;
          }

          if (
            feedback.submission?.comments &&
            feedback.submission.comments.length > 0
          ) {
            markdown += `## 💬 General Comments\n\n`;

            feedback.submission.comments.forEach((comment) => {
              const date = new Date(comment.createdAt).toLocaleString();
              markdown += `**${comment.author}** (${date}):\n> ${comment.comment}\n\n`;
            });
          }

          if (feedback.rubric && feedback.rubric.length > 0) {
            markdown += `## 📋 Full Rubric Reference\n\n`;

            feedback.rubric.forEach((criterion, index) => {
              markdown += `### ${index + 1}. ${criterion.description} (${criterion.points} pts)\n\n`;

              if (criterion.ratings.length > 0) {
                markdown += `**Performance Levels:** `;
                const levels = criterion.ratings.map(
                  (r) => `${r.description} (${r.points} pts)`,
                );
                markdown += levels.join(" • ");
                markdown += `\n\n`;
              }
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_course_navigation": {
          const navigation = await getCourseNavigation({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 🧭 Course Navigation: ${navigation.courseName}\n\n`;
          markdown += `**Course ID:** ${navigation.courseId}\n`;
          markdown += `**Total Modules:** ${navigation.modules.length}\n`;
          markdown += `**Overall Progress:** ${navigation.completionStatus.overallProgress}%\n\n`;

          // Progress Summary
          markdown += `## 📊 Progress Summary\n\n`;
          markdown += `| Metric | Completed | Total | Percentage |\n|---|---|---|---|\n`;
          markdown += `| Modules | ${navigation.completionStatus.completedModules} | ${navigation.completionStatus.totalModules} | ${navigation.completionStatus.overallProgress}% |\n`;
          markdown += `| Items | ${navigation.completionStatus.completedItems} | ${navigation.completionStatus.totalItems} | ${navigation.completionStatus.totalItems > 0 ? Math.round((navigation.completionStatus.completedItems / navigation.completionStatus.totalItems) * 100) : 0}% |\n\n`;

          // Module Structure
          markdown += `## 🏗️ Module Structure\n\n`;
          markdown += `| # | Module Name | Status | Items | Prerequisites |\n|---|---|---|---|---|\n`;

          navigation.modules.forEach((module, index) => {
            const statusEmoji =
              module.state === "completed"
                ? "✅"
                : module.state === "started"
                  ? "🔄"
                  : module.state === "locked"
                    ? "🔒"
                    : "⭕";

            const prereqText =
              module.prerequisiteModuleIds.length > 0
                ? `${module.prerequisiteModuleIds.length} prereq(s)`
                : "None";

            markdown += `| ${index + 1} | ${module.name} | ${statusEmoji} ${module.state} | ${module.items.length} | ${prereqText} |\n`;
          });

          // Next Steps
          if (navigation.nextSteps.length > 0) {
            markdown += `\n## 🎯 Recommended Next Steps\n\n`;

            navigation.nextSteps.forEach((step, index) => {
              markdown += `### ${index + 1}. ${step.moduleName}\n`;
              markdown += `**Status:** ${step.reason}\n`;

              if (step.blockedBy && step.blockedBy.length > 0) {
                markdown += `**Blocked by:** ${step.blockedBy.join(", ")}\n`;
              }

              markdown += `\n`;
            });
          }

          // Prerequisites Map
          if (navigation.prerequisiteMap.size > 0) {
            markdown += `## 🔗 Module Dependencies\n\n`;

            navigation.modules.forEach((module) => {
              if (module.prerequisiteModuleIds.length > 0) {
                const prereqNames = module.prerequisiteModuleIds.map(
                  (prereqId) => {
                    const prereqModule = navigation.modules.find(
                      (m) => m.id === prereqId,
                    );
                    return prereqModule?.name || `Module ${prereqId}`;
                  },
                );

                markdown += `- **${module.name}** requires: ${prereqNames.join(", ")}\n`;
              }
            });
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_course_syllabus": {
          const syllabus = await getCourseSyllabus({
            ...getCanvasConfig(),
            ...(input as any),
          });

          let markdown = `# 📚 Course Syllabus: ${syllabus.courseName}\n\n`;
          markdown += `**Course ID:** ${syllabus.courseId}\n\n`;

          // Syllabus Body
          if (
            syllabus.syllabusBody &&
            syllabus.syllabusBody.trim().length > 0
          ) {
            markdown += `## 📄 Course Syllabus\n\n`;
            markdown += `${syllabus.syllabusBody}\n\n`;
          } else {
            markdown += `## 📄 Course Syllabus\n\n`;
            markdown += `*No syllabus content found in course body.*\n\n`;
          }

          // Syllabus Pages
          if (syllabus.syllabusPages.length > 0) {
            markdown += `## 📑 Syllabus Pages\n\n`;
            markdown += `| Page Title | URL |\n|---|---|\n`;

            syllabus.syllabusPages.forEach((page) => {
              markdown += `| ${page.title} | [View Page](${page.url}) |\n`;
            });

            markdown += `\n`;
          }

          // Syllabus Files
          if (syllabus.syllabusFiles.length > 0) {
            markdown += `## 📁 Syllabus Files\n\n`;
            markdown += `| File Name | Type | Size | Link |\n|---|---|---|---|\n`;

            syllabus.syllabusFiles.forEach((file) => {
              const sizeKB = Math.round(file.size / 1024);
              markdown += `| ${file.name} | ${file.contentType} | ${sizeKB}KB | [Download](${file.url}) |\n`;
            });

            markdown += `\n`;
          }

          // Extracted Information
          if (syllabus.extractedInfo) {
            const info = syllabus.extractedInfo;

            if (
              info.gradingPolicy ||
              info.attendancePolicy ||
              info.latePolicy
            ) {
              markdown += `## 📋 Course Policies\n\n`;

              if (info.gradingPolicy) {
                markdown += `### 📊 Grading Policy\n${info.gradingPolicy}\n\n`;
              }

              if (info.attendancePolicy) {
                markdown += `### 📅 Attendance Policy\n${info.attendancePolicy}\n\n`;
              }

              if (info.latePolicy) {
                markdown += `### ⏰ Late Submission Policy\n${info.latePolicy}\n\n`;
              }
            }

            if (info.contactInfo && info.contactInfo.length > 0) {
              markdown += `## 📞 Contact Information\n\n`;
              markdown += `| Type | Information |\n|---|---|\n`;

              info.contactInfo.forEach((contact) => {
                const typeLabel =
                  contact.type === "email"
                    ? "📧 Email"
                    : contact.type === "phone"
                      ? "📱 Phone"
                      : contact.type === "office_hours"
                        ? "🏢 Office Hours"
                        : contact.type;

                markdown += `| ${typeLabel} | ${contact.info} |\n`;
              });

              markdown += `\n`;
            }

            if (info.importantDates && info.importantDates.length > 0) {
              markdown += `## 📅 Important Dates\n\n`;
              markdown += `| Date | Event |\n|---|---|\n`;

              info.importantDates.forEach((date) => {
                markdown += `| ${date.date} | ${date.event} |\n`;
              });

              markdown += `\n`;
            }
          }

          // Summary
          markdown += `## 📊 Syllabus Summary\n\n`;
          markdown += `- **Syllabus Body:** ${syllabus.syllabusBody ? "Available" : "Not found"}\n`;
          markdown += `- **Syllabus Pages:** ${syllabus.syllabusPages.length} found\n`;
          markdown += `- **Syllabus Files:** ${syllabus.syllabusFiles.length} found\n`;
          markdown += `- **Extracted Policies:** ${Object.values(syllabus.extractedInfo).filter((v) => v && (Array.isArray(v) ? v.length > 0 : true)).length} found\n`;

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "calculate_course_analytics": {
          const analytics = await calculateCourseAnalytics({
            ...getCanvasConfig(),
            ...(input as Omit<
              CourseAnalyticsParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `# 📊 Course Analytics: ${analytics.courseName}\n\n`;

          // Current Grade Summary
          markdown += `## 🎯 Current Standing\n\n`;
          markdown += `**Current Grade:** ${analytics.currentGrade.percentage !== null ? `${analytics.currentGrade.percentage.toFixed(1)}%` : "Not calculated"} `;
          markdown += `(${analytics.currentGrade.letterGrade || "No letter grade"})\n`;
          markdown += `**Points Earned:** ${analytics.currentGrade.pointsEarned} / ${analytics.currentGrade.pointsPossible}\n\n`;

          // Projected Grade
          markdown += `## 🔮 Projected Final Grade\n\n`;
          markdown += `**Projected Grade:** ${analytics.projectedGrade.percentage !== null ? `${analytics.projectedGrade.percentage.toFixed(1)}%` : "Not calculated"} `;
          markdown += `(${analytics.projectedGrade.letterGrade || "No letter grade"})\n`;
          markdown += `**Total Points:** ${analytics.projectedGrade.pointsEarned.toFixed(1)} / ${analytics.projectedGrade.pointsPossible}\n\n`;

          // Category Breakdown
          if (analytics.categoryBreakdown.length > 0) {
            markdown += `## 📈 Category Performance\n\n`;
            markdown += `| Category | Weight | Current Score | Progress | Points |\n|---|---|---|---|---|\n`;

            analytics.categoryBreakdown.forEach((category) => {
              const score =
                category.currentScore !== null
                  ? `${category.currentScore.toFixed(1)}%`
                  : "No grades";
              const progress = `${category.assignmentsCompleted}/${category.assignmentsTotal}`;
              const points = `${category.pointsEarned} / ${category.pointsPossible}`;

              markdown += `| ${category.categoryName} | ${category.weight}% | ${score} | ${progress} | ${points} |\n`;
            });

            markdown += `\n`;
          }

          // Upcoming Assignments
          if (analytics.upcomingAssignments.length > 0) {
            markdown += `## 📅 Upcoming Assignments\n\n`;
            markdown += `| Assignment | Due Date | Points | Days Left | Category |\n|---|---|---|---|---|\n`;

            analytics.upcomingAssignments.forEach((assignment) => {
              const dueDate = assignment.dueDate
                ? new Date(assignment.dueDate).toLocaleDateString()
                : "No due date";
              const daysLeft =
                assignment.daysUntilDue !== null
                  ? `${assignment.daysUntilDue} days`
                  : "No due date";

              markdown += `| ${assignment.name} | ${dueDate} | ${assignment.points} | ${daysLeft} | ${assignment.category} |\n`;
            });

            markdown += `\n`;
          }

          // Statistics
          markdown += `## 📊 Performance Statistics\n\n`;
          markdown += `**Completion Rate:** ${analytics.statistics.completionRate.toFixed(1)}% (${analytics.statistics.assignmentsCompleted}/${analytics.statistics.assignmentsTotal} assignments)\n`;
          if (analytics.statistics.averageScore !== null) {
            markdown += `**Average Score:** ${analytics.statistics.averageScore.toFixed(1)}%\n`;
          }
          markdown += `\n`;

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "generate_what_if_scenarios": {
          const scenarios = await generateWhatIfScenarios({
            ...getCanvasConfig(),
            ...(input as Omit<
              WhatIfScenarioParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `# 🎯 What-If Scenarios: ${scenarios.courseName}\n\n`;

          // Target Summary
          markdown += `## 🏆 Target Grade Analysis\n\n`;
          markdown += `**Current Grade:** ${scenarios.currentGrade !== null ? `${scenarios.currentGrade.toFixed(1)}%` : "Not calculated"}\n`;
          markdown += `**Target Grade:** ${scenarios.targetGrade}% (${scenarios.targetLetterGrade})\n`;
          markdown += `**Is Achievable:** ${scenarios.isAchievable ? "✅ Yes" : "❌ No"}\n\n`;

          if (scenarios.requiredAverage !== null) {
            markdown += `**Required Average on Remaining Work:** ${scenarios.requiredAverage.toFixed(1)}%\n`;
          }
          markdown += `**Remaining Points Available:** ${scenarios.remainingPoints}\n`;
          markdown += `**Remaining Assignments:** ${scenarios.remainingAssignments}\n\n`;

          // Scenarios
          if (scenarios.scenarios.length > 0) {
            markdown += `## 📋 Scenarios\n\n`;

            scenarios.scenarios.forEach((scenario, index) => {
              const difficultyEmoji =
                {
                  Easy: "🟢",
                  Moderate: "🟡",
                  Challenging: "🟠",
                  "Nearly Impossible": "🔴",
                }[scenario.difficulty] || "⚪";

              markdown += `### ${difficultyEmoji} ${scenario.difficulty}: ${scenario.description}\n\n`;
              markdown += `**Required Score:** ${scenario.requiredScore.toFixed(1)}%\n`;
              markdown += `**Explanation:** ${scenario.explanation}\n\n`;
            });
          }

          // Recommendations
          if (scenarios.recommendations.length > 0) {
            markdown += `## 💡 Recommendations\n\n`;

            scenarios.recommendations.forEach((recommendation) => {
              markdown += `- ${recommendation}\n`;
            });

            markdown += `\n`;
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        case "get_grade_trends": {
          const trends = await getGradeTrends({
            ...getCanvasConfig(),
            ...(input as Omit<
              GradeTrendsParams,
              "canvasBaseUrl" | "accessToken"
            >),
          });

          let markdown = `# 📈 Grade Trends: ${trends.courseName}\n\n`;

          // Trend Analysis
          markdown += `## 📊 Overall Trend Analysis\n\n`;

          const trendEmoji =
            {
              Improving: "📈",
              Declining: "📉",
              Stable: "➡️",
              "Insufficient Data": "❓",
            }[trends.trendAnalysis.overallTrend] || "❓";

          markdown += `**Overall Trend:** ${trendEmoji} ${trends.trendAnalysis.overallTrend}\n`;

          if (trends.trendAnalysis.trendPercentage !== null) {
            const direction =
              trends.trendAnalysis.trendPercentage > 0
                ? "improvement"
                : "decline";
            markdown += `**Trend Change:** ${Math.abs(trends.trendAnalysis.trendPercentage).toFixed(1)} percentage point ${direction}\n`;
          }

          markdown += `**Confidence Level:** ${trends.trendAnalysis.confidence}\n\n`;

          // Timeline Data
          if (trends.timelineData.length > 0) {
            markdown += `## 📅 Recent Assignment Timeline\n\n`;
            markdown += `| Date | Assignment | Score | Percentage | Category |\n|---|---|---|---|---|\n`;

            trends.timelineData.forEach((assignment) => {
              const date = new Date(assignment.date).toLocaleDateString();
              const percentage = `${assignment.percentage.toFixed(1)}%`;
              const score = `${assignment.score} / ${assignment.pointsPossible}`;

              markdown += `| ${date} | ${assignment.assignmentName} | ${score} | ${percentage} | ${assignment.category} |\n`;
            });

            markdown += `\n`;
          }

          // Performance by Category
          if (trends.performanceByCategory.length > 0) {
            markdown += `## 📊 Performance by Category\n\n`;
            markdown += `| Category | Average Score | Trend | Recent Assignments |\n|---|---|---|---|\n`;

            trends.performanceByCategory.forEach((category) => {
              const trendIcon =
                {
                  Improving: "📈",
                  Declining: "📉",
                  Stable: "➡️",
                }[category.trend] || "❓";

              markdown += `| ${category.categoryName} | ${category.averageScore.toFixed(1)}% | ${trendIcon} ${category.trend} | ${category.recentAssignments} |\n`;
            });

            markdown += `\n`;
          }

          // Insights
          if (trends.insights.length > 0) {
            markdown += `## 💡 Key Insights\n\n`;

            trends.insights.forEach((insight) => {
              markdown += `- ${insight}\n`;
            });

            markdown += `\n`;
          }

          return {
            content: [
              {
                type: "text",
                text: markdown,
              },
            ],
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool "${toolName}" not found`,
          );
      }
    } catch (error: any) {
      logger.error("Tool call failed:", error);
      // Forward the error message to the client
      throw new McpError(ErrorCode.InternalError, error.message);
    }
  });

  logger.log("🚀 Starting Notioc Canvas MCP Server...");

  // Connect server to transport and start listening
  await server.connect(transport);

  logger.log("✅ Server started and listening for requests.");
  logger.log(
    "Make sure your .env file is configured with CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN.",
  );

  // Graceful shutdown
  process.on("SIGINT", async () => {
    logger.log("🔌 Shutting down server...");
    // The connection will be closed automatically on process exit
    logger.log("✅ Server stopped.");
    process.exit(0);
  });
}

// Run the main function
main().catch((error) => {
  logger.error("❌ Failed to start server:", error);
  process.exit(1);
});
