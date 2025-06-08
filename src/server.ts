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
import { listAssignments, getAssignmentWithFiles, AssignmentListParams } from '../tools/assignments.js';
import { searchFiles, getFileContent, readFileById, FileSearchParams, FileContentParams } from '../tools/files.js';
import { 
  listPages, getPageContent, 
  listDiscussions, getDiscussionContent,
  PagesListParams, PageContentParams,
  DiscussionsListParams, DiscussionContentParams
} from '../tools/pages-discussions.js';
import { getKnowledgeGraph } from '../tools/knowledge.js';
import { generateQAPrompt } from '../tools/prompts.js';
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
          name: 'build_knowledge_graph',
          description: 'Build a knowledge graph for a specific Canvas course, aggregating syllabus, assignments, files, and calendar events.',
          inputSchema: {
            type: 'object',
            properties: {
              courseName: {
                type: 'string',
                description: 'The name of the course to build the graph for (e.g., "Intro to Everything").',
              },
            },
            required: ['courseName'],
          },
        },
        {
          name: 'generate_qa_prompt',
          description: 'Generates a context-rich prompt for an LLM to answer a question about a course.',
          inputSchema: {
            type: 'object',
            properties: {
              courseName: {
                type: 'string',
                description: 'The name of the course.',
              },
              question: {
                type: 'string',
                description: 'The question to ask about the course.',
              },
            },
            required: ['courseName', 'question'],
          },
        },
        {
          name: 'get_homework',
          description: 'Get a specific homework assignment with all its associated files and content. Can find homework by name, number, or course context.',
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
              homeworkName: {
                type: 'string',
                description: 'The homework assignment name or number (e.g., "Homework 3", "HW3", "Assignment 1"). If not provided, will find the most recent homework.',
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

        case 'build_knowledge_graph': {
          const graph = await getKnowledgeGraph(input as { courseName: string });
          const outputText = `
Knowledge Graph for: **${graph.courseName}**
---------------------------------
**Syllabus**: ${graph.syllabus?.body ? '✅ Found' : '❌ Not Found'}
**Assignments**: ${graph.assignments.length} found
**Files**: ${graph.files.length} found
`;
        return {
          content: [
            {
                type: "text",
                text: outputText
            }
          ]
        };
      }

        case 'generate_qa_prompt': {
          const prompt = await generateQAPrompt(input as { courseName: string, question: string });
        return {
          content: [
            {
                type: "text",
                text: prompt
            }
          ]
        };
      }

        case 'get_homework': {
          const inputParams = input as any;
          let homeworkName = inputParams.homeworkName;
          let courseName = inputParams.courseName;
          let courseId = inputParams.courseId;
          
          // If no course is specified, try to infer from context or recent activity
          if (!courseId && !courseName) {
            // For now, we'll require at least a course to be specified
            throw new Error('Please specify either courseId or courseName to search for homework assignments.');
          }
          
          // If no homework name is provided, look for recent homework assignments
          if (!homeworkName) {
            // Get all assignments and find homework-like ones
            const allAssignments = await listAssignments({
              ...getCanvasConfig(),
              courseId,
              courseName
            });
            
            // Filter for homework assignments (containing "hw", "homework", or "assignment")
            const homeworkAssignments = allAssignments.filter(assignment => 
              /\b(hw|homework|assignment)\s*\d+/i.test(assignment.name)
            );
            
            if (homeworkAssignments.length === 0) {
              throw new Error('No homework assignments found in this course.');
            }
            
            // Sort by due date or name and take the most recent
            homeworkAssignments.sort((a, b) => {
              if (a.dueAt && b.dueAt) {
                return new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime();
              }
              return b.name.localeCompare(a.name);
            });
            
            homeworkName = homeworkAssignments[0].name;
          }
          
          const homework = await getAssignmentWithFiles({
            ...getCanvasConfig(),
            courseId,
            courseName,
            assignmentName: homeworkName
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
          /(?:homework|hw)\s*(\d+)/i,
          /(?:assignment|assign)\s*(\d+)/i,
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
            const homework = await getAssignmentWithFiles({
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