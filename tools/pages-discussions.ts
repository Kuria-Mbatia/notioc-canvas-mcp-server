// MCP Tool: Canvas Pages and Discussions Retrieval
// Supports listing and retrieving content from Canvas pages and discussions

import { callCanvasAPI } from '../lib/canvas-api.js';
import { logger } from '../lib/logger.js';

// Interfaces for Pages functionality
export interface PagesListParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  sort?: 'title' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
  searchTerm?: string;
}

export interface PageContentParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  pageUrl?: string; // URL or title of the page from the URL
  pageId?: string; // Direct page ID if available
}

export interface PageInfo {
  pageId: string;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  editedBy?: { id: string; displayName: string };
  similarity?: number; // For search results
}

export interface PageContentResult {
  title: string;
  body: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  editedBy?: { id: string; displayName: string };
  error?: string;
}

// Interfaces for Discussions functionality
export interface DiscussionsListParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  onlyAnnouncements?: boolean;
  orderBy?: 'position' | 'recent_activity' | 'title';
  searchTerm?: string;
}

export interface DiscussionContentParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  discussionId: string;
  includeReplies?: boolean;
}

export interface DiscussionInfo {
  id: string;
  title: string;
  message: string; // This contains the main post HTML
  postedAt: string;
  userId: string;
  isAnnouncement: boolean;
  isLocked: boolean;
  url: string;
  similarity?: number; // For search results
}

export interface DiscussionContentResult {
  id: string;
  title: string;
  message: string; // This contains the main post HTML
  postedAt: string;
  author?: { id: string; displayName: string };
  replies?: DiscussionReply[];
  isAnnouncement: boolean;
  isLocked: boolean;
  url: string;
  error?: string;
}

export interface DiscussionReply {
  id: string;
  message: string;
  postedAt: string;
  userId: string;
  userDisplayName?: string;
}

// Similarity scoring function for search
function calculateSimilarity(searchTerm: string, text: string): number {
  if (!searchTerm || !text) return 0;
  
  const search = searchTerm.toLowerCase();
  const target = text.toLowerCase();
  
  // Exact match
  if (target === search) return 1.0;
  
  // Contains search term
  if (target.includes(search)) return 0.8;
  
  // Word-based matching
  const searchWords = search.split(/\\s+/);
  const targetWords = target.split(/[\\s._-]+/);
  
  let matchingWords = 0;
  for (const searchWord of searchWords) {
    for (const targetWord of targetWords) {
      if (targetWord.includes(searchWord) || searchWord.includes(targetWord)) {
        matchingWords++;
        break;
      }
    }
  }
  
  return matchingWords / searchWords.length * 0.6;
}

// Converts HTML to plain text with basic formatting preserved
function htmlToText(html: string): string {
  if (!html) return '';
  
  // Replace <br>, <p>, <div> with newlines
  let text = html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n');
  
  // Replace <strong>, <b> with **
  text = text.replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, '**$2**');
  
  // Replace <em>, <i> with *
  text = text.replace(/<(em|i)>(.*?)<\/(em|i)>/gi, '*$2*');
  
  // Handle lists
  text = text.replace(/<li>(.*?)(<\/li>|$)/gi, '• $1');
  
  // Remove all other tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Handle HTML entities
  text = text.replace(/&nbsp;/gi, ' ')
             .replace(/&amp;/gi, '&')
             .replace(/&lt;/gi, '<')
             .replace(/&gt;/gi, '>')
             .replace(/&quot;/gi, '"')
             .replace(/&#39;/gi, "'");
  
  // Fix multiple newlines
  text = text.replace(/\\n\\s*\\n\\s*\\n/g, '\n\n');
  
  return text.trim();
}

// Helper to extract page URL/ID from a Canvas page URL or title
function extractPageIdentifier(pageUrl: string): string {
  // Format can be full URL or just the last part
  // https://psu.instructure.com/courses/2382301/pages/self-reflective-memo-prompt
  // or just 'self-reflective-memo-prompt'
  
  const urlParts = pageUrl.split('/');
  return urlParts[urlParts.length - 1];
}

/**
 * List pages in a Canvas course with optional search
 */
export async function listPages(params: PagesListParams): Promise<PageInfo[]> {
  const { canvasBaseUrl, accessToken, courseId, sort = 'updated_at', order = 'desc', searchTerm } = params;

  if (!canvasBaseUrl || !accessToken || !courseId) {
    throw new Error('Missing required parameters for listing pages');
  }

  try {
    logger.info(`Listing pages for course ${courseId}`);
    
    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: `/api/v1/courses/${courseId}/pages`,
      params: {
        sort_by: sort,
        order,
        per_page: '100'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list pages: ${response.status} ${response.statusText}`);
    }

    const pagesData = await response.json();
    logger.info(`Retrieved ${pagesData.length} pages from course`);

    // Map to PageInfo objects
    let pages: PageInfo[] = pagesData.map((page: any) => ({
      pageId: page.url, // Canvas uses the URL as the ID for pages
      title: page.title || '',
      url: page.html_url || '',
      createdAt: page.created_at || '',
      updatedAt: page.updated_at || '',
      editedBy: page.last_edited_by ? {
        id: String(page.last_edited_by.id),
        displayName: page.last_edited_by.display_name || '',
      } : undefined
    }));

    // Apply search filtering if requested
    if (searchTerm) {
      pages = pages
        .map(page => ({
          ...page,
          similarity: Math.max(
            calculateSimilarity(searchTerm, page.title),
            calculateSimilarity(searchTerm, page.url)
          ),
        }))
        .filter(page => page.similarity && page.similarity > 0.1)
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    }

    return pages;
  } catch (error) {
    logger.error('Error listing Canvas pages:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to list pages: ${error.message}`);
    } else {
      throw new Error('Failed to list pages: Unknown error');
    }
  }
}

/**
 * Get content of a specific Canvas page
 */
export async function getPageContent(params: PageContentParams): Promise<PageContentResult> {
  const { canvasBaseUrl, accessToken, courseId, pageUrl, pageId } = params;

  if (!canvasBaseUrl || !accessToken || !courseId) {
    return {
      title: '',
      body: '',
      url: '',
      createdAt: '',
      updatedAt: '',
      error: 'Missing required parameters',
    };
  }

  if (!pageUrl && !pageId) {
    return {
      title: '',
      body: '',
      url: '',
      createdAt: '',
      updatedAt: '',
      error: 'Either pageUrl or pageId must be provided',
    };
  }

  try {
    const identifier = pageId || extractPageIdentifier(pageUrl || '');
    logger.info(`Getting page content for '${identifier}' in course ${courseId}`);

    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: `/api/v1/courses/${courseId}/pages/${identifier}`,
    });

    if (!response.ok) {
      throw new Error(`Failed to get page content: ${response.status} ${response.statusText}`);
    }

    const pageData = await response.json();
    logger.info(`Successfully retrieved page content for "${pageData.title}"`);

    return {
      title: pageData.title || '',
      body: pageData.body || '',
      url: pageData.html_url || '',
      createdAt: pageData.created_at || '',
      updatedAt: pageData.updated_at || '',
      editedBy: pageData.last_edited_by ? {
        id: String(pageData.last_edited_by.id),
        displayName: pageData.last_edited_by.display_name || '',
      } : undefined
    };
  } catch (error) {
    logger.error('Error getting Canvas page content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      title: pageUrl || pageId || 'unknown',
      body: '',
      url: '',
      createdAt: '',
      updatedAt: '',
      error: errorMessage,
    };
  }
}

/**
 * List discussion topics in a Canvas course with optional search
 */
export async function listDiscussions(params: DiscussionsListParams): Promise<DiscussionInfo[]> {
  const { canvasBaseUrl, accessToken, courseId, onlyAnnouncements = false, orderBy = 'recent_activity', searchTerm } = params;

  if (!canvasBaseUrl || !accessToken || !courseId) {
    throw new Error('Missing required parameters for listing discussions');
  }

  try {
    logger.info(`Listing ${onlyAnnouncements ? 'announcements' : 'discussions'} for course ${courseId}`);
    
    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: `/api/v1/courses/${courseId}/discussion_topics`,
      params: {
        order_by: orderBy,
        only_announcements: onlyAnnouncements ? 'true' : 'false',
        per_page: '100'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list discussions: ${response.status} ${response.statusText}`);
    }

    const discussionsData = await response.json();
    logger.info(`Retrieved ${discussionsData.length} discussion topics from course`);

    // Map to DiscussionInfo objects
    let discussions: DiscussionInfo[] = discussionsData.map((discussion: any) => ({
      id: String(discussion.id),
      title: discussion.title || '',
      message: discussion.message || '',
      postedAt: discussion.posted_at || '',
      userId: String(discussion.user_id) || '',
      isAnnouncement: !!discussion.is_announcement,
      isLocked: !!discussion.locked,
      url: discussion.html_url || '',
    }));

    // Apply search filtering if requested
    if (searchTerm) {
      discussions = discussions
        .map(discussion => ({
          ...discussion,
          similarity: Math.max(
            calculateSimilarity(searchTerm, discussion.title),
            calculateSimilarity(searchTerm, htmlToText(discussion.message))
          ),
        }))
        .filter(discussion => discussion.similarity && discussion.similarity > 0.1)
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    }

    return discussions;
  } catch (error) {
    logger.error('Error listing Canvas discussions:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to list discussions: ${error.message}`);
    } else {
      throw new Error('Failed to list discussions: Unknown error');
    }
  }
}

/**
 * Get content of a specific discussion topic with optional replies
 */
export async function getDiscussionContent(params: DiscussionContentParams): Promise<DiscussionContentResult> {
  const { canvasBaseUrl, accessToken, courseId, discussionId, includeReplies = true } = params;

  if (!canvasBaseUrl || !accessToken || !courseId || !discussionId) {
    return {
      id: '',
      title: '',
      message: '',
      postedAt: '',
      isAnnouncement: false,
      isLocked: false,
      url: '',
      error: 'Missing required parameters',
    };
  }

  try {
    logger.info(`Getting discussion content for ID ${discussionId} in course ${courseId}`);

    // First, get the discussion topic
    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: `/api/v1/courses/${courseId}/discussion_topics/${discussionId}`,
    });

    if (!response.ok) {
      throw new Error(`Failed to get discussion topic: ${response.status} ${response.statusText}`);
    }

    const discussionData = await response.json();
    logger.info(`Successfully retrieved discussion "${discussionData.title}"`);

    const result: DiscussionContentResult = {
      id: String(discussionData.id),
      title: discussionData.title || '',
      message: discussionData.message || '',
      postedAt: discussionData.posted_at || '',
      author: discussionData.author ? {
        id: String(discussionData.author.id),
        displayName: discussionData.author.display_name || '',
      } : undefined,
      isAnnouncement: !!discussionData.is_announcement,
      isLocked: !!discussionData.locked,
      url: discussionData.html_url || '',
      replies: [],
    };

    // Get replies if requested
    if (includeReplies && discussionData.id) {
      try {
        const repliesResponse = await callCanvasAPI({
          canvasBaseUrl,
          accessToken,
          method: 'GET',
          apiPath: `/api/v1/courses/${courseId}/discussion_topics/${discussionId}/entries`,
        });

        if (repliesResponse.ok) {
          const repliesData = await repliesResponse.json();
          result.replies = repliesData.map((reply: any) => ({
            id: String(reply.id),
            message: reply.message || '',
            postedAt: reply.created_at || '',
            userId: String(reply.user_id) || '',
            userDisplayName: reply.user_name || '',
          }));
          logger.info(`Retrieved ${result.replies?.length || 0} replies for discussion`);
        }
      } catch (repliesError) {
        logger.warn('Failed to retrieve discussion replies:', repliesError);
        // This is non-fatal - we'll just return the main discussion without replies
      }
    }

    return result;
  } catch (error) {
    logger.error('Error getting Canvas discussion content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      id: discussionId,
      title: '',
      message: '',
      postedAt: '',
      isAnnouncement: false,
      isLocked: false,
      url: '',
      error: errorMessage,
    };
  }
}
