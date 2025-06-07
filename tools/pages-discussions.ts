// MCP Tool: Canvas Pages & Discussions
// Adapted from /app/api/canvas-pages/route.ts

import { fetchAllPaginated, CanvasPage, CanvasDiscussion } from '../lib/pagination.js';
import { findBestMatch } from '../lib/search.js';
import { listCourses } from './courses.js';
import { logger } from '../lib/logger.js';

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
  courseId: string;
  pageUrl?: string;
  pageId?: string;
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
  courseId: string;
  discussionId: string;
  includeReplies?: boolean;
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
      throw new Error(`Failed to list pages: ${error.message}`);
    } else {
      throw new Error('Failed to list pages: Unknown error');
    }
  }
}

/**
 * Get the content of a specific page
 */
export async function getPageContent(params: PageContentParams): Promise<{ title: string; body: string, url: string }> {
  const { canvasBaseUrl, accessToken, courseId, pageUrl, pageId } = params;
  
  if (!pageUrl && !pageId) {
    throw new Error('Either pageUrl or pageId must be provided.');
  }

  const pageIdentifier = pageId || (pageUrl ? extractPageIdentifier(pageUrl) : '');

  try {
    const response = await fetch(`${canvasBaseUrl}/api/v1/courses/${courseId}/pages/${pageIdentifier}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get page content: ${response.status} ${response.statusText}`);
    }

    const pageData: CanvasPage = await response.json();
    
    return {
      title: pageData.title,
      body: pageData.body || '',
      url: pageData.html_url,
    };
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
  const { canvasBaseUrl, accessToken, courseId, discussionId, includeReplies = true } = params;
  
  try {
    const apiPath = `/api/v1/courses/${courseId}/discussion_topics/${discussionId}`;
    const queryParams: Record<string, any> = {};
    if (includeReplies) {
      queryParams.include = ['view'];
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
    
    if (includeReplies && discussionData.view) {
      // The view contains a tree of replies. We can process this if needed.
      // For now, just indicate that replies are included.
      result.replies = discussionData.view;
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
