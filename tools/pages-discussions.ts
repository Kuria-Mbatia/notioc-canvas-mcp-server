// MCP Tool: Canvas Pages & Discussions
// Adapted from /app/api/canvas-pages/route.ts

import { fetchAllPaginated, CanvasPage, CanvasDiscussion } from '../lib/pagination.js';
import { findBestMatch } from '../lib/search.js';
import { listCourses } from './courses.js';
import { logger } from '../lib/logger.js';
import { parseCanvasUrl, isCanvasUrl, extractPageSlug } from '../lib/url-parser.js';

// Interfaces for Pages functionality
export interface PagesListParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  sort?: 'title' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
  searchTerm?: string;
}

export interface PageInfo {
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface PageContentParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  pageUrl?: string;
  pageId?: string;
  fullUrl?: string; // New: accepts full Canvas URL like https://psu.instructure.com/courses/2422265/pages/l12-overview
  extractLinks?: boolean; // Extract and categorize links from page content
}

export interface PageLink {
  type: 'page' | 'file' | 'assignment' | 'discussion' | 'external' | 'module';
  url: string;
  text: string;
  resourceId?: string;
}

export interface PageContentResult {
  title: string;
  body: string;
  url: string;
  published?: boolean;
  frontPage?: boolean;
  createdAt?: string;
  updatedAt?: string;
  links?: PageLink[];
  editingRoles?: string;
  lockInfo?: {
    locked: boolean;
    explanation?: string;
  };
}

// Interfaces for Discussions/Announcements functionality
export interface DiscussionsListParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  onlyAnnouncements?: boolean;
  orderBy?: 'position' | 'recent_activity' | 'title';
  searchTerm?: string;
}

export interface DiscussionInfo {
  id: string;
  title: string;
  url: string;
  postedAt: string | null;
  lastReplyAt: string | null;
  type: 'discussion' | 'announcement';
}

export interface DiscussionContentParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  discussionId?: string;
  includeReplies?: boolean;
  fullUrl?: string; // New: accepts full Canvas discussion URL
}

// Helper to extract the last part of a URL, which Canvas uses as a page identifier
function extractPageIdentifier(pageUrl: string): string {
  try {
    const url = new URL(pageUrl);
    const pathParts = url.pathname.split('/').filter(part => part);
    return pathParts[pathParts.length - 1];
  } catch (e) {
    // If it's not a full URL, assume it's just the identifier itself
    return pageUrl;
  }
}

/**
 * Extract and categorize links from HTML content
 */
function extractLinksFromHTML(html: string, canvasBaseUrl: string): PageLink[] {
  const links: PageLink[] = [];
  
  // Match all <a> tags with href and text content
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const text = match[2].trim();
    
    // Skip empty links or anchors
    if (!url || url.startsWith('#') || !text) {
      continue;
    }
    
    try {
      const fullUrl = url.startsWith('http') ? url : `${canvasBaseUrl}${url}`;
      const urlObj = new URL(fullUrl);
      const pathname = urlObj.pathname;
      
      // Categorize Canvas links
      if (urlObj.hostname.includes('instructure.com') || urlObj.hostname === new URL(canvasBaseUrl).hostname) {
        if (pathname.includes('/pages/')) {
          const pageId = pathname.split('/pages/')[1]?.split('?')[0];
          links.push({
            type: 'page',
            url: fullUrl,
            text,
            resourceId: pageId
          });
        } else if (pathname.includes('/files/')) {
          const fileId = pathname.match(/\/files\/(\d+)/)?.[1];
          links.push({
            type: 'file',
            url: fullUrl,
            text,
            resourceId: fileId
          });
        } else if (pathname.includes('/assignments/')) {
          const assignmentId = pathname.match(/\/assignments\/(\d+)/)?.[1];
          links.push({
            type: 'assignment',
            url: fullUrl,
            text,
            resourceId: assignmentId
          });
        } else if (pathname.includes('/discussion_topics/')) {
          const discussionId = pathname.match(/\/discussion_topics\/(\d+)/)?.[1];
          links.push({
            type: 'discussion',
            url: fullUrl,
            text,
            resourceId: discussionId
          });
        } else if (pathname.includes('/modules/')) {
          const moduleId = pathname.match(/\/modules\/(\d+)/)?.[1];
          links.push({
            type: 'module',
            url: fullUrl,
            text,
            resourceId: moduleId
          });
        }
      } else {
        // External link
        links.push({
          type: 'external',
          url: fullUrl,
          text
        });
      }
    } catch (e) {
      // Skip invalid URLs
      continue;
    }
  }
  
  return links;
}

/**
 * Convert HTML to more readable markdown-like text
 */
function htmlToReadableText(html: string): string {
  if (!html) return '';
  
  let text = html;
  
  // Convert headers
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n');
  
  // Convert lists
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n');
  text = text.replace(/<\/?[ou]l[^>]*>/gi, '\n');
  
  // Convert paragraphs
  text = text.replace(/<p[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  
  // Convert line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Convert bold/italic
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  
  // Preserve links with their text (links will be extracted separately)
  text = text.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi, '[$2]($1)');
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  
  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  
  return text;
}

/**
 * List pages in a Canvas course with optional search
 */
export async function listPages(params: PagesListParams): Promise<PageInfo[]> {
  let { canvasBaseUrl, accessToken, courseId, courseName, sort = 'updated_at', order = 'desc', searchTerm } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  try {
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find a course with the name "${courseName}".`);
      }
      courseId = matchedCourse.id;
    }
    
    logger.info(`Listing pages for course ${courseId}`);
    
    const queryParams: Record<string, any> = {
      sort,
      order,
      per_page: '100',
    };

    if (searchTerm) {
      queryParams.search_term = searchTerm;
    }

    const pagesData = await fetchAllPaginated<CanvasPage>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/courses/${courseId}/pages`,
      queryParams
    );

    const pages: PageInfo[] = pagesData.map(page => ({
      title: page.title,
      url: page.html_url,
      createdAt: page.created_at,
      updatedAt: page.updated_at,
    }));

    return pages;

  } catch (error) {
    if (error instanceof Error) {
      // Handle specific Canvas API errors gracefully
      if (error.message.includes('404') || error.message.includes('disabled') || error.message.includes('تم تعطيل')) {
        logger.warn(`Pages not available for course ${courseId}: ${error.message}`);
        return []; // Return empty array instead of throwing
      }
      if (error.message.includes('401') || error.message.includes('access token')) {
        throw new Error(`Authentication failed - please check your Canvas access token`);
      }
      if (error.message.includes('403') || error.message.includes('insufficient permissions')) {
        throw new Error(`Access denied - insufficient permissions to view pages for course ${courseId}`);
      }
      throw new Error(`Failed to list pages: ${error.message}`);
    } else {
      throw new Error('Failed to list pages: Unknown error');
    }
  }
}

/**
 * Get the content of a specific page
 */
export async function getPageContent(params: PageContentParams): Promise<PageContentResult> {
  let { canvasBaseUrl, accessToken, courseId, courseName, pageUrl, pageId, fullUrl, extractLinks = true } = params;
  
  // Handle full Canvas URL
  if (fullUrl && isCanvasUrl(fullUrl)) {
    const parsedUrl = parseCanvasUrl(fullUrl);
    if (parsedUrl.courseId) {
      courseId = parsedUrl.courseId;
    }
    if (parsedUrl.pageUrl) {
      pageUrl = parsedUrl.pageUrl;
    }
    if (parsedUrl.baseUrl) {
      canvasBaseUrl = parsedUrl.baseUrl;
    }
  }
  
  if (!pageUrl && !pageId) {
    throw new Error('Either pageUrl, pageId, or fullUrl must be provided.');
  }

  const pageIdentifier = pageId || (pageUrl ? extractPageIdentifier(pageUrl) : '');

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

    const response = await fetch(`${canvasBaseUrl}/api/v1/courses/${courseId}/pages/${pageIdentifier}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Page "${pageIdentifier}" not found in course ${courseId}. This course may not have pages enabled or the page may not exist.`);
      }
      const errorText = await response.text();
      throw new Error(`Failed to get page content: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const pageData: CanvasPage = await response.json();
    
    const result: PageContentResult = {
      title: pageData.title,
      body: htmlToReadableText(pageData.body || ''),
      url: pageData.html_url,
      published: pageData.published,
      frontPage: pageData.front_page,
      createdAt: pageData.created_at,
      updatedAt: pageData.updated_at || undefined,
      editingRoles: pageData.editing_roles,
      lockInfo: pageData.locked_for_user ? {
        locked: true,
        explanation: pageData.lock_explanation
      } : {
        locked: false
      }
    };
    
    // Extract links if requested
    if (extractLinks && pageData.body) {
      result.links = extractLinksFromHTML(pageData.body, canvasBaseUrl);
      logger.info(`Extracted ${result.links.length} links from page "${pageData.title}"`);
    }
    
    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get page content for "${pageIdentifier}": ${error.message}`);
    } else {
      throw new Error(`Failed to get page content for "${pageIdentifier}": Unknown error`);
    }
  }
}

/**
 * List discussion topics or announcements in a Canvas course
 */
export async function listDiscussions(params: DiscussionsListParams): Promise<DiscussionInfo[]> {
  let { canvasBaseUrl, accessToken, courseId, courseName, onlyAnnouncements = false, orderBy = 'recent_activity', searchTerm } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }
  
  try {
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find a course with the name "${courseName}".`);
      }
      courseId = matchedCourse.id;
    }

    logger.info(`Listing ${onlyAnnouncements ? 'announcements' : 'discussions'} for course ${courseId}`);

    const apiPath = onlyAnnouncements
      ? `/api/v1/announcements`
      : `/api/v1/courses/${courseId}/discussion_topics`;

    const queryParams: Record<string, any> = {
      per_page: '100',
      order_by: orderBy,
    };

    if (onlyAnnouncements) {
      queryParams.context_codes = [`course_${courseId}`];
    }
    
    if (searchTerm) {
      queryParams.search_term = searchTerm;
    }
    
    const discussionsData = await fetchAllPaginated<CanvasDiscussion>(
      canvasBaseUrl,
      accessToken,
      apiPath,
      queryParams
    );

    const discussions: DiscussionInfo[] = discussionsData.map(d => ({
      id: String(d.id),
      title: d.title,
      url: d.html_url,
      postedAt: d.posted_at,
      lastReplyAt: d.last_reply_at,
      type: d.discussion_type === 'side_comment' ? 'discussion' : 'announcement'
    }));
    
    return discussions;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to list discussions: ${error.message}`);
    } else {
      throw new Error('Failed to list discussions: Unknown error');
    }
  }
}

/**
 * Get the content of a specific discussion topic
 */
export async function getDiscussionContent(params: DiscussionContentParams): Promise<{ title: string; message: string; url: string; replies?: any[] }> {
  let { canvasBaseUrl, accessToken, courseId, courseName, discussionId, includeReplies = true, fullUrl } = params;
  
  // Handle full Canvas URL
  if (fullUrl && isCanvasUrl(fullUrl)) {
    const parsedUrl = parseCanvasUrl(fullUrl);
    if (parsedUrl.courseId) {
      courseId = parsedUrl.courseId;
    }
    if (parsedUrl.discussionId) {
      discussionId = parsedUrl.discussionId;
    }
    if (parsedUrl.baseUrl) {
      canvasBaseUrl = parsedUrl.baseUrl;
    }
  }
  
  if (!discussionId) {
    throw new Error('Either discussionId or fullUrl must be provided.');
  }
  
  try {
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
    
    const apiPath = `/api/v1/courses/${courseId}/discussion_topics/${discussionId}`;
    const queryParams: Record<string, any> = {};
    if (includeReplies) {
      queryParams.include = ['all_dates', 'sections', 'sections_user_count', 'overrides'];
    }

    const response = await fetch(`${canvasBaseUrl}${apiPath}?${new URLSearchParams(queryParams)}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get discussion content: ${response.status} ${response.statusText}`);
    }
    
    const discussionData = await response.json();

    const result: { title: string; message: string; url: string; replies?: any[] } = {
      title: discussionData.title,
      message: discussionData.message,
      url: discussionData.html_url,
    };
    
    // Try to get replies using the discussion entries API
    if (includeReplies) {
      try {
        const entriesResponse = await fetch(`${canvasBaseUrl}/api/v1/courses/${courseId}/discussion_topics/${discussionId}/entries?per_page=100`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (entriesResponse.ok) {
          const entries = await entriesResponse.json();
          result.replies = entries;
        }
      } catch (error) {
        // If entries fetch fails, continue without replies
        logger.info(`Could not fetch discussion entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return result;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get discussion content for topic ${discussionId}: ${error.message}`);
    } else {
      throw new Error(`Failed to get discussion content for topic ${discussionId}: Unknown error`);
    }
  }
}
