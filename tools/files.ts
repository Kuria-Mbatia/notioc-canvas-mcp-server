// MCP Tool: Canvas File Search & Retrieval
// Adapted from /app/api/canvas-files/route.ts

import { fetchAllPaginated, CanvasFile } from '../lib/pagination.js';
import { findBestMatch } from '../lib/search.js';
import { listCourses } from './courses.js';
import Fuse from 'fuse.js';
import { createRequire } from 'module';
import { logger } from '../lib/logger.js';
import { parseWithLlama, isFileSupported, LlamaParseError } from '../lib/llamaparse.js';

// LlamaParse configuration (loaded from environment)
const LLAMA_CONFIG = {
  apiKey: process.env.LLAMA_CLOUD_API_KEY || '',
  enabled: process.env.ENABLE_LLAMAPARSE === 'true',
  llamaOnly: process.env.LLAMA_ONLY === 'true',
  resultFormat: process.env.LLAMA_PARSE_RESULT_FORMAT || 'markdown',
  timeoutMs: parseInt(process.env.LLAMA_PARSE_TIMEOUT_MS || '120000'),
  pollIntervalMs: parseInt(process.env.LLAMA_PARSE_POLL_INTERVAL_MS || '2000'),
  maxMB: parseInt(process.env.LLAMA_PARSE_MAX_MB || '50'),
  allowUpload: process.env.LLAMA_PARSE_ALLOW_UPLOAD === 'true'
};

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
      // Handle specific Canvas API errors gracefully
      if (error.message.includes('404') || error.message.includes('disabled') || error.message.includes('تم تعطيل')) {
        logger.warn(`Files not available for course ${courseId}: ${error.message}`);
        return []; // Return empty array instead of throwing
      }
      if (error.message.includes('401') || error.message.includes('access token')) {
        throw new Error(`Authentication failed - please check your Canvas access token`);
      }
      if (error.message.includes('403') || error.message.includes('insufficient permissions')) {
        throw new Error(`Access denied - insufficient permissions to view files for course ${courseId}`);
      }
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
      throw new Error(`Failed to download file from ${fileToFetch.url}. Status: ${fileResponse.statusText}`);
    }

    const contentType = fileResponse.headers.get('content-type');
    const content = await handleFileContent(fileResponse, contentType, fileToFetch.name);

    return { 
      name: fileToFetch.name, 
      content,
      url: fileToFetch.url // Include the URL for reference
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get content: ${error.message}`);
    } else {
      throw new Error('Failed to get content: Unknown error');
    }
  }
}

// Helper function to handle different file content types
async function handleFileContent(response: Response, contentType: string | null, fileName?: string): Promise<string> {
  // Get filename from response URL if not provided
  const detectedFileName = fileName || decodeURIComponent(response.url.split('/').pop() || 'unknown');
  
  // Route all supported files through LlamaParse
  if (shouldUseLlamaParse(detectedFileName, contentType)) {
    return await processWithLlamaParse(response, detectedFileName, contentType);
  }
  
  // Handle simple text-based files directly (no parsing needed)
  else if (contentType?.includes('text/plain') || contentType?.includes('text/csv') || contentType?.includes('application/json')) {
    return await response.text();
  } 
  
  // Handle HTML files with basic processing
  else if (contentType?.includes('text/html')) {
    const html = await response.text();
    // Basic HTML cleanup - remove tags and extract text
    return html.replace(/<[^>]*>/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
  }
  
  // Handle unsupported file types
  else {
    const fileType = contentType || 'unknown type';
    const supportedByLlama = isFileSupported(detectedFileName);
    
    if (supportedByLlama) {
      return `[LlamaParse required but not enabled. Enable with ENABLE_LLAMAPARSE=true and LLAMA_PARSE_ALLOW_UPLOAD=true]\n\nFile: ${detectedFileName}\nType: ${fileType}\nDownload: ${response.url}`;
    } else {
      return `[File type not supported: ${fileType}]\n\nFile: ${detectedFileName}\nDownload: ${response.url}`;
    }
  }
}

// Helper function to determine if a file should use LlamaParse
function shouldUseLlamaParse(fileName: string, contentType: string | null): boolean {
  // Always use LlamaParse for supported files when enabled
  if (LLAMA_CONFIG.enabled && LLAMA_CONFIG.apiKey && isFileSupported(fileName)) {
    return true;
  }

  // Check by content-type as fallback for files without clear extensions
  if (LLAMA_CONFIG.enabled && LLAMA_CONFIG.apiKey && contentType) {
    const supportedTypes = [
      // PDFs
      'application/pdf',
      
      // Microsoft Office
      'application/vnd.openxmlformats-officedocument',
      'application/vnd.ms-',
      'application/msword',
      'application/vnd.ms-powerpoint',
      'application/vnd.ms-excel',
      
      // Other document formats
      'application/rtf',
      'application/epub+zip',
      'application/xml',
      'text/xml',
      
      // Image formats (for OCR)
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/webp',
      'image/svg+xml',
      
      // Audio formats
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/webm'
    ];

    return supportedTypes.some(type => contentType.includes(type));
  }

  return false;
}

// Helper function to process files with LlamaParse
async function processWithLlamaParse(response: Response, fileName: string, contentType: string | null): Promise<string> {
  try {
    logger.debug(`[Files] Processing with LlamaParse: ${fileName}`);
    
    const buffer = await response.arrayBuffer();
    
    const result = await parseWithLlama(
      {
        buffer: Buffer.from(buffer),
        filename: fileName,
        mime: contentType || undefined
      },
      {
        apiKey: LLAMA_CONFIG.apiKey,
        allowUpload: LLAMA_CONFIG.allowUpload,
        resultFormat: LLAMA_CONFIG.resultFormat as 'markdown' | 'text',
        timeoutMs: LLAMA_CONFIG.timeoutMs,
        pollIntervalMs: LLAMA_CONFIG.pollIntervalMs,
        maxBytes: LLAMA_CONFIG.maxMB * 1024 * 1024
      }
    );
    
    logger.info(`[Files] LlamaParse successful: ${fileName} (${result.meta?.processingTime}ms)`);
    return result.content;
    
  } catch (error) {
    const llamaError = error as LlamaParseError;
    logger.warn(`[Files] LlamaParse failed: ${fileName} - ${llamaError.message}`);
    
    // Return structured error with download link
    return `[LlamaParse Error: ${llamaError.message}]\n\nFile: ${fileName}\nDownload: ${response.url}`;
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
    logger.info(`File info for ${fileId}: ${fileInfo.display_name}, URL: ${fileInfo.url}`);

    // Canvas file downloads require special handling
    // Try multiple download strategies
    let fileResponse;
    let downloadUrl = fileInfo.url;

    // Strategy 1: Try the direct URL with authorization
    try {
      fileResponse = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        redirect: 'follow'
      });

      if (!fileResponse.ok) {
        logger.warn(`Direct download failed: ${fileResponse.status}, trying Canvas API download endpoint`);
        
        // Strategy 2: Use Canvas API download endpoint
        downloadUrl = `${canvasBaseUrl}/api/v1/files/${fileId}/download`;
        fileResponse = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          redirect: 'follow'
        });
      }

      if (!fileResponse.ok) {
        logger.warn(`API download failed: ${fileResponse.status}, trying direct file access`);
        
        // Strategy 3: Try accessing the file content URL directly
        if (fileInfo.url && fileInfo.url.includes('instructure.com')) {
          fileResponse = await fetch(fileInfo.url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': 'Canvas-MCP-Client/1.0',
            },
            redirect: 'follow'
          });
        }
      }

      if (!fileResponse.ok) {
        throw new Error(`All download strategies failed. Last status: ${fileResponse.status} ${fileResponse.statusText}`);
      }

    } catch (fetchError) {
      logger.error(`File download error: ${fetchError}`);
      throw new Error(`Failed to download file: ${fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'}`);
    }

    const contentType = fileResponse.headers.get('content-type');
    logger.info(`File content type: ${contentType}, size: ${fileResponse.headers.get('content-length')}`);
    
    const content = await handleFileContent(fileResponse, contentType);

    return { 
      name: fileInfo.display_name, 
      content,
      url: fileInfo.url
    };
  } catch (error) {
    logger.error(`Error in readFileById: ${error}`);
    if (error instanceof Error) {
      throw new Error(`Failed to read file by ID: ${error.message}`);
    } else {
      throw new Error('Unknown error reading file by ID.');
    }
  }
}
