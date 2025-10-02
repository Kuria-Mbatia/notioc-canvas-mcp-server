import { logger } from '../lib/logger.js';

/**
 * Canvas History API
 * 
 * Tracks recently viewed Canvas pages for the current user.
 * 
 * Use cases:
 * - "What was that assignment I looked at yesterday?"
 * - "Find the page I visited this morning"
 * - "Show me my recent Canvas activity"
 * - "What have I been working on lately?"
 * 
 * Critical for rediscovering pages without remembering exact titles or locations.
 */

export interface HistoryEntry {
  asset_code: string;
  asset_name?: string;
  asset_icon?: string;
  asset_readable_category?: string;
  context_type?: string;
  context_id?: number;
  context_name?: string;
  visited_url?: string;
  visited_at?: string;
  interaction_seconds?: number;
}

export interface GetHistoryParams {
  canvasUrl: string;
  apiToken: string;
}

/**
 * Get recently viewed Canvas pages
 * 
 * Returns the user's history of page views across Canvas.
 * Useful for "What was I looking at earlier?" queries.
 */
export async function getRecentHistory(params: GetHistoryParams): Promise<HistoryEntry[]> {
  const { canvasUrl, apiToken } = params;
  
  logger.info('Fetching user history');
  
  try {
    const url = `${canvasUrl}/api/v1/users/self/history`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch history', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      });
      throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
    }

    const history = await response.json();
    logger.info('Successfully fetched history', { count: history.length });
    
    return history;
  } catch (error) {
    logger.error('Error fetching history', { error });
    throw error;
  }
}

/**
 * Format history entries for display
 */
export function formatHistory(history: HistoryEntry[]): string {
  if (history.length === 0) {
    return '📜 No recent history found. Start browsing Canvas to build your history!';
  }

  let output = '📜 Your Recent Canvas History\n\n';

  history.forEach((entry, index) => {
    // Determine icon based on category
    let icon = '📄';
    if (entry.asset_readable_category) {
      const category = entry.asset_readable_category.toLowerCase();
      if (category.includes('assignment')) icon = '📝';
      else if (category.includes('discussion')) icon = '💬';
      else if (category.includes('quiz')) icon = '📋';
      else if (category.includes('page')) icon = '📄';
      else if (category.includes('file')) icon = '📁';
      else if (category.includes('announcement')) icon = '📢';
      else if (category.includes('module')) icon = '📚';
    }

    output += `${index + 1}. ${icon} ${entry.asset_name || entry.asset_code}\n`;
    
    if (entry.context_name) {
      output += `   📚 Course: ${entry.context_name}\n`;
    }
    
    if (entry.asset_readable_category) {
      output += `   🏷️  Type: ${entry.asset_readable_category}\n`;
    }
    
    if (entry.visited_at) {
      const visitDate = new Date(entry.visited_at);
      output += `   🕐 Visited: ${visitDate.toLocaleString()}\n`;
    }
    
    if (entry.interaction_seconds !== undefined && entry.interaction_seconds > 0) {
      const minutes = Math.floor(entry.interaction_seconds / 60);
      const seconds = entry.interaction_seconds % 60;
      if (minutes > 0) {
        output += `   ⏱️  Time spent: ${minutes}m ${seconds}s\n`;
      } else {
        output += `   ⏱️  Time spent: ${seconds}s\n`;
      }
    }
    
    if (entry.visited_url) {
      output += `   🔗 ${entry.visited_url}\n`;
    }
    
    output += '\n';
  });

  return output.trim();
}

/**
 * Format history with grouping by date
 */
export function formatHistoryByDate(history: HistoryEntry[]): string {
  if (history.length === 0) {
    return '📜 No recent history found. Start browsing Canvas to build your history!';
  }

  // Group by date
  const grouped = new Map<string, HistoryEntry[]>();
  
  history.forEach(entry => {
    if (entry.visited_at) {
      const date = new Date(entry.visited_at);
      const dateKey = date.toLocaleDateString();
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(entry);
    }
  });

  let output = '📜 Your Recent Canvas History\n\n';

  // Sort dates (newest first)
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  sortedDates.forEach(dateKey => {
    const entries = grouped.get(dateKey)!;
    
    // Determine if it's today, yesterday, or older
    const entryDate = new Date(dateKey);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateLabel = dateKey;
    if (entryDate.toDateString() === today.toDateString()) {
      dateLabel = '📅 Today';
    } else if (entryDate.toDateString() === yesterday.toDateString()) {
      dateLabel = '📅 Yesterday';
    } else {
      dateLabel = `📅 ${dateKey}`;
    }
    
    output += `${dateLabel}\n`;
    output += '─'.repeat(50) + '\n';
    
    entries.forEach(entry => {
      let icon = '📄';
      if (entry.asset_readable_category) {
        const category = entry.asset_readable_category.toLowerCase();
        if (category.includes('assignment')) icon = '📝';
        else if (category.includes('discussion')) icon = '💬';
        else if (category.includes('quiz')) icon = '📋';
        else if (category.includes('page')) icon = '📄';
        else if (category.includes('file')) icon = '📁';
        else if (category.includes('announcement')) icon = '📢';
      }

      const time = entry.visited_at ? new Date(entry.visited_at).toLocaleTimeString() : '';
      output += `${icon} ${entry.asset_name || entry.asset_code}`;
      
      if (time) {
        output += ` (${time})`;
      }
      
      output += '\n';
      
      if (entry.context_name) {
        output += `  Course: ${entry.context_name}\n`;
      }
    });
    
    output += '\n';
  });

  return output.trim();
}
