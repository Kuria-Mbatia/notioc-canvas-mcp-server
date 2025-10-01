// LlamaParse API Client
// Handles document upload, job polling, and result retrieval

import { logger } from './logger.js';

export interface LlamaParseOptions {
  apiKey: string;
  baseUrl?: string;
  resultFormat?: 'markdown' | 'text' | 'json';
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxBytes?: number;
  allowUpload?: boolean;
}

export interface ParseInput {
  buffer: Buffer;
  filename: string;
  mime?: string;
}

export interface ParseResult {
  content: string;
  format: string;
  meta?: {
    jobId: string;
    pages?: number;
    processingTime?: number;
  };
}

export interface LlamaParseError extends Error {
  code: 'DISABLED' | 'UPLOAD_DISALLOWED' | 'SIZE_EXCEEDED' | 'TIMEOUT' | 'API_ERROR' | 'UNSUPPORTED';
  details?: any;
}

// Supported file extensions (based on LlamaParse documentation)
const SUPPORTED_EXTENSIONS = new Set([
  // Base types
  'pdf',
  // Documents and presentations
  '602', 'abw', 'cgm', 'cwk', 'doc', 'docx', 'docm', 'dot', 'dotm', 'hwp', 'key', 'lwp', 'mw', 'mcw', 
  'pages', 'pbd', 'ppt', 'pptm', 'pptx', 'pot', 'potm', 'potx', 'rtf', 'sda', 'sdd', 'sdp', 'sdw', 
  'sgl', 'sti', 'sxi', 'sxw', 'stw', 'sxg', 'txt', 'uof', 'uop', 'uot', 'vor', 'wpd', 'wps', 'xml', 
  'zabw', 'epub',
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'tiff', 'webp', 'web', 'htm', 'html',
  // Spreadsheets
  'xlsx', 'xls', 'xlsm', 'xlsb', 'xlw', 'csv', 'dif', 'sylk', 'slk', 'prn', 'numbers', 'et', 'ods', 
  'fods', 'uos1', 'uos2', 'dbf', 'wk1', 'wk2', 'wk3', 'wk4', 'wks', '123', 'wq1', 'wq2', 'wb1', 
  'wb2', 'wb3', 'qpw', 'xlr', 'eth', 'tsv',
  // Notebooks
  'ipynb',
  // Audio (≤20MB)
  'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'
]);

// Audio file extensions (have different size limit)
const AUDIO_EXTENSIONS = new Set(['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm']);

function createError(code: LlamaParseError['code'], message: string, details?: any): LlamaParseError {
  const error = new Error(message) as LlamaParseError;
  error.code = code;
  error.details = details;
  return error;
}

function getFileExtension(filename: string): string {
  // Remove query parameters and URL fragments first
  const cleanFilename = filename.split('?')[0].split('#')[0];
  const ext = cleanFilename.toLowerCase().split('.').pop();
  return ext || '';
}

function isSupported(filename: string): boolean {
  const ext = getFileExtension(filename);
  return SUPPORTED_EXTENSIONS.has(ext);
}

function validateInput(input: ParseInput, options: LlamaParseOptions): void {
  // Check if LlamaParse is enabled
  if (!options.apiKey) {
    throw createError('DISABLED', 'LlamaParse disabled (no LLAMA_CLOUD_API_KEY)');
  }

  // Check upload permission
  if (!options.allowUpload) {
    throw createError('UPLOAD_DISALLOWED', 'File upload disabled (set LLAMA_PARSE_ALLOW_UPLOAD=true)');
  }

  // Check file type support
  if (!isSupported(input.filename)) {
    const ext = getFileExtension(input.filename);
    throw createError('UNSUPPORTED', `Unsupported file type: .${ext}`);
  }

  // Check size limits
  const maxBytes = options.maxBytes || 50 * 1024 * 1024; // 50MB default
  const isAudio = AUDIO_EXTENSIONS.has(getFileExtension(input.filename));
  const audioLimit = 20 * 1024 * 1024; // 20MB for audio
  
  if (isAudio && input.buffer.length > audioLimit) {
    throw createError('SIZE_EXCEEDED', `Audio file exceeds 20MB limit (${(input.buffer.length / 1024 / 1024).toFixed(1)}MB)`);
  }
  
  if (input.buffer.length > maxBytes) {
    throw createError('SIZE_EXCEEDED', `File exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit (${(input.buffer.length / 1024 / 1024).toFixed(1)}MB)`);
  }
}

async function uploadFile(input: ParseInput, options: LlamaParseOptions): Promise<string> {
  const baseUrl = options.baseUrl || 'https://api.cloud.llamaindex.ai';
  const formData = new FormData();
  
  // Convert Buffer to Uint8Array for Blob (more compatible)
  const uint8Array = new Uint8Array(input.buffer);
  
  formData.append('file', new Blob([uint8Array]), input.filename);
  formData.append('result_type', options.resultFormat || 'markdown');

  const response = await fetch(`${baseUrl}/api/parsing/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw createError('API_ERROR', `Upload failed: ${response.status} ${response.statusText}`, {
      status: response.status,
      response: errorText
    });
  }

  const result = await response.json();
  return result.id || result.job_id;
}

async function pollJobStatus(jobId: string, options: LlamaParseOptions): Promise<any> {
  const baseUrl = options.baseUrl || 'https://api.cloud.llamaindex.ai';
  const timeoutMs = options.timeoutMs || 120000;
  const pollIntervalMs = options.pollIntervalMs || 2000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/parsing/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${options.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const status = await response.json();
      
      if (status.status === 'SUCCESS' || status.status === 'COMPLETED') {
        return status;
      }
      
      if (status.status === 'ERROR' || status.status === 'FAILED') {
        throw createError('API_ERROR', `Parse job failed: ${status.error || 'Unknown error'}`, status);
      }

      // Still processing, wait and retry
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      
    } catch (error) {
      if (error instanceof Error && (error as LlamaParseError).code) {
        throw error; // Re-throw LlamaParseError
      }
      // Network error, wait and retry
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }

  throw createError('TIMEOUT', `Parse job timed out after ${timeoutMs}ms`);
}

async function getResult(jobId: string, options: LlamaParseOptions): Promise<string> {
  const baseUrl = options.baseUrl || 'https://api.cloud.llamaindex.ai';
  
  const response = await fetch(`${baseUrl}/api/parsing/job/${jobId}/result/${options.resultFormat || 'markdown'}`, {
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw createError('API_ERROR', `Result fetch failed: ${response.status} ${response.statusText}`, {
      status: response.status,
      response: errorText
    });
  }

  return await response.text();
}

export async function parseWithLlama(input: ParseInput, options: LlamaParseOptions): Promise<ParseResult> {
  const startTime = Date.now();
  
  try {
    // Validate input and options
    validateInput(input, options);
    
    logger.debug(`[LlamaParse] Starting parse: ${input.filename} (${(input.buffer.length / 1024).toFixed(1)}KB)`);
    
    // Upload file
    const jobId = await uploadFile(input, options);
    logger.debug(`[LlamaParse] Upload complete: ${jobId}`);
    
    // Poll for completion
    const status = await pollJobStatus(jobId, options);
    logger.debug(`[LlamaParse] Job completed: ${jobId}`);
    
    // Get result
    const content = await getResult(jobId, options);
    
    const processingTime = Date.now() - startTime;
    logger.info(`[LlamaParse] Parse successful: ${input.filename} (${processingTime}ms)`);
    
    return {
      content,
      format: options.resultFormat || 'markdown',
      meta: {
        jobId,
        pages: status.pages,
        processingTime
      }
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    if (error instanceof Error && (error as LlamaParseError).code) {
      logger.warn(`[LlamaParse] Parse failed: ${input.filename} - ${error.message} (${processingTime}ms)`);
      throw error;
    }
    
    logger.error(`[LlamaParse] Unexpected error: ${input.filename} - ${error} (${processingTime}ms)`);
    throw createError('API_ERROR', `Unexpected error: ${error}`, error);
  }
}

// Helper function to check if a file is supported without parsing
export function isFileSupported(filename: string): boolean {
  return isSupported(filename);
}

// Helper function to get supported extensions list
export function getSupportedExtensions(): string[] {
  return Array.from(SUPPORTED_EXTENSIONS).sort();
} 