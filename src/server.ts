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
import { listCourses, CourseListParams } from '../tools/courses.js';
import { listAssignments, getAssignmentDetails, AssignmentListParams } from '../tools/assignments.js';
import { searchFiles, getFileContent, readFileById, FileSearchParams, FileContentParams } from '../tools/files.js';
import { 
  listPages, getPageContent, 
  listDiscussions, getDiscussionContent,
  PagesListParams, PageContentParams,
  DiscussionsListParams, DiscussionContentParams
} from '../tools/pages-discussions.js';
import { postDiscussionReply, replyToDiscussionEntry, PostDiscussionReplyParams } from '../tools/discussions.js';
import { 
  createConversation, replyToConversation, listConversations, getConversationDetails,
  SendMessageParams, ReplyToConversationParams, ListConversationsParams
} from '../tools/messages.js';
import { 
  findPeopleInCourse, searchRecipients, getUserProfile, getMyProfile,
  FindPeopleParams, SearchRecipientsParams
} from '../tools/users.js';
import { listQuizzes, getQuizDetails, getQuizSubmissions, ListQuizzesParams, QuizDetailsParams, QuizSubmissionsParams } from '../tools/quizzes.js';
import { listModules, getModuleItems, getModuleDetails, ListModulesParams, ModuleItemsParams } from '../tools/modules.js';
import { runFullIndex } from '../lib/indexer.js';

// Import custom logger that writes to stderr
import { logger } from '../lib/logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Load environment variables with explicit path
dotenv.config({ path: join(projectRoot, '.env') });

// State variable to prevent concurrent indexing
let isIndexing = false;

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

// Wrapper function to handle indexing with a concurrency lock
async function handleIndexing(source: 'startup' | 'scheduled' | 'manual', initialConfig?: CanvasConfig, forceRefreshOverride?: boolean) {
  if (isIndexing) {
    logger.info(`Indexing already in progress. Skipping ${source} request.`);
    return;
  }

  isIndexing = true;
  logger.info(`Starting indexer (triggered by: ${source})...`);
  try {
    const config = initialConfig || getCanvasConfig();
    logger.info(`Indexer is using Canvas URL: ${config.canvasBaseUrl}`);
    
    // Get cache settings from environment
    const forceRefresh = forceRefreshOverride !== undefined ? forceRefreshOverride : (source === 'manual'); // Manual runs default to force refresh
    const maxAgeHours = parseInt(process.env.CACHE_MAX_AGE_HOURS || '6', 10);
    
    await runFullIndex({ 
      canvasBaseUrl: config.canvasBaseUrl, 
      accessToken: config.accessToken,
      forceRefresh,
      maxAgeHours
    });
    logger.info(`Indexer run (triggered by: ${source}) completed successfully.`);
  } catch (error) {
    logger.error(`Indexer run (triggered by: ${source}) failed:`, error);
  } finally {
    isIndexing = false;
  }
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
    logger.info('🧠 To enable smart features like Q&A, run the indexer first.');
    logger.info('   You can do this by running ./test-server.js or calling the "run_indexer" tool from an MCP client.');

  } catch (error: any) {
    logger.error('❌ FATAL: Could not start server.', {
      message: error.message,
      advice: 'Please ensure your .env file is correctly configured with your CANVAS_BASE_URL and CANVAS_ACCESS_TOKEN.'
    });
    // Exit gracefully if the config is bad
    return; 
  }

  // --- Autonomous Indexing Service ---
  const runOnStartup = process.env.RUN_INDEXER_ON_STARTUP === 'true';
  const backgroundIndexing = process.env.ENABLE_BACKGROUND_INDEXING === 'true';
  const intervalHours = parseInt(process.env.INDEXING_INTERVAL_HOURS || '12', 10);

  if (runOnStartup) {
    // Run async without blocking server startup, with a small delay
    setTimeout(() => handleIndexing('startup', config), 2000);
  }

  if (backgroundIndexing) {
    logger.info(`Background indexing is enabled. Will run every ${intervalHours} hours.`);
    setInterval(() => {
      handleIndexing('scheduled');
    }, intervalHours * 60 * 60 * 1000);
  } else {
    logger.info('Background indexing is disabled. Run the indexer manually or via the test script.');
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
          name: 'run_indexer',
          description: 'Runs the indexer to fetch data from Canvas and store it in the local database. Uses smart caching to avoid re-fetching recent data unless forced.',
          inputSchema: {
            type: 'object',
            properties: {
              forceRefresh: {
                type: 'boolean',
                description: 'Force refresh all data even if recently cached (default: true for manual runs)',
                default: true
              }
            },
          },
        },
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
        description: 'Read the content of a specific Canvas page',
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
          name: 'smart_search',
          description: 'Intelligently search for assignments, homework, files, or content using natural language. Can find homework assignments and their files automatically.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language search query (e.g., "find homework 3 in math 451", "get assignment 2 files", "what is due this week")',
              },
              includeFileContent: {
                type: 'boolean',
                description: 'Whether to automatically read file contents (default: true)',
                default: true
              }
            },
            required: ['query'],
          },
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
          name: 'list_modules',
          description: 'List course modules in a Canvas course.',
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
          description: 'Get items for a specific Canvas course module.',
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
    ],
  };
});

  // Call a tool
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name: toolName, arguments: input } = req.params;
    const { canvasBaseUrl, accessToken } = getCanvasConfig();

    logger.log(`Tool call: ${toolName} with args:`, input);

    try {
      switch (toolName) {
        case 'run_indexer': {
          const inputParams = input as any;
          const forceRefresh = inputParams.forceRefresh !== false; // Default to true for manual runs
          handleIndexing('manual', undefined, forceRefresh); // Don't await, let it run in the background
          
          const refreshText = forceRefresh ? ' (force refresh mode)' : ' (smart caching mode)';
          return {
            content: [
              {
                type: "text",
                text: `Indexer has been started manually${refreshText}. It will run in the background. Check server logs for progress.`
              }
            ]
          };
        }

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
            ...(input as Omit<PageContentParams, 'canvasBaseUrl' | 'accessToken'>)
          });
          return {
            content: [
              {
                type: "text",
                text: pageContent.body
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

      case 'smart_search': {
        const inputParams = input as any;
        const query = inputParams.query.toLowerCase();
        const includeFileContent = inputParams.includeFileContent !== false;
        
        // Parse the query to extract course and assignment information
        let courseName = '';
        let assignmentName = '';
        
        // Extract course name patterns
        const courseMatches = [
          /(?:in|for|from)\s+(math\s*\d+|cmpen\s*\d+|cmpsc\s*\d+|ee\s*\d+|\w+\s*\d+)/i,
          /(math|cmpen|cmpsc|ee)\s*(\d+)/i
        ];
        
        for (const regex of courseMatches) {
          const match = query.match(regex);
          if (match) {
            courseName = match[1] || `${match[1]} ${match[2]}`;
            break;
          }
        }
        
        // Extract assignment/homework patterns
        const assignmentMatches = [
          /(?:homework|hw|project|proj|assignment|assign)\s*(\d+)/i,
          /(hw\d+)/i
        ];
        
        for (const regex of assignmentMatches) {
          const match = query.match(regex);
          if (match) {
            assignmentName = match[1] ? `HW${match[1]}` : match[0];
            break;
          }
        }
        
        // If we found course and assignment info, use get_homework
        if (courseName && assignmentName) {
          try {
            const homework = await getAssignmentDetails({
              ...getCanvasConfig(),
              courseName,
              assignmentName
            });
            
            let markdown = `# 🔍 Smart Search Results\n\n`;
            markdown += `**Query:** "${inputParams.query}"\n\n`;
            markdown += `**Found:** ${homework.name}\n`;
            markdown += `**Course:** ${courseName}\n`;
            markdown += `**Due Date:** ${homework.dueAt ? new Date(homework.dueAt).toLocaleString() : 'N/A'}\n`;
            markdown += `**Points:** ${homework.pointsPossible}\n\n`;
            
            if (homework.description) {
              markdown += `## Assignment Description\n${homework.description}\n\n`;
            }
            
            if (homework.allFiles.length > 0) {
              markdown += `## 📁 Associated Files\n\n| File Name | Source | File ID |\n|---|---|---|\n`;
              homework.allFiles.forEach(file => {
                markdown += `| ${file.name} | ${file.source} | ${file.id} |\n`;
              });
              markdown += `\n`;
              
              if (includeFileContent) {
                markdown += `## 📄 File Contents\n\n`;
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
            } else {
              markdown += `## 📁 Associated Files\n\n*No files found for this assignment.*\n\n`;
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
            throw new Error(`Could not find homework: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        
        // If no specific homework found, provide a helpful response
        let response = `# 🔍 Smart Search Results\n\n`;
        response += `**Query:** "${inputParams.query}"\n\n`;
        response += `I couldn't automatically parse your request. Here are some examples of what I can help with:\n\n`;
        response += `- "find homework 3 in math 451"\n`;
        response += `- "get hw2 for cmpen 431"\n`;
        response += `- "show assignment 1 files"\n\n`;
        response += `Please try rephrasing your query with more specific course and assignment information.`;
        
        return {
          content: [
            {
              type: "text",
              text: response
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
            fileId
          });
          
          let markdown = `# 📄 File Analysis: ${fileContent.name}\n\n`;
          
          // Basic file info
          markdown += `**File ID:** ${fileId}\n`;
          markdown += `**File Name:** ${fileContent.name}\n`;
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

      case 'list_modules': {
        const modules = await listModules({
          ...getCanvasConfig(),
          ...(input as Omit<ListModulesParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        let markdown = `| Module ID | Name | Position | Items Count | State | Published |\n|---|---|---|---|---|---|\n`;
        modules.forEach(module => {
          markdown += `| ${module.id} | ${module.name} | ${module.position} | ${module.itemsCount} | ${module.state || 'N/A'} | ${module.published ? '✅' : '❌'} |\n`;
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

      case 'get_module_items': {
        const items = await getModuleItems({
          ...getCanvasConfig(),
          ...(input as Omit<ModuleItemsParams, 'canvasBaseUrl' | 'accessToken'>)
        });
        
        let markdown = `| Item ID | Title | Type | Position | Published |\n|---|---|---|---|---|\n`;
        items.forEach(item => {
          markdown += `| ${item.id} | ${item.title} | ${item.type} | ${item.position} | ${item.published ? '✅' : '❌'} |\n`;
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