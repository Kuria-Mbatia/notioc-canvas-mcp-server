/**
 * Smart Search Tool
 * Intelligent content discovery that handles API restrictions gracefully
 */

import { smartSearch, extractCourseContent, getExtractionStats, clearCourseCache } from '../lib/content-extraction.js';
import { logger } from '../lib/logger.js';

export interface SmartSearchParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  query: string;
  forceRefresh?: boolean;
  includeContent?: boolean;
}

export interface SmartSearchResult {
  success: boolean;
  query: string;
  courseInfo: {
    courseId?: string;
    courseName?: string;
  };
  results: {
    files: Array<{
      fileId: string;
      fileName: string;
      url: string;
      source: string;
      relevance: number;
      canProcess: boolean;
    }>;
    pages: Array<{
      name: string;
      url: string;
      path: string;
      relevance: number;
    }>;
    links: Array<{
      title: string;
      url: string;
      type: string;
      source: string;
      relevance: number;
    }>;
  };
  metadata: {
    totalResults: number;
    searchTime: number;
    extractionUsed: boolean;
    discoveryMethod: string;
    apiRestrictions?: string;
  };
  suggestions?: string[];
  error?: string;
}

/**
 * Smart search across course content with automatic discovery
 */
export async function performSmartSearch(params: SmartSearchParams): Promise<SmartSearchResult> {
  const startTime = Date.now();
  
  try {
    logger.info(`[Smart Search Tool] Searching for "${params.query}" in course ${params.courseId || 'unknown'}`);
    
    if (!params.courseId) {
      return {
        success: false,
        query: params.query,
        courseInfo: { courseName: params.courseName },
        results: { files: [], pages: [], links: [] },
        metadata: {
          totalResults: 0,
          searchTime: Date.now() - startTime,
          extractionUsed: false,
          discoveryMethod: 'none'
        },
        error: 'Course ID is required for smart search'
      };
    }
    
    // Perform smart search using content extraction engine
    const searchResult = await smartSearch(
      params.query,
      params.courseId,
      params.canvasBaseUrl,
      params.accessToken,
      {
        forceRefresh: params.forceRefresh,
        useWebDiscovery: true
      }
    );
    
    // Get extraction stats for metadata
    const stats = await getExtractionStats(
      params.courseId,
      params.canvasBaseUrl,
      params.accessToken
    );
    
    // Enhance file results with processing capability info
    const enhancedFiles = searchResult.files.map(file => ({
      ...file,
      canProcess: canProcessFile(file.fileName)
    }));
    
    // Generate suggestions based on results
    const suggestions = generateSearchSuggestions(params.query, searchResult);
    
    const result: SmartSearchResult = {
      success: true,
      query: params.query,
      courseInfo: {
        courseId: params.courseId,
        courseName: params.courseName
      },
      results: {
        files: enhancedFiles,
        pages: searchResult.pages,
        links: searchResult.links
      },
      metadata: {
        totalResults: searchResult.totalResults,
        searchTime: searchResult.searchTime,
        extractionUsed: searchResult.extractionUsed,
        discoveryMethod: stats.hasCache ? 'cached' : 'discovery',
        apiRestrictions: stats.apiStatus === 'restricted' ? 'Some APIs restricted, using smart discovery' : undefined
      },
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
    
    logger.info(`[Smart Search Tool] Found ${result.metadata.totalResults} results for "${params.query}" in ${result.metadata.searchTime}ms`);
    
    return result;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[Smart Search Tool] Search failed: ${errorMsg}`);
    
    return {
      success: false,
      query: params.query,
      courseInfo: {
        courseId: params.courseId,
        courseName: params.courseName
      },
      results: { files: [], pages: [], links: [] },
      metadata: {
        totalResults: 0,
        searchTime: Date.now() - startTime,
        extractionUsed: false,
        discoveryMethod: 'failed'
      },
      error: `Search failed: ${errorMsg}`
    };
  }
}

/**
 * Get course content overview
 */
export async function getCourseContentOverview(
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
  forceRefresh = false
): Promise<{
  success: boolean;
  courseId: string;
  contentSummary: {
    totalFiles: number;
    totalPages: number;
    totalLinks: number;
    lastScanned?: Date;
    cacheAge?: string;
  };
  apiStatus: {
    status: string;
    restrictions?: string;
    recommendsDiscovery: boolean;
  };
  topFiles: Array<{
    fileId: string;
    fileName: string;
    source: string;
  }>;
  availablePages: Array<{
    name: string;
    path: string;
    accessible: boolean;
  }>;
  error?: string;
}> {
  try {
    logger.info(`[Smart Search Tool] Getting content overview for course ${courseId}`);
    
    // Get current stats
    const stats = await getExtractionStats(courseId, canvasBaseUrl, accessToken);
    
    // If no cache or forced refresh, trigger extraction
    if (!stats.hasCache || forceRefresh) {
      const extraction = await extractCourseContent(
        courseId,
        canvasBaseUrl,
        accessToken,
        { forceRefresh, useWebDiscovery: true }
      );
      
      if (!extraction.success) {
        return {
          success: false,
          courseId,
          contentSummary: { totalFiles: 0, totalPages: 0, totalLinks: 0 },
          apiStatus: { status: 'unknown', recommendsDiscovery: false },
          topFiles: [],
          availablePages: [],
          error: extraction.errors.join(', ')
        };
      }
      
      return {
        success: true,
        courseId,
        contentSummary: {
          totalFiles: extraction.courseIndex.metadata.totalFiles,
          totalPages: extraction.courseIndex.metadata.totalPages,
          totalLinks: extraction.courseIndex.discoveredLinks.length,
          lastScanned: extraction.courseIndex.lastScanned
        },
        apiStatus: {
          status: extraction.courseIndex.metadata.hasRestrictedAPIs ? 'restricted' : 'available',
          restrictions: extraction.apiRestrictions?.summary,
          recommendsDiscovery: extraction.method === 'web' || extraction.method === 'hybrid'
        },
        topFiles: extraction.courseIndex.discoveredFiles.slice(0, 10).map(f => ({
          fileId: f.fileId,
          fileName: f.fileName,
          source: f.source
        })),
        availablePages: extraction.courseIndex.discoveredPages.slice(0, 10).map(p => ({
          name: p.name,
          path: p.path,
          accessible: p.accessible
        }))
      };
    }
    
    // Use cached data
    const cacheAgeMs = stats.cacheAge || 0;
    const cacheAgeStr = formatDuration(cacheAgeMs);
    
    return {
      success: true,
      courseId,
      contentSummary: {
        totalFiles: stats.contentCounts.files,
        totalPages: stats.contentCounts.pages,
        totalLinks: stats.contentCounts.links,
        lastScanned: stats.lastUpdate,
        cacheAge: cacheAgeStr
      },
      apiStatus: {
        status: stats.apiStatus,
        recommendsDiscovery: stats.apiStatus === 'restricted'
      },
      topFiles: [],
      availablePages: []
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[Smart Search Tool] Overview failed: ${errorMsg}`);
    
    return {
      success: false,
      courseId,
      contentSummary: { totalFiles: 0, totalPages: 0, totalLinks: 0 },
      apiStatus: { status: 'error', recommendsDiscovery: false },
      topFiles: [],
      availablePages: [],
      error: `Overview failed: ${errorMsg}`
    };
  }
}

/**
 * Clear content cache for a course
 */
export function clearContentCache(courseId?: string): {
  success: boolean;
  message: string;
} {
  try {
    clearCourseCache(courseId);
    const message = courseId 
      ? `Cleared content cache for course ${courseId}`
      : 'Cleared content cache for all courses';
    
    logger.info(`[Smart Search Tool] ${message}`);
    return { success: true, message };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[Smart Search Tool] Cache clear failed: ${errorMsg}`);
    return { success: false, message: `Failed to clear cache: ${errorMsg}` };
  }
}

/**
 * Check if a file can be processed by LlamaParse
 */
function canProcessFile(fileName: string): boolean {
  const supportedExtensions = [
    // Documents
    'pdf', 'doc', 'docx', 'docm', 'dot', 'dotm', 'rtf', 'txt',
    // Presentations
    'ppt', 'pptx', 'pptm', 'pot', 'potm', 'potx',
    // Spreadsheets
    'xls', 'xlsx', 'xlsm', 'xlsb', 'csv',
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'tiff', 'webp',
    // Audio
    'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'
  ];
  
  const extension = fileName.toLowerCase().split('.').pop() || '';
  return supportedExtensions.includes(extension);
}

/**
 * Generate search suggestions based on results
 */
function generateSearchSuggestions(query: string, searchResult: any): string[] {
  const suggestions: string[] = [];
  
  // If no results, suggest broader terms
  if (searchResult.totalResults === 0) {
    suggestions.push('Try broader search terms like "lecture", "notes", or "slides"');
    suggestions.push('Check if the course has restricted APIs by viewing course overview');
  }
  
  // If many files found, suggest refinement
  if (searchResult.files.length > 10) {
    suggestions.push('Many files found - try more specific terms to narrow results');
  }
  
  // Suggest common academic terms if current query is very short
  if (query.length < 4) {
    suggestions.push('Try specific topics like "uncertainty", "quantum", "optics"');
  }
  
  return suggestions;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
} 