import { logger } from '../lib/logger.js';

/**
 * Canvas Content Shares API
 * 
 * Instructors can share content directly with students (or students with each other).
 * This is different from course content - it's personal shares.
 * 
 * Use cases:
 * - "Did my professor share anything with me?"
 * - "Show me resources my instructor sent me"
 * - "What content has been shared with me?"
 * 
 * Critical for discovering resources instructors share outside regular course materials.
 */

export interface ContentShare {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: number;
  sender?: {
    id: number;
    display_name: string;
    avatar_image_url?: string;
    html_url?: string;
  };
  receivers?: Array<{
    id: number;
    display_name: string;
    avatar_image_url?: string;
    html_url?: string;
  }>;
  content_type?: string;
  content_export?: {
    id: number;
    created_at: string;
    export_type: string;
  };
  read_state?: string;
  message?: string;
}

export interface GetContentSharesParams {
  canvasUrl: string;
  apiToken: string;
}

/**
 * Get content shares received by the current user
 * 
 * Returns content that has been shared directly with the user by instructors or peers.
 */
export async function getReceivedContentShares(params: GetContentSharesParams): Promise<ContentShare[]> {
  const { canvasUrl, apiToken } = params;
  
  logger.info('Fetching received content shares');
  
  try {
    const url = `${canvasUrl}/api/v1/users/self/content_shares/received`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch content shares', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      throw new Error(`Failed to fetch content shares: ${response.status} ${response.statusText}`);
    }

    const shares = await response.json();
    logger.info('Successfully fetched content shares', { count: shares.length });
    
    return shares;
  } catch (error) {
    logger.error('Error fetching content shares', { error });
    throw error;
  }
}

/**
 * Format content shares for display
 */
export function formatContentShares(shares: ContentShare[]): string {
  if (shares.length === 0) {
    return '📤 No content shares found. Your instructors haven\'t shared anything directly with you yet.';
  }

  let output = '📤 Content Shared With You\n\n';

  // Separate unread and read shares
  const unreadShares = shares.filter(s => s.read_state === 'unread');
  const readShares = shares.filter(s => s.read_state !== 'unread');

  if (unreadShares.length > 0) {
    output += '🆕 Unread Shares\n';
    output += '─'.repeat(50) + '\n';
    
    unreadShares.forEach((share, index) => {
      output += formatSingleShare(share, index + 1);
      output += '\n';
    });
  }

  if (readShares.length > 0) {
    if (unreadShares.length > 0) {
      output += '\n';
    }
    output += '📖 Previously Read Shares\n';
    output += '─'.repeat(50) + '\n';
    
    readShares.forEach((share, index) => {
      output += formatSingleShare(share, index + 1);
      output += '\n';
    });
  }

  return output.trim();
}

/**
 * Format a single content share
 */
function formatSingleShare(share: ContentShare, index: number): string {
  let output = `${index}. ${share.name}`;
  
  if (share.read_state === 'unread') {
    output += ' 🆕';
  }
  
  output += '\n';
  
  if (share.sender) {
    output += `   👤 From: ${share.sender.display_name}\n`;
  }
  
  if (share.content_type) {
    const typeLabel = formatContentType(share.content_type);
    output += `   📋 Type: ${typeLabel}\n`;
  }
  
  if (share.message) {
    output += `   💬 Message: ${share.message}\n`;
  }
  
  const sharedDate = new Date(share.created_at);
  output += `   📅 Shared: ${sharedDate.toLocaleString()}\n`;
  
  output += `   🔑 ID: ${share.id}\n`;
  
  return output;
}

/**
 * Format content type for display
 */
function formatContentType(contentType: string): string {
  const types: { [key: string]: string } = {
    'assignment': '📝 Assignment',
    'discussion_topic': '💬 Discussion',
    'page': '📄 Page',
    'quiz': '📋 Quiz',
    'module': '📚 Module',
    'module_item': '📌 Module Item',
    'attachment': '📎 File/Attachment',
  };
  
  return types[contentType] || contentType;
}

/**
 * Get count of unread content shares
 */
export async function getUnreadContentSharesCount(params: GetContentSharesParams): Promise<number> {
  const { canvasUrl, apiToken } = params;
  
  logger.info('Fetching unread content shares count');
  
  try {
    const url = `${canvasUrl}/api/v1/users/self/content_shares/unread_count`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch unread count', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      throw new Error(`Failed to fetch unread count: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const count = result.unread_count || 0;
    
    logger.info('Successfully fetched unread content shares count', { count });
    
    return count;
  } catch (error) {
    logger.error('Error fetching unread content shares count', { error });
    throw error;
  }
}

/**
 * Format content shares with unread count summary
 */
export async function formatContentSharesWithCount(
  shares: ContentShare[], 
  params: GetContentSharesParams
): Promise<string> {
  const unreadCount = await getUnreadContentSharesCount(params);
  
  let output = '📤 Content Shared With You\n\n';
  
  if (unreadCount > 0) {
    output += `🆕 You have ${unreadCount} unread share${unreadCount !== 1 ? 's' : ''}\n\n`;
  } else {
    output += '✅ All shares have been read\n\n';
  }
  
  output += formatContentShares(shares);
  
  return output;
}
