// MCP Tool: Canvas Discussion Posting
// Implementation of discussion reply posting functionality

import { callCanvasAPI, CanvasDiscussionEntry } from '../lib/canvas-api.js';
import { listCourses } from './courses.js';
import { findBestMatch } from '../lib/search.js';
import { logger } from '../lib/logger.js';

export interface PostDiscussionReplyParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  topicId: string;
  message: string;
  attachmentIds?: string[];
}

export interface DiscussionReplyResult {
  id: string;
  message: string;
  createdAt: string;
  userId?: string;
  userName?: string;
  parentId?: string;
}

/**
 * Post a reply to a discussion topic
 */
export async function postDiscussionReply(params: PostDiscussionReplyParams): Promise<DiscussionReplyResult> {
  let { canvasBaseUrl, accessToken, courseId, courseName, topicId, message, attachmentIds } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  if (!topicId || !message) {
    throw new Error('Both topicId and message are required');
  }

  try {
    // Resolve courseName to courseId if needed
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find a course with the name "${courseName}".`);
      }
      courseId = matchedCourse.id;
    }

    logger.info(`Posting reply to discussion topic ${topicId} in course ${courseId}`);

    // Prepare the request body
    const requestBody: Record<string, any> = {
      message: message
    };

    if (attachmentIds && attachmentIds.length > 0) {
      requestBody.attachment_ids = attachmentIds;
    }

    // Make the POST request to create the discussion entry
    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'POST',
      apiPath: `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries`,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to post discussion reply: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const entryData: CanvasDiscussionEntry = await response.json();

    return {
      id: entryData.id,
      message: entryData.message || message,
      createdAt: entryData.created_at || new Date().toISOString(),
      userId: entryData.user_id,
      userName: entryData.user_name,
      parentId: entryData.parent_id
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to post discussion reply: ${error.message}`);
    } else {
      throw new Error('Failed to post discussion reply: Unknown error');
    }
  }
}

/**
 * Reply to an existing discussion entry (threaded reply)
 */
export async function replyToDiscussionEntry(params: PostDiscussionReplyParams & { parentEntryId: string }): Promise<DiscussionReplyResult> {
  let { canvasBaseUrl, accessToken, courseId, courseName, topicId, parentEntryId, message, attachmentIds } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  if (!topicId || !parentEntryId || !message) {
    throw new Error('topicId, parentEntryId, and message are all required');
  }

  try {
    // Resolve courseName to courseId if needed
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find a course with the name "${courseName}".`);
      }
      courseId = matchedCourse.id;
    }

    logger.info(`Posting threaded reply to entry ${parentEntryId} in topic ${topicId}, course ${courseId}`);

    // Prepare the request body
    const requestBody: Record<string, any> = {
      message: message
    };

    if (attachmentIds && attachmentIds.length > 0) {
      requestBody.attachment_ids = attachmentIds;
    }

    // Make the POST request to reply to the specific entry
    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'POST',
      apiPath: `/api/v1/courses/${courseId}/discussion_topics/${topicId}/entries/${parentEntryId}/replies`,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to post threaded reply: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const entryData: CanvasDiscussionEntry = await response.json();

    return {
      id: entryData.id,
      message: entryData.message || message,
      createdAt: entryData.created_at || new Date().toISOString(),
      userId: entryData.user_id,
      userName: entryData.user_name,
      parentId: parentEntryId
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to post threaded reply: ${error.message}`);
    } else {
      throw new Error('Failed to post threaded reply: Unknown error');
    }
  }
} 