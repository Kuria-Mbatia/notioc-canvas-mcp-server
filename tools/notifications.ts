// MCP Tool: Account Notifications
// Expose Canvas's global notification system (campus alerts, emergencies, policy changes)

import { logger } from '../lib/logger.js';
import { fetchAllPaginated } from '../lib/pagination.js';

export interface AccountNotification {
  id: number;
  subject: string;
  message: string;
  start_at: string;
  end_at: string;
  icon: 'warning' | 'information' | 'question' | 'error' | 'calendar';
  roles?: string[];
  account_notification_id?: number;
}

export interface GetNotificationsParams {
  canvasBaseUrl: string;
  accessToken: string;
}

/**
 * Get active account-level notifications for the current user
 * These are system-wide alerts like campus closures, emergencies, policy changes
 */
export async function getAccountNotifications(params: GetNotificationsParams): Promise<AccountNotification[]> {
  const { canvasBaseUrl, accessToken } = params;

  try {
    logger.info('[Notifications] Fetching account notifications for user');

    // Get user's account ID first (notifications are per-account)
    const userResponse = await fetch(`${canvasBaseUrl}/api/v1/users/self`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user info: ${userResponse.statusText}`);
    }

    const user = await userResponse.json();
    const accountId = user.primary_account_id || user.root_account_id || 'self';

    logger.debug(`[Notifications] Using account ID: ${accountId}`);

    // Fetch active notifications for this account
    const url = `${canvasBaseUrl}/api/v1/accounts/${accountId}/account_notifications`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.info('[Notifications] No notifications endpoint available (may not have permission)');
        return [];
      }
      throw new Error(`Failed to fetch notifications: ${response.statusText}`);
    }

    const notifications: AccountNotification[] = await response.json();

    logger.info(`[Notifications] Retrieved ${notifications.length} active notifications`);

    // Filter to currently active notifications (Canvas should do this, but double-check)
    const now = new Date();
    const activeNotifications = notifications.filter(n => {
      const startAt = n.start_at ? new Date(n.start_at) : null;
      const endAt = n.end_at ? new Date(n.end_at) : null;

      const isActive = (!startAt || startAt <= now) && (!endAt || endAt >= now);
      return isActive;
    });

    logger.info(`[Notifications] ${activeNotifications.length} notifications currently active`);

    return activeNotifications;

  } catch (error) {
    logger.error('[Notifications] Error fetching account notifications:', error);
    throw error;
  }
}

/**
 * Dismiss/close a notification for the current user
 */
export async function dismissNotification(params: {
  canvasBaseUrl: string;
  accessToken: string;
  accountId: string | number;
  notificationId: string | number;
}): Promise<void> {
  const { canvasBaseUrl, accessToken, accountId, notificationId } = params;

  try {
    logger.info(`[Notifications] Dismissing notification ${notificationId}`);

    const url = `${canvasBaseUrl}/api/v1/accounts/${accountId}/account_notifications/${notificationId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to dismiss notification: ${response.statusText}`);
    }

    logger.info(`[Notifications] Successfully dismissed notification ${notificationId}`);

  } catch (error) {
    logger.error('[Notifications] Error dismissing notification:', error);
    throw error;
  }
}

/**
 * Format notifications for display
 */
export function formatNotifications(notifications: AccountNotification[]): string {
  if (notifications.length === 0) {
    return 'No active account notifications.';
  }

  const priorityOrder = { error: 0, warning: 1, question: 2, calendar: 3, information: 4 };

  // Sort by priority (icon) and then by start date
  const sorted = notifications.sort((a, b) => {
    const priorityDiff = priorityOrder[a.icon] - priorityOrder[b.icon];
    if (priorityDiff !== 0) return priorityDiff;
    
    return new Date(b.start_at).getTime() - new Date(a.start_at).getTime();
  });

  let output = `📢 Active Account Notifications (${notifications.length}):\n\n`;

  for (const notification of sorted) {
    const icon = getIconEmoji(notification.icon);
    const startDate = new Date(notification.start_at).toLocaleDateString();
    const endDate = notification.end_at ? new Date(notification.end_at).toLocaleDateString() : 'Ongoing';

    output += `${icon} ${notification.subject}\n`;
    output += `   ${notification.message}\n`;
    output += `   Active: ${startDate} - ${endDate}\n`;
    output += `   ID: ${notification.id}\n\n`;
  }

  return output;
}

function getIconEmoji(icon: string): string {
  switch (icon) {
    case 'error': return '🚨';
    case 'warning': return '⚠️';
    case 'question': return '❓';
    case 'calendar': return '📅';
    case 'information': return 'ℹ️';
    default: return '📌';
  }
}
