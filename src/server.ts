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
import { listAssignments, AssignmentListParams } from '../tools/assignments.js';
import { searchFiles, getFileContent, FileSearchParams, FileContentParams } from '../tools/files.js';
import { 
  listPages, getPageContent, 
  listDiscussions, getDiscussionContent,
  PagesListParams, PageContentParams,
  DiscussionsListParams, DiscussionContentParams
} from '../tools/pages-discussions.js';

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

// Configuration interface
interface CanvasConfig {
  baseUrl: string;
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

  return { baseUrl, accessToken };
}

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
        name: 'get_pages',
        description: 'Get pages in a Canvas course',
        inputSchema: {
          type: 'object',
          properties: {
            courseId: {
              type: 'string',
              description: 'The Canvas course ID',
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
          required: ['courseId'],
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
              description: 'The Canvas course ID',
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
          required: ['courseId'],
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
              description: 'The Canvas course ID',
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
          required: ['courseId'],
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
              description: 'The Canvas course ID',
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
          required: ['courseId', 'discussionId'],
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
              description: 'The Canvas course ID',
            },
            includeSubmissions: {
              type: 'boolean',
              description: 'Include submission information (default: false)',
              default: false
            }
          },
          required: ['courseId'],
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
              description: 'The Canvas course ID',
            },
            searchTerm: {
              type: 'string',
              description: 'Optional search term to filter files by name',
            }
          },
          required: ['courseId'],
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
              description: 'The Canvas course ID',
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
          required: ['courseId'],
        },
      },

    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Get Canvas configuration
    const config = getCanvasConfig();

    switch (name) {
      case 'get_courses': {
        const params: CourseListParams = {
          canvasBaseUrl: config.baseUrl,
          accessToken: config.accessToken,
          enrollmentState: (args as any)?.enrollmentState as 'active' | 'completed' | 'all' || 'active'
        };
        
        const courses = await listCourses(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                courses: courses,
                message: `Found ${courses.length} courses`
              }, null, 2)
            }
          ]
        };
      }

      case 'get_assignments': {
        if (!(args as any)?.courseId) {
          throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
        }

        const params: AssignmentListParams = {
          canvasBaseUrl: config.baseUrl,
          accessToken: config.accessToken,
          courseId: (args as any).courseId as string,
          includeSubmissions: (args as any)?.includeSubmissions as boolean || false
        };
        
        const assignments = await listAssignments(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                assignments: assignments,
                message: `Found ${assignments.length} assignments in course ${(args as any).courseId}`
              }, null, 2)
            }
          ]
        };
      }

      case 'find_files': {
        if (!(args as any)?.courseId) {
          throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
        }

        const params: FileSearchParams = {
          canvasBaseUrl: config.baseUrl,
          accessToken: config.accessToken,
          courseId: (args as any).courseId as string,
          searchTerm: (args as any)?.searchTerm as string
        };
        
        const files = await searchFiles(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                files: files,
                message: `Found ${files.length} files${(args as any)?.searchTerm ? ` matching "${(args as any).searchTerm}"` : ''} in course ${(args as any).courseId}`
              }, null, 2)
            }
          ]
        };
      }

      case 'read_file': {
        if (!(args as any)?.courseId) {
          throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
        }

        if (!(args as any)?.fileId && !(args as any)?.fileName) {
          throw new McpError(ErrorCode.InvalidParams, 'Either fileId or fileName is required');
        }

        const params: FileContentParams = {
          canvasBaseUrl: config.baseUrl,
          accessToken: config.accessToken,
          courseId: (args as any).courseId as string,
          fileId: (args as any)?.fileId as string,
          fileName: (args as any)?.fileName as string
        };
        
        const result = await getFileContent(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: !result.error,
                fileName: result.fileName,
                content: result.content,
                contentType: result.contentType,
                error: result.error,
                message: result.error 
                  ? `Failed to get content: ${result.error}`
                  : `Successfully retrieved content for "${result.fileName}"`
              }, null, 2)
            }
          ]
        };
      }

      case 'get_pages': {
        if (!(args as any)?.courseId) {
          throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
        }

        const params: PagesListParams = {
          canvasBaseUrl: config.baseUrl,
          accessToken: config.accessToken,
          courseId: (args as any).courseId as string,
          sort: (args as any)?.sort as 'title' | 'created_at' | 'updated_at',
          order: (args as any)?.order as 'asc' | 'desc',
          searchTerm: (args as any)?.searchTerm as string
        };
        
        const pages = await listPages(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                pages: pages,
                message: `Found ${pages.length} pages in course ${(args as any).courseId}`
              }, null, 2)
            }
          ]
        };
      }

      case 'read_page': {
        if (!(args as any)?.courseId) {
          throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
        }

        if (!(args as any)?.pageId && !(args as any)?.pageUrl) {
          throw new McpError(ErrorCode.InvalidParams, 'Either pageId or pageUrl is required');
        }

        const params: PageContentParams = {
          canvasBaseUrl: config.baseUrl,
          accessToken: config.accessToken,
          courseId: (args as any).courseId as string,
          pageId: (args as any)?.pageId as string,
          pageUrl: (args as any)?.pageUrl as string
        };
        
        const result = await getPageContent(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: !result.error,
                title: result.title,
                body: result.body,
                error: result.error,
                message: result.error 
                  ? `Failed to get content: ${result.error}`
                  : `Successfully retrieved content for "${result.title}"`
              }, null, 2)
            }
          ]
        };
      }

      case 'get_discussions': {
        if (!(args as any)?.courseId) {
          throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
        }

        const params: DiscussionsListParams = {
          canvasBaseUrl: config.baseUrl,
          accessToken: config.accessToken,
          courseId: (args as any).courseId as string,
          onlyAnnouncements: (args as any)?.onlyAnnouncements as boolean,
          orderBy: (args as any)?.orderBy as 'position' | 'recent_activity' | 'title',
          searchTerm: (args as any)?.searchTerm as string
        };
        
        const discussions = await listDiscussions(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                discussions: discussions,
                message: `Found ${discussions.length} discussions in course ${(args as any).courseId}`
              }, null, 2)
            }
          ]
        };
      }

      case 'read_discussion': {
        if (!(args as any)?.courseId) {
          throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
        }

        if (!(args as any)?.discussionId) {
          throw new McpError(ErrorCode.InvalidParams, 'discussionId is required');
        }

        const params: DiscussionContentParams = {
          canvasBaseUrl: config.baseUrl,
          accessToken: config.accessToken,
          courseId: (args as any).courseId as string,
          discussionId: (args as any).discussionId as string,
          includeReplies: (args as any)?.includeReplies as boolean ?? true
        };
        
        const result = await getDiscussionContent(params);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: !result.error,
                title: result.title,
                content: result.message,
                replies: result.replies,
                error: result.error,
                message: result.error 
                  ? `Failed to get content: ${result.error}`
                  : `Successfully retrieved content for "${result.title}"`
              }, null, 2)
            }
          ]
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${message}`);
  }
});

// Start the server
async function main() {
  try {
    // Validate configuration on startup
    getCanvasConfig();
    
    // Log server startup to stderr, not stdout
    logger.info('Notioc Canvas MCP Server starting...');
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Log successful connection to stderr
    logger.info('MCP Server connected and ready to process requests');
    
  } catch (error) {
    logger.error('Failed to start MCP Server:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal, shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal, shutting down');
  process.exit(0);
});

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(() => process.exit(1));
}
