// MCP Tool: Canvas File Search & Retrieval
// Adapted from /app/api/canvas-files/route.ts

import { fetchAllPaginated, CanvasFile } from '../lib/pagination.js';
import { findBestMatch } from '../lib/search.js';
import { listCourses } from './courses.js';
import Fuse from 'fuse.js';
import { createRequire } from 'module';

// PDF parsing function - use require to avoid debug mode issues
let pdfParse: any = null;
let pdfLoadAttempted = false;

async function initializePdfParse() {
  if (pdfParse) return pdfParse;
  
  try {
    // Suppress the loading message to keep progress bar clean
    // console.log('🔍 Loading pdf-parse via require...');
    
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    pdfParse = require('pdf-parse');
    
    // Suppress the success message to keep progress bar clean  
    // console.log('📄 PDF parsing enabled');
    return pdfParse;
  } catch (error) {
    console.error('❌ Could not load pdf-parse:', error);
    return null;
  }
}

// Calculate a basic similarity score
function calculateSimilarity(searchTerm: string, text: string): number {
  if (!searchTerm || !text) return 0;

  const search = searchTerm.toLowerCase();
  const target = text.toLowerCase();

  if (target.includes(search)) {
    return 0.8;
  }

  const searchWords = search.split(/\s+/);
  const targetWords = target.split(/[\s._-]+/);
  let matchingWords = 0;
  for (const sword of searchWords) {
    if (targetWords.some(tword => tword.includes(sword))) {
      matchingWords++;
    }
  }
  return matchingWords / searchWords.length * 0.6;
}

export interface FileSearchParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  searchTerm?: string;
}

export interface FileInfo {
  id: string;
  name: string;
  url: string;
  updatedAt: string | null;
  moduleName: string | null;
  similarity?: number; // Added for search results
}

export interface FileContentParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  fileId?: string;
  fileName?: string;
}

// Search for files in a Canvas course
export async function searchFiles(params: FileSearchParams): Promise<FileInfo[]> {
  let { canvasBaseUrl, accessToken, courseId, courseName, searchTerm } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  try {
    // If courseName is provided, find the courseId first
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      if (courses.length === 0) {
        throw new Error('No courses found for this user.');
      }
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);

      if (!matchedCourse) {
        throw new Error(`Could not find a course matching "${courseName}".`);
      }
      courseId = matchedCourse.id;
    }

    // Initialize with an empty array in case we can't access files directly
    let allFiles: FileInfo[] = [];

    // 1. Get files from the "Files" tab
    try {
      const filesData = await fetchAllPaginated<CanvasFile>(
        canvasBaseUrl,
        accessToken,
        `/api/v1/courses/${courseId}/files`,
        { per_page: '100' }
      );
      allFiles.push(...filesData.map(file => ({
        id: String(file.id),
        name: file.display_name,
        url: file.url,
        updatedAt: file.updated_at,
        moduleName: 'Course Files', // Assign a default module name
      })));
    } catch (e) {
      // Suppress error message to keep progress bar clean
      // console.warn(`Could not fetch course files directly for course ${courseId}. This may be okay if files are only in modules.`);
    }

    // 2. Get files from course modules
    try {
      const modulesData = await fetchAllPaginated<any>(
        canvasBaseUrl,
        accessToken,
        `/api/v1/courses/${courseId}/modules`,
        { include: ['items'], per_page: '100' }
      );

      for (const module of modulesData) {
        if (module.items) {
          for (const item of module.items) {
            if (item.type === 'File') {
              // Avoid duplicates
              if (!allFiles.some(f => f.id === String(item.content_id))) {
                allFiles.push({
                  id: String(item.content_id),
                  name: item.title,
                  url: item.html_url,
                  updatedAt: item.updated_at,
                  moduleName: module.name,
                });
              }
            }
          }
        }
      }
    } catch (e) {
      // Suppress error message to keep progress bar clean
      // console.warn(`Could not fetch modules for course ${courseId}. File search may be incomplete.`);
    }

    if (!searchTerm) {
      return allFiles;
    }

    // Use Fuse.js for fuzzy searching
    const fuse = new Fuse(allFiles, {
      keys: ['name', 'moduleName'],
      includeScore: true,
      threshold: 0.4,
    });

    return fuse.search(searchTerm).map(result => ({
      ...result.item,
      similarity: 1 - (result.score || 1), // Convert score to similarity
    }));

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to search files: ${error.message}`);
    } else {
      throw new Error('Failed to search files: Unknown error');
    }
  }
}

// Get content of a specific file
export async function getFileContent(params: FileContentParams): Promise<{ name: string; content: string, url: string }> {
  let { canvasBaseUrl, accessToken, courseId, courseName, fileId, fileName } = params;

  if (!fileId && !fileName) {
    throw new Error('Either fileId or fileName must be provided.');
  }

  try {
    // Resolve courseName to courseId if needed
    if (!courseId && courseName) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find a course with the name "${courseName}".`);
      }
      courseId = matchedCourse.id;
    }

    if (!courseId) {
      throw new Error('Could not determine course ID.');
    }

    let fileToFetch: FileInfo | undefined;

    if (fileId) {
      // If we have the ID, we can fetch directly
      const response = await fetch(`${canvasBaseUrl}/api/v1/courses/${courseId}/files/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) throw new Error(`API error when fetching file by ID: ${response.statusText}`);
      const fileData: CanvasFile = await response.json();
      fileToFetch = {
        id: String(fileData.id),
        name: fileData.display_name,
        url: fileData.url,
        updatedAt: fileData.updated_at,
        moduleName: null
      };
    } else if (fileName) {
      // If we only have the name, we need to search for it first
      const searchResults = await searchFiles({ canvasBaseUrl, accessToken, courseId, searchTerm: fileName });
      fileToFetch = findBestMatch(fileName, searchResults, ['name']) as FileInfo;
      if (!fileToFetch) {
        throw new Error(`File '${fileName}' not found in course.`);
      }
    }

    if (!fileToFetch) {
      throw new Error('Could not identify which file to fetch.');
    }

    // Canvas files often require authentication and may redirect
    // We need to follow redirects and include authorization
    const fileResponse = await fetch(fileToFetch.url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      redirect: 'follow' // Important: follow redirects for Canvas file downloads
    });

    if (!fileResponse.ok) {
      // If direct download fails, try getting a download URL first
      try {
        const downloadUrlResponse = await fetch(`${canvasBaseUrl}/api/v1/files/${fileToFetch.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (downloadUrlResponse.ok) {
          const fileInfo = await downloadUrlResponse.json();
          const secondAttempt = await fetch(fileInfo.url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
            redirect: 'follow'
          });
          
          if (secondAttempt.ok) {
            const contentType = secondAttempt.headers.get('content-type');
            let content = await handleFileContent(secondAttempt, contentType);
            
            return {
              name: fileToFetch.name,
              content,
              url: fileInfo.url
            };
          }
        }
      } catch (retryError) {
        // Fall through to original error
      }
      
      throw new Error(`Failed to download file: ${fileResponse.status} ${fileResponse.statusText}`);
    }

    const contentType = fileResponse.headers.get('content-type');
    let content = await handleFileContent(fileResponse, contentType);

    return {
      name: fileToFetch.name,
      content,
      url: fileToFetch.url
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get file content: ${error.message}`);
    } else {
      throw new Error('Failed to get file content: Unknown error');
    }
  }
}

// Helper function to handle different file content types
async function handleFileContent(response: Response, contentType: string | null): Promise<string> {
  if (contentType && contentType.includes('text')) {
    return await response.text();
  } else if (contentType && contentType.includes('pdf')) {
    const pdfParser = await initializePdfParse();
    if (pdfParser) {
      try {
        const dataBuffer = await response.arrayBuffer();
        
        // Aggressively suppress all console output during PDF parsing
        const originalStdout = process.stdout.write;
        const originalStderr = process.stderr.write;
        const originalWarn = console.warn;
        const originalLog = console.log;
        const originalError = console.error;
        
        // Redirect all output to nothing during PDF parsing
        process.stdout.write = () => true;
        process.stderr.write = () => true;
        console.warn = () => {};
        console.log = () => {};
        console.error = () => {};
        
        try {
          const data = await pdfParser(Buffer.from(dataBuffer));
          return data.text;
        } finally {
          // Restore all console methods
          process.stdout.write = originalStdout;
          process.stderr.write = originalStderr;
          console.warn = originalWarn;
          console.log = originalLog;
          console.error = originalError;
        }
      } catch (error) {
        // Only show critical errors, not PDF parsing warnings
        return `PDF file detected but could not be parsed. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    } else {
      return `File is a PDF but PDF parsing is not available. You can download it from: ${response.url}`;
    }
  } else if (contentType && (contentType.includes('application/json') || contentType.includes('application/javascript'))) {
    return await response.text();
  } else {
    // For other binary types, we can't do much yet
    const url = response.url;
    return `File content is binary (${contentType}) and cannot be displayed as text. You can download it from: ${url}`;
  }
}

// Read a file directly by its Canvas file ID (without needing course context)
export async function readFileById(params: { canvasBaseUrl: string; accessToken: string; fileId: string }): Promise<{ name: string; content: string; url: string }> {
  const { canvasBaseUrl, accessToken, fileId } = params;

  try {
    // First, get file metadata
    const fileInfoResponse = await fetch(`${canvasBaseUrl}/api/v1/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info: ${fileInfoResponse.status} ${fileInfoResponse.statusText}`);
    }

    const fileInfo = await fileInfoResponse.json();

    // Now download the file content
    const fileResponse = await fetch(fileInfo.url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      redirect: 'follow'
    });

    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status} ${fileResponse.statusText}`);
    }

    const contentType = fileResponse.headers.get('content-type');
    const content = await handleFileContent(fileResponse, contentType);

    return {
      name: fileInfo.display_name || fileInfo.filename || `File ${fileId}`,
      content,
      url: fileInfo.url
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read file by ID: ${error.message}`);
    } else {
      throw new Error('Failed to read file by ID: Unknown error');
    }
  }
}
