import { logger } from '../lib/logger.js';

/**
 * Canvas Bookmarks API
 * 
 * Students use bookmarks to save important Canvas URLs:
 * - Specific discussion threads they need to revisit
 * - Study resources shared by instructors
 * - Important assignment pages
 * - Useful external links shared in Canvas
 * 
 * Use cases:
 * - "Show me that study guide I bookmarked"
 * - "Find the discussion thread about the midterm"
 * - "What resources have I saved?"
 */

export interface Bookmark {
  id: number;
  name: string;
  url: string;
  position?: number;
  data?: {
    active_tab?: number;
  };
}

export interface GetBookmarksParams {
  canvasUrl: string;
  apiToken: string;
}

export interface GetBookmarkParams {
  canvasUrl: string;
  apiToken: string;
  bookmarkId: string;
}

export interface CreateBookmarkParams {
  canvasUrl: string;
  apiToken: string;
  name: string;
  url: string;
  position?: number;
  data?: {
    active_tab?: number;
  };
}

export interface UpdateBookmarkParams {
  canvasUrl: string;
  apiToken: string;
  bookmarkId: string;
  name?: string;
  url?: string;
  position?: number;
  data?: {
    active_tab?: number;
  };
}

export interface DeleteBookmarkParams {
  canvasUrl: string;
  apiToken: string;
  bookmarkId: string;
}

/**
 * Get all bookmarks for the current user
 */
export async function getBookmarks(params: GetBookmarksParams): Promise<Bookmark[]> {
  const { canvasUrl, apiToken } = params;
  
  logger.info('Fetching user bookmarks');
  
  try {
    const url = `${canvasUrl}/api/v1/users/self/bookmarks`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch bookmarks', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      throw new Error(`Failed to fetch bookmarks: ${response.status} ${response.statusText}`);
    }

    const bookmarks = await response.json();
    logger.info('Successfully fetched bookmarks', { count: bookmarks.length });
    
    return bookmarks;
  } catch (error) {
    logger.error('Error fetching bookmarks', { error });
    throw error;
  }
}

/**
 * Get a specific bookmark by ID
 */
export async function getBookmark(params: GetBookmarkParams): Promise<Bookmark> {
  const { canvasUrl, apiToken, bookmarkId } = params;
  
  logger.info('Fetching bookmark', { bookmarkId });
  
  try {
    const url = `${canvasUrl}/api/v1/users/self/bookmarks/${bookmarkId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch bookmark', { 
        bookmarkId,
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      throw new Error(`Failed to fetch bookmark: ${response.status} ${response.statusText}`);
    }

    const bookmark = await response.json();
    logger.info('Successfully fetched bookmark', { bookmarkId });
    
    return bookmark;
  } catch (error) {
    logger.error('Error fetching bookmark', { bookmarkId, error });
    throw error;
  }
}

/**
 * Create a new bookmark
 */
export async function createBookmark(params: CreateBookmarkParams): Promise<Bookmark> {
  const { canvasUrl, apiToken, name, url, position, data } = params;
  
  logger.info('Creating bookmark', { name, url });
  
  try {
    const apiUrl = `${canvasUrl}/api/v1/users/self/bookmarks`;
    
    const body: any = {
      name,
      url,
    };
    
    if (position !== undefined) {
      body.position = position;
    }
    
    if (data !== undefined) {
      body.data = data;
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to create bookmark', { 
        name,
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      throw new Error(`Failed to create bookmark: ${response.status} ${response.statusText}`);
    }

    const bookmark = await response.json();
    logger.info('Successfully created bookmark', { bookmarkId: bookmark.id, name });
    
    return bookmark;
  } catch (error) {
    logger.error('Error creating bookmark', { name, error });
    throw error;
  }
}

/**
 * Update an existing bookmark
 */
export async function updateBookmark(params: UpdateBookmarkParams): Promise<Bookmark> {
  const { canvasUrl, apiToken, bookmarkId, name, url, position, data } = params;
  
  logger.info('Updating bookmark', { bookmarkId });
  
  try {
    const apiUrl = `${canvasUrl}/api/v1/users/self/bookmarks/${bookmarkId}`;
    
    const body: any = {};
    
    if (name !== undefined) {
      body.name = name;
    }
    
    if (url !== undefined) {
      body.url = url;
    }
    
    if (position !== undefined) {
      body.position = position;
    }
    
    if (data !== undefined) {
      body.data = data;
    }
    
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to update bookmark', { 
        bookmarkId,
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      throw new Error(`Failed to update bookmark: ${response.status} ${response.statusText}`);
    }

    const bookmark = await response.json();
    logger.info('Successfully updated bookmark', { bookmarkId });
    
    return bookmark;
  } catch (error) {
    logger.error('Error updating bookmark', { bookmarkId, error });
    throw error;
  }
}

/**
 * Delete a bookmark
 */
export async function deleteBookmark(params: DeleteBookmarkParams): Promise<void> {
  const { canvasUrl, apiToken, bookmarkId } = params;
  
  logger.info('Deleting bookmark', { bookmarkId });
  
  try {
    const url = `${canvasUrl}/api/v1/users/self/bookmarks/${bookmarkId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to delete bookmark', { 
        bookmarkId,
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      throw new Error(`Failed to delete bookmark: ${response.status} ${response.statusText}`);
    }

    logger.info('Successfully deleted bookmark', { bookmarkId });
  } catch (error) {
    logger.error('Error deleting bookmark', { bookmarkId, error });
    throw error;
  }
}

/**
 * Format bookmarks for display
 */
export function formatBookmarks(bookmarks: Bookmark[]): string {
  if (bookmarks.length === 0) {
    return '📑 No bookmarks found. Save important Canvas resources with create_bookmark!';
  }

  let output = '📑 Your Canvas Bookmarks\n\n';

  bookmarks.forEach((bookmark, index) => {
    output += `${index + 1}. ${bookmark.name}\n`;
    output += `   🔗 ${bookmark.url}\n`;
    output += `   ID: ${bookmark.id}`;
    
    if (bookmark.position !== undefined) {
      output += ` | Position: ${bookmark.position}`;
    }
    
    output += '\n\n';
  });

  return output.trim();
}

/**
 * Format a single bookmark for display
 */
export function formatBookmark(bookmark: Bookmark): string {
  let output = '📑 Bookmark Details\n\n';
  output += `Name: ${bookmark.name}\n`;
  output += `URL: ${bookmark.url}\n`;
  output += `ID: ${bookmark.id}\n`;
  
  if (bookmark.position !== undefined) {
    output += `Position: ${bookmark.position}\n`;
  }
  
  if (bookmark.data?.active_tab !== undefined) {
    output += `Active Tab: ${bookmark.data.active_tab}\n`;
  }
  
  return output;
}
