// MCP Tool: Canvas Course Nicknames
// Allow students to rename courses for natural language ("Biology" instead of "BIO-301-F25-SEC02")

import { logger } from '../lib/logger.js';

export interface CourseNickname {
  course_id: number;
  name: string;
  nickname: string;
}

export interface GetNicknamesParams {
  canvasBaseUrl: string;
  accessToken: string;
}

export interface GetNicknameParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
}

export interface SetNicknameParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  nickname: string;
}

export interface RemoveNicknameParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
}

/**
 * Get all course nicknames
 */
export async function getAllNicknames(params: GetNicknamesParams): Promise<CourseNickname[]> {
  const { canvasBaseUrl, accessToken } = params;

  try {
    logger.info('[Nicknames] Fetching all course nicknames');

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/users/self/course_nicknames`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch nicknames: ${response.statusText}`);
    }

    const nicknames: CourseNickname[] = await response.json();

    logger.info(`[Nicknames] Retrieved ${nicknames.length} course nicknames`);

    return nicknames;

  } catch (error) {
    logger.error('[Nicknames] Error fetching nicknames:', error);
    throw error;
  }
}

/**
 * Get nickname for a specific course
 */
export async function getNickname(params: GetNicknameParams): Promise<CourseNickname> {
  const { canvasBaseUrl, accessToken, courseId } = params;

  try {
    logger.info(`[Nicknames] Fetching nickname for course ${courseId}`);

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/users/self/course_nicknames/${courseId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No nickname set for this course.');
      }
      throw new Error(`Failed to fetch nickname: ${response.statusText}`);
    }

    const nickname: CourseNickname = await response.json();

    logger.info(`[Nicknames] Retrieved nickname for course ${courseId}: ${nickname.nickname}`);

    return nickname;

  } catch (error) {
    logger.error('[Nicknames] Error fetching nickname:', error);
    throw error;
  }
}

/**
 * Set nickname for a course
 */
export async function setNickname(params: SetNicknameParams): Promise<CourseNickname> {
  const { canvasBaseUrl, accessToken, courseId, nickname } = params;

  try {
    logger.info(`[Nicknames] Setting nickname for course ${courseId}: ${nickname}`);

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/users/self/course_nicknames/${courseId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nickname })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to set nickname: ${response.statusText}`);
    }

    const result: CourseNickname = await response.json();

    logger.info(`[Nicknames] Set nickname for course ${courseId}: ${result.nickname}`);

    return result;

  } catch (error) {
    logger.error('[Nicknames] Error setting nickname:', error);
    throw error;
  }
}

/**
 * Remove nickname for a course
 */
export async function removeNickname(params: RemoveNicknameParams): Promise<void> {
  const { canvasBaseUrl, accessToken, courseId } = params;

  try {
    logger.info(`[Nicknames] Removing nickname for course ${courseId}`);

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/users/self/course_nicknames/${courseId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to remove nickname: ${response.statusText}`);
    }

    logger.info(`[Nicknames] Removed nickname for course ${courseId}`);

  } catch (error) {
    logger.error('[Nicknames] Error removing nickname:', error);
    throw error;
  }
}

/**
 * Format nicknames for display
 */
export function formatNicknames(nicknames: CourseNickname[]): string {
  if (nicknames.length === 0) {
    return '📝 No course nicknames set yet!\n\n💡 **Tip:** Use set_course_nickname to give courses friendly names like "Biology" instead of "BIO-301-F25-SEC02".\n\nExample: "Rename my biology course to just Biology"';
  }

  let output = `📝 Your Course Nicknames (${nicknames.length})\n\n`;

  for (const item of nicknames) {
    output += `**${item.nickname}** ← "${item.name}"\n`;
    output += `   🆔 Course ID: ${item.course_id}\n\n`;
  }

  output += `💡 **Tip:** Nicknames make it easier to reference courses naturally. Say "my Biology course" instead of the full code.`;

  return output;
}
