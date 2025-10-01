/**
 * MCP Tool: Canvas Groups
 * Access group information, members, and discussions
 */

import { callCanvasAPI } from '../lib/canvas-api.js';
import { fetchAllPaginated } from '../lib/pagination.js';
import { listCourses } from './courses.js';
import { findBestMatch } from '../lib/search.js';
import { logger } from '../lib/logger.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CanvasGroup {
  id: string;
  name: string;
  description?: string;
  is_public?: boolean;
  followed_by_user?: boolean;
  join_level?: 'parent_context_auto_join' | 'parent_context_request' | 'invitation_only';
  members_count?: number;
  avatar_url?: string;
  context_type?: string;
  course_id?: string;
  account_id?: string;
  role?: string;
  group_category_id?: string;
  sis_group_id?: string;
  sis_import_id?: string;
  storage_quota_mb?: number;
  permissions?: {
    create_discussion_topic?: boolean;
    create_announcement?: boolean;
  };
  concluded?: boolean;
}

export interface GroupMember {
  id: string;
  name: string;
  sortable_name?: string;
  short_name?: string;
  login_id?: string;
  avatar_url?: string;
  pronouns?: string;
}

export interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  membersCount?: number;
  courseId?: string;
  isPublic?: boolean;
  role?: string;
}

export interface GroupDetailsInfo extends GroupInfo {
  joinLevel?: string;
  avatarUrl?: string;
  concluded?: boolean;
  permissions?: {
    canCreateDiscussion: boolean;
    canCreateAnnouncement: boolean;
  };
}

export interface GroupDiscussionTopic {
  id: string;
  title: string;
  message?: string;
  posted_at?: string;
  last_reply_at?: string;
  author?: {
    id: string;
    display_name: string;
    avatar_image_url?: string;
  };
  discussion_subentry_count?: number;
  unread_count?: number;
  read_state?: 'read' | 'unread';
  pinned?: boolean;
  locked?: boolean;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * List all groups for the current user or a specific course
 */
export async function listGroups(params: {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  contextType?: 'Account' | 'Course';
}): Promise<GroupInfo[]> {
  const { canvasBaseUrl, accessToken, contextType = 'Course' } = params;
  let { courseId, courseName } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  try {
    // If courseName provided, resolve to courseId
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find a course with the name "${courseName}".`);
      }
      courseId = matchedCourse.id;
    }

    let apiPath: string;
    const queryParams: Record<string, any> = {
      per_page: '100'
    };

    if (courseId) {
      // Get groups for a specific course
      apiPath = `/api/v1/courses/${courseId}/groups`;
      logger.info(`Fetching groups for course ${courseId}`);
    } else {
      // Get all groups for the current user
      apiPath = '/api/v1/users/self/groups';
      queryParams.include = ['course'];
      logger.info('Fetching all groups for current user');
    }

    const groupsData = await fetchAllPaginated<CanvasGroup>(
      canvasBaseUrl,
      accessToken,
      apiPath,
      queryParams
    );

    const groups: GroupInfo[] = groupsData.map(group => ({
      id: String(group.id),
      name: group.name || `Group ${group.id}`,
      description: group.description,
      membersCount: group.members_count,
      courseId: group.course_id ? String(group.course_id) : undefined,
      isPublic: group.is_public,
      role: group.role
    }));

    logger.info(`Found ${groups.length} groups`);
    return groups;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch groups: ${error.message}`);
    } else {
      throw new Error('Failed to fetch groups: Unknown error');
    }
  }
}

/**
 * Get detailed information about a specific group
 */
export async function getGroupDetails(params: {
  canvasBaseUrl: string;
  accessToken: string;
  groupId: string;
  includePermissions?: boolean;
}): Promise<GroupDetailsInfo> {
  const { canvasBaseUrl, accessToken, groupId, includePermissions = true } = params;

  if (!canvasBaseUrl || !accessToken || !groupId) {
    throw new Error('Missing required parameters');
  }

  try {
    logger.info(`Fetching details for group ${groupId}`);

    const queryParams: Record<string, any> = {};
    if (includePermissions) {
      queryParams.include = ['permissions'];
    }

    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: `/api/v1/groups/${groupId}`,
      params: queryParams
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch group details: ${response.status} ${response.statusText}`);
    }

    const group: CanvasGroup = await response.json();

    return {
      id: String(group.id),
      name: group.name || `Group ${group.id}`,
      description: group.description,
      membersCount: group.members_count,
      courseId: group.course_id ? String(group.course_id) : undefined,
      isPublic: group.is_public,
      role: group.role,
      joinLevel: group.join_level,
      avatarUrl: group.avatar_url,
      concluded: group.concluded,
      permissions: group.permissions ? {
        canCreateDiscussion: group.permissions.create_discussion_topic || false,
        canCreateAnnouncement: group.permissions.create_announcement || false
      } : undefined
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch group details: ${error.message}`);
    } else {
      throw new Error('Failed to fetch group details: Unknown error');
    }
  }
}

/**
 * List members of a specific group
 */
export async function listGroupMembers(params: {
  canvasBaseUrl: string;
  accessToken: string;
  groupId: string;
}): Promise<GroupMember[]> {
  const { canvasBaseUrl, accessToken, groupId } = params;

  if (!canvasBaseUrl || !accessToken || !groupId) {
    throw new Error('Missing required parameters');
  }

  try {
    logger.info(`Fetching members for group ${groupId}`);

    const membersData = await fetchAllPaginated<GroupMember>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/groups/${groupId}/users`,
      { per_page: '100' }
    );

    logger.info(`Found ${membersData.length} members in group ${groupId}`);
    return membersData;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch group members: ${error.message}`);
    } else {
      throw new Error('Failed to fetch group members: Unknown error');
    }
  }
}

/**
 * List discussion topics in a group
 */
export async function listGroupDiscussions(params: {
  canvasBaseUrl: string;
  accessToken: string;
  groupId: string;
  orderBy?: 'position' | 'recent_activity' | 'title';
  scope?: 'locked' | 'unlocked' | 'pinned' | 'unpinned';
}): Promise<GroupDiscussionTopic[]> {
  const { canvasBaseUrl, accessToken, groupId, orderBy, scope } = params;

  if (!canvasBaseUrl || !accessToken || !groupId) {
    throw new Error('Missing required parameters');
  }

  try {
    logger.info(`Fetching discussions for group ${groupId}`);

    const queryParams: Record<string, any> = {
      per_page: '100'
    };

    if (orderBy) {
      queryParams.order_by = orderBy;
    }

    if (scope) {
      queryParams.scope = scope;
    }

    const discussionsData = await fetchAllPaginated<GroupDiscussionTopic>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/groups/${groupId}/discussion_topics`,
      queryParams
    );

    logger.info(`Found ${discussionsData.length} discussions in group ${groupId}`);
    return discussionsData;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch group discussions: ${error.message}`);
    } else {
      throw new Error('Failed to fetch group discussions: Unknown error');
    }
  }
}

/**
 * Get a specific discussion topic from a group
 */
export async function getGroupDiscussion(params: {
  canvasBaseUrl: string;
  accessToken: string;
  groupId: string;
  topicId: string;
}): Promise<GroupDiscussionTopic> {
  const { canvasBaseUrl, accessToken, groupId, topicId } = params;

  if (!canvasBaseUrl || !accessToken || !groupId || !topicId) {
    throw new Error('Missing required parameters');
  }

  try {
    logger.info(`Fetching discussion ${topicId} from group ${groupId}`);

    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: `/api/v1/groups/${groupId}/discussion_topics/${topicId}`
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch discussion: ${response.status} ${response.statusText}`);
    }

    const discussion: GroupDiscussionTopic = await response.json();
    return discussion;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch group discussion: ${error.message}`);
    } else {
      throw new Error('Failed to fetch group discussion: Unknown error');
    }
  }
}

/**
 * Post a new discussion topic to a group
 */
export async function postGroupDiscussion(params: {
  canvasBaseUrl: string;
  accessToken: string;
  groupId: string;
  title: string;
  message: string;
  discussionType?: 'side_comment' | 'threaded';
  published?: boolean;
}): Promise<GroupDiscussionTopic> {
  const { canvasBaseUrl, accessToken, groupId, title, message, discussionType = 'threaded', published = true } = params;

  if (!canvasBaseUrl || !accessToken || !groupId || !title || !message) {
    throw new Error('Missing required parameters: groupId, title, and message are required');
  }

  try {
    logger.info(`Posting new discussion to group ${groupId}`);

    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'POST',
      apiPath: `/api/v1/groups/${groupId}/discussion_topics`,
      body: {
        title,
        message,
        discussion_type: discussionType,
        published
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to post discussion: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const discussion: GroupDiscussionTopic = await response.json();
    logger.info(`Created discussion ${discussion.id} in group ${groupId}`);
    return discussion;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to post group discussion: ${error.message}`);
    } else {
      throw new Error('Failed to post group discussion: Unknown error');
    }
  }
}
