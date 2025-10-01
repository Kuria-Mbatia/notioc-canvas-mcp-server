// Enhanced File Discovery & Browsing
// Comprehensive file browser with folder hierarchy, metadata, and LlamaParse integration

import { fetchAllPaginated, CanvasFile } from './pagination.js';
import { logger } from './logger.js';
import { isFileSupported } from './llamaparse.js';
import { findBestMatch } from './search.js';
import { listCourses } from '../tools/courses.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface EnhancedFileInfo {
  // Core properties
  id: string;
  name: string;
  displayName: string;
  url: string;
  
  // Metadata
  size: number;
  sizeFormatted: string;  // "2.5 MB"
  contentType: string;
  mimeClass: string;      // "pdf", "doc", "image", etc.
  
  // Dates
  createdAt: string;
  updatedAt: string;
  modifiedAt: string | null;
  
  // Location
  folderId: number | null;
  folderPath: string | null;
  moduleName: string | null;
  
  // Status
  locked: boolean;
  lockedForUser: boolean;
  lockExplanation: string | null;
  hidden: boolean;
  hiddenForUser: boolean;
  
  // Processing capability
  llamaParseSupported: boolean;
  processingRecommendation: 'highly-recommended' | 'recommended' | 'supported' | 'not-supported';
  estimatedProcessingTime?: string;
  
  // Additional
  thumbnailUrl: string | null;
  previewUrl: string | null;
}

export interface FolderInfo {
  id: number;
  name: string;
  fullName: string;
  parentFolderId: number | null;
  filesCount: number;
  foldersCount: number;
  position: number;
  locked: boolean;
  hidden: boolean;
  forSubmissions: boolean;
  contextType?: string;
  contextId?: number;
}

export interface GetFilesParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  
  // Browsing options
  folderId?: string;
  folderPath?: string;
  recursive?: boolean;
  
  // Filtering options
  contentTypes?: string[];
  searchTerm?: string;
  showHidden?: boolean;
  showLocked?: boolean;
  includeFromModules?: boolean;
  
  // Display options
  groupBy?: 'folder' | 'type' | 'none';
  sortBy?: 'name' | 'size' | 'date' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface GetFilesResult {
  // Files
  files: EnhancedFileInfo[];
  fileCount: number;
  
  // Folders
  folders: FolderInfo[];
  folderCount: number;
  currentFolder: FolderInfo | null;
  parentFolder: FolderInfo | null;
  breadcrumb: string[];
  
  // Statistics
  totalSize: number;
  totalSizeFormatted: string;
  processableCount: number;
  filesByType: Record<string, number>;
  
  // Processing context
  llamaParseEnabled: boolean;
  llamaParseConfig: {
    maxFileSizeMB: number;
    supportedExtensions: string[];
    resultFormat: string;
  };
  
  // Recommendations
  suggestions: string[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get file category from MIME type or extension
 */
export function getFileCategory(file: { contentType: string; name: string }): string {
  const mime = file.contentType.toLowerCase();
  const ext = file.name.toLowerCase().split('.').pop() || '';
  
  // Documents
  if (mime.includes('pdf') || ext === 'pdf') return 'documents';
  if (mime.includes('word') || mime.includes('document') || ['doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'documents';
  if (mime.includes('presentation') || ['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'presentations';
  
  // Spreadsheets
  if (mime.includes('spreadsheet') || mime.includes('excel') || ['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext)) return 'spreadsheets';
  
  // Images
  if (mime.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'tiff', 'webp'].includes(ext)) return 'images';
  
  // Audio
  if (mime.includes('audio') || ['mp3', 'wav', 'm4a', 'ogg', 'webm'].includes(ext)) return 'audio';
  
  // Video
  if (mime.includes('video') || ['mp4', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) return 'video';
  
  // Archives
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) return 'archives';
  
  // Code
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'rb', 'php', 'html', 'css', 'json', 'xml'].includes(ext)) return 'code';
  
  // Text
  if (mime.includes('text') || ['txt', 'md', 'log'].includes(ext)) return 'text';
  
  return 'other';
}

/**
 * Get emoji icon for file category
 */
export function getFileIcon(category: string): string {
  const icons: Record<string, string> = {
    documents: '📄',
    presentations: '📊',
    spreadsheets: '📊',
    images: '🖼️',
    audio: '🎵',
    video: '🎬',
    archives: '📦',
    code: '💻',
    text: '📝',
    other: '📎'
  };
  return icons[category] || '📎';
}

/**
 * Get category display name
 */
export function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    documents: 'Documents',
    presentations: 'Presentations',
    spreadsheets: 'Spreadsheets',
    images: 'Images',
    audio: 'Audio Files',
    video: 'Video Files',
    archives: 'Archives',
    code: 'Code Files',
    text: 'Text Files',
    other: 'Other Files'
  };
  return names[category] || 'Other Files';
}

/**
 * Estimate processing time based on file size
 */
export function estimateProcessingTime(sizeBytes: number): string {
  const sizeMB = sizeBytes / (1024 * 1024);
  
  if (sizeMB < 1) return '~2-5s';
  if (sizeMB < 5) return '~5-15s';
  if (sizeMB < 10) return '~15-30s';
  if (sizeMB < 20) return '~30-60s';
  return '~1-2min';
}

/**
 * Get processing recommendation level
 */
export function getProcessingRecommendation(
  file: { name: string; contentType: string; size: number },
  llamaSupported: boolean
): 'highly-recommended' | 'recommended' | 'supported' | 'not-supported' {
  if (!llamaSupported) return 'not-supported';
  
  const name = file.name.toLowerCase();
  const sizeMB = file.size / (1024 * 1024);
  
  // Highly recommended: Key course materials
  if (name.includes('syllabus') || 
      name.includes('lecture') || 
      name.includes('assignment') ||
      name.includes('reading') ||
      name.includes('chapter')) {
    return 'highly-recommended';
  }
  
  // Recommended: Good size and likely useful
  if (sizeMB < 10 && (
    file.contentType.includes('pdf') ||
    file.contentType.includes('word') ||
    file.contentType.includes('presentation')
  )) {
    return 'recommended';
  }
  
  // Supported: Can be processed but lower priority
  return 'supported';
}

/**
 * Convert Canvas file to enhanced file info
 */
export function enhanceFileInfo(file: CanvasFile, moduleName?: string | null): EnhancedFileInfo {
  const category = getFileCategory({ contentType: file['content-type'], name: file.display_name });
  const llamaSupported = isFileSupported(file.display_name);
  const recommendation = getProcessingRecommendation(
    { name: file.display_name, contentType: file['content-type'], size: file.size },
    llamaSupported
  );
  
  return {
    id: String(file.id),
    name: file.filename,
    displayName: file.display_name,
    url: file.url,
    
    size: file.size,
    sizeFormatted: formatFileSize(file.size),
    contentType: file['content-type'],
    mimeClass: file.mime_class,
    
    createdAt: file.created_at,
    updatedAt: file.updated_at,
    modifiedAt: file.modified_at,
    
    folderId: file.folder_id || null,
    folderPath: null, // Will be populated if we fetch folder details
    moduleName: moduleName || null,
    
    locked: file.locked,
    lockedForUser: file.locked_for_user,
    lockExplanation: file.lock_explanation || null,
    hidden: file.hidden,
    hiddenForUser: file.hidden_for_user,
    
    llamaParseSupported: llamaSupported,
    processingRecommendation: recommendation,
    estimatedProcessingTime: llamaSupported ? estimateProcessingTime(file.size) : undefined,
    
    thumbnailUrl: file.thumbnail_url || null,
    previewUrl: file.preview_url || null
  };
}

// ============================================================================
// CORE API FUNCTIONS
// ============================================================================

/**
 * Fetch folder details
 */
export async function fetchFolder(
  canvasBaseUrl: string,
  accessToken: string,
  folderId: string
): Promise<FolderInfo | null> {
  try {
    const response = await fetch(
      `${canvasBaseUrl}/api/v1/folders/${folderId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      logger.warn(`Failed to fetch folder ${folderId}: ${response.status}`);
      return null;
    }
    
    const folder = await response.json();
    return {
      id: folder.id,
      name: folder.name,
      fullName: folder.full_name,
      parentFolderId: folder.parent_folder_id || null,
      filesCount: folder.files_count || 0,
      foldersCount: folder.folders_count || 0,
      position: folder.position || 0,
      locked: folder.locked || false,
      hidden: folder.hidden || false,
      forSubmissions: folder.for_submissions || false,
      contextType: folder.context_type,
      contextId: folder.context_id
    };
  } catch (error) {
    logger.error(`Error fetching folder ${folderId}: ${error}`);
    return null;
  }
}

/**
 * Fetch subfolders in a folder
 */
export async function fetchSubfolders(
  canvasBaseUrl: string,
  accessToken: string,
  folderId: string
): Promise<FolderInfo[]> {
  try {
    const folders = await fetchAllPaginated<any>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/folders/${folderId}/folders`,
      { per_page: '100' }
    );
    
    return folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      fullName: folder.full_name,
      parentFolderId: folder.parent_folder_id || null,
      filesCount: folder.files_count || 0,
      foldersCount: folder.folders_count || 0,
      position: folder.position || 0,
      locked: folder.locked || false,
      hidden: folder.hidden || false,
      forSubmissions: folder.for_submissions || false,
      contextType: folder.context_type,
      contextId: folder.context_id
    }));
  } catch (error) {
    logger.error(`Error fetching subfolders for ${folderId}: ${error}`);
    return [];
  }
}

/**
 * Resolve folder path to folder ID
 */
export async function resolveFolderPath(
  canvasBaseUrl: string,
  accessToken: string,
  courseId: string,
  folderPath: string
): Promise<string | null> {
  try {
    // Canvas API: GET /api/v1/courses/:course_id/folders/by_path/*full_path
    const encodedPath = folderPath.split('/').map(p => encodeURIComponent(p)).join('/');
    const response = await fetch(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/folders/by_path/${encodedPath}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      logger.warn(`Failed to resolve folder path "${folderPath}": ${response.status}`);
      return null;
    }
    
    const folders = await response.json();
    // The API returns an array of folders in the path hierarchy
    // The last one is the target folder
    if (folders && folders.length > 0) {
      const targetFolder = folders[folders.length - 1];
      return String(targetFolder.id);
    }
    
    return null;
  } catch (error) {
    logger.error(`Error resolving folder path "${folderPath}": ${error}`);
    return null;
  }
}

/**
 * Get root folder for a course
 */
export async function getRootFolder(
  canvasBaseUrl: string,
  accessToken: string,
  courseId: string
): Promise<FolderInfo | null> {
  try {
    const response = await fetch(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/folders/root`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      logger.warn(`Failed to fetch root folder for course ${courseId}: ${response.status}`);
      return null;
    }
    
    const folder = await response.json();
    return {
      id: folder.id,
      name: folder.name,
      fullName: folder.full_name,
      parentFolderId: folder.parent_folder_id || null,
      filesCount: folder.files_count || 0,
      foldersCount: folder.folders_count || 0,
      position: folder.position || 0,
      locked: folder.locked || false,
      hidden: folder.hidden || false,
      forSubmissions: folder.for_submissions || false,
      contextType: folder.context_type,
      contextId: folder.context_id
    };
  } catch (error) {
    logger.error(`Error fetching root folder for course ${courseId}: ${error}`);
    return null;
  }
}

/**
 * Fetch files from a folder
 */
export async function fetchFilesFromFolder(
  canvasBaseUrl: string,
  accessToken: string,
  folderId: string,
  options: {
    contentTypes?: string[];
    searchTerm?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}
): Promise<CanvasFile[]> {
  try {
    const params: Record<string, string> = {
      per_page: '100'
    };
    
    if (options.contentTypes && options.contentTypes.length > 0) {
      options.contentTypes.forEach((type, i) => {
        params[`content_types[${i}]`] = type;
      });
    }
    
    if (options.searchTerm) {
      params.search_term = options.searchTerm;
    }
    
    if (options.sortBy) {
      params.sort = options.sortBy;
    }
    
    if (options.sortOrder) {
      params.order = options.sortOrder;
    }
    
    const files = await fetchAllPaginated<CanvasFile>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/folders/${folderId}/files`,
      params
    );
    
    return files;
  } catch (error) {
    logger.error(`Error fetching files from folder ${folderId}: ${error}`);
    return [];
  }
}

/**
 * Fetch files from course (all files tab)
 */
export async function fetchFilesFromCourse(
  canvasBaseUrl: string,
  accessToken: string,
  courseId: string,
  options: {
    contentTypes?: string[];
    searchTerm?: string;
    sortBy?: string;
    sortOrder?: string;
  } = {}
): Promise<CanvasFile[]> {
  try {
    const params: Record<string, string> = {
      per_page: '100'
    };
    
    if (options.contentTypes && options.contentTypes.length > 0) {
      options.contentTypes.forEach((type, i) => {
        params[`content_types[${i}]`] = type;
      });
    }
    
    if (options.searchTerm) {
      params.search_term = options.searchTerm;
    }
    
    if (options.sortBy) {
      params.sort = options.sortBy;
    }
    
    if (options.sortOrder) {
      params.order = options.sortOrder;
    }
    
    const files = await fetchAllPaginated<CanvasFile>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/courses/${courseId}/files`,
      params
    );
    
    return files;
  } catch (error) {
    logger.error(`Error fetching files from course ${courseId}: ${error}`);
    return [];
  }
}

/**
 * Fetch files from course modules
 */
export async function fetchFilesFromModules(
  canvasBaseUrl: string,
  accessToken: string,
  courseId: string
): Promise<Array<CanvasFile & { moduleName: string }>> {
  try {
    const modules = await fetchAllPaginated<any>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/courses/${courseId}/modules`,
      { include: ['items'], per_page: '100' }
    );
    
    const filesFromModules: Array<CanvasFile & { moduleName: string }> = [];
    
    for (const module of modules) {
      if (module.items) {
        for (const item of module.items) {
          if (item.type === 'File') {
            // Fetch file details
            try {
              const fileResponse = await fetch(
                `${canvasBaseUrl}/api/v1/courses/${courseId}/files/${item.content_id}`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                  },
                }
              );
              
              if (fileResponse.ok) {
                const file = await fileResponse.json();
                filesFromModules.push({
                  ...file,
                  moduleName: module.name
                });
              }
            } catch (err) {
              logger.debug(`Could not fetch file ${item.content_id} from module`);
            }
          }
        }
      }
    }
    
    return filesFromModules;
  } catch (error) {
    logger.warn(`Could not fetch files from modules: ${error}`);
    return [];
  }
}

/**
 * Generate breadcrumb from folder full name
 */
export function generateBreadcrumb(fullName: string): string[] {
  if (!fullName) return [];
  return fullName.split('/').filter(s => s.length > 0);
}

/**
 * Generate suggestions based on files
 */
export function generateSuggestions(files: EnhancedFileInfo[]): string[] {
  const suggestions: string[] = [];
  
  const processableFiles = files.filter(f => f.llamaParseSupported);
  const highlyRecommended = files.filter(f => f.processingRecommendation === 'highly-recommended');
  const largeFiles = files.filter(f => f.size > 20 * 1024 * 1024);
  const pdfs = files.filter(f => f.contentType.includes('pdf'));
  const syllabus = files.find(f => f.name.toLowerCase().includes('syllabus'));
  
  if (processableFiles.length > 0) {
    suggestions.push(`${processableFiles.length} ${processableFiles.length === 1 ? 'file is' : 'files are'} ready for immediate processing`);
  }
  
  if (syllabus) {
    suggestions.push(`Start with "${syllabus.displayName}" for course overview`);
  }
  
  if (highlyRecommended.length > 0 && !syllabus) {
    suggestions.push(`Recommended: Process "${highlyRecommended[0].displayName}" first (key course material)`);
  }
  
  if (largeFiles.length > 0) {
    suggestions.push(`${largeFiles.length} large ${largeFiles.length === 1 ? 'file' : 'files'} (>20MB) may take longer to process`);
  }
  
  if (pdfs.length > 3) {
    suggestions.push(`${pdfs.length} PDF documents available - consider processing by topic or week`);
  }
  
  return suggestions;
}

// ============================================================================
// MAIN GET FILES FUNCTION
// ============================================================================

/**
 * Get files with enhanced metadata and folder navigation
 */
export async function getFiles(params: GetFilesParams): Promise<GetFilesResult> {
  const {
    canvasBaseUrl,
    accessToken,
    courseId: providedCourseId,
    courseName,
    folderId,
    folderPath,
    recursive = true,
    contentTypes,
    searchTerm,
    showHidden = false,
    showLocked = true,
    includeFromModules = true,
    groupBy = 'type',
    sortBy = 'name',
    sortOrder = 'asc'
  } = params;
  
  // Resolve course ID if course name provided
  let courseId = providedCourseId;
  if (!courseId && courseName) {
    const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
    const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
    
    if (!matchedCourse) {
      throw new Error(`Could not find a course matching "${courseName}"`);
    }
    courseId = matchedCourse.id;
  }
  
  if (!courseId) {
    throw new Error('Either courseId or courseName must be provided');
  }
  
  logger.info(`[GetFiles] Course: ${courseId}, Folder: ${folderId || folderPath || 'root'}`);
  
  // Resolve folder
  let targetFolderId = folderId;
  if (!targetFolderId && folderPath) {
    const resolved = await resolveFolderPath(canvasBaseUrl, accessToken, courseId, folderPath);
    if (!resolved) {
      throw new Error(`Could not resolve folder path "${folderPath}"`);
    }
    targetFolderId = resolved;
  }
  
  // Get current folder info
  let currentFolder: FolderInfo | null = null;
  if (targetFolderId) {
    currentFolder = await fetchFolder(canvasBaseUrl, accessToken, targetFolderId);
  } else {
    currentFolder = await getRootFolder(canvasBaseUrl, accessToken, courseId);
    if (currentFolder) {
      targetFolderId = String(currentFolder.id);
    }
  }
  
  // Get parent folder info
  let parentFolder: FolderInfo | null = null;
  if (currentFolder && currentFolder.parentFolderId) {
    parentFolder = await fetchFolder(canvasBaseUrl, accessToken, String(currentFolder.parentFolderId));
  }
  
  // Generate breadcrumb
  const breadcrumb = currentFolder ? generateBreadcrumb(currentFolder.fullName) : [];
  
  // Fetch folders
  const folders = targetFolderId ? 
    await fetchSubfolders(canvasBaseUrl, accessToken, targetFolderId) : [];
  
  // Fetch files
  let allFiles: EnhancedFileInfo[] = [];
  
  if (targetFolderId) {
    // Fetch files from specific folder
    const filesData = await fetchFilesFromFolder(
      canvasBaseUrl,
      accessToken,
      targetFolderId,
      { contentTypes, searchTerm, sortBy, sortOrder }
    );
    allFiles = filesData.map(f => enhanceFileInfo(f));
  } else {
    // Fetch all files from course
    const filesData = await fetchFilesFromCourse(
      canvasBaseUrl,
      accessToken,
      courseId,
      { contentTypes, searchTerm, sortBy, sortOrder }
    );
    allFiles = filesData.map(f => enhanceFileInfo(f));
  }
  
  // Optionally include files from modules
  if (includeFromModules) {
    const moduleFiles = await fetchFilesFromModules(canvasBaseUrl, accessToken, courseId);
    const moduleFilesEnhanced = moduleFiles.map(f => enhanceFileInfo(f, f.moduleName));
    
    // Merge, avoiding duplicates
    for (const mf of moduleFilesEnhanced) {
      if (!allFiles.some(f => f.id === mf.id)) {
        allFiles.push(mf);
      }
    }
  }
  
  // Apply filters
  if (!showHidden) {
    allFiles = allFiles.filter(f => !f.hidden && !f.hiddenForUser);
  }
  
  if (!showLocked) {
    allFiles = allFiles.filter(f => !f.locked && !f.lockedForUser);
  }
  
  // Calculate statistics
  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
  const processableCount = allFiles.filter(f => f.llamaParseSupported).length;
  
  const filesByType: Record<string, number> = {};
  allFiles.forEach(f => {
    const category = getFileCategory({ contentType: f.contentType, name: f.name });
    filesByType[category] = (filesByType[category] || 0) + 1;
  });
  
  // Generate suggestions
  const suggestions = generateSuggestions(allFiles);
  
  // LlamaParse config
  const llamaParseEnabled = !!process.env.LLAMA_CLOUD_API_KEY && process.env.ENABLE_LLAMAPARSE === 'true';
  const llamaParseConfig = {
    maxFileSizeMB: parseInt(process.env.LLAMA_PARSE_MAX_MB || '50'),
    supportedExtensions: ['pdf', 'docx', 'pptx', 'xlsx', 'jpg', 'png', 'mp3', 'wav'], // Shortened for display
    resultFormat: process.env.LLAMA_PARSE_RESULT_FORMAT || 'markdown'
  };
  
  return {
    files: allFiles,
    fileCount: allFiles.length,
    folders,
    folderCount: folders.length,
    currentFolder,
    parentFolder,
    breadcrumb,
    totalSize,
    totalSizeFormatted: formatFileSize(totalSize),
    processableCount,
    filesByType,
    llamaParseEnabled,
    llamaParseConfig,
    suggestions
  };
}
