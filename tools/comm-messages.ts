import { logger } from '../lib/logger.js';

/**
 * Canvas CommMessages API
 * 
 * System-generated notifications from Canvas:
 * - Grade posted notifications
 * - Submission feedback received
 * - Assignment comments
 * - Due date reminders
 * - Course announcements
 * 
 * Use cases:
 * - "What notifications do I have?"
 * - "Show me my Canvas system messages"
 * - "Did I get any grade notifications?"
 * 
 * These are Canvas-generated messages, distinct from:
 * - Account Notifications (admin/campus alerts)
 * - Content Shares (instructor direct shares)
 * - Messages (user-to-user conversations)
 */

export interface CommMessage {
  id: number;
  created_at: string;
  sent_at?: string;
  workflow_state: string;
  from: string;
  from_name?: string;
  to: string;
  reply_to?: string;
  subject: string;
  body?: string;
  body_html?: string;
  notification_name?: string;
  notification_category?: string;
  url?: string;
}

export interface GetCommMessagesParams {
  canvasUrl: string;
  apiToken: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Get system-generated Canvas messages (notifications)
 * 
 * Returns Canvas-generated notifications like grade postings, submission comments, etc.
 */
export async function getCommMessages(params: GetCommMessagesParams): Promise<CommMessage[]> {
  const { canvasUrl, apiToken, startDate, endDate } = params;
  
  logger.info('Fetching comm messages', { startDate, endDate });
  
  try {
    let url = `${canvasUrl}/api/v1/comm_messages`;
    
    // Add query parameters if provided
    const queryParams: string[] = [];
    if (startDate) {
      queryParams.push(`start_time=${encodeURIComponent(startDate)}`);
    }
    if (endDate) {
      queryParams.push(`end_time=${encodeURIComponent(endDate)}`);
    }
    
    if (queryParams.length > 0) {
      url += '?' + queryParams.join('&');
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch comm messages', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      throw new Error(`Failed to fetch comm messages: ${response.status} ${response.statusText}`);
    }

    const messages = await response.json();
    logger.info('Successfully fetched comm messages', { count: messages.length });
    
    return messages;
  } catch (error) {
    logger.error('Error fetching comm messages', { error });
    throw error;
  }
}

/**
 * Format comm messages for display
 */
export function formatCommMessages(messages: CommMessage[]): string {
  if (messages.length === 0) {
    return '📬 No system notifications found. You\'re all caught up!';
  }

  let output = '📬 Canvas System Notifications\n\n';

  // Group by notification category
  const categorized = new Map<string, CommMessage[]>();
  
  messages.forEach(msg => {
    const category = msg.notification_category || 'Other';
    if (!categorized.has(category)) {
      categorized.set(category, []);
    }
    categorized.get(category)!.push(msg);
  });

  // Sort categories by priority
  const priorityOrder = ['Grading', 'Due Date', 'Submission Comment', 'Course Content', 'Other'];
  const sortedCategories = Array.from(categorized.keys()).sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a);
    const bIndex = priorityOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  sortedCategories.forEach(category => {
    const categoryMessages = categorized.get(category)!;
    
    output += `${getCategoryIcon(category)} ${category}\n`;
    output += '─'.repeat(50) + '\n';
    
    categoryMessages.forEach(msg => {
      output += formatSingleMessage(msg);
      output += '\n';
    });
    
    output += '\n';
  });

  return output.trim();
}

/**
 * Format a single comm message
 */
function formatSingleMessage(msg: CommMessage): string {
  let output = `📧 ${msg.subject}\n`;
  
  if (msg.from_name) {
    output += `   👤 From: ${msg.from_name}\n`;
  }
  
  if (msg.notification_name) {
    output += `   🏷️  Type: ${msg.notification_name}\n`;
  }
  
  const sentDate = msg.sent_at || msg.created_at;
  if (sentDate) {
    const date = new Date(sentDate);
    output += `   📅 ${date.toLocaleString()}\n`;
  }
  
  if (msg.body) {
    // Clean up HTML and limit length
    const plainText = msg.body.replace(/<[^>]*>/g, '').trim();
    const preview = plainText.length > 150 
      ? plainText.substring(0, 150) + '...'
      : plainText;
    if (preview) {
      output += `   💬 ${preview}\n`;
    }
  }
  
  if (msg.url) {
    output += `   🔗 ${msg.url}\n`;
  }
  
  output += `   🔑 ID: ${msg.id} | State: ${msg.workflow_state}\n`;
  
  return output;
}

/**
 * Get icon for notification category
 */
function getCategoryIcon(category: string): string {
  const icons: { [key: string]: string } = {
    'Grading': '📊',
    'Due Date': '⏰',
    'Submission Comment': '💬',
    'Course Content': '📚',
    'Announcement': '📢',
    'Calendar': '📅',
    'Discussion': '💭',
    'Other': '📋',
  };
  
  return icons[category] || '📋';
}

/**
 * Format comm messages grouped by date
 */
export function formatCommMessagesByDate(messages: CommMessage[]): string {
  if (messages.length === 0) {
    return '📬 No system notifications found. You\'re all caught up!';
  }

  // Group by date
  const grouped = new Map<string, CommMessage[]>();
  
  messages.forEach(msg => {
    const sentDate = msg.sent_at || msg.created_at;
    if (sentDate) {
      const date = new Date(sentDate);
      const dateKey = date.toLocaleDateString();
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(msg);
    }
  });

  let output = '📬 Canvas System Notifications\n\n';

  // Sort dates (newest first)
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  sortedDates.forEach(dateKey => {
    const dateMessages = grouped.get(dateKey)!;
    
    // Determine if it's today, yesterday, or older
    const messageDate = new Date(dateKey);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateLabel = dateKey;
    if (messageDate.toDateString() === today.toDateString()) {
      dateLabel = '📅 Today';
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      dateLabel = '📅 Yesterday';
    } else {
      dateLabel = `📅 ${dateKey}`;
    }
    
    output += `${dateLabel} (${dateMessages.length} notification${dateMessages.length !== 1 ? 's' : ''})\n`;
    output += '─'.repeat(50) + '\n';
    
    dateMessages.forEach(msg => {
      const icon = getCategoryIcon(msg.notification_category || 'Other');
      output += `${icon} ${msg.subject}`;
      
      if (msg.from_name) {
        output += ` (from ${msg.from_name})`;
      }
      
      output += '\n';
      
      if (msg.notification_name) {
        output += `  Type: ${msg.notification_name}\n`;
      }
    });
    
    output += '\n';
  });

  return output.trim();
}
