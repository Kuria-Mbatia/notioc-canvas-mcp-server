/**
 * Course Discovery Engine
 * Intelligently discovers Canvas course content even when APIs are restricted
 */

export interface DiscoveryConfig {
  enabled: boolean;
  cacheTimeout: number; // milliseconds
  maxRetries: number;
  respectRateLimit: boolean;
}

export interface APIEndpointStatus {
  name: string;
  path: string;
  available: boolean;
  status: number;
  error?: string;
  message?: string;
}

export interface CourseAPIAvailability {
  courseId: string;
  tested: Date;
  endpoints: {
    pages: APIEndpointStatus;
    files: APIEndpointStatus;
    modules: APIEndpointStatus;
    assignments: APIEndpointStatus;
    discussions: APIEndpointStatus;
    announcements: APIEndpointStatus;
    tabs: APIEndpointStatus;
  };
}

export interface DiscoveredPage {
  name: string;
  url: string;
  path: string;
  accessible: boolean;
  contentType: string;
  lastChecked: Date;
  embeddedFiles?: DiscoveredFile[];
  embeddedLinks?: DiscoveredLink[];
}

export interface DiscoveredFile {
  fileId: string;
  fileName: string;
  url: string;
  source: string; // which page it was found on
  fileType?: string;
  size?: number;
  lastModified?: Date;
}

export interface DiscoveredLink {
  title: string;
  url: string;
  type: 'external' | 'internal' | 'video' | 'document';
  source: string;
}

export interface CourseContentIndex {
  courseId: string;
  courseName?: string;
  lastScanned: Date;
  apiAvailability: CourseAPIAvailability;
  discoveredPages: DiscoveredPage[];
  discoveredFiles: DiscoveredFile[];
  discoveredLinks: DiscoveredLink[];
  searchableContent: string; // Combined text for semantic search
  metadata: {
    totalFiles: number;
    totalPages: number;
    hasRestrictedAPIs: boolean;
    discoveryMethod: 'api' | 'web' | 'hybrid';
  };
}

export interface DiscoveryResult {
  success: boolean;
  method: 'api' | 'web' | 'hybrid';
  contentIndex: CourseContentIndex;
  errors?: string[];
  warnings?: string[];
  timing: {
    apiTest: number;
    webDiscovery: number;
    contentExtraction: number;
    total: number;
  };
}

// Default configuration
export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  enabled: true,
  cacheTimeout: 3600000, // 1 hour
  maxRetries: 3,
  respectRateLimit: true
};

// Common Canvas page patterns to try
export const COMMON_COURSE_PAGES = [
  'readings-class-notes-and-videos',
  'course-materials',
  'lecture-slides', 
  'lecture-notes',
  'resources',
  'course-resources',
  'syllabus',
  'schedule',
  'course-schedule',
  'materials',
  'notes',
  'slides',
  'handouts',
  'documents'
];

// Canvas API endpoints to test
export const CANVAS_API_ENDPOINTS = [
  { name: 'pages', path: '/pages' },
  { name: 'files', path: '/files' },
  { name: 'modules', path: '/modules' },
  { name: 'assignments', path: '/assignments' },
  { name: 'discussions', path: '/discussion_topics' },
  { name: 'announcements', path: '/announcements' },
  { name: 'tabs', path: '/tabs' }
];

// Error handling
export class DiscoveryError extends Error {
  constructor(
    message: string,
    public code: 'API_FAILED' | 'WEB_FAILED' | 'PARSING_FAILED' | 'TIMEOUT' | 'RATE_LIMITED',
    public details?: any
  ) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

// Cache for discovery results
const discoveryCache = new Map<string, CourseContentIndex>();

export function getCachedDiscovery(courseId: string): CourseContentIndex | null {
  const cached = discoveryCache.get(courseId);
  if (!cached) return null;
  
  const now = Date.now();
  const cacheAge = now - cached.lastScanned.getTime();
  
  if (cacheAge > DEFAULT_DISCOVERY_CONFIG.cacheTimeout) {
    discoveryCache.delete(courseId);
    return null;
  }
  
  return cached;
}

export function setCachedDiscovery(courseId: string, index: CourseContentIndex): void {
  discoveryCache.set(courseId, index);
}

export function clearDiscoveryCache(courseId?: string): void {
  if (courseId) {
    discoveryCache.delete(courseId);
  } else {
    discoveryCache.clear();
  }
} 