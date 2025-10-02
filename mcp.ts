#!/usr/bin/env node

// Notioc Canvas MCP Server
// Model Context Protocol server for Canvas LMS integration

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

// Import our Canvas tools
import { listCourses, CourseListParams } from './tools/courses.js';
import { listAssignments, getAssignmentDetails, AssignmentListParams } from './tools/assignments.js';
import { searchFiles, getFileContent, readFileById, FileSearchParams, FileContentParams } from './tools/files.js';
import { getFiles, GetFilesParams } from './lib/files-enhanced.js';
import { 
  listPages, getPageContent, 
  listDiscussions, getDiscussionContent,
  PagesListParams, PageContentParams,
  DiscussionsListParams, DiscussionContentParams
} from './tools/pages-discussions.js';
import { postDiscussionReply, replyToDiscussionEntry, PostDiscussionReplyParams } from './tools/discussions.js';
import { 
  createConversation, replyToConversation, listConversations, getConversationDetails,
  SendMessageParams, ReplyToConversationParams, ListConversationsParams
} from './tools/messages.js';
import { 
  findPeopleInCourse, searchRecipients, getUserProfile, getMyProfile,
  FindPeopleParams, SearchRecipientsParams
} from './tools/users.js';
import { listQuizzes, getQuizDetails, getQuizSubmissions, ListQuizzesParams, QuizDetailsParams, QuizSubmissionsParams } from './tools/quizzes.js';
import { listModules, getModuleItems, getModuleDetails, ListModulesParams, ModuleItemsParams } from './tools/modules.js';
import { getGrades, getGradebookCategories, GetGradesParams, GradebookCategoriesParams } from './tools/grades.js';
import { listCalendarEvents, CalendarEventListParams } from './tools/calendar.js';
import { getAssignmentRubric, getRubricAnalysis, getAssignmentFeedback, RubricParams } from './tools/rubrics.js';
import { downloadSubmissionFile } from './tools/file-download.js';
import { getCourseNavigation, getCourseSyllabus, CourseStructureParams } from './tools/course-structure.js';
import { getSubmissionComments, getDetailedSubmission, GetSubmissionCommentsParams, GetDetailedSubmissionParams } from './tools/submission-comments.js';
import { 
  calculateCourseAnalytics, generateWhatIfScenarios, getGradeTrends,
  CourseAnalyticsParams, WhatIfScenarioParams, GradeTrendsParams 
} from './tools/analytics.js';
import { 
  getQuizSubmissionContent, getUserQuizSubmissionHistory,
  QuizSubmissionContentParams 
} from './tools/quiz-submission-content.js';
import { 
  getPreviousSubmissionContent, listSubmittedAssignments,
  PreviousSubmissionParams
} from './tools/previous-submissions.js';
import { getCurrentCourses, CurrentCoursesParams } from './tools/current-courses.js';
import {
  listGroups, getGroupDetails, listGroupMembers, listGroupDiscussions, getGroupDiscussion, postGroupDiscussion
} from './tools/groups.js';
import { getAccountNotifications, dismissNotification, formatNotifications, GetNotificationsParams } from './tools/notifications.js';
import {
  getPlannerItems, getPlannerNotes, createPlannerNote, updatePlannerNote,
  deletePlannerNote, markPlannerItemComplete, formatPlannerItems,
  GetPlannerItemsParams, CreatePlannerNoteParams, UpdatePlannerNoteParams,
  MarkPlannerCompleteParams
} from './tools/planner.js';
import {
  getCourseAnalytics, getActivityData, getAssignmentAnalytics, getCommunicationAnalytics,
  getStudentPerformanceSummary, formatAnalyticsSummary,
  GetCourseAnalyticsParams
} from './tools/analytics-dashboard.js';
import {
  listPeerReviews, getAllPeerReviews, getPeerReviewSubmission,
  formatPeerReviews, formatAllPeerReviews,
  GetPeerReviewsParams, GetPeerReviewSubmissionParams
} from './tools/peer-reviews.js';
import {
  getFavoriteCourses, addFavoriteCourse, removeFavoriteCourse, formatFavorites,
  GetFavoritesParams, AddFavoriteParams, RemoveFavoriteParams
} from './tools/favorites.js';
import {
  getAllNicknames, getNickname, setNickname, removeNickname, formatNicknames,
  GetNicknamesParams, GetNicknameParams, SetNicknameParams, RemoveNicknameParams
} from './tools/nicknames.js';
import {
  getBookmarks, getBookmark, createBookmark, updateBookmark, deleteBookmark,
  formatBookmarks, formatBookmark,
  GetBookmarksParams, GetBookmarkParams, CreateBookmarkParams, UpdateBookmarkParams, DeleteBookmarkParams
} from './tools/bookmarks.js';
import {
  getRecentHistory, formatHistory, formatHistoryByDate,
  GetHistoryParams
} from './tools/history.js';
import {
  getReceivedContentShares, getUnreadContentSharesCount,
  formatContentShares, formatContentSharesWithCount,
  GetContentSharesParams
} from './tools/content-shares.js';

// Import tool help and guidance systems
import { getToolHelp, getAllToolsOverview, searchTools } from './lib/tool-help.js';
import { SYSTEM_GUIDANCE } from './lib/llm-guidance.js';

// Import custom logger that writes to stderr
import { logger } from './lib/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Load environment variables with explicit path
dotenv.config({ path: join(projectRoot, '.env') });

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
      'Canvas configuration missing. Please set CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN environment variables.'
    );
  }

  return { canvasBaseUrl: baseUrl, accessToken };
}

function formatDiscussionReplies(replies: any[], level = 0): string {
  let markdown = '';
  const indent = '  '.repeat(level);

  for (const reply of replies) {
    if (!reply.message) continue;

    const author = reply.user_name || 'Anonymous';
    const postedAt = reply.created_at ? new Date(reply.created_at).toLocaleString() : 'No date';
    
    // Naively strip HTML tags and clean up message
    const message = (reply.message || '')
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
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
  logger.info('🚀 Notioc Canvas MCP Server is starting...');
  let config: CanvasConfig;

  try {
    // This will throw if config is missing, and the catch block will handle it.
    config = getCanvasConfig(); 
    
    logger.info('✅ Canvas configuration loaded successfully.');

  } catch (error: any) {
    logger.error('❌ FATAL: Could not start server.', {
      message: error.message,
      advice: 'Please ensure your .env file is correctly configured with your CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN.'
    });
    // Exit gracefully if the config is bad
    return; 
  }

  // Use standard I/O for transport
  const transport = new StdioServerTransport();

// Create MCP server
const server = new Server(
  {
    name: 'notioc-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_courses',
        description: 'Get your Canvas courses for the authenticated user',
        inputSchema: {
          type: 'object',
          properties: {
            enrollmentState: {
              type: 'string',
              enum: ['active', 'completed', 'all'],
              description: 'Filter courses by enrollment state (default: active)',
              default: 'active'
            }
          },
        },
      },
      {
        name: 'get_current_courses',
        description: '🎯 SMART TOOL: Get ONLY currently active courses (running right now this semester/term). Use this instead of get_courses when users ask about "my courses", "current courses", or "what\'s due". Automatically filters out past/future courses and provides context about which courses are actually running.',
        inputSchema: {
          type: 'object',
          properties: {
            includeUpcoming: {
              type: 'boolean',
              description: 'Also show courses starting in the next 4 weeks',
              default: false
            },
            includeRecentlyCompleted: {
              type: 'boolean',
              description: 'Also show courses that ended in the last 4 weeks',
              default: false
            },
            checkActivity: {
              type: 'boolean',
              description: '🔥 RECOMMENDED: Check for upcoming assignments to filter out inactive courses (e.g., training). Slightly slower but much more accurate for users with many enrollments.',
              default: false
            }
          },
        },
      },
      {
        name: 'get_pages',
        description: 'Get pages in a Canvas course',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
            },
            sort: {
              type: 'string',
              enum: ['title', 'created_at', 'updated_at'],
              description: 'Sort pages by (default: updated_at)',
              default: 'updated_at'
            },
            order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort order (default: desc)',
              default: 'desc'
            },
            searchTerm: {
              type: 'string',
              description: 'Optional search term to filter pages by title',
            }
          },
        },
      },
      {
        name: 'read_page',
        description: 'Read the content of a specific Canvas page. Automatically extracts and categorizes all links (other pages, files, assignments, discussions) found on the page, providing Claude with context about what else can be explored.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
            },
            pageUrl: {
              type: 'string',
              description: 'The page URL or title from the URL (e.g., "self-reflective-memo-prompt")',
            },
            pageId: {
              type: 'string',
              description: 'The Canvas page ID (if known, can be used instead of pageUrl)',
            }
          },
        },
      },
      {
        name: 'get_discussions',
        description: 'Get discussion topics in a Canvas course',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
            },
            onlyAnnouncements: {
              type: 'boolean',
              description: 'Only list announcements (default: false)',
              default: false
            },
            orderBy: {
              type: 'string',
              enum: ['position', 'recent_activity', 'title'],
              description: 'Order discussions by (default: recent_activity)',
              default: 'recent_activity'
            },
            searchTerm: {
              type: 'string',
              description: 'Optional search term to filter discussions by title',
            }
          },
        },
      },
      {
        name: 'read_discussion',
        description: 'Read the content of a specific Canvas discussion topic',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
            },
            discussionId: {
              type: 'string',
              description: 'The Canvas discussion topic ID',
            },
            includeReplies: {
              type: 'boolean',
              description: 'Include discussion replies (default: true)',
              default: true
            }
          },
          required: ['discussionId'],
        },
      },
      {
        name: 'list_groups',
        description: 'List Canvas groups for the current user or a specific course. Groups are used for collaboration, group discussions, and group assignments.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric). If omitted, returns all groups for the current user.',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
            }
          },
        },
      },
      {
        name: 'get_group_details',
        description: 'Get detailed information about a specific Canvas group including permissions and member count.',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The Canvas group ID (numeric)',
            }
          },
          required: ['groupId'],
        },
      },
      {
        name: 'list_group_members',
        description: 'List all members of a specific Canvas group.',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The Canvas group ID (numeric)',
            }
          },
          required: ['groupId'],
        },
      },
      {
        name: 'list_group_discussions',
        description: 'List discussion topics in a Canvas group. Groups often have their own discussion boards separate from course discussions.',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The Canvas group ID (numeric)',
            },
            orderBy: {
              type: 'string',
              enum: ['position', 'recent_activity', 'title'],
              description: 'Order discussions by (default: recent_activity)',
              default: 'recent_activity'
            }
          },
          required: ['groupId'],
        },
      },
      {
        name: 'get_group_discussion',
        description: 'Get a specific discussion topic from a Canvas group.',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The Canvas group ID (numeric)',
            },
            topicId: {
              type: 'string',
              description: 'The discussion topic ID',
            }
          },
          required: ['groupId', 'topicId'],
        },
      },
      {
        name: 'post_group_discussion',
        description: 'Create a new discussion topic in a Canvas group.',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The Canvas group ID (numeric)',
            },
            title: {
              type: 'string',
              description: 'The title of the discussion topic',
            },
            message: {
              type: 'string',
              description: 'The message/content of the discussion topic',
            },
            discussionType: {
              type: 'string',
              enum: ['side_comment', 'threaded'],
              description: 'Type of discussion (default: threaded)',
              default: 'threaded'
            }
          },
          required: ['groupId', 'title', 'message'],
        },
      },
      {
        name: 'get_account_notifications',
        description: '🚨 Get active account-level notifications (global alerts, campus closures, emergencies, policy changes). These are system-wide announcements that all students need to know about. IMPORTANT: Use this when users ask "what do I need to know today?" or "any important announcements?"',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_planner_items',
        description: '📅 Get unified TODO/planner view across all courses (Canvas native planner). Shows assignments, quizzes, discussions, calendar events, and personal notes in chronological order. Use this when users ask "what do I need to do today/this week?" or "what\'s coming up?" Perfect for daily/weekly planning.',
        inputSchema: {
          type: 'object',
          properties: {
            startDate: {
              type: 'string',
              description: 'Start date filter (ISO 8601 format: YYYY-MM-DD). Defaults to today if not specified.',
            },
            endDate: {
              type: 'string',
              description: 'End date filter (ISO 8601 format: YYYY-MM-DD). Optional.',
            },
            contextCodes: {
              type: 'array',
              description: 'Filter by specific courses (e.g., ["course_123", "course_456"]). Optional.',
              items: { type: 'string' },
            },
            filter: {
              type: 'string',
              description: 'Filter option. Use "new_activity" to show only items with recent updates.',
              enum: ['new_activity'],
            },
          },
        },
      },
      {
        name: 'create_planner_note',
        description: '📌 Create a personal planner note/reminder (Canvas native TODO item). Students use this for custom reminders like "study for midterm" or "office hours with professor". These appear in Canvas planner alongside course items.',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Note title (e.g., "Study for Bio midterm")',
            },
            details: {
              type: 'string',
              description: 'Note details/description (optional)',
            },
            todoDate: {
              type: 'string',
              description: 'When this TODO is due (ISO 8601 format: YYYY-MM-DD)',
            },
            courseId: {
              type: 'string',
              description: 'Associate with a specific course (optional)',
            },
          },
          required: ['title', 'todoDate'],
        },
      },
      {
        name: 'update_planner_note',
        description: '✏️ Update an existing planner note (change title, date, details, or associated course)',
        inputSchema: {
          type: 'object',
          properties: {
            noteId: {
              type: 'string',
              description: 'The planner note ID to update',
            },
            title: {
              type: 'string',
              description: 'New note title (optional)',
            },
            details: {
              type: 'string',
              description: 'New note details (optional)',
            },
            todoDate: {
              type: 'string',
              description: 'New due date (ISO 8601 format: YYYY-MM-DD) (optional)',
            },
            courseId: {
              type: 'string',
              description: 'New course association (optional)',
            },
          },
          required: ['noteId'],
        },
      },
      {
        name: 'delete_planner_note',
        description: '🗑️ Delete a personal planner note',
        inputSchema: {
          type: 'object',
          properties: {
            noteId: {
              type: 'string',
              description: 'The planner note ID to delete',
            },
          },
          required: ['noteId'],
        },
      },
      {
        name: 'mark_planner_item_complete',
        description: '✅ Mark a planner item as complete/incomplete (check off TODO items in Canvas planner). Works for assignments, quizzes, discussions, and notes. Students use this to track progress.',
        inputSchema: {
          type: 'object',
          properties: {
            plannableType: {
              type: 'string',
              description: 'Type of item (assignment, quiz, discussion_topic, planner_note, etc.)',
              enum: ['assignment', 'quiz', 'discussion_topic', 'wiki_page', 'planner_note', 'calendar_event', 'assessment_request'],
            },
            plannableId: {
              type: 'string',
              description: 'The ID of the item to mark complete',
            },
            markedComplete: {
              type: 'boolean',
              description: 'true to mark complete, false to mark incomplete',
            },
          },
          required: ['plannableType', 'plannableId', 'markedComplete'],
        },
      },
      {
        name: 'get_canvas_analytics',
        description: '📊 Get Canvas\'s native analytics dashboard for a course (engagement metrics, participation levels). Shows page views, activity level, assignment patterns, and compares you to class averages. Use this when students ask "How am I doing?" or "Am I participating enough?"',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Biology 101"). If provided, courseId is not required.',
            },
            includeActivity: {
              type: 'boolean',
              description: 'Include detailed activity data over time (page views and participations by day)',
              default: false,
            },
            includeAssignments: {
              type: 'boolean',
              description: 'Include assignment-level analytics',
              default: false,
            },
          },
        },
      },
      {
        name: 'get_student_performance_summary',
        description: '🎯 Get comprehensive performance summary combining Canvas analytics + grades. Perfect for "How am I doing in this course?" questions. Shows engagement metrics, grade, submission patterns, strengths, and areas for improvement.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Biology 101"). If provided, courseId is not required.',
            },
          },
        },
      },
      {
        name: 'get_all_peer_reviews',
        description: '👥 Get ALL peer reviews across all courses. Shows which assignments have peer reviews, how many you need to complete, and feedback you\'ve received. Use this when students ask "Do I have any peer reviews?" or "What peer reviews are pending?"',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_peer_reviews_for_assignment',
        description: '📝 Get detailed peer review information for a specific assignment. Shows reviews you need to complete (with student names unless anonymous) and reviews of your work (with feedback). Use this to see specific peer review details.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            assignmentId: {
              type: 'string',
              description: 'The assignment ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (optional, for display purposes)',
            },
          },
          required: ['courseId', 'assignmentId'],
        },
      },
      {
        name: 'get_peer_review_submission',
        description: '📄 Get the submission content you need to review for a peer review. Returns the student\'s submission text, attachments, and any existing comments. Use this when completing a peer review.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            assignmentId: {
              type: 'string',
              description: 'The assignment ID (numeric)',
            },
            submissionId: {
              type: 'string',
              description: 'The submission ID to review (from list_peer_reviews_for_assignment)',
            },
          },
          required: ['courseId', 'assignmentId', 'submissionId'],
        },
      },
      {
        name: 'get_favorite_courses',
        description: '⭐ Get your favorite/starred courses. Favorites are courses you\'ve starred in Canvas for quick access. Perfect for filtering to "important courses" or "this semester\'s main classes". Use when students say "show me my important courses" or "my main classes".',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'add_favorite_course',
        description: '⭐ Star/favorite a course for quick access. Adds course to your favorites list in Canvas. Use when students want to mark a course as important or frequently accessed.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID to favorite (numeric)',
            },
          },
          required: ['courseId'],
        },
      },
      {
        name: 'remove_favorite_course',
        description: '⭐ Unstar/unfavorite a course. Removes course from your favorites list in Canvas.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID to unfavorite (numeric)',
            },
          },
          required: ['courseId'],
        },
      },
      {
        name: 'get_all_course_nicknames',
        description: '📝 Get all your course nicknames. Nicknames let you call courses by friendly names ("Biology" instead of "BIO-301-F25-SEC02"). Helps with natural language queries.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'set_course_nickname',
        description: '📝 Set a friendly nickname for a course. Makes it easier to reference courses naturally. Example: rename "CSCI-401-F25-001" to just "Capstone" or "Senior Project".',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            nickname: {
              type: 'string',
              description: 'The friendly nickname to use (e.g., "Biology", "Calc 2", "History")',
            },
          },
          required: ['courseId', 'nickname'],
        },
      },
      {
        name: 'remove_course_nickname',
        description: '📝 Remove a course nickname and revert to the official course name.',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
          },
          required: ['courseId'],
        },
      },
      {
        name: 'get_bookmarks',
        description: '📑 Get all your saved Canvas bookmarks. Students bookmark important resources like study guides, discussion threads, and assignment pages for quick access.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_bookmark',
        description: '📑 Get details for a specific bookmark by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            bookmarkId: {
              type: 'string',
              description: 'The bookmark ID',
            },
          },
          required: ['bookmarkId'],
        },
      },
      {
        name: 'create_bookmark',
        description: '📑 Save a Canvas URL as a bookmark. Perfect for saving important discussion threads, study resources, or assignment pages you need to revisit.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'A descriptive name for the bookmark (e.g., "Midterm Study Guide", "Week 3 Discussion")',
            },
            url: {
              type: 'string',
              description: 'The Canvas URL to bookmark (must be a Canvas page URL)',
            },
            position: {
              type: 'number',
              description: 'Optional: Position for ordering bookmarks (1-based)',
            },
          },
          required: ['name', 'url'],
        },
      },
      {
        name: 'update_bookmark',
        description: '📑 Update an existing bookmark (rename it or change the URL).',
        inputSchema: {
          type: 'object',
          properties: {
            bookmarkId: {
              type: 'string',
              description: 'The bookmark ID to update',
            },
            name: {
              type: 'string',
              description: 'New name for the bookmark',
            },
            url: {
              type: 'string',
              description: 'New URL for the bookmark',
            },
            position: {
              type: 'number',
              description: 'New position for ordering',
            },
          },
          required: ['bookmarkId'],
        },
      },
      {
        name: 'delete_bookmark',
        description: '📑 Delete a saved bookmark.',
        inputSchema: {
          type: 'object',
          properties: {
            bookmarkId: {
              type: 'string',
              description: 'The bookmark ID to delete',
            },
          },
          required: ['bookmarkId'],
        },
      },
      {
        name: 'get_recent_history',
        description: '📜 Get your recently viewed Canvas pages. Perfect for "What was that assignment I looked at yesterday?" or "Find the page I visited this morning". Shows page views across all courses with timestamps and time spent.',
        inputSchema: {
          type: 'object',
          properties: {
            groupByDate: {
              type: 'boolean',
              description: 'Optional: Group results by date (today, yesterday, etc.) for easier reading. Default: false',
            },
          },
        },
      },
      {
        name: 'get_content_shares',
        description: '📤 Get content that instructors or peers have shared directly with you. This is separate from regular course content - it\'s personal shares. Shows unread shares first with sender info and shared dates.',
        inputSchema: {
          type: 'object',
          properties: {
            includeCount: {
              type: 'boolean',
              description: 'Optional: Include unread count summary at the top. Default: false',
            },
          },
        },
      },
      {
        name: 'get_assignments',
        description: 'Get assignments for a specific Canvas course',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
            },
            includeSubmissions: {
              type: 'boolean',
              description: 'Include submission information (default: false)',
              default: false
            }
          },
        },
      },
      {
        name: 'find_files',
        description: 'Find files in a Canvas course',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
            },
            searchTerm: {
              type: 'string',
              description: 'Optional search term to filter files by name',
            }
          },
        },
      },
      {
        name: 'read_file',
        description: 'Read the content of a specific Canvas file',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
            },
            fileId: {
              type: 'string',
              description: 'The Canvas file ID (optional if fileName is provided)',
            },
            fileName: {
              type: 'string',
              description: 'The file name to search for (optional if fileId is provided)',
            }
          },
        },
      },
      {
        name: 'read_file_by_id',
        description: 'Read a Canvas file directly using its file ID (e.g., from a Canvas URL like /files/176870249)',
        inputSchema: {
          type: 'object',
          properties: {
            fileId: {
              type: 'string',
              description: 'The Canvas file ID (e.g., "176870249" from the URL)',
            }
          },
          required: ['fileId'],
        },
      },
      {
        name: 'get_files',
        description: `Comprehensive file browser for Canvas courses with folder hierarchy, rich metadata, and LlamaParse processing indicators.

Shows:
• Organized folder structure with navigation
• File details: size, type, dates, lock status  
• Which files can be processed by LlamaParse (PDF, Office, images, audio)
• Processing recommendations and time estimates
• Summary statistics and actionable suggestions

Use this to:
• Explore course file structure
• Find documents to process and analyze
• Identify relevant materials for assignments
• Check which files support advanced processing
• Get processing recommendations

Better than find_files because it shows:
✓ Folder hierarchy (not flat list)
✓ Processing capability (LlamaParse support)
✓ Rich metadata (size, type, dates)
✓ Smart recommendations (what to process first)
✓ Navigation context (parent folders, breadcrumb)`,
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID (numeric)',
            },
            courseName: {
              type: 'string',
              description: 'The course name (e.g., "Data Science 410"). If provided, courseId is not required.',
            },
            folderId: {
              type: 'string',
              description: 'Browse a specific folder by ID. Omit to browse root folder.',
            },
            folderPath: {
              type: 'string',
              description: 'Browse by folder path (e.g., "Week 1/Readings"). Alternative to folderId.',
            },
            recursive: {
              type: 'boolean',
              description: 'Include files from subfolders (default: true)',
              default: true,
            },
            contentTypes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by content types (e.g., ["application/pdf", "image"])',
            },
            searchTerm: {
              type: 'string',
              description: 'Search file names (fuzzy matching)',
            },
            groupBy: {
              type: 'string',
              enum: ['folder', 'type', 'none'],
              description: 'How to organize results (default: type)',
              default: 'type',
            },
            sortBy: {
              type: 'string',
              enum: ['name', 'size', 'date', 'type'],
              description: 'Sort order (default: name)',
              default: 'name',
            },
            showHidden: {
              type: 'boolean',
              description: 'Include hidden files (default: false)',
              default: false,
            },
            includeFromModules: {
              type: 'boolean',
              description: 'Also include files referenced in course modules (default: true)',
              default: true,
            },
          },
        },
      },
        {
          name: 'get_assignment_details',
          description: 'Gets the full details for a single assignment, including the description, due date, points, and a list of all associated files. Use this after finding an assignment with get_assignments.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Math 451", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentName: {
                type: 'string',
                description: 'The full name of the assignment (e.g., "Project 2: Human Behavior Insights to Sustainable Arts and Design").',
              },
              includeFileContent: {
                type: 'boolean',
                description: 'Whether to automatically read the content of associated files (default: true)',
                default: true
              },
              processFiles: {
                type: 'boolean',
                description: 'Whether to process files for discussion and Q&A (default: false)',
                default: false
              }
            },
            required: [],
          },
        },
        {
          name: 'get_submission_comments',
          description: '📝 **NEW** Get detailed feedback and comments for a specific assignment submission including rubric assessments',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentId: {
                type: 'string',
                description: 'The Canvas assignment ID (numeric)',
              },
              assignmentName: {
                type: 'string',
                description: 'The assignment name (e.g., "Final Project", "Essay 1"). If provided, assignmentId is not required.',
              },
              userId: {
                type: 'string',
                description: 'Optional user ID to get comments for (defaults to current user)',
              },
              includeRubricAssessment: {
                type: 'boolean',
                description: 'Include detailed rubric grading (default: true)',
                default: true
              },
              includeSubmissionHistory: {
                type: 'boolean',
                description: 'Include submission attempt history (default: false)',
                default: false
              }
            },
            anyOf: [
              { required: ['courseId', 'assignmentId'] },
              { required: ['courseId', 'assignmentName'] },
              { required: ['courseName', 'assignmentId'] },
              { required: ['courseName', 'assignmentName'] }
            ]
          }
        },
        {
          name: 'get_detailed_submission',
          description: '📋 **NEW** Get comprehensive submission details with assignment info, feedback, comments, and rubric data in one call',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentId: {
                type: 'string',
                description: 'The Canvas assignment ID (numeric)',
              },
              assignmentName: {
                type: 'string',
                description: 'The assignment name (e.g., "Final Project", "Essay 1"). If provided, assignmentId is not required.',
              },
              userId: {
                type: 'string',
                description: 'Optional user ID to get submission for (defaults to current user)',
              }
            },
            anyOf: [
              { required: ['courseId', 'assignmentId'] },
              { required: ['courseId', 'assignmentName'] },
              { required: ['courseName', 'assignmentId'] },
              { required: ['courseName', 'assignmentName'] }
            ]
          }
        },
        {
          name: 'process_file',
          description: 'Process a Canvas file for discussion and Q&A. Reads the file content and provides a summary with key points that can be discussed.',
          inputSchema: {
            type: 'object',
            properties: {
              fileId: {
                type: 'string',
                description: 'The Canvas file ID to process',
              },
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (optional, for context)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (optional, for context)',
              },
              analysisType: {
                type: 'string',
                enum: ['summary', 'key_points', 'full_content', 'qa_ready'],
                description: 'Type of analysis to perform (default: qa_ready)',
                default: 'qa_ready'
              },
              mode: {
                type: 'string',
                enum: ['preview', 'full'],
                description: 'Content mode: "preview" for compressed version (faster, fewer tokens), "full" for complete content (default: full)',
                default: 'full'
              },
              forceRefresh: {
                type: 'boolean',
                description: 'Force refresh from source, bypassing cache (default: false)',
                default: false
              }
            },
            required: ['fileId'],
          },
        },
        {
          name: 'post_discussion_reply',
          description: 'Post a reply to a Canvas discussion topic. This allows you to participate in course discussions.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              topicId: {
                type: 'string',
                description: 'The Canvas discussion topic ID',
              },
              message: {
                type: 'string',
                description: 'The message content to post',
              },
              attachmentIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of Canvas file IDs to attach',
              }
            },
            required: ['topicId', 'message'],
          },
        },
        {
          name: 'reply_to_discussion_entry',
          description: 'Reply to a specific entry in a Canvas discussion (threaded reply).',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              topicId: {
                type: 'string',
                description: 'The Canvas discussion topic ID',
              },
              parentEntryId: {
                type: 'string',
                description: 'The ID of the discussion entry to reply to',
              },
              message: {
                type: 'string',
                description: 'The message content to post',
              },
              attachmentIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of Canvas file IDs to attach',
              }
            },
            required: ['topicId', 'parentEntryId', 'message'],
          },
        },
        {
          name: 'send_message',
          description: 'Create a new Canvas conversation and send the initial message.',
          inputSchema: {
            type: 'object',
            properties: {
              recipientIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of Canvas user IDs to send the message to',
              },
              subject: {
                type: 'string',
                description: 'Subject line for the conversation',
              },
              body: {
                type: 'string',
                description: 'Message body content',
              },
              contextCode: {
                type: 'string',
                description: 'Optional context code (e.g., "course_123") to associate with a course',
              },
              attachmentIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of Canvas file IDs to attach',
              }
            },
            required: ['recipientIds', 'subject', 'body'],
          },
        },
        {
          name: 'reply_to_conversation',
          description: 'Reply to an existing Canvas conversation.',
          inputSchema: {
            type: 'object',
            properties: {
              conversationId: {
                type: 'string',
                description: 'The Canvas conversation ID',
              },
              body: {
                type: 'string',
                description: 'Message body content',
              },
              attachmentIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of Canvas file IDs to attach',
              },
              includedMessages: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional array of message IDs to include in the reply',
              }
            },
            required: ['conversationId', 'body'],
          },
        },
        {
          name: 'list_conversations',
          description: 'List Canvas conversations (inbox messages).',
          inputSchema: {
            type: 'object',
            properties: {
              scope: {
                type: 'string',
                enum: ['inbox', 'sent', 'archived', 'unread'],
                description: 'Filter conversations by scope (default: inbox)',
                default: 'inbox'
              },
              filter: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional filter terms',
              },
              filterMode: {
                type: 'string',
                enum: ['and', 'or'],
                description: 'How to apply filters (default: and)',
                default: 'and'
              }
            },
          },
        },
        {
          name: 'get_conversation_details',
          description: 'Get details of a specific Canvas conversation including all messages.',
          inputSchema: {
            type: 'object',
            properties: {
              conversationId: {
                type: 'string',
                description: 'The Canvas conversation ID',
              },
              autoMarkAsRead: {
                type: 'boolean',
                description: 'Automatically mark the conversation as read (default: true)',
                default: true
              },
              filter: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional filter terms',
              }
            },
            required: ['conversationId'],
          },
        },
        {
          name: 'find_people',
          description: 'Find people in a Canvas course to send messages to.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              searchTerm: {
                type: 'string',
                description: 'Optional search term to filter users by name',
              },
              enrollmentType: {
                type: 'string',
                enum: ['student', 'teacher', 'ta', 'observer', 'designer'],
                description: 'Filter by enrollment type',
              },
              enrollmentState: {
                type: 'string',
                enum: ['active', 'invited', 'rejected', 'completed', 'inactive'],
                description: 'Filter by enrollment state (default: active)',
                default: 'active'
              }
            },
          },
        },
        {
          name: 'search_recipients',
          description: 'Search for message recipients using Canvas search API. Note: This may be restricted at some institutions.',
          inputSchema: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Search term for recipient names',
              },
              context: {
                type: 'string',
                description: 'Context code (e.g., "course_123") to limit search scope',
              },
              exclude: {
                type: 'array',
                items: { type: 'string' },
                description: 'User IDs to exclude from results',
              },
              type: {
                type: 'string',
                enum: ['user', 'context'],
                description: 'Type of recipients to search for',
              }
            },
          },
        },
        {
          name: 'get_user_profile',
          description: 'Get profile information for a specific Canvas user.',
          inputSchema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                description: 'The Canvas user ID (use "self" for your own profile)',
              },
              include: {
                type: 'array',
                items: { 
                  type: 'string',
                  enum: ['locale', 'avatar_url', 'permissions', 'email', 'effective_locale', 'bio', 'pronouns']
                },
                description: 'Additional information to include',
              }
            },
            required: ['userId'],
          },
        },
        {
          name: 'list_quizzes',
          description: 'List quizzes in a Canvas course.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              searchTerm: {
                type: 'string',
                description: 'Optional search term to filter quizzes by title',
              }
            },
          },
        },
        {
          name: 'get_quiz_details',
          description: 'Get details of a specific Canvas quiz.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              quizId: {
                type: 'string',
                description: 'The Canvas quiz ID',
              },
              include: {
                type: 'array',
                items: { 
                  type: 'string',
                  enum: ['assignment', 'submissions', 'all_dates', 'permissions']
                },
                description: 'Additional information to include',
              }
            },
            required: ['quizId'],
          },
        },
        {
          name: 'get_quiz_submissions',
          description: 'Get submissions for a specific Canvas quiz.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              quizId: {
                type: 'string',
                description: 'The Canvas quiz ID',
              },
              include: {
                type: 'array',
                items: { 
                  type: 'string',
                  enum: ['submission', 'quiz', 'user']
                },
                description: 'Additional information to include',
              }
            },
            required: ['quizId'],
          },
        },
        {
          name: 'get_quiz_submission_content',
          description: '📚 **NEW** Get completed quiz questions and answers for educational review and study assistance. Access your previously completed quiz content to help with studying, understanding mistakes, and grade questions.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              quizId: {
                type: 'string',
                description: 'The Canvas quiz ID (if known)',
              },
              quizName: {
                type: 'string',
                description: 'The quiz name (e.g., "Quiz 1", "Midterm Exam"). If provided, quizId is not required.',
              },
              submissionId: {
                type: 'string',
                description: 'Specific submission ID (optional - will find most recent completed submission if not provided)',
              },
              includeAnswers: {
                type: 'boolean',
                description: 'Include correct answers and answer options (default: true)',
                default: true
              },
              includeUserResponses: {
                type: 'boolean',
                description: 'Include your submitted answers (default: true)',
                default: true
              }
            },
            anyOf: [
              { required: ['courseId', 'quizId'] },
              { required: ['courseId', 'quizName'] },
              { required: ['courseName', 'quizId'] },
              { required: ['courseName', 'quizName'] },
              { required: ['submissionId'] }
            ]
          },
        },
        {
          name: 'get_previous_submission_content',
          description: '📁 **NEW** Access your previously submitted assignment files (PDF, DOCX, etc.) for review and analysis. Perfect for longer projects where you want to review what you submitted.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentId: {
                type: 'string',
                description: 'The Canvas assignment ID (if known)',
              },
              assignmentName: {
                type: 'string',
                description: 'The assignment name (e.g., "Final Project", "Essay 1"). If provided, assignmentId is not required.',
              },
              includeFileContent: {
                type: 'boolean',
                description: 'Whether to automatically read file content (default: false for performance)',
                default: false
              }
            },
            anyOf: [
              { required: ['courseId', 'assignmentId'] },
              { required: ['courseId', 'assignmentName'] },
              { required: ['courseName', 'assignmentId'] },
              { required: ['courseName', 'assignmentName'] }
            ]
          },
        },
        {
          name: 'list_submitted_assignments',
          description: 'List all assignments you have submitted in a course, with file counts and submission dates.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              }
            },
            anyOf: [
              { required: ['courseId'] },
              { required: ['courseName'] }
            ]
          },
        },
        {
          name: 'download_submission_file',
          description: 'Download a specific file from a Canvas submission using Canvas file URL or file ID.',
          inputSchema: {
            type: 'object',
            properties: {
              submissionUrl: {
                type: 'string',
                description: 'Full Canvas submission file URL (e.g., https://psu.instructure.com/courses/.../submissions/...?download=...)',
              },
              fileId: {
                type: 'string',
                description: 'Direct Canvas file ID (alternative to submissionUrl)',
              },
              courseId: {
                type: 'string',
                description: 'Course ID (helpful for authentication context)',
              },
              assignmentId: {
                type: 'string',
                description: 'Assignment ID (helpful for authentication context)',
              },
              submissionId: {
                type: 'string',
                description: 'Submission ID (helpful for authentication context)',
              }
            },
            anyOf: [
              { required: ['submissionUrl'] },
              { required: ['fileId'] }
            ]
          },
        },
        {
          name: 'list_modules',
          description: 'List course modules in a Canvas course with comprehensive details including prerequisites, sequential progress requirements, unlock dates, completion status, and item summaries. Shows which modules must be completed before others, overall progress, and counts of different item types within each module.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              include: {
                type: 'array',
                items: { 
                  type: 'string',
                  enum: ['items', 'content_details']
                },
                description: 'Additional information to include (default: items)',
              },
              searchTerm: {
                type: 'string',
                description: 'Optional search term to filter modules by name',
              },
              studentId: {
                type: 'string',
                description: 'Optional student ID to get module progress for that student',
              }
            },
          },
        },
        {
          name: 'get_module_items',
          description: 'Get items for a specific Canvas course module with smart categorization by type (Assignments, Quizzes, Pages, Files, Discussions, etc.). Shows completion requirements, due dates with overdue warnings, lock status, and provides specific tool suggestions for accessing each item. Includes summary statistics of completed, locked, and overdue items.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              moduleId: {
                type: 'string',
                description: 'The Canvas module ID',
              },
              include: {
                type: 'array',
                items: { 
                  type: 'string',
                  enum: ['content_details', 'mastery_paths']
                },
                description: 'Additional information to include',
              },
              searchTerm: {
                type: 'string',
                description: 'Optional search term to filter items by title',
              },
              studentId: {
                type: 'string',
                description: 'Optional student ID to get item progress for that student',
              }
            },
            required: ['moduleId'],
          },
        },
        {
          name: 'get_module_details',
          description: 'Get details of a specific Canvas course module.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              moduleId: {
                type: 'string',
                description: 'The Canvas module ID',
              },
              include: {
                type: 'array',
                items: { 
                  type: 'string',
                  enum: ['items', 'content_details']
                },
                description: 'Additional information to include',
              },
              studentId: {
                type: 'string',
                description: 'Optional student ID to get module progress for that student',
              }
            },
            required: ['moduleId'],
          },
        },
        {
          name: 'get_grades',
          description: 'Get student grades and submission status for a specific course',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID'
              },
              courseName: {
                type: 'string',
                description: 'The name of the course (alternative to courseId)'
              },
              studentId: {
                type: 'string',
                description: 'Specific student ID to get grades for (optional - if not provided, gets current user grades)'
              },
              assignmentId: {
                type: 'string',
                description: 'Specific assignment ID to get grades for (optional)'
              }
            },
            anyOf: [
              { required: ['courseId'] },
              { required: ['courseName'] }
            ]
          }
        },
        {
          name: 'get_gradebook_categories',
          description: 'Get gradebook categories (assignment groups) and their weights for a course',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID'
              },
              courseName: {
                type: 'string',
                description: 'The name of the course (alternative to courseId)'
              }
            },
            anyOf: [
              { required: ['courseId'] },
              { required: ['courseName'] }
            ]
          }
        },
        {
          name: 'calculate_course_analytics',
          description: '📊 **NEW PHASE 2** Calculate comprehensive course analytics including current grades, projected grades, category breakdowns, and upcoming assignments',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              userId: {
                type: 'string',
                description: 'Optional user ID to calculate analytics for (defaults to current user)',
              }
            },
            anyOf: [
              { required: ['courseId'] },
              { required: ['courseName'] }
            ]
          }
        },
        {
          name: 'generate_what_if_scenarios',
          description: '🎯 **CRITICAL STUDENT TOOL** Generate what-if grade scenarios to answer "What grade do I need on the final to get an A?" Calculates required scores on remaining work to achieve target grades. Shows if target is achievable and provides detailed recommendations. Students use this constantly for grade planning.',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              targetGrade: {
                type: 'number',
                description: 'Target grade percentage (e.g., 90 for 90%)',
              },
              targetLetterGrade: {
                type: 'string',
                description: 'Target letter grade (e.g., "A", "B+", "C"). If provided, targetGrade is not required.',
              },
              userId: {
                type: 'string',
                description: 'Optional user ID to generate scenarios for (defaults to current user)',
              }
            },
            anyOf: [
              { required: ['courseId', 'targetGrade'] },
              { required: ['courseId', 'targetLetterGrade'] },
              { required: ['courseName', 'targetGrade'] },
              { required: ['courseName', 'targetLetterGrade'] }
            ]
          }
        },
        {
          name: 'get_grade_trends',
          description: '📈 **NEW PHASE 2** Analyze grade trends over time to see if performance is improving, declining, or stable',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              userId: {
                type: 'string',
                description: 'Optional user ID to analyze trends for (defaults to current user)',
              },
              daysBack: {
                type: 'number',
                description: 'How many days back to analyze (default: 90)',
                default: 90
              }
            },
            anyOf: [
              { required: ['courseId'] },
              { required: ['courseName'] }
            ]
          }
        },
        {
          name: 'get_calendar_events',
          description: '📅 **NEW** Get calendar events for a specific Canvas course, including assignments and other scheduled events',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              startDate: {
                type: 'string',
                description: 'Start date for events (ISO 8601 format, e.g., "2024-01-01T00:00:00Z")'
              },
              endDate: {
                type: 'string', 
                description: 'End date for events (ISO 8601 format, e.g., "2024-12-31T23:59:59Z")'
              },
              type: {
                type: 'string',
                enum: ['event', 'assignment'],
                description: 'Type of calendar events to fetch (default: event)',
                default: 'event'
              }
            },
            anyOf: [
              { required: ['courseId'] },
              { required: ['courseName'] }
            ]
          }
        },
        {
          name: 'get_assignment_rubric',
          description: 'Get detailed rubric criteria and grading information for a specific assignment',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentId: {
                type: 'string',
                description: 'The Canvas assignment ID (numeric)',
              },
              assignmentName: {
                type: 'string',
                description: 'The assignment name (e.g., "Final Project", "Essay 1"). If provided, assignmentId is not required.',
              }
            },
            anyOf: [
              { required: ['courseId', 'assignmentId'] },
              { required: ['courseId', 'assignmentName'] },
              { required: ['courseName', 'assignmentId'] },
              { required: ['courseName', 'assignmentName'] }
            ]
          }
        },
        {
          name: 'get_rubric_analysis',
          description: 'Analyze rubric patterns and common grading criteria across multiple assignments in a course',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of assignments to analyze (default: 10)',
                default: 10
              }
            },
            anyOf: [
              { required: ['courseId'] },
              { required: ['courseName'] }
            ]
          }
        },
        {
          name: 'get_assignment_feedback',
          description: 'Get detailed feedback and rubric assessment for a specific assignment submission',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              },
              assignmentId: {
                type: 'string',
                description: 'The Canvas assignment ID (numeric)',
              },
              assignmentName: {
                type: 'string',
                description: 'The assignment name (e.g., "Final Project", "Essay 1"). If provided, assignmentId is not required.',
              },
              userId: {
                type: 'string',
                description: 'Optional user ID to get feedback for (defaults to current user)',
              }
            },
            anyOf: [
              { required: ['courseId', 'assignmentId'] },
              { required: ['courseId', 'assignmentName'] },
              { required: ['courseName', 'assignmentId'] },
              { required: ['courseName', 'assignmentName'] }
            ]
          }
        },
        {
          name: 'get_course_navigation',
          description: 'Get comprehensive course structure with module prerequisites and navigation paths',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              }
            },
            anyOf: [
              { required: ['courseId'] },
              { required: ['courseName'] }
            ]
          }
        },
        {
          name: 'get_course_syllabus',
          description: 'Get course syllabus information from multiple sources with structured data extraction',
          inputSchema: {
            type: 'object',
            properties: {
              courseId: {
                type: 'string',
                description: 'The Canvas course ID (numeric)',
              },
              courseName: {
                type: 'string',
                description: 'The course name (e.g., "Art 113N", "CMPEN 431"). If provided, courseId is not required.',
              }
            },
            anyOf: [
              { required: ['courseId'] },
              { required: ['courseName'] }
            ]
          }
        },
        {
          name: 'get_tool_help',
          description: `Get detailed help, examples, and usage guidance for Canvas MCP tools. Use this to understand tool capabilities, see examples, learn best practices, and troubleshoot issues.
          
**Use cases:**
- "How do I check my grades?" → Get help on grade tools
- "Show me all available tools" → Get complete overview
- "How does smart_search work?" → Get detailed tool documentation
- "What tools help with assignments?" → Search for relevant tools`,
          inputSchema: {
            type: 'object',
            properties: {
              toolName: {
                type: 'string',
                description: 'Name of specific tool to get help for (e.g., "get_courses", "smart_search"). Use "all" for complete overview, or "search" with searchQuery to find tools.',
              },
              searchQuery: {
                type: 'string',
                description: 'Optional: Search for tools by keywords (e.g., "grades", "assignments", "files")',
              },
              showExamples: {
                type: 'boolean',
                description: 'Include usage examples (default: true)',
                default: true
              }
            }
          }
        },
    ],
  };
});

// Multi-course assignment search handler
  // Call a tool
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name: toolName, arguments: input } = req.params;
    const { canvasBaseUrl, accessToken } = getCanvasConfig();

    logger.log(`Tool call: ${toolName} with args:`, input);

    try {
      switch (toolName) {
        case 'get_courses': {
          const courses = await listCourses({
            ...getCanvasConfig(),
            ...(input as Omit<CourseListParams, 'canvasBaseUrl' | 'accessToken'>)
          });
          const markdown = `| Course ID | Course Name | Course Code |\n|---|---|---|\n` + courses.map(c => `| ${c.id} | ${c.name} | ${c.courseCode} |`).join('\n');
          return {
            content: [
              {
                type: "text",
                text: markdown
              }
            ]
          };
        }

        case 'get_current_courses': {
          const result = await getCurrentCourses({
            ...getCanvasConfig(),
            ...(input as Omit<CurrentCoursesParams, 'canvasBaseUrl' | 'accessToken'>)
          });
          return {
            content: [
              {
                type: "text",
                text: result
              }
            ]
          };
        }

        case 'get_pages': {
          const pages = await listPages({
            ...getCanvasConfig(),
            ...(input as Omit<PagesListParams, 'canvasBaseUrl' | 'accessToken'>)
          });
          const markdown = `| Page Title | URL |\n|---|---|\n` + pages.map(p => `| ${p.title} | ${p.url} |`).join('\n');
          return {
            content: [
              {
                type: "text",
                text: markdown
              }
            ]
          };
        }

        case 'read_page': {
          const pageContent = await getPageContent({
            ...getCanvasConfig(),
            ...(input as Omit<PageContentParams, 'canvasBaseUrl' | 'accessToken'>),
            extractLinks: true
          });
          
          let markdown = `# ${pageContent.title}\n\n`;
          
          // Add metadata
          if (pageContent.published !== undefined) {
            markdown += `**Status**: ${pageContent.published ? '✅ Published' : '📝 Draft'}\n`;
          }
          if (pageContent.frontPage) {
            markdown += `**Front Page**: Yes\n`;
          }
          if (pageContent.lockInfo?.locked) {
            markdown += `**🔒 Locked**: ${pageContent.lockInfo.explanation || 'This page is locked'}\n`;
          }
          markdown += `\n---\n\n`;
          
          // Add page content
          markdown += pageContent.body;
          
          // Add links section if any were found
          if (pageContent.links && pageContent.links.length > 0) {
            markdown += `\n\n---\n\n## 🔗 Links Found on This Page\n\n`;
            
            // Group links by type
            const linksByType = pageContent.links.reduce((acc, link) => {
              if (!acc[link.type]) acc[link.type] = [];
              acc[link.type].push(link);
              return acc;
            }, {} as Record<string, typeof pageContent.links>);
            
            // Pages
            if (linksByType.page?.length > 0) {
              markdown += `\n### 📄 Canvas Pages (${linksByType.page.length})\n`;
              markdown += `*Use read_page with these page URLs to read them*\n\n`;
              linksByType.page.forEach(link => {
                markdown += `- **${link.text}** → \`${link.url}\`\n`;
              });
            }
            
            // Files
            if (linksByType.file?.length > 0) {
              markdown += `\n### 📎 Files (${linksByType.file.length})\n`;
              markdown += `*Use read_file_by_id with the file ID to access these*\n\n`;
              linksByType.file.forEach(link => {
                markdown += `- **${link.text}** → File ID: \`${link.resourceId}\`\n`;
              });
            }
            
            // Assignments
            if (linksByType.assignment?.length > 0) {
              markdown += `\n### 📝 Assignments (${linksByType.assignment.length})\n`;
              markdown += `*Use get_assignment_details with the assignment ID*\n\n`;
              linksByType.assignment.forEach(link => {
                markdown += `- **${link.text}** → Assignment ID: \`${link.resourceId}\`\n`;
              });
            }
            
            // Discussions
            if (linksByType.discussion?.length > 0) {
              markdown += `\n### 💬 Discussions (${linksByType.discussion.length})\n`;
              markdown += `*Use read_discussion with the discussion ID*\n\n`;
              linksByType.discussion.forEach(link => {
                markdown += `- **${link.text}** → Discussion ID: \`${link.resourceId}\`\n`;
              });
            }
            
            // Modules
            if (linksByType.module?.length > 0) {
              markdown += `\n### 📚 Modules (${linksByType.module.length})\n`;
              markdown += `*Use get_module_items with the module ID*\n\n`;
              linksByType.module.forEach(link => {
                markdown += `- **${link.text}** → Module ID: \`${link.resourceId}\`\n`;
              });
            }
            
            // External Links
            if (linksByType.external?.length > 0) {
              markdown += `\n### 🌐 External Links (${linksByType.external.length})\n\n`;
              linksByType.external.forEach(link => {
                markdown += `- [${link.text}](${link.url})\n`;
              });
            }
          }
          
          return {
            content: [
              {
                type: "text",
                text: markdown
              }
            ]
          };
        }
        
        case 'get_discussions': {
          const discussions = await listDiscussions({
            ...getCanvasConfig(),
            ...(input as Omit<DiscussionsListParams, 'canvasBaseUrl' | 'accessToken'>)
          });
          const markdown = `| Discussion ID | Topic Title | Last Updated |\n|---|---|---|\n` + discussions.map(d => `| ${d.id} | ${d.title} | ${d.lastReplyAt ? new Date(d.lastReplyAt).toLocaleString() : 'N/A'} |`).join('\n');
          return {
            content: [
              {
                type: "text",
                text: markdown
              }
            ]
          };
        }

        case 'read_discussion': {
          const discussionContent = await getDiscussionContent({
            ...getCanvasConfig(),
            ...(input as Omit<DiscussionContentParams, 'canvasBaseUrl' | 'accessToken'>)
          });
          
          let markdown = `## ${discussionContent.title}\n\n`;
          markdown += `${discussionContent.message}\n\n`;
          
          if (discussionContent.replies && discussionContent.replies.length > 0) {
            markdown += '---\n\n### Replies\n';
            markdown += formatDiscussionReplies(discussionContent.replies);
          } else {
            markdown += '*No replies found for this discussion.*';
          }
          
        return {
          content: [
            {
                type: "text",
                text: markdown
            }
          ]
        };
      }

      case 'list_groups': {
        const groups = await listGroups({
          ...getCanvasConfig(),
          ...(input as any)
        });
        const markdown = `| Group ID | Group Name | Members | Course ID | Role |\n|---|---|---|---|---|\n` + 
          groups.map(g => `| ${g.id} | ${g.name} | ${g.membersCount || 'N/A'} | ${g.courseId || 'N/A'} | ${g.role || 'N/A'} |`).join('\n');
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_group_details': {
        const groupDetails = await getGroupDetails({
          ...getCanvasConfig(),
          ...(input as any)
        });
        let markdown = `# ${groupDetails.name}\n\n`;
        if (groupDetails.description) {
          markdown += `**Description:** ${groupDetails.description}\n\n`;
        }
        markdown += `**Members:** ${groupDetails.membersCount || 'N/A'}\n`;
        markdown += `**Course ID:** ${groupDetails.courseId || 'N/A'}\n`;
        markdown += `**Role:** ${groupDetails.role || 'N/A'}\n`;
        markdown += `**Public:** ${groupDetails.isPublic ? 'Yes' : 'No'}\n`;
        if (groupDetails.joinLevel) {
          markdown += `**Join Level:** ${groupDetails.joinLevel}\n`;
        }
        if (groupDetails.permissions) {
          markdown += `\n**Permissions:**\n`;
          markdown += `- Can Create Discussion: ${groupDetails.permissions.canCreateDiscussion ? 'Yes' : 'No'}\n`;
          markdown += `- Can Create Announcement: ${groupDetails.permissions.canCreateAnnouncement ? 'Yes' : 'No'}\n`;
        }
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'list_group_members': {
        const members = await listGroupMembers({
          ...getCanvasConfig(),
          ...(input as any)
        });
        const markdown = `| User ID | Name | Login ID | Pronouns |\n|---|---|---|---|\n` + 
          members.map(m => `| ${m.id} | ${m.name} | ${m.login_id || 'N/A'} | ${m.pronouns || 'N/A'} |`).join('\n');
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'list_group_discussions': {
        const discussions = await listGroupDiscussions({
          ...getCanvasConfig(),
          ...(input as any)
        });
        const markdown = `| Topic ID | Title | Posted At | Replies | Unread |\n|---|---|---|---|---|\n` + 
          discussions.map(d => `| ${d.id} | ${d.title} | ${d.posted_at ? new Date(d.posted_at).toLocaleString() : 'N/A'} | ${d.discussion_subentry_count || 0} | ${d.unread_count || 0} |`).join('\n');
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_group_discussion': {
        const discussion = await getGroupDiscussion({
          ...getCanvasConfig(),
          ...(input as any)
        });
        let markdown = `## ${discussion.title}\n\n`;
        if (discussion.message) {
          markdown += `${discussion.message}\n\n`;
        }
        if (discussion.author) {
          markdown += `**Posted by:** ${discussion.author.display_name}\n`;
        }
        if (discussion.posted_at) {
          markdown += `**Posted at:** ${new Date(discussion.posted_at).toLocaleString()}\n`;
        }
        markdown += `**Replies:** ${discussion.discussion_subentry_count || 0}\n`;
        markdown += `**Unread:** ${discussion.unread_count || 0}\n`;
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'post_group_discussion': {
        const result = await postGroupDiscussion({
          ...getCanvasConfig(),
          ...(input as any)
        });
        return {
          content: [
            {
              type: "text",
              text: `✅ Successfully created discussion "${result.title}" in group (ID: ${result.id})`
            }
          ]
        };
      }

      case 'get_account_notifications': {
        const notifications = await getAccountNotifications({
          ...getCanvasConfig()
        });
        
        const formattedOutput = formatNotifications(notifications);
        
        return {
          content: [
            {
              type: "text",
              text: formattedOutput
            }
          ]
        };
      }

      case 'get_planner_items': {
        const plannerParams = input as Partial<GetPlannerItemsParams>;
        
        // Default to today if no start date provided
        if (!plannerParams.startDate) {
          plannerParams.startDate = new Date().toISOString().split('T')[0];
        }
        
        const items = await getPlannerItems({
          ...getCanvasConfig(),
          ...(plannerParams as any)
        });
        
        const formattedOutput = formatPlannerItems(items);
        
        return {
          content: [
            {
              type: "text",
              text: formattedOutput
            }
          ]
        };
      }

      case 'create_planner_note': {
        const noteParams = input as Partial<CreatePlannerNoteParams>;
        
        const note = await createPlannerNote({
          ...getCanvasConfig(),
          ...(noteParams as any)
        });
        
        const markdown = `✅ Created planner note: **${note.title}**\n\n` +
          `📅 Due: ${new Date(note.todo_date).toLocaleDateString()}\n` +
          (note.description ? `📝 Details: ${note.description}\n` : '') +
          (note.course_id ? `📚 Course ID: ${note.course_id}\n` : '') +
          `\n🆔 Note ID: ${note.id}`;
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'update_planner_note': {
        const updateParams = input as Partial<UpdatePlannerNoteParams>;
        
        const note = await updatePlannerNote({
          ...getCanvasConfig(),
          ...(updateParams as any)
        });
        
        const markdown = `✅ Updated planner note: **${note.title}**\n\n` +
          `📅 Due: ${new Date(note.todo_date).toLocaleDateString()}\n` +
          (note.description ? `📝 Details: ${note.description}\n` : '') +
          (note.course_id ? `📚 Course ID: ${note.course_id}\n` : '');
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'delete_planner_note': {
        const deleteParams = input as { noteId: string };
        
        await deletePlannerNote({
          ...getCanvasConfig(),
          noteId: deleteParams.noteId
        });
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Successfully deleted planner note (ID: ${deleteParams.noteId})`
            }
          ]
        };
      }

      case 'mark_planner_item_complete': {
        const completeParams = input as Partial<MarkPlannerCompleteParams>;
        
        const override = await markPlannerItemComplete({
          ...getCanvasConfig(),
          ...(completeParams as any)
        });
        
        const status = override.marked_complete ? '✅ Marked complete' : '⬜ Marked incomplete';
        const markdown = `${status}: ${completeParams.plannableType} (ID: ${completeParams.plannableId})`;
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_canvas_analytics': {
        const analyticsParams = input as Partial<GetCourseAnalyticsParams> & {
          includeActivity?: boolean;
          includeAssignments?: boolean;
          courseName?: string;
        };

        // Get summary analytics
        const summary = await getCourseAnalytics({
          ...getCanvasConfig(),
          courseId: analyticsParams.courseId!,
        });

        // Optionally fetch detailed data
        let activityData;
        let assignmentData;

        if (analyticsParams.includeActivity) {
          activityData = await getActivityData({
            ...getCanvasConfig(),
            courseId: analyticsParams.courseId!,
          }).catch(err => {
            logger.warn('[Analytics] Activity data not available:', err);
            return undefined;
          });
        }

        if (analyticsParams.includeAssignments) {
          assignmentData = await getAssignmentAnalytics({
            ...getCanvasConfig(),
            courseId: analyticsParams.courseId!,
          }).catch(err => {
            logger.warn('[Analytics] Assignment data not available:', err);
            return undefined;
          });
        }

        const formattedOutput = formatAnalyticsSummary(summary, activityData, assignmentData);

        return {
          content: [
            {
              type: "text",
              text: analyticsParams.courseName 
                ? `📚 **${analyticsParams.courseName}**\n\n${formattedOutput}`
                : formattedOutput
            }
          ]
        };
      }

      case 'get_student_performance_summary': {
        const performanceParams = input as Partial<GetCourseAnalyticsParams> & {
          courseName?: string;
        };

        // Get current grade if available
        let currentGrade: number | undefined;
        try {
          const grades = await getGrades({
            ...getCanvasConfig(),
            courseId: performanceParams.courseId!,
          });
          
          // getGrades returns array of GradeInfo, find the matching course
          if (grades.length > 0 && grades[0].currentScore !== undefined && grades[0].currentScore !== null) {
            currentGrade = grades[0].currentScore;
          }
        } catch (err) {
          logger.warn('[Analytics] Could not fetch grades for performance summary:', err);
        }

        const summary = await getStudentPerformanceSummary({
          ...getCanvasConfig(),
          courseId: performanceParams.courseId!,
          currentGrade,
          courseName: performanceParams.courseName,
        });

        return {
          content: [
            {
              type: "text",
              text: summary
            }
          ]
        };
      }

      case 'get_favorite_courses': {
        const favorites = await getFavoriteCourses({
          ...getCanvasConfig()
        });

        const formattedOutput = formatFavorites(favorites);

        return {
          content: [
            {
              type: "text",
              text: formattedOutput
            }
          ]
        };
      }

      case 'add_favorite_course': {
        const addParams = input as Partial<AddFavoriteParams>;

        const favorite = await addFavoriteCourse({
          ...getCanvasConfig(),
          courseId: addParams.courseId!,
        });

        return {
          content: [
            {
              type: "text",
              text: `⭐ Successfully added **${favorite.name}** to your favorites!\n\n🆔 Course ID: ${favorite.id}\n📚 Code: ${favorite.course_code}`
            }
          ]
        };
      }

      case 'remove_favorite_course': {
        const removeParams = input as Partial<RemoveFavoriteParams>;

        await removeFavoriteCourse({
          ...getCanvasConfig(),
          courseId: removeParams.courseId!,
        });

        return {
          content: [
            {
              type: "text",
              text: `⭐ Successfully removed course ${removeParams.courseId} from your favorites.`
            }
          ]
        };
      }

      case 'get_all_course_nicknames': {
        const nicknames = await getAllNicknames({
          ...getCanvasConfig()
        });

        return {
          content: [
            {
              type: "text",
              text: formatNicknames(nicknames)
            }
          ]
        };
      }

      case 'set_course_nickname': {
        const setParams = input as Partial<SetNicknameParams>;

        const nickname = await setNickname({
          ...getCanvasConfig(),
          courseId: setParams.courseId!,
          nickname: setParams.nickname!
        });

        return {
          content: [
            {
              type: "text",
              text: `✅ Course ${nickname.course_id} nicknamed "${nickname.nickname}"`
            }
          ]
        };
      }

      case 'remove_course_nickname': {
        const removeNicknameParams = input as Partial<RemoveNicknameParams>;

        await removeNickname({
          ...getCanvasConfig(),
          courseId: removeNicknameParams.courseId!
        });

        return {
          content: [
            {
              type: "text",
              text: `✅ Removed nickname for course ${removeNicknameParams.courseId}`
            }
          ]
        };
      }

      case 'get_bookmarks': {
        const config = getCanvasConfig();
        const bookmarks = await getBookmarks({
          canvasUrl: config.canvasBaseUrl,
          apiToken: config.accessToken
        });

        return {
          content: [
            {
              type: "text",
              text: formatBookmarks(bookmarks)
            }
          ]
        };
      }

      case 'get_bookmark': {
        const getBookmarkParams = input as Partial<GetBookmarkParams>;
        const config = getCanvasConfig();

        const bookmark = await getBookmark({
          canvasUrl: config.canvasBaseUrl,
          apiToken: config.accessToken,
          bookmarkId: getBookmarkParams.bookmarkId!
        });

        return {
          content: [
            {
              type: "text",
              text: formatBookmark(bookmark)
            }
          ]
        };
      }

      case 'create_bookmark': {
        const createBookmarkParams = input as Partial<CreateBookmarkParams>;
        const config = getCanvasConfig();

        const bookmark = await createBookmark({
          canvasUrl: config.canvasBaseUrl,
          apiToken: config.accessToken,
          name: createBookmarkParams.name!,
          url: createBookmarkParams.url!,
          position: createBookmarkParams.position,
        });

        return {
          content: [
            {
              type: "text",
              text: `✅ Bookmark created: "${bookmark.name}"\n🔗 ${bookmark.url}\nID: ${bookmark.id}`
            }
          ]
        };
      }

      case 'update_bookmark': {
        const updateBookmarkParams = input as Partial<UpdateBookmarkParams>;
        const config = getCanvasConfig();

        const bookmark = await updateBookmark({
          canvasUrl: config.canvasBaseUrl,
          apiToken: config.accessToken,
          bookmarkId: updateBookmarkParams.bookmarkId!,
          name: updateBookmarkParams.name,
          url: updateBookmarkParams.url,
          position: updateBookmarkParams.position,
        });

        return {
          content: [
            {
              type: "text",
              text: `✅ Bookmark updated: "${bookmark.name}"\n🔗 ${bookmark.url}`
            }
          ]
        };
      }

      case 'delete_bookmark': {
        const deleteBookmarkParams = input as Partial<DeleteBookmarkParams>;
        const config = getCanvasConfig();

        await deleteBookmark({
          canvasUrl: config.canvasBaseUrl,
          apiToken: config.accessToken,
          bookmarkId: deleteBookmarkParams.bookmarkId!
        });

        return {
          content: [
            {
              type: "text",
              text: `✅ Bookmark ${deleteBookmarkParams.bookmarkId} deleted successfully`
            }
          ]
        };
      }

      case 'get_recent_history': {
        const historyParams = input as { groupByDate?: boolean };
        const config = getCanvasConfig();

        const history = await getRecentHistory({
          canvasUrl: config.canvasBaseUrl,
          apiToken: config.accessToken
        });

        // Use date grouping if requested
        const formattedHistory = historyParams.groupByDate 
          ? formatHistoryByDate(history)
          : formatHistory(history);

        return {
          content: [
            {
              type: "text",
              text: formattedHistory
            }
          ]
        };
      }

      case 'get_content_shares': {
        const contentShareParams = input as { includeCount?: boolean };
        const config = getCanvasConfig();

        const params: GetContentSharesParams = {
          canvasUrl: config.canvasBaseUrl,
          apiToken: config.accessToken
        };

        const shares = await getReceivedContentShares(params);

        // Include unread count if requested
        const formattedShares = contentShareParams.includeCount
          ? await formatContentSharesWithCount(shares, params)
          : formatContentShares(shares);

        return {
          content: [
            {
              type: "text",
              text: formattedShares
            }
          ]
        };
      }

      case 'get_all_peer_reviews': {
        const allReviews = await getAllPeerReviews({
          ...getCanvasConfig()
        });

        const formattedOutput = formatAllPeerReviews(allReviews);

        return {
          content: [
            {
              type: "text",
              text: formattedOutput
            }
          ]
        };
      }

      case 'list_peer_reviews_for_assignment': {
        const peerReviewParams = input as Partial<GetPeerReviewsParams> & {
          courseName?: string;
        };

        const reviewsData = await listPeerReviews({
          ...getCanvasConfig(),
          courseId: peerReviewParams.courseId!,
          assignmentId: peerReviewParams.assignmentId!,
        });

        const formattedOutput = formatPeerReviews(reviewsData);

        return {
          content: [
            {
              type: "text",
              text: peerReviewParams.courseName 
                ? `📚 **${peerReviewParams.courseName}**\n\n${formattedOutput}`
                : formattedOutput
            }
          ]
        };
      }

      case 'get_peer_review_submission': {
        const submissionParams = input as Partial<GetPeerReviewSubmissionParams>;

        const submission = await getPeerReviewSubmission({
          ...getCanvasConfig(),
          courseId: submissionParams.courseId!,
          assignmentId: submissionParams.assignmentId!,
          submissionId: submissionParams.submissionId!,
        });

        let markdown = `📄 Peer Review Submission\n\n`;
        markdown += `**User ID:** ${submission.user_id}\n`;
        markdown += `**Submission ID:** ${submission.id}\n`;
        
        if (submission.submitted_at) {
          markdown += `**Submitted:** ${new Date(submission.submitted_at).toLocaleString()}\n`;
        }
        
        markdown += '\n---\n\n';

        if (submission.body) {
          markdown += `**Submission Content:**\n\n${submission.body}\n\n`;
        }

        if (submission.attachments && submission.attachments.length > 0) {
          markdown += `**Attachments (${submission.attachments.length}):**\n\n`;
          submission.attachments.forEach(att => {
            markdown += `📎 **${att.display_name}** (${att.filename})\n`;
            markdown += `   Size: ${(att.size / 1024).toFixed(2)} KB\n`;
            markdown += `   Type: ${att['content-type']}\n`;
            markdown += `   URL: ${att.url}\n\n`;
          });
        }

        if (submission.submission_comments && submission.submission_comments.length > 0) {
          markdown += `**Existing Comments (${submission.submission_comments.length}):**\n\n`;
          submission.submission_comments.forEach(comment => {
            markdown += `💬 **${comment.author_name}** (${new Date(comment.created_at).toLocaleString()}):\n`;
            markdown += `   ${comment.comment}\n\n`;
          });
        }

        if (submission.preview_url) {
          markdown += `\n🔗 **Preview URL:** ${submission.preview_url}`;
        }

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_assignments': {
          const assignments = await listAssignments({
            ...getCanvasConfig(),
            ...(input as Omit<AssignmentListParams, 'canvasBaseUrl' | 'accessToken'>)
          });
          let markdown = `| Assignment Name | Due Date | Points | Files |\n|---|---|---|---|\n`;
          assignments.forEach(assignment => {
            const dueDate = assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : 'N/A';
            const points = assignment.pointsPossible || 'N/A';
            
            // Combine all files from attachments and embedded links
            const allFiles: string[] = [];
            assignment.attachments?.forEach(att => allFiles.push(`📎 ${att.filename}`));
            assignment.embeddedFileLinks?.forEach(link => allFiles.push(`🔗 ${link.text}`));
            
            const filesDisplay = allFiles.length > 0 ? allFiles.join(', ') : 'None';
            
            markdown += `| ${assignment.name} | ${dueDate} | ${points} | ${filesDisplay} |\n`;
          });
        return {
          content: [
            {
                type: "text",
                text: markdown
            }
          ]
        };
      }

      case 'find_files': {
          const files = await searchFiles({
            ...getCanvasConfig(),
            ...(input as Omit<FileSearchParams, 'canvasBaseUrl' | 'accessToken'>)
          });
          const markdown = `| File Name | Module |\n|---|---|\n` + files.map(f => `| ${f.name} | ${f.moduleName || 'N/A'} |`).join('\n');
        return {
          content: [
            {
                type: "text",
                text: markdown
            }
          ]
        };
      }

      case 'read_file': {
          const fileContent = await getFileContent({
            ...getCanvasConfig(),
            ...(input as Omit<FileContentParams, 'canvasBaseUrl' | 'accessToken'>)
          });
        return {
          content: [
            {
                type: "text",
                text: `Content for ${fileContent.name}:\n\n${fileContent.content}`
            }
          ]
        };
      }

        case 'read_file_by_id': {
          const fileContent = await readFileById({
            ...getCanvasConfig(),
            ...(input as { fileId: string })
          });
        return {
          content: [
            {
                type: "text",
                text: `**${fileContent.name}**\n\n${fileContent.content}\n\n[Download Link](${fileContent.url})`
            }
          ]
        };
      }

      case 'get_files': {
        const inputParams = input as Partial<GetFilesParams>;
        const result = await getFiles({
          ...getCanvasConfig(),
          ...inputParams
        });

        // Format response with rich visual indicators
        let markdown = '';
        
        // Header with breadcrumb
        if (result.breadcrumb.length > 0) {
          const lastCrumb = result.breadcrumb[result.breadcrumb.length - 1];
          markdown += `📁 **${lastCrumb.toUpperCase()}**\n`;
          markdown += `${'═'.repeat(50)}\n\n`;
          markdown += `📍 Location: ${result.breadcrumb.join(' / ')}\n\n`;
        } else {
          markdown += `📁 **COURSE FILES**\n`;
          markdown += `${'═'.repeat(50)}\n\n`;
        }
        
        // Summary statistics
        markdown += `📊 **SUMMARY**\n`;
        markdown += `${'─'.repeat(30)}\n`;
        markdown += `  Files: ${result.fileCount} (${result.totalSizeFormatted})\n`;
        if (result.llamaParseEnabled) {
          markdown += `  Processable: ${result.processableCount} files ✓\n`;
        }
        if (result.folderCount > 0) {
          markdown += `  Folders: ${result.folderCount}\n`;
        }
        markdown += `\n`;
        
        // Show folders first
        if (result.folders.length > 0) {
          markdown += `📁 **FOLDERS** (${result.folders.length})\n`;
          markdown += `${'─'.repeat(30)}\n`;
          
          // Sort folders by position/name
          const sortedFolders = [...result.folders].sort((a, b) => {
            if (a.position !== b.position) return a.position - b.position;
            return a.name.localeCompare(b.name);
          });
          
          for (const folder of sortedFolders) {
            const lockIcon = folder.locked ? '🔒 ' : '';
            const hiddenIcon = folder.hidden ? '👁️‍🗨️ ' : '';
            markdown += `  📁 ${lockIcon}${hiddenIcon}${folder.name}`;
            if (folder.filesCount > 0 || folder.foldersCount > 0) {
              const counts = [];
              if (folder.filesCount > 0) counts.push(`${folder.filesCount} files`);
              if (folder.foldersCount > 0) counts.push(`${folder.foldersCount} folders`);
              markdown += ` (${counts.join(', ')})`;
            }
            markdown += `\n     To browse: Use get_files with folderId: "${folder.id}"\n`;
          }
          markdown += `\n`;
        }
        
        // Group files by category
        if (result.files.length > 0) {
          const { getFileCategory, getFileIcon, getCategoryName } = await import('./lib/files-enhanced.js');
          
          // Group files by category
          const filesByCategory = new Map<string, typeof result.files>();
          for (const file of result.files) {
            const category = getFileCategory({ contentType: file.contentType, name: file.name });
            if (!filesByCategory.has(category)) {
              filesByCategory.set(category, []);
            }
            filesByCategory.get(category)!.push(file);
          }
          
          // Display each category
          const categoryOrder = ['documents', 'presentations', 'spreadsheets', 'images', 'audio', 'video', 'text', 'code', 'archives', 'other'];
          
          for (const category of categoryOrder) {
            if (!filesByCategory.has(category)) continue;
            
            const categoryFiles = filesByCategory.get(category)!;
            const icon = getFileIcon(category);
            const name = getCategoryName(category);
            const hasProcessable = categoryFiles.some(f => f.llamaParseSupported);
            
            markdown += `${icon} **${name.toUpperCase()}** (${categoryFiles.length} ${categoryFiles.length === 1 ? 'file' : 'files'}`;
            if (hasProcessable && result.llamaParseEnabled) {
              markdown += ` - LlamaParse Supported ✓`;
            }
            markdown += `)\n`;
            markdown += `${'─'.repeat(50)}\n`;
            
            // Sort files within category
            const sortedFiles = [...categoryFiles].sort((a, b) => {
              if (inputParams.sortBy === 'size') return inputParams.sortOrder === 'desc' ? b.size - a.size : a.size - b.size;
              if (inputParams.sortBy === 'date') return inputParams.sortOrder === 'desc' ? 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() :
                new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
              return a.displayName.localeCompare(b.displayName);
            });
            
            // Show top files (limit to prevent token overflow)
            const maxFilesPerCategory = 10;
            const filesToShow = sortedFiles.slice(0, maxFilesPerCategory);
            
            for (const file of filesToShow) {
              const lockIcon = file.locked || file.lockedForUser ? '🔒 ' : '';
              const hiddenIcon = file.hidden || file.hiddenForUser ? '👁️‍🗨️ ' : '';
              
              markdown += `  ${icon} ${lockIcon}${hiddenIcon}${file.displayName}\n`;
              markdown += `     Size: ${file.sizeFormatted} | Updated: ${new Date(file.updatedAt).toLocaleDateString()}\n`;
              
              if (file.moduleName) {
                markdown += `     Module: ${file.moduleName}\n`;
              }
              
              if (file.llamaParseSupported && result.llamaParseEnabled) {
                if (file.processingRecommendation === 'highly-recommended') {
                  markdown += `     🔥 **Highly recommended for processing**\n`;
                } else if (file.processingRecommendation === 'recommended') {
                  markdown += `     ✓ Recommended for processing\n`;
                } else {
                  markdown += `     ✓ Can be processed\n`;
                }
                if (file.estimatedProcessingTime) {
                  markdown += `     Est. time: ${file.estimatedProcessingTime}\n`;
                }
              }
              
              if (file.lockedForUser && file.lockExplanation) {
                markdown += `     ⚠️ ${file.lockExplanation}\n`;
              }
              
              markdown += `     To process: Use read_file_by_id with fileId: "${file.id}"\n`;
              markdown += `\n`;
            }
            
            if (sortedFiles.length > maxFilesPerCategory) {
              markdown += `  ... and ${sortedFiles.length - maxFilesPerCategory} more ${category} files\n`;
            }
            
            markdown += `\n`;
          }
        } else {
          markdown += `*No files found in this location*\n\n`;
        }
        
        // Navigation hints
        if (result.parentFolder || result.folders.length > 0) {
          markdown += `🎯 **NAVIGATION**\n`;
          markdown += `${'─'.repeat(30)}\n`;
          
          if (result.parentFolder) {
            markdown += `  ⬆️  Parent: Use get_files with folderId: "${result.parentFolder.id}"\n`;
          }
          if (!inputParams.folderId && !inputParams.folderPath) {
            markdown += `  🏠 You are at the root folder\n`;
          } else {
            markdown += `  🏠 Root: Use get_files without folderId/folderPath\n`;
          }
          if (result.folders.length > 0) {
            markdown += `  📁 Browse folders above with get_files and folderId\n`;
          }
          markdown += `\n`;
        }
        
        // Suggestions
        if (result.suggestions.length > 0) {
          markdown += `💡 **SUGGESTIONS**\n`;
          markdown += `${'─'.repeat(30)}\n`;
          for (const suggestion of result.suggestions) {
            markdown += `  • ${suggestion}\n`;
          }
          markdown += `\n`;
        }
        
        // LlamaParse status
        if (!result.llamaParseEnabled && result.fileCount > 0) {
          markdown += `ℹ️ **Note:** LlamaParse is not enabled. Set ENABLE_LLAMAPARSE=true and LLAMA_CLOUD_API_KEY to process documents.\n`;
        }

        return {
          content: [{
            type: 'text',
            text: markdown
          }],
          isError: false,
          _meta: {
            fileCount: result.fileCount,
            processableCount: result.processableCount,
            totalSize: result.totalSize,
            folderCount: result.folderCount,
            llamaParseEnabled: result.llamaParseEnabled
          }
        };
      }

        case 'get_assignment_details': {
          const inputParams = input as any;
          let assignmentName = inputParams.assignmentName;
          let courseName = inputParams.courseName;
          let courseId = inputParams.courseId;
          
          const homework = await getAssignmentDetails({
            ...getCanvasConfig(),
            courseId,
            courseName,
            assignmentName: assignmentName
          });
          
          let markdown = `# ${homework.name}\n\n`;
          markdown += `**Due Date:** ${homework.dueAt ? new Date(homework.dueAt).toLocaleString() : 'N/A'}\n`;
          markdown += `**Points:** ${homework.pointsPossible}\n\n`;
          
          if (homework.description) {
            markdown += `## Description\n${homework.description}\n\n`;
          }
          
          if (homework.allFiles.length > 0) {
            markdown += `## Associated Files\n\n| File Name | Source | File ID |\n|---|---|---|\n`;
            homework.allFiles.forEach(file => {
              markdown += `| ${file.name} | ${file.source} | ${file.id} |\n`;
            });
            markdown += `\n`;
          } else {
            markdown += `## Associated Files\n\n*No files found attached to this assignment.*\n\n`;
          }
          
          // If includeFileContent is true (default), read file contents
          const includeFileContent = inputParams.includeFileContent !== false; // Default to true
          const processFiles = inputParams.processFiles === true; // Default to false
          
          if (homework.allFiles.length > 0 && (includeFileContent || processFiles)) {
            if (processFiles) {
              markdown += `## 📄 Processed Files (Ready for Discussion)\n\n`;
              for (const file of homework.allFiles) {
                try {
                  const fileContent = await readFileById({ 
                    ...getCanvasConfig(), 
                    fileId: file.id 
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
                  markdown += `### ${file.name}\n\n*Could not process file: ${error instanceof Error ? error.message : 'Unknown error'}*\n\n`;
                }
              }
            } else if (includeFileContent) {
              markdown += `## File Contents\n\n`;
              for (const file of homework.allFiles) {
                try {
                  const fileContent = await readFileById({ 
                    ...getCanvasConfig(), 
                    fileId: file.id 
                  });
                  markdown += `### ${file.name}\n\n\`\`\`\n${fileContent.content}\n\`\`\`\n\n`;
                } catch (error) {
                  markdown += `### ${file.name}\n\n*Could not read file content: ${error instanceof Error ? error.message : 'Unknown error'}*\n\n`;
                }
              }
            }
          }
        
        return {
          content: [
            {
                type: "text",
                text: markdown
            }
          ]
        };
      }

      case 'get_submission_comments': {
        const submissionData = await getSubmissionComments({
          ...getCanvasConfig(),
          ...(input as Omit<GetSubmissionCommentsParams, 'canvasBaseUrl' | 'accessToken'>)
        });

        let markdown = `# 💬 Submission Comments: ${submissionData.assignmentName}\n\n`;
        markdown += `**Assignment ID:** ${submissionData.assignmentId}\n`;
        markdown += `**Submission ID:** ${submissionData.submissionId}\n`;
        markdown += `**Score:** ${submissionData.score !== null ? `${submissionData.score} points` : 'Not graded'}\n`;
        markdown += `**Grade:** ${submissionData.grade || 'Not assigned'}\n`;
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
              comment.attachments.forEach(att => {
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
        if (submissionData.rubricAssessment && submissionData.rubricAssessment.length > 0) {
          markdown += `## 🎯 Rubric Assessment\n\n`;
          markdown += `| Criterion | Score | Performance Level | Comments |\n|---|---|---|---|\n`;
          
          submissionData.rubricAssessment.forEach(criterion => {
            const score = criterion.pointsEarned !== null ? 
              `${criterion.pointsEarned} / ${criterion.pointsPossible}` : 
              `Not scored / ${criterion.pointsPossible}`;
            const performance = criterion.ratingDescription || 'Not assessed';
            const comments = criterion.comments || 'No comments';
            
            markdown += `| ${criterion.criterionDescription} | ${score} | ${performance} | ${comments} |\n`;
          });
          
          const totalEarned = submissionData.rubricAssessment.reduce((sum, c) => sum + (c.pointsEarned || 0), 0);
          const totalPossible = submissionData.rubricAssessment.reduce((sum, c) => sum + c.pointsPossible, 0);
          markdown += `\n**Total Rubric Score:** ${totalEarned} / ${totalPossible} points\n\n`;
        }

        // Submission history if included
        if (submissionData.submissionHistory && submissionData.submissionHistory.length > 0) {
          markdown += `## 📚 Submission History\n\n`;
          markdown += `| Attempt | Submitted | Score | Grade |\n|---|---|---|---|\n`;
          
          submissionData.submissionHistory.forEach(attempt => {
            const submitted = attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Not submitted';
            const score = attempt.score !== null ? attempt.score.toString() : 'N/A';
            const grade = attempt.grade || 'N/A';
            
            markdown += `| ${attempt.attempt} | ${submitted} | ${score} | ${grade} |\n`;
          });
          
          markdown += `\n`;
        }

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_detailed_submission': {
        const detailedData = await getDetailedSubmission({
          ...getCanvasConfig(),
          ...(input as Omit<GetDetailedSubmissionParams, 'canvasBaseUrl' | 'accessToken'>)
        });

        let markdown = `# 📋 Detailed Submission: ${detailedData.assignment.name}\n\n`;

        // Assignment Overview
        markdown += `## 📝 Assignment Details\n\n`;
        markdown += `**Assignment ID:** ${detailedData.assignment.id}\n`;
        markdown += `**Points Possible:** ${detailedData.assignment.pointsPossible}\n`;
        markdown += `**Due Date:** ${detailedData.assignment.dueAt ? new Date(detailedData.assignment.dueAt).toLocaleString() : 'No due date'}\n`;
        markdown += `**Submission Types:** ${detailedData.assignment.submissionTypes.join(', ')}\n\n`;

        if (detailedData.assignment.description) {
          markdown += `**Description:**\n${detailedData.assignment.description}\n\n`;
        }

        // Submission Details
        markdown += `## 📊 Submission Status\n\n`;
        markdown += `**Submission ID:** ${detailedData.submission.id}\n`;
        markdown += `**Score:** ${detailedData.submission.score !== null ? `${detailedData.submission.score} / ${detailedData.assignment.pointsPossible}` : 'Not graded'}\n`;
        markdown += `**Grade:** ${detailedData.submission.grade || 'Not assigned'}\n`;
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

        if (detailedData.submission.attachments && detailedData.submission.attachments.length > 0) {
          markdown += `**Attachments:**\n`;
          detailedData.submission.attachments.forEach(att => {
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
              comment.attachments.forEach(att => {
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
        if (detailedData.rubricAssessment && detailedData.rubricAssessment.length > 0) {
          markdown += `## 🎯 Rubric Assessment\n\n`;
          markdown += `| Criterion | Score | Performance Level | Feedback |\n|---|---|---|---|\n`;
          
          detailedData.rubricAssessment.forEach(criterion => {
            const score = criterion.pointsEarned !== null ? 
              `${criterion.pointsEarned} / ${criterion.pointsPossible}` : 
              `Not scored / ${criterion.pointsPossible}`;
            const performance = criterion.ratingDescription || 'Not assessed';
            const feedback = criterion.comments || 'No feedback';
            
            markdown += `| ${criterion.criterionDescription} | ${score} | ${performance} | ${feedback} |\n`;
          });
          
          const totalEarned = detailedData.rubricAssessment.reduce((sum, c) => sum + (c.pointsEarned || 0), 0);
          const totalPossible = detailedData.rubricAssessment.reduce((sum, c) => sum + c.pointsPossible, 0);
          markdown += `\n**Total Rubric Score:** ${totalEarned} / ${totalPossible} points\n\n`;
        }

        // Full Rubric Reference
        if (detailedData.rubricCriteria && detailedData.rubricCriteria.length > 0) {
          markdown += `## 📋 Complete Rubric Reference\n\n`;
          
          detailedData.rubricCriteria.forEach((criterion, index) => {
            markdown += `### ${index + 1}. ${criterion.description} (${criterion.points} pts)\n\n`;
            
            if (criterion.longDescription) {
              markdown += `*${criterion.longDescription}*\n\n`;
            }

            if (criterion.ratings.length > 0) {
              markdown += `**Performance Levels:**\n\n`;
              markdown += `| Level | Points | Description |\n|---|---|---|\n`;
              
              criterion.ratings.forEach(rating => {
                const description = rating.longDescription || rating.description;
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
              text: markdown
            }
          ]
        };
      }

      case 'process_file': {
        const inputParams = input as any;
        const fileId = inputParams.fileId;
        const analysisType = inputParams.analysisType || 'qa_ready';
        
        try {
          const fileContent = await readFileById({
            ...getCanvasConfig(),
            fileId,
            mode: inputParams.mode || 'full', // Allow mode control
            forceRefresh: inputParams.forceRefresh || false
          });
          
          let markdown = `# 📄 File Analysis: ${fileContent.name}\n\n`;
          
          // Basic file info
          markdown += `**File ID:** ${fileId}\n`;
          markdown += `**File Name:** ${fileContent.name}\n`;
          markdown += `**Mode:** ${fileContent.metadata.mode}\n`;
          markdown += `**Content Size:** ${fileContent.metadata.originalSize || fileContent.content.length} chars\n`;
          if (fileContent.metadata.cached) {
            markdown += `**Cached:** ✅ (processing time: ${fileContent.metadata.processingTime || 'instant'}ms)\n`;
          }
          if (fileContent.metadata.truncated) {
            markdown += `**Truncated:** ⚠️ Preview mode - use mode="full" for complete content\n`;
          }
          markdown += `**Download Link:** [View Original](${fileContent.url})\n\n`;
          
          // Content analysis based on type
          switch (analysisType) {
            case 'summary':
              markdown += `## 📋 Summary\n\n`;
              if (fileContent.content.length > 500) {
                markdown += `${fileContent.content.substring(0, 500)}...\n\n`;
                markdown += `*This is a preview. The full document contains ${fileContent.content.length} characters.*\n\n`;
              } else {
                markdown += `${fileContent.content}\n\n`;
              }
              break;
              
            case 'key_points':
              markdown += `## 🔑 Key Points\n\n`;
              // Simple key point extraction - look for numbered lists, bullet points, etc.
              const lines = fileContent.content.split('\n');
              const keyLines = lines.filter(line => 
                line.trim().length > 20 && 
                (line.includes('•') || line.includes('-') || /^\d+\./.test(line.trim()) || line.includes(':'))
              );
              if (keyLines.length > 0) {
                keyLines.slice(0, 10).forEach(line => {
                  markdown += `- ${line.trim()}\n`;
                });
              } else {
                markdown += `*No obvious key points detected. Showing first few sentences:*\n\n`;
                const sentences = fileContent.content.split('.').slice(0, 3);
                sentences.forEach(sentence => {
                  if (sentence.trim().length > 10) {
                    markdown += `- ${sentence.trim()}.\n`;
                  }
                });
              }
              markdown += `\n`;
              break;
              
            case 'full_content':
              markdown += `## 📖 Full Content\n\n`;
              markdown += `\`\`\`\n${fileContent.content}\n\`\`\`\n\n`;
              break;
              
            case 'qa_ready':
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
                text: markdown
              }
            ]
          };
          
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      case 'post_discussion_reply': {
        const reply = await postDiscussionReply({
          ...getCanvasConfig(),
          ...(input as Omit<PostDiscussionReplyParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Discussion reply posted successfully!\n\n**Reply ID:** ${reply.id}\n**Created:** ${new Date(reply.createdAt).toLocaleString()}\n**Message:** ${reply.message}`
            }
          ]
        };
      }

      case 'reply_to_discussion_entry': {
        const reply = await replyToDiscussionEntry({
          ...getCanvasConfig(),
          ...(input as Omit<PostDiscussionReplyParams & { parentEntryId: string }, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Threaded reply posted successfully!\n\n**Reply ID:** ${reply.id}\n**Parent Entry:** ${reply.parentId}\n**Created:** ${new Date(reply.createdAt).toLocaleString()}\n**Message:** ${reply.message}`
            }
          ]
        };
      }

      case 'send_message': {
        const message = await createConversation({
          ...getCanvasConfig(),
          ...(input as Omit<SendMessageParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Message sent successfully!\n\n**Conversation ID:** ${message.conversationId}\n**Message ID:** ${message.id}\n**Created:** ${new Date(message.createdAt).toLocaleString()}\n**Recipients:** ${(input as any).recipientIds.length} user(s)`
            }
          ]
        };
      }

      case 'reply_to_conversation': {
        const message = await replyToConversation({
          ...getCanvasConfig(),
          ...(input as Omit<ReplyToConversationParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        return {
          content: [
            {
              type: "text",
              text: `✅ Reply sent successfully!\n\n**Conversation ID:** ${message.conversationId}\n**Message ID:** ${message.id}\n**Created:** ${new Date(message.createdAt).toLocaleString()}`
            }
          ]
        };
      }

      case 'list_conversations': {
        const conversations = await listConversations({
          ...getCanvasConfig(),
          ...(input as Omit<ListConversationsParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        let markdown = `| Subject | Participants | Last Message | Workflow State |\n|---|---|---|---|\n`;
        conversations.forEach(conv => {
          const participants = conv.participants.map(p => p.name).join(', ');
          const lastMessageDate = conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : 'N/A';
          markdown += `| ${conv.subject} | ${participants} | ${lastMessageDate} | ${conv.workflowState} |\n`;
        });
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_conversation_details': {
        const conversation = await getConversationDetails({
          ...getCanvasConfig(),
          ...(input as any)
        });
        
        let markdown = `# 💬 Conversation: ${conversation.subject}\n\n`;
        markdown += `**Participants:** ${conversation.participants.map(p => p.name).join(', ')}\n`;
        markdown += `**Last Message:** ${conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString() : 'N/A'}\n`;
        markdown += `**Message Count:** ${conversation.messageCount}\n\n`;
        
        if (conversation.messages && conversation.messages.length > 0) {
          markdown += `## Messages\n\n`;
          conversation.messages.reverse().forEach((msg, index) => {
            markdown += `### Message ${index + 1}\n`;
            markdown += `**From:** ${msg.authorName || 'Unknown'}\n`;
            markdown += `**Date:** ${new Date(msg.createdAt).toLocaleString()}\n\n`;
            markdown += `${msg.body}\n\n`;
            if (msg.attachments && msg.attachments.length > 0) {
              markdown += `**Attachments:** ${msg.attachments.map(att => att.filename).join(', ')}\n\n`;
            }
            markdown += `---\n\n`;
          });
        }
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'find_people': {
        const users = await findPeopleInCourse({
          ...getCanvasConfig(),
          ...(input as Omit<FindPeopleParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        let markdown = `| User ID | Name | Email | Enrollment Type |\n|---|---|---|---|\n`;
        users.forEach(user => {
          const enrollmentTypes = user.enrollments?.map(e => e.type).join(', ') || 'N/A';
          markdown += `| ${user.id} | ${user.name} | ${user.email || 'N/A'} | ${enrollmentTypes} |\n`;
        });
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'search_recipients': {
        const recipients = await searchRecipients({
          ...getCanvasConfig(),
          ...(input as Omit<SearchRecipientsParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        let markdown = `| Recipient ID | Name | Common Courses |\n|---|---|---|\n`;
        recipients.forEach(recipient => {
          const commonCourses = recipient.commonCourses ? Object.keys(recipient.commonCourses).join(', ') : 'N/A';
          markdown += `| ${recipient.id} | ${recipient.name} | ${commonCourses} |\n`;
        });
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_user_profile': {
        const user = await getUserProfile({
          ...getCanvasConfig(),
          ...(input as any)
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
              text: markdown
            }
          ]
        };
      }

      case 'list_quizzes': {
        const quizzes = await listQuizzes({
          ...getCanvasConfig(),
          ...(input as Omit<ListQuizzesParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        let markdown = `| Quiz ID | Title | Due Date | Points | Question Count | Published |\n|---|---|---|---|---|---|\n`;
        quizzes.forEach(quiz => {
          const dueDate = quiz.dueAt ? new Date(quiz.dueAt).toLocaleString() : 'N/A';
          markdown += `| ${quiz.id} | ${quiz.title} | ${dueDate} | ${quiz.pointsPossible} | ${quiz.questionCount} | ${quiz.published ? '✅' : '❌'} |\n`;
        });
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_quiz_details': {
        const quiz = await getQuizDetails({
          ...getCanvasConfig(),
          ...(input as Omit<QuizDetailsParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        let markdown = `# 📝 Quiz: ${quiz.title}\n\n`;
        if (quiz.description) markdown += `**Description:** ${quiz.description}\n\n`;
        markdown += `**Quiz ID:** ${quiz.id}\n`;
        markdown += `**Type:** ${quiz.quizType}\n`;
        markdown += `**Points Possible:** ${quiz.pointsPossible}\n`;
        markdown += `**Question Count:** ${quiz.questionCount}\n`;
        markdown += `**Time Limit:** ${quiz.timeLimit ? `${quiz.timeLimit} minutes` : 'No limit'}\n`;
        markdown += `**Allowed Attempts:** ${quiz.allowedAttempts === -1 ? 'Unlimited' : quiz.allowedAttempts}\n`;
        markdown += `**Published:** ${quiz.published ? '✅' : '❌'}\n`;
        if (quiz.dueAt) markdown += `**Due Date:** ${new Date(quiz.dueAt).toLocaleString()}\n`;
        if (quiz.unlockAt) markdown += `**Available From:** ${new Date(quiz.unlockAt).toLocaleString()}\n`;
        if (quiz.lockAt) markdown += `**Available Until:** ${new Date(quiz.lockAt).toLocaleString()}\n`;
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_quiz_submissions': {
        const submissions = await getQuizSubmissions({
          ...getCanvasConfig(),
          ...(input as Omit<QuizSubmissionsParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        let markdown = `| Submission ID | User ID | Attempt | Score | Started | Finished | State |\n|---|---|---|---|---|---|---|\n`;
        submissions.forEach(sub => {
          const score = sub.score !== undefined ? sub.score.toString() : 'N/A';
          const started = sub.startedAt ? new Date(sub.startedAt).toLocaleString() : 'N/A';
          const finished = sub.finishedAt ? new Date(sub.finishedAt).toLocaleString() : 'N/A';
          markdown += `| ${sub.id} | ${sub.userId || 'N/A'} | ${sub.attempt} | ${score} | ${started} | ${finished} | ${sub.workflowState} |\n`;
        });
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_quiz_submission_content': {
        const quizContent = await getQuizSubmissionContent({
          ...getCanvasConfig(),
          ...(input as Omit<QuizSubmissionContentParams, 'canvasBaseUrl' | 'accessToken'>)
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
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
          
          markdown += `**Question:** ${cleanQuestionText}\n\n`;
          
          // Show question type
          markdown += `**Type:** ${question.questionType}\n\n`;
          
          // Show user's answer if available
          if (question.userAnswer !== undefined && question.userAnswer !== null) {
            markdown += `**Your Answer:** ${question.userAnswer}\n\n`;
          }
          
          // Show score for this question
          if (question.userScore !== undefined) {
            const percentage = question.pointsPossible > 0 ? 
              ((question.userScore / question.pointsPossible) * 100).toFixed(1) : '0';
            markdown += `**Score:** ${question.userScore} / ${question.pointsPossible} points (${percentage}%)\n\n`;
          }
          
          // Show if correct/incorrect
          if (question.correct !== undefined) {
            markdown += `**Result:** ${question.correct ? '✅ Correct' : '❌ Incorrect'}\n\n`;
          }
          
          // Show answer options for multiple choice questions
          if (question.answers && question.answers.length > 0) {
            markdown += `**Answer Options:**\n`;
            question.answers.forEach((answer, answerIndex) => {
              const isCorrect = answer.weight > 0 ? ' ✅' : '';
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
        const correctCount = quizContent.questions.filter(q => q.correct === true).length;
        const totalQuestions = quizContent.questions.length;
        markdown += `- **Questions Correct:** ${correctCount} / ${totalQuestions}\n`;
        markdown += `- **Overall Accuracy:** ${totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(1) : '0'}%\n`;
        markdown += `- **Points Earned:** ${quizContent.score} / ${quizContent.pointsPossible}\n\n`;

        const incorrectQuestions = quizContent.questions.filter(q => q.correct === false);
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
              text: markdown
            }
          ]
        };
      }

      case 'get_previous_submission_content': {
        const submissionContent = await getPreviousSubmissionContent({
          ...getCanvasConfig(),
          ...(input as Omit<PreviousSubmissionParams, 'canvasBaseUrl' | 'accessToken'>)
        });

        let markdown = `# 📁 Previous Submission: ${submissionContent.assignment.name}\n\n`;
        
        // Assignment details
        markdown += `## 📚 Assignment Details\n\n`;
        markdown += `**Assignment ID:** ${submissionContent.assignment.id}\n`;
        markdown += `**Points Possible:** ${submissionContent.assignment.pointsPossible}\n`;
        markdown += `**Due Date:** ${submissionContent.assignment.dueAt ? new Date(submissionContent.assignment.dueAt).toLocaleString() : 'No due date'}\n`;
        markdown += `**Submission Types:** ${submissionContent.assignment.submissionTypes.join(', ')}\n\n`;
        
        if (submissionContent.assignment.description) {
          markdown += `**Description:** ${submissionContent.assignment.description.substring(0, 200)}${submissionContent.assignment.description.length > 200 ? '...' : ''}\n\n`;
        }

        // Submission details
        markdown += `## 📊 Your Submission\n\n`;
        markdown += `**Score:** ${submissionContent.submission.score !== null ? `${submissionContent.submission.score} / ${submissionContent.assignment.pointsPossible}` : 'Not graded'}\n`;
        markdown += `**Grade:** ${submissionContent.submission.grade || 'Not assigned'}\n`;
        markdown += `**Submitted:** ${submissionContent.submission.submittedAt ? new Date(submissionContent.submission.submittedAt).toLocaleString() : 'Not submitted'}\n`;
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
              if (file.contentType.includes('pdf') || file.content.length > 1000) {
                markdown += `\`\`\`\n${file.content.substring(0, 1000)}${file.content.length > 1000 ? '\n... (truncated, full content available)' : ''}\n\`\`\`\n\n`;
              } else {
                markdown += `\`\`\`\n${file.content}\n\`\`\`\n\n`;
              }
            }
          });
        } else {
          markdown += `## 📎 Files\n\n*No files were submitted with this assignment.*\n\n`;
        }

        // Submission history
        if (submissionContent.submissionHistory && submissionContent.submissionHistory.length > 1) {
          markdown += `## 📚 Submission History (${submissionContent.submissionHistory.length} attempts)\n\n`;
          
          submissionContent.submissionHistory.forEach((attempt, index) => {
            markdown += `### Attempt ${attempt.attempt}\n`;
            markdown += `**Submitted:** ${attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'Not submitted'}\n`;
            markdown += `**Files:** ${attempt.files.length}\n`;
            
            if (attempt.files.length > 0) {
              attempt.files.forEach(file => {
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
              text: markdown
            }
          ]
        };
      }

      case 'list_submitted_assignments': {
        const submittedAssignments = await listSubmittedAssignments({
          ...getCanvasConfig(),
          ...(input as { courseId?: string; courseName?: string; })
        });

        let markdown = `# 📋 Your Submitted Assignments\n\n`;
        
        if (submittedAssignments.length === 0) {
          markdown += `*No submitted assignments found in this course.*\n`;
        } else {
          markdown += `Found ${submittedAssignments.length} submitted assignments:\n\n`;
          markdown += `| Assignment | Submitted | Score | Files | Type |\n|---|---|---|---|---|\n`;
          
          submittedAssignments.forEach(assignment => {
            const submittedDate = new Date(assignment.submittedAt).toLocaleDateString();
            const score = assignment.score !== null ? assignment.score.toString() : 'Not graded';
            const fileText = assignment.fileCount > 0 ? `${assignment.fileCount} file${assignment.fileCount > 1 ? 's' : ''}` : 'No files';
            const types = assignment.submissionTypes.join(', ');
            
            markdown += `| ${assignment.name} | ${submittedDate} | ${score} | ${fileText} | ${types} |\n`;
          });
          
          markdown += `\n💡 **Tip:** Use \`get_previous_submission_content\` with any assignment name to review your submitted files and content.\n`;
        }

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'download_submission_file': {
        const fileData = await downloadSubmissionFile({
          ...getCanvasConfig(),
          ...(input as { submissionUrl?: string; fileId?: string; courseId?: string; assignmentId?: string; submissionId?: string; })
        });

        let markdown = `# 📁 Downloaded File: ${fileData.filename}\n\n`;
        markdown += `**File Type:** ${fileData.contentType}\n`;
        markdown += `**File Size:** ${Math.round(fileData.size / 1024)}KB\n\n`;
        
        if (fileData.content.length > 0) {
          if (fileData.contentType.includes('pdf') || fileData.contentType.includes('image') || fileData.size > 50000) {
            // For large files or PDFs, provide a summary
            markdown += `**Content Preview:**\n\n`;
            markdown += `\`\`\`\n${fileData.content.substring(0, 1000)}${fileData.content.length > 1000 ? '\n... (truncated for display)' : ''}\n\`\`\`\n\n`;
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
              text: markdown
            }
          ]
        };
      }

      case 'list_modules': {
        const modules = await listModules({
          ...getCanvasConfig(),
          ...(input as Omit<ListModulesParams, 'canvasBaseUrl' | 'accessToken'>),
          include: ['items']
        });
        
        let markdown = `# 📚 Course Modules\n\n`;
        
        if (modules.length === 0) {
          markdown += `*No modules found in this course.*\n`;
        } else {
          modules.forEach((module, idx) => {
            markdown += `\n## ${idx + 1}. ${module.name}\n\n`;
            
            // Module metadata
            markdown += `**Module ID**: ${module.id} | **Position**: ${module.position} | `;
            markdown += `**Published**: ${module.published ? '✅' : '❌'}\n\n`;
            
            // State and completion
            if (module.state) {
              const stateEmoji: Record<string, string> = {
                'locked': '🔒',
                'unlocked': '🔓',
                'started': '▶️',
                'completed': '✅'
              };
              markdown += `**Status**: ${stateEmoji[module.state] || ''} ${module.state.charAt(0).toUpperCase() + module.state.slice(1)}\n\n`;
            }
            
            if (module.completedAt) {
              markdown += `**✅ Completed**: ${new Date(module.completedAt).toLocaleString()}\n\n`;
            }
            
            // Prerequisites
            if (module.prerequisiteModuleIds.length > 0) {
              markdown += `**📋 Prerequisites**: Must complete modules ${module.prerequisiteModuleIds.join(', ')} first\n\n`;
            }
            
            // Sequential progress
            if (module.requireSequentialProgress) {
              markdown += `**➡️ Sequential**: Items must be completed in order\n\n`;
            }
            
            // Unlock date
            if (module.unlockAt) {
              const unlockDate = new Date(module.unlockAt);
              const isLocked = unlockDate > new Date();
              markdown += `**${isLocked ? '🔒' : '🔓'} Unlock Date**: ${unlockDate.toLocaleString()}${isLocked ? ' (Not yet unlocked)' : ''}\n\n`;
            }
            
            // Items summary
            markdown += `**📦 Items**: ${module.itemsCount} total\n`;
            if (module.items && module.items.length > 0) {
              // Group by type
              const itemTypes: Record<string, number> = {};
              module.items.forEach(item => {
                itemTypes[item.type] = (itemTypes[item.type] || 0) + 1;
              });
              const typeSummary = Object.entries(itemTypes)
                .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
                .join(', ');
              markdown += `  - ${typeSummary}\n`;
            }
            markdown += `\n`;
            
            // Action suggestion
            markdown += `**🎯 To Explore**: Use \`get_module_items\` with moduleId: \`${module.id}\`\n\n`;
            markdown += `---\n`;
          });
          
          // Overall summary
          markdown += `\n## 📊 Overall Progress\n\n`;
          const totalModules = modules.length;
          const publishedModules = modules.filter(m => m.published).length;
          const completedModules = modules.filter(m => m.state === 'completed').length;
          const lockedModules = modules.filter(m => m.state === 'locked').length;
          
          markdown += `- **Total Modules**: ${totalModules}\n`;
          markdown += `- **Published**: ${publishedModules}\n`;
          if (completedModules > 0) {
            markdown += `- **✅ Completed**: ${completedModules}\n`;
          }
          if (lockedModules > 0) {
            markdown += `- **🔒 Locked**: ${lockedModules}\n`;
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_module_items': {
        const items = await getModuleItems({
          ...getCanvasConfig(),
          ...(input as Omit<ModuleItemsParams, 'canvasBaseUrl' | 'accessToken'>),
          include: ['content_details']
        });
        
        let markdown = `# 📚 Module Items\n\n`;
        
        if (items.length === 0) {
          markdown += `*No items found in this module.*\n`;
        } else {
          // Group items by type for better organization
          const itemsByType: Record<string, typeof items> = {};
          items.forEach(item => {
            if (!itemsByType[item.type]) {
              itemsByType[item.type] = [];
            }
            itemsByType[item.type].push(item);
          });
          
          // Helper to get tool suggestion for item type
          const getToolSuggestion = (item: typeof items[0]) => {
            switch (item.type) {
              case 'Page':
                return `\`read_page\` with pageUrl: \`${item.pageUrl}\``;
              case 'File':
                return `\`read_file_by_id\` with fileId: \`${item.contentId}\``;
              case 'Assignment':
                return `\`get_assignment_details\` with assignmentId: \`${item.contentId}\``;
              case 'Quiz':
                return `\`get_quiz_details\` with quizId: \`${item.contentId}\``;
              case 'Discussion':
                return `\`read_discussion\` with discussionId: \`${item.contentId}\``;
              case 'ExternalUrl':
                return `Visit: ${item.externalUrl}`;
              case 'ExternalTool':
                return `Access external tool at: ${item.htmlUrl}`;
              case 'SubHeader':
                return `(Section Header - no action needed)`;
              default:
                return `View at: ${item.htmlUrl}`;
            }
          };
          
          // Display each type group
          const typeOrder = ['Assignment', 'Quiz', 'Page', 'File', 'Discussion', 'ExternalUrl', 'ExternalTool', 'SubHeader'];
          const displayedTypes = typeOrder.filter(type => itemsByType[type]?.length > 0);
          const otherTypes = Object.keys(itemsByType).filter(type => !typeOrder.includes(type));
          
          [...displayedTypes, ...otherTypes].forEach(type => {
            const typeItems = itemsByType[type];
            if (!typeItems || typeItems.length === 0) return;
            
            // Type emoji mapping
            const typeEmoji: Record<string, string> = {
              'Assignment': '📝',
              'Quiz': '📊',
              'Page': '📄',
              'File': '📎',
              'Discussion': '💬',
              'ExternalUrl': '🔗',
              'ExternalTool': '🔧',
              'SubHeader': '📑'
            };
            
            markdown += `\n## ${typeEmoji[type] || '📌'} ${type} Items (${typeItems.length})\n\n`;
            
            typeItems.forEach((item, idx) => {
              // Indent level
              const indent = '  '.repeat(item.indent);
              
              markdown += `${indent}### ${idx + 1}. ${item.title}\n\n`;
              
              // Status indicators
              const statusIcons: string[] = [];
              if (!item.published) statusIcons.push('📝 Draft');
              if (item.completionRequirement?.completed) statusIcons.push('✅ Completed');
              if (item.contentDetails?.lockedForUser) statusIcons.push('🔒 Locked');
              
              if (statusIcons.length > 0) {
                markdown += `${indent}**Status**: ${statusIcons.join(' | ')}\n\n`;
              }
              
              // Completion requirement
              if (item.completionRequirement && !item.completionRequirement.completed) {
                markdown += `${indent}**📋 Requirement**: `;
                switch (item.completionRequirement.type) {
                  case 'must_view':
                    markdown += `Must view this item\n`;
                    break;
                  case 'must_contribute':
                    markdown += `Must contribute (post/comment)\n`;
                    break;
                  case 'must_submit':
                    markdown += `Must submit\n`;
                    break;
                  case 'min_score':
                    markdown += `Must score at least ${item.completionRequirement.minScore} points\n`;
                    break;
                  case 'must_mark_done':
                    markdown += `Must mark as done\n`;
                    break;
                  default:
                    markdown += `${item.completionRequirement.type}\n`;
                }
                markdown += `\n`;
              }
              
              // Content details (due date, points, etc.)
              if (item.contentDetails) {
                const details = item.contentDetails;
                if (details.dueAt) {
                  const dueDate = new Date(details.dueAt);
                  const isOverdue = dueDate < new Date();
                  markdown += `${indent}**📅 Due**: ${dueDate.toLocaleString()}${isOverdue ? ' ⚠️ OVERDUE' : ''}\n\n`;
                }
                if (details.pointsPossible) {
                  markdown += `${indent}**Points**: ${details.pointsPossible}\n\n`;
                }
                if (details.lockedForUser && details.lockExplanation) {
                  markdown += `${indent}**🔒 Lock Info**: ${details.lockExplanation}\n\n`;
                }
              }
              
              // Action suggestion
              markdown += `${indent}**🎯 To Access**: ${getToolSuggestion(item)}\n\n`;
              
              markdown += `${indent}---\n\n`;
            });
          });
          
          // Summary stats
          markdown += `\n## 📊 Summary\n\n`;
          markdown += `- **Total Items**: ${items.length}\n`;
          const completedCount = items.filter(i => i.completionRequirement?.completed).length;
          const totalRequirements = items.filter(i => i.completionRequirement).length;
          if (totalRequirements > 0) {
            markdown += `- **Completed**: ${completedCount} / ${totalRequirements}\n`;
          }
          const lockedCount = items.filter(i => i.contentDetails?.lockedForUser).length;
          if (lockedCount > 0) {
            markdown += `- **Locked Items**: ${lockedCount}\n`;
          }
          const overdueCount = items.filter(i => 
            i.contentDetails?.dueAt && new Date(i.contentDetails.dueAt) < new Date()
          ).length;
          if (overdueCount > 0) {
            markdown += `- **⚠️ Overdue**: ${overdueCount}\n`;
          }
        }
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_module_details': {
        const module = await getModuleDetails({
          ...getCanvasConfig(),
          ...(input as any)
        });
        
        let markdown = `# 📚 Module: ${module.name}\n\n`;
        markdown += `**Module ID:** ${module.id}\n`;
        markdown += `**Position:** ${module.position}\n`;
        markdown += `**Items Count:** ${module.itemsCount}\n`;
        markdown += `**Published:** ${module.published ? '✅' : '❌'}\n`;
        if (module.unlockAt) markdown += `**Unlock Date:** ${new Date(module.unlockAt).toLocaleString()}\n`;
        markdown += `**Sequential Progress Required:** ${module.requireSequentialProgress ? '✅' : '❌'}\n`;
        
        if (module.items && module.items.length > 0) {
          markdown += `\n## Module Items\n\n`;
          markdown += `| Title | Type | Published |\n|---|---|---|\n`;
          module.items.forEach(item => {
            markdown += `| ${item.title} | ${item.type} | ${item.published ? '✅' : '❌'} |\n`;
          });
        }
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_grades': {
        const grades = await getGrades({
          ...getCanvasConfig(),
          ...(input as any)
        });
        
        let markdown = `# 📊 Grades Report\n\n`;
        
        if (grades.length === 0) {
          markdown += `No grades found or access denied.`;
        } else {
          // Process each course and its assignments
          grades.forEach(course => {
            markdown += `## 📚 ${course.courseName}\n\n`;
            
            // Show overall course scores if available
            if (course.currentScore !== undefined || course.finalScore !== undefined || course.finalGrade !== undefined) {
              markdown += `**Course Overview:**\n`;
              if (course.currentScore !== undefined) markdown += `- Current Score: ${course.currentScore}%\n`;
              if (course.finalScore !== undefined) markdown += `- Final Score: ${course.finalScore}%\n`;
              if (course.finalGrade !== undefined) markdown += `- Final Grade: ${course.finalGrade}\n`;
              markdown += `\n`;
            }
            
            // Show assignments if available
            if (course.assignments && course.assignments.length > 0) {
              markdown += `| Assignment | Grade | Status | Points | Possible |\n|---|---|---|---|---|\n`;
              
              course.assignments.forEach(assignment => {
                const status = assignment.submissionStatus === 'graded' ? '✅ Graded' : 
                             assignment.submissionStatus === 'submitted' ? '📤 Submitted' : 
                             assignment.submissionStatus === 'missing' ? '❌ Missing' : 
                             assignment.submissionStatus === 'late' ? '⏰ Late' : '⏳ Not Submitted';
                const gradeDisplay = assignment.score !== null ? assignment.score : 'No Grade';
                const pointsDisplay = assignment.pointsPossible ? `${assignment.pointsPossible}` : 'N/A';
                
                markdown += `| ${assignment.assignmentName} | ${gradeDisplay} | ${status} | ${assignment.score || 'N/A'} | ${pointsDisplay} |\n`;
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
              text: markdown
            }
          ]
        };
      }

      case 'get_gradebook_categories': {
        const categories = await getGradebookCategories({
          ...getCanvasConfig(),
          ...(input as any)
        });
        
        let markdown = `# 📊 Gradebook Categories\n\n`;
        
        if (categories.length === 0) {
          markdown += `No gradebook categories found.`;
        } else {
          markdown += `| Category | Weight | Position | Drop Lowest | Drop Highest |\n|---|---|---|---|---|\n`;
          
          categories.forEach(category => {
            const weightDisplay = category.weight > 0 ? `${category.weight}%` : 'No Weight';
            markdown += `| ${category.name} | ${weightDisplay} | ${category.position} | ${category.dropLowest} | ${category.dropHighest} |\n`;
          });
        }
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_calendar_events': {
        const events = await listCalendarEvents({
          ...getCanvasConfig(),
          ...(input as any)
        });
        
        let markdown = `# 📅 Calendar Events\n\n`;
        
        if (events.length === 0) {
          markdown += `No calendar events found for the specified criteria.`;
        } else {
          markdown += `| Event | Type | Start Date | End Date | Course |\n|---|---|---|---|---|\n`;
          
          events.forEach(event => {
            const startDate = event.startAt ? new Date(event.startAt).toLocaleString() : 'N/A';
            const endDate = event.endAt ? new Date(event.endAt).toLocaleString() : 'N/A';
            const eventType = event.type === 'assignment' ? '📝 Assignment' : '📅 Event';
            
            markdown += `| [${event.title}](${event.url}) | ${eventType} | ${startDate} | ${endDate} | Course ${event.courseId} |\n`;
          });
        }
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_assignment_rubric': {
        const rubricData = await getAssignmentRubric({
          ...getCanvasConfig(),
          ...(input as any)
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
          
          criterion.ratings.forEach(rating => {
            const description = rating.longDescription || rating.description;
            markdown += `| ${rating.description} | ${rating.points} | ${description} |\n`;
          });
          
          markdown += `\n`;
        });

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_rubric_analysis': {
        const analysis = await getRubricAnalysis({
          ...getCanvasConfig(),
          ...(input as any)
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
          
          analysis.rubricThemes.forEach(theme => {
            markdown += `| ${theme.theme} | ${theme.frequency} assignments | ${theme.examples.join(', ') || 'Various criteria'} |\n`;
          });
          
          markdown += `\n`;
        }

        if (analysis.commonCriteria.length > 0) {
          markdown += `## 🔍 Most Common Grading Criteria\n\n`;
          markdown += `| Criterion | Used in | Avg Points | Example Assignments |\n|---|---|---|---|\n`;
          
          analysis.commonCriteria.forEach(criterion => {
            const examples = criterion.assignments.slice(0, 2).join(', ');
            const moreCount = criterion.assignments.length > 2 ? ` (+${criterion.assignments.length - 2} more)` : '';
            markdown += `| ${criterion.description} | ${criterion.frequency} assignments | ${criterion.avgPoints} pts | ${examples}${moreCount} |\n`;
          });
        }

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_assignment_feedback': {
        const feedback = await getAssignmentFeedback({
          ...getCanvasConfig(),
          ...(input as any)
        });

        let markdown = `# 📝 Assignment Feedback: ${feedback.assignment.name}\n\n`;
        markdown += `**Assignment ID:** ${feedback.assignment.id}\n`;
        markdown += `**Total Points Possible:** ${feedback.assignment.points}\n\n`;

        if (feedback.submission) {
          markdown += `## 📊 Submission Summary\n\n`;
          markdown += `**Score:** ${feedback.submission.score || 'Not graded'} / ${feedback.assignment.points}\n`;
          markdown += `**Grade:** ${feedback.submission.grade || 'Not assigned'}\n`;
          markdown += `**Status:** ${feedback.submission.workflowState}\n`;
          
          if (feedback.submission.submittedAt) {
            markdown += `**Submitted:** ${new Date(feedback.submission.submittedAt).toLocaleString()}\n`;
          }
          
          markdown += `\n`;
        }

        if (feedback.feedback && feedback.feedback.criteriaFeedback.length > 0) {
          markdown += `## 🎯 Rubric Assessment\n\n`;
          markdown += `**Overall Score:** ${feedback.feedback.totalScore || 'Not scored'} / ${feedback.feedback.totalPossible}\n\n`;
          
          markdown += `| Criterion | Score | Performance Level | Comments |\n|---|---|---|---|\n`;
          
          feedback.feedback.criteriaFeedback.forEach(criterion => {
            const score = criterion.pointsEarned !== undefined ? 
              `${criterion.pointsEarned} / ${criterion.pointsPossible}` : 
              `Not scored / ${criterion.pointsPossible}`;
            const performance = criterion.performance || 'Not assessed';
            const comments = criterion.comments || 'No comments';
            
            markdown += `| ${criterion.criterion} | ${score} | ${performance} | ${comments} |\n`;
          });
          
          markdown += `\n`;
        }

        if (feedback.submission?.comments && feedback.submission.comments.length > 0) {
          markdown += `## 💬 General Comments\n\n`;
          
          feedback.submission.comments.forEach(comment => {
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
              const levels = criterion.ratings.map(r => `${r.description} (${r.points} pts)`);
              markdown += levels.join(' • ');
              markdown += `\n\n`;
            }
          });
        }

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_course_navigation': {
        const navigation = await getCourseNavigation({
          ...getCanvasConfig(),
          ...(input as any)
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
          const statusEmoji = module.state === 'completed' ? '✅' : 
                             module.state === 'started' ? '🔄' : 
                             module.state === 'locked' ? '🔒' : '⭕';
          
          const prereqText = module.prerequisiteModuleIds.length > 0 ? 
            `${module.prerequisiteModuleIds.length} prereq(s)` : 'None';
          
          markdown += `| ${index + 1} | ${module.name} | ${statusEmoji} ${module.state} | ${module.items.length} | ${prereqText} |\n`;
        });

        // Next Steps
        if (navigation.nextSteps.length > 0) {
          markdown += `\n## 🎯 Recommended Next Steps\n\n`;
          
          navigation.nextSteps.forEach((step, index) => {
            markdown += `### ${index + 1}. ${step.moduleName}\n`;
            markdown += `**Status:** ${step.reason}\n`;
            
            if (step.blockedBy && step.blockedBy.length > 0) {
              markdown += `**Blocked by:** ${step.blockedBy.join(', ')}\n`;
            }
            
            markdown += `\n`;
          });
        }

        // Prerequisites Map
        if (navigation.prerequisiteMap.size > 0) {
          markdown += `## 🔗 Module Dependencies\n\n`;
          
          navigation.modules.forEach(module => {
            if (module.prerequisiteModuleIds.length > 0) {
              const prereqNames = module.prerequisiteModuleIds.map(prereqId => {
                const prereqModule = navigation.modules.find(m => m.id === prereqId);
                return prereqModule?.name || `Module ${prereqId}`;
              });
              
              markdown += `- **${module.name}** requires: ${prereqNames.join(', ')}\n`;
            }
          });
        }

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_course_syllabus': {
        const syllabus = await getCourseSyllabus({
          ...getCanvasConfig(),
          ...(input as any)
        });

        let markdown = `# 📚 Course Syllabus: ${syllabus.courseName}\n\n`;
        markdown += `**Course ID:** ${syllabus.courseId}\n\n`;

        // Syllabus Body
        if (syllabus.syllabusBody && syllabus.syllabusBody.trim().length > 0) {
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
          
          syllabus.syllabusPages.forEach(page => {
            markdown += `| ${page.title} | [View Page](${page.url}) |\n`;
          });
          
          markdown += `\n`;
        }

        // Syllabus Files
        if (syllabus.syllabusFiles.length > 0) {
          markdown += `## 📁 Syllabus Files\n\n`;
          markdown += `| File Name | Type | Size | Link |\n|---|---|---|---|\n`;
          
          syllabus.syllabusFiles.forEach(file => {
            const sizeKB = Math.round(file.size / 1024);
            markdown += `| ${file.name} | ${file.contentType} | ${sizeKB}KB | [Download](${file.url}) |\n`;
          });
          
          markdown += `\n`;
        }

        // Extracted Information
        if (syllabus.extractedInfo) {
          const info = syllabus.extractedInfo;
          
          if (info.gradingPolicy || info.attendancePolicy || info.latePolicy) {
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
            
            info.contactInfo.forEach(contact => {
              const typeLabel = contact.type === 'email' ? '📧 Email' :
                               contact.type === 'phone' ? '📱 Phone' :
                               contact.type === 'office_hours' ? '🏢 Office Hours' :
                               contact.type;
              
              markdown += `| ${typeLabel} | ${contact.info} |\n`;
            });
            
            markdown += `\n`;
          }

          if (info.importantDates && info.importantDates.length > 0) {
            markdown += `## 📅 Important Dates\n\n`;
            markdown += `| Date | Event |\n|---|---|\n`;
            
            info.importantDates.forEach(date => {
              markdown += `| ${date.date} | ${date.event} |\n`;
            });
            
            markdown += `\n`;
          }
        }

        // Summary
        markdown += `## 📊 Syllabus Summary\n\n`;
        markdown += `- **Syllabus Body:** ${syllabus.syllabusBody ? 'Available' : 'Not found'}\n`;
        markdown += `- **Syllabus Pages:** ${syllabus.syllabusPages.length} found\n`;
        markdown += `- **Syllabus Files:** ${syllabus.syllabusFiles.length} found\n`;
        markdown += `- **Extracted Policies:** ${Object.values(syllabus.extractedInfo).filter(v => v && (Array.isArray(v) ? v.length > 0 : true)).length} found\n`;

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'calculate_course_analytics': {
        const analytics = await calculateCourseAnalytics({
          ...getCanvasConfig(),
          ...(input as Omit<CourseAnalyticsParams, 'canvasBaseUrl' | 'accessToken'>)
        });

        let markdown = `# 📊 Course Analytics: ${analytics.courseName}\n\n`;

        // Current Grade Summary
        markdown += `## 🎯 Current Standing\n\n`;
        markdown += `**Current Grade:** ${analytics.currentGrade.percentage !== null ? `${analytics.currentGrade.percentage.toFixed(1)}%` : 'Not calculated'} `;
        markdown += `(${analytics.currentGrade.letterGrade || 'No letter grade'})\n`;
        markdown += `**Points Earned:** ${analytics.currentGrade.pointsEarned} / ${analytics.currentGrade.pointsPossible}\n\n`;

        // Projected Grade
        markdown += `## 🔮 Projected Final Grade\n\n`;
        markdown += `**Projected Grade:** ${analytics.projectedGrade.percentage !== null ? `${analytics.projectedGrade.percentage.toFixed(1)}%` : 'Not calculated'} `;
        markdown += `(${analytics.projectedGrade.letterGrade || 'No letter grade'})\n`;
        markdown += `**Total Points:** ${analytics.projectedGrade.pointsEarned.toFixed(1)} / ${analytics.projectedGrade.pointsPossible}\n\n`;

        // Category Breakdown
        if (analytics.categoryBreakdown.length > 0) {
          markdown += `## 📈 Category Performance\n\n`;
          markdown += `| Category | Weight | Current Score | Progress | Points |\n|---|---|---|---|---|\n`;
          
          analytics.categoryBreakdown.forEach(category => {
            const score = category.currentScore !== null ? `${category.currentScore.toFixed(1)}%` : 'No grades';
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
          
          analytics.upcomingAssignments.forEach(assignment => {
            const dueDate = assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No due date';
            const daysLeft = assignment.daysUntilDue !== null ? `${assignment.daysUntilDue} days` : 'No due date';
            
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
              text: markdown
            }
          ]
        };
      }

      case 'generate_what_if_scenarios': {
        const scenarios = await generateWhatIfScenarios({
          ...getCanvasConfig(),
          ...(input as Omit<WhatIfScenarioParams, 'canvasBaseUrl' | 'accessToken'>)
        });

        let markdown = `# 🎯 What-If Scenarios: ${scenarios.courseName}\n\n`;

        // Target Summary
        markdown += `## 🏆 Target Grade Analysis\n\n`;
        markdown += `**Current Grade:** ${scenarios.currentGrade !== null ? `${scenarios.currentGrade.toFixed(1)}%` : 'Not calculated'}\n`;
        markdown += `**Target Grade:** ${scenarios.targetGrade}% (${scenarios.targetLetterGrade})\n`;
        markdown += `**Is Achievable:** ${scenarios.isAchievable ? '✅ Yes' : '❌ No'}\n\n`;

        if (scenarios.requiredAverage !== null) {
          markdown += `**Required Average on Remaining Work:** ${scenarios.requiredAverage.toFixed(1)}%\n`;
        }
        markdown += `**Remaining Points Available:** ${scenarios.remainingPoints}\n`;
        markdown += `**Remaining Assignments:** ${scenarios.remainingAssignments}\n\n`;

        // Scenarios
        if (scenarios.scenarios.length > 0) {
          markdown += `## 📋 Scenarios\n\n`;
          
          scenarios.scenarios.forEach((scenario, index) => {
            const difficultyEmoji = {
              'Easy': '🟢',
              'Moderate': '🟡', 
              'Challenging': '🟠',
              'Nearly Impossible': '🔴'
            }[scenario.difficulty] || '⚪';
            
            markdown += `### ${difficultyEmoji} ${scenario.difficulty}: ${scenario.description}\n\n`;
            markdown += `**Required Score:** ${scenario.requiredScore.toFixed(1)}%\n`;
            markdown += `**Explanation:** ${scenario.explanation}\n\n`;
          });
        }

        // Recommendations
        if (scenarios.recommendations.length > 0) {
          markdown += `## 💡 Recommendations\n\n`;
          
          scenarios.recommendations.forEach(recommendation => {
            markdown += `- ${recommendation}\n`;
          });
          
          markdown += `\n`;
        }

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_grade_trends': {
        const trends = await getGradeTrends({
          ...getCanvasConfig(),
          ...(input as Omit<GradeTrendsParams, 'canvasBaseUrl' | 'accessToken'>)
        });

        let markdown = `# 📈 Grade Trends: ${trends.courseName}\n\n`;

        // Trend Analysis
        markdown += `## 📊 Overall Trend Analysis\n\n`;
        
        const trendEmoji = {
          'Improving': '📈',
          'Declining': '📉', 
          'Stable': '➡️',
          'Insufficient Data': '❓'
        }[trends.trendAnalysis.overallTrend] || '❓';
        
        markdown += `**Overall Trend:** ${trendEmoji} ${trends.trendAnalysis.overallTrend}\n`;
        
        if (trends.trendAnalysis.trendPercentage !== null) {
          const direction = trends.trendAnalysis.trendPercentage > 0 ? 'improvement' : 'decline';
          markdown += `**Trend Change:** ${Math.abs(trends.trendAnalysis.trendPercentage).toFixed(1)} percentage point ${direction}\n`;
        }
        
        markdown += `**Confidence Level:** ${trends.trendAnalysis.confidence}\n\n`;

        // Timeline Data
        if (trends.timelineData.length > 0) {
          markdown += `## 📅 Recent Assignment Timeline\n\n`;
          markdown += `| Date | Assignment | Score | Percentage | Category |\n|---|---|---|---|---|\n`;
          
          trends.timelineData.forEach(assignment => {
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
          
          trends.performanceByCategory.forEach(category => {
            const trendIcon = {
              'Improving': '📈',
              'Declining': '📉',
              'Stable': '➡️'
            }[category.trend] || '❓';
            
            markdown += `| ${category.categoryName} | ${category.averageScore.toFixed(1)}% | ${trendIcon} ${category.trend} | ${category.recentAssignments} |\n`;
          });
          
          markdown += `\n`;
        }

        // Insights
        if (trends.insights.length > 0) {
          markdown += `## 💡 Key Insights\n\n`;
          
          trends.insights.forEach(insight => {
            markdown += `- ${insight}\n`;
          });
          
          markdown += `\n`;
        }

        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      case 'get_tool_help': {
        const inputParams = input as any;
        const toolName = inputParams.toolName?.toLowerCase();
        const searchQuery = inputParams.searchQuery;
        
        let markdown = '';
        
        // Handle different request types
        if (searchQuery) {
          // Search for tools by keywords
          const matches = searchTools(searchQuery);
          
          if (matches.length === 0) {
            markdown = `# 🔍 Tool Search: "${searchQuery}"\n\n`;
            markdown += `No tools found matching your search. Try broader terms like "grades", "assignments", "files", "discussions", etc.\n\n`;
            markdown += `Use \`get_tool_help\` with toolName="all" to see all available tools.`;
          } else {
            markdown = `# 🔍 Tool Search Results: "${searchQuery}"\n\n`;
            markdown += `Found ${matches.length} tool(s) matching your search:\n\n`;
            matches.forEach(tool => {
              markdown += `## ${tool}\n\n`;
              markdown += getToolHelp(tool) + '\n\n---\n\n';
            });
          }
        } else if (toolName === 'all' || !toolName) {
          // Return overview of all tools
          markdown = getAllToolsOverview();
        } else {
          // Get help for specific tool
          markdown = getToolHelp(toolName);
        }
        
        return {
          content: [
            {
              type: "text",
              text: markdown
            }
          ]
        };
      }

      default:
          throw new McpError(ErrorCode.MethodNotFound, `Tool "${toolName}" not found`);
      }
    } catch (error: any) {
      logger.error('Tool call failed:', error);
      // Forward the error message to the client
      throw new McpError(ErrorCode.InternalError, error.message);
    }
  });

  logger.log('🚀 Starting Notioc Canvas MCP Server...');
    
  // Connect server to transport and start listening
    await server.connect(transport);
    
  logger.log('✅ Server started and listening for requests.');
  logger.log('Make sure your .env file is configured with CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN.');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.log('🔌 Shutting down server...');
    // The connection will be closed automatically on process exit
    logger.log('✅ Server stopped.');
  process.exit(0);
});
}

// Run the main function
main().catch(error => {
  logger.error('❌ Failed to start server:', error);
  process.exit(1);
}); 