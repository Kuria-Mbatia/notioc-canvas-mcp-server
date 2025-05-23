// MCP Tool: Canvas Files Search and Content Retrieval
// Adapted from /app/api/canvas-files/route.ts and /app/api/canvas-file-content/route.ts

import { callCanvasAPI, CanvasFile, CanvasModule, CanvasModuleItem } from '../lib/canvas-api.js';
import { logger } from '../lib/logger.js';

// Dynamically import pdf-parse to avoid test file issues
let pdfParse: any = null;
async function getPdfParse() {
  if (!pdfParse) {
    try {
      pdfParse = (await import('pdf-parse')).default;
    } catch (error) {
      logger.warn('pdf-parse not available:', error);
      return null;
    }
  }
  return pdfParse;
}

// LlamaParse API configuration for Office document processing
const LLAMA_CLOUD_API_KEY = process.env.LLAMA_CLOUD_API_KEY;
const LLAMA_CLOUD_BASE_URL = "https://api.cloud.llamaindex.ai/api/parsing";

// LlamaParse API interfaces
interface LlamaParseUploadResponse {
  id: string; // Job ID
}

interface LlamaParseJobStatusResponse {
  id: string;
  status: string; // "PENDING", "SUCCESS", "ERROR", etc.
}

export interface FileSearchParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  searchTerm?: string;
}

export interface FileContentParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  fileId?: string;
  fileName?: string;
}

export interface FileInfo {
  id: string;
  displayName: string;
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  url: string;
  thumbnailUrl?: string;
  folderId?: string;
  similarity?: number; // For search results
}

export interface FileContentResult {
  fileName: string;
  content: string;
  contentType: string;
  error?: string;
}

// Similarity scoring function for file search
function calculateSimilarity(searchTerm: string, fileName: string): number {
  if (!searchTerm) return 0;
  
  const search = searchTerm.toLowerCase();
  const file = fileName.toLowerCase();
  
  // Exact match
  if (file === search) return 1.0;
  
  // Contains search term
  if (file.includes(search)) return 0.8;
  
  // Word-based matching
  const searchWords = search.split(/\s+/);
  const fileWords = file.split(/[\s._-]+/);
  
  let matchingWords = 0;
  for (const searchWord of searchWords) {
    for (const fileWord of fileWords) {
      if (fileWord.includes(searchWord) || searchWord.includes(fileWord)) {
        matchingWords++;
        break;
      }
    }
  }
  
  return matchingWords / searchWords.length * 0.6;
}

// Search for files in a Canvas course
export async function searchFiles(params: FileSearchParams): Promise<FileInfo[]> {
  const { canvasBaseUrl, accessToken, courseId, searchTerm } = params;

  if (!canvasBaseUrl || !accessToken || !courseId) {
    throw new Error('Missing required parameters');
  }

  try {
    // Initialize with an empty array in case we can't access files directly
    let filesData: CanvasFile[] = [];
    
    try {
      // Get files from the course files folder - but don't fail if this doesn't work
      const filesResponse = await callCanvasAPI({
        canvasBaseUrl,
        accessToken,
        method: 'GET',
        apiPath: `/api/v1/courses/${courseId}/files`,
        params: { per_page: '100' },
      });

      if (filesResponse.ok) {
        filesData = await filesResponse.json();
        logger.info(`Retrieved ${filesData.length} files from course files endpoint`);
      } else {
        // Suppress error and continue using modules
        logger.info(`Could not access course files directly (${filesResponse.status}), will use modules only`);
      }
    } catch (error) {
      // Suppress error and continue using modules
      logger.info('Error accessing course files directly, will use modules only:', error);
    }

    // Also get files from course modules - this is more reliable with student permissions
    let moduleFiles: CanvasFile[] = [];
    try {
      const modulesResponse = await callCanvasAPI({
        canvasBaseUrl,
        accessToken,
        method: 'GET',
        apiPath: `/api/v1/courses/${courseId}/modules`,
        params: { include: 'items', per_page: '100' },
      });

      if (modulesResponse.ok) {
        const modules: CanvasModule[] = await modulesResponse.json();
        
        for (const module of modules) {
          // Get module items to find files
          const itemsResponse = await callCanvasAPI({
            canvasBaseUrl,
            accessToken,
            method: 'GET',
            apiPath: `/api/v1/courses/${courseId}/modules/${module.id}/items`,
            params: { per_page: '100' },
          });

          if (itemsResponse.ok) {
            const items: CanvasModuleItem[] = await itemsResponse.json();
            const fileItems = items.filter(item => item.type === 'File');
            
            for (const item of fileItems) {
              if (item.content_id) {
                try {
                  const fileResponse = await callCanvasAPI({
                    canvasBaseUrl,
                    accessToken,
                    method: 'GET',
                    apiPath: `/api/v1/files/${item.content_id}`,
                  });

                  if (fileResponse.ok) {
                    const fileData: CanvasFile = await fileResponse.json();
                    moduleFiles.push(fileData);
                  }
                } catch (error) {
                  // Silently skip files that can't be fetched
                }
              }
            }
          }
        }
      }
    } catch (error) {
      // Silently skip module files if they can't be fetched
    }

    // Combine and deduplicate files - prioritize module files which are more accessible
    const allFiles = [...moduleFiles, ...filesData]; // Module files first for more reliable access
    const uniqueFiles = allFiles.filter((file, index, self) => 
      index === self.findIndex(f => f.id === file.id)
    );
    
    logger.info(`Total unique files found: ${uniqueFiles.length} (${moduleFiles.length} from modules, ${filesData.length} from direct access)`)

    // Map to FileInfo and apply search filtering
    let files: FileInfo[] = uniqueFiles.map(file => ({
      id: String(file.id),
      displayName: file.display_name || file.filename || `File ${file.id}`,
      filename: file.filename || '',
      contentType: file.content_type || 'application/octet-stream',
      size: file.size || 0,
      createdAt: file.created_at || '',
      updatedAt: file.updated_at || '',
      url: file.url || '',
      thumbnailUrl: file.thumbnail_url,
      folderId: file.folder_id ? String(file.folder_id) : undefined,
    }));

    // Apply search filtering and scoring
    if (searchTerm) {
      files = files
        .map(file => ({
          ...file,
          similarity: Math.max(
            calculateSimilarity(searchTerm, file.displayName),
            calculateSimilarity(searchTerm, file.filename)
          ),
        }))
        .filter(file => file.similarity && file.similarity > 0.1)
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    } else {
      // Sort by updated date if no search term
      files.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    return files;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to search files: ${error.message}`);
    } else {
      throw new Error('Failed to search files: Unknown error');
    }
  }
}

// Find the best matching file by name
async function findBestFileMatch(
  canvasBaseUrl: string, 
  accessToken: string, 
  courseId: string, 
  fileName: string
): Promise<string | null> {
  try {
    const files = await searchFiles({
      canvasBaseUrl,
      accessToken,
      courseId,
      searchTerm: fileName,
    });

    if (files.length === 0) {
      return null;
    }

    // Return the file with highest similarity
    return files[0].id;
  } catch (error) {
    return null;
  }
}

// Process Office documents using LlamaParse API (similar to fetch-parse route)
async function processDocumentWithLlamaParse(
  buffer: ArrayBuffer, 
  contentType: string, 
  documentType: string
): Promise<string> {
  if (!LLAMA_CLOUD_API_KEY) {
    logger.warn('LLAMA_CLOUD_API_KEY not configured. Cannot extract text from Office documents.');
    return `[${documentType} - text extraction requires LlamaParse API configuration. Please set LLAMA_CLOUD_API_KEY environment variable.]`;
  }

  try {
    // Step 1: Upload file to LlamaParse
    const formData = new FormData();
    const fileBlob = new Blob([buffer], { type: contentType });
    formData.append('file', fileBlob, `document.${getFileExtension(contentType)}`);

    logger.info(`Uploading ${documentType} to LlamaParse for text extraction...`);
    const uploadResponse = await fetch(`${LLAMA_CLOUD_BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
        'accept': 'application/json',
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      logger.error(`LlamaParse upload failed: ${uploadResponse.status} - ${errorText}`);
      return `[${documentType} - upload to parser failed: ${uploadResponse.statusText}]`;
    }

    const uploadResult = await uploadResponse.json() as LlamaParseUploadResponse;
    const jobId = uploadResult.id;
    logger.info(`File uploaded to LlamaParse. Job ID: ${jobId}`);

    // Step 2: Poll for job completion
    let jobStatus = "";
    const maxRetries = 15; // Reduce retries for MCP context 
    const retryInterval = 4000; // 4 seconds

    for (let i = 0; i < maxRetries; i++) {
      await new Promise(resolve => setTimeout(resolve, retryInterval));
      logger.info(`Checking LlamaParse job status (${i + 1}/${maxRetries})...`);

      const statusResponse = await fetch(`${LLAMA_CLOUD_BASE_URL}/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
          'accept': 'application/json',
        }
      });

      if (!statusResponse.ok) {
        logger.warn(`Failed to get job status: ${statusResponse.statusText}`);
        continue;
      }

      const statusResult = await statusResponse.json() as LlamaParseJobStatusResponse;
      jobStatus = statusResult.status.toUpperCase();
      logger.info(`Job ${jobId} status: ${jobStatus}`);

      if (jobStatus === "SUCCESS") break;
      if (jobStatus === "ERROR" || jobStatus === "FAILURE") {
        throw new Error(`LlamaParse job failed with status: ${jobStatus}`);
      }
    }

    if (jobStatus !== "SUCCESS") {
      return `[${documentType} - parsing did not complete in time. Last status: ${jobStatus}]`;
    }

    // Step 3: Retrieve the parsed text result
    logger.info(`Fetching parsed text result for job ${jobId}...`);
    const resultResponse = await fetch(`${LLAMA_CLOUD_BASE_URL}/job/${jobId}/result/text`, {
      headers: {
        'Authorization': `Bearer ${LLAMA_CLOUD_API_KEY}`,
        'accept': 'application/json',
      }
    });

    if (!resultResponse.ok) {
      const errorText = await resultResponse.text();
      logger.error(`Failed to retrieve result: ${resultResponse.status} - ${errorText}`);
      return `[${documentType} - failed to retrieve parsed result: ${resultResponse.statusText}]`;
    }

    const parsedContent = await resultResponse.text();
    
    if (!parsedContent || parsedContent.trim().length === 0) {
      logger.warn(`Parsed content is empty for ${documentType}.`);
      return `[${documentType} - parsing completed but extracted content is empty]`;
    }

    logger.info(`Successfully extracted text from ${documentType} (${parsedContent.length} chars)`);
    return parsedContent;

  } catch (error) {
    logger.error(`Error processing ${documentType} with LlamaParse:`, error);
    return `[${documentType} - text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

// Helper function to get file extension from content type
function getFileExtension(contentType: string): string {
  if (contentType.includes('wordprocessingml') || contentType.includes('msword')) {
    return contentType.includes('document') ? 'docx' : 'doc';
  }
  if (contentType.includes('presentationml') || contentType.includes('powerpoint')) {
    return contentType.includes('presentation') ? 'pptx' : 'ppt';
  }
  if (contentType.includes('spreadsheetml') || contentType.includes('excel')) {
    return contentType.includes('sheet') ? 'xlsx' : 'xls';
  }
  return 'bin';
}

// Extract text content from various file types
async function extractFileContent(buffer: ArrayBuffer, contentType: string): Promise<string> {
  try {
    // Handle PDF files
    if (contentType === 'application/pdf' || contentType.includes('pdf')) {
      const pdfParser = await getPdfParse();
      if (!pdfParser) {
        return '[PDF file - pdf-parse library not available for text extraction]';
      }
      
      try {
        const data = await pdfParser(Buffer.from(buffer));
        return data.text || '[PDF file - could not extract text content]';
      } catch (pdfError) {
        logger.warn('PDF parsing error:', pdfError);
        return '[PDF file - error extracting text content]';
      }
    }

    // Handle text files
    if (contentType.startsWith('text/')) {
      const decoder = new TextDecoder();
      return decoder.decode(buffer);
    }

    // Handle DOCX files using LlamaParse
    if (contentType.includes('word') || 
        contentType.includes('document') ||
        contentType.includes('msword') ||
        contentType.includes('officedocument.wordprocessingml')) {
      return await processDocumentWithLlamaParse(buffer, contentType, 'Word Document');
    }

    // Handle PowerPoint files using LlamaParse
    if (contentType.includes('powerpoint') || 
        contentType.includes('presentation') ||
        contentType.includes('officedocument.presentationml')) {
      return await processDocumentWithLlamaParse(buffer, contentType, 'PowerPoint Presentation');
    }

    // Handle Excel files
    if (contentType.includes('excel') || 
        contentType.includes('spreadsheet') ||
        contentType.includes('officedocument.spreadsheetml')) {
      return '[Excel spreadsheet - text extraction not yet supported. Please download the file to view content.]';
    }

    // Handle HTML files
    if (contentType.includes('html')) {
      const decoder = new TextDecoder();
      const htmlContent = decoder.decode(buffer);
      // Basic HTML tag removal for readability
      return htmlContent.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
    }

    // Handle JSON files
    if (contentType.includes('json')) {
      const decoder = new TextDecoder();
      const jsonContent = decoder.decode(buffer);
      try {
        const parsed = JSON.parse(jsonContent);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return jsonContent;
      }
    }

    // For other file types, return a helpful message
    return `[Binary file of type: ${contentType}. Content extraction not yet supported for this file type. File size: ${buffer.byteLength} bytes]`;
    
  } catch (error) {
    return `[Error extracting content from ${contentType} file: ${error instanceof Error ? error.message : 'Unknown error'}]`;
  }
}

// Get content of a specific Canvas file
export async function getFileContent(params: FileContentParams): Promise<FileContentResult> {
  const { canvasBaseUrl, accessToken, courseId, fileId, fileName } = params;

  if (!canvasBaseUrl || !accessToken || !courseId) {
    return {
      fileName: fileName || fileId || 'unknown',
      content: '',
      contentType: '',
      error: 'Missing required parameters',
    };
  }

  if (!fileId && !fileName) {
    return {
      fileName: 'unknown',
      content: '',
      contentType: '',
      error: 'Either fileId or fileName must be provided',
    };
  }

  try {
    let targetFileId: string | undefined = fileId;

    // If no fileId provided, search for the file by name
    if (!targetFileId && fileName) {
      const foundFileId = await findBestFileMatch(canvasBaseUrl, accessToken, courseId, fileName);
      
      if (!foundFileId) {
        return {
          fileName: fileName,
          content: '',
          contentType: '',
          error: `File "${fileName}" not found in course`,
        };
      }
      
      targetFileId = foundFileId;
    }

    // First, get file metadata
    const fileMetaResponse = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: `/api/v1/files/${targetFileId}`,
    });

    if (!fileMetaResponse.ok) {
      throw new Error(`Failed to get file metadata: ${fileMetaResponse.status}`);
    }

    const fileMetaData: CanvasFile = await fileMetaResponse.json();
    const contentType = fileMetaData.content_type || 'application/octet-stream';

    // For Canvas files, we need to get the public URL for reliable access
    // This approach also works better with student permissions
    logger.info(`Getting public URL for file ID: ${targetFileId}`);
    const publicUrlResponse = await callCanvasAPI({
      canvasBaseUrl,
      accessToken, 
      method: 'GET',
      apiPath: `/api/v1/files/${targetFileId}/public_url`
    });
    
    if (!publicUrlResponse.ok) {
      throw new Error(`Failed to get public URL for file: ${publicUrlResponse.status}`);
    }
    
    const publicUrlData = await publicUrlResponse.json();
    const downloadUrl = publicUrlData.public_url;
    
    if (!downloadUrl) {
      throw new Error('Public URL response did not contain a valid URL');
    }
    
    logger.info(`Downloading file content from public URL`);
    
    // Download the actual file content using the public URL (no auth header needed)
    const fileContentResponse = await fetch(downloadUrl);

    if (!fileContentResponse.ok) {
      throw new Error(`Failed to download file: ${fileContentResponse.status} - ${fileContentResponse.statusText}`);
    }

    const buffer = await fileContentResponse.arrayBuffer();
    const content = await extractFileContent(buffer, contentType);

    return {
      fileName: fileMetaData.display_name || fileMetaData.filename || `File ${targetFileId}`,
      content,
      contentType,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      fileName: fileName || fileId || 'unknown',
      content: '',
      contentType: '',
      error: errorMessage,
    };
  }
}
