// MCP Tool: Canvas Users and People Search
// Implementation of user search functionality for messaging

import { callCanvasAPI } from "../lib/canvas-api.js";
import { fetchAllPaginated } from "../lib/pagination.js";
import { listCourses } from "./courses.js";
import { findBestMatch } from "../lib/search.js";
import { logger } from "../lib/logger.js";

export interface FindPeopleParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  searchTerm?: string;
  enrollmentType?: "student" | "teacher" | "ta" | "observer" | "designer";
  enrollmentState?:
    | "active"
    | "invited"
    | "rejected"
    | "completed"
    | "inactive";
  include?: (
    | "enrollments"
    | "locked"
    | "avatar_url"
    | "test_student"
    | "bio"
    | "custom_links"
  )[];
}

export interface SearchRecipientsParams {
  canvasBaseUrl: string;
  accessToken: string;
  search?: string;
  context?: string; // e.g., "course_123" or "section_456"
  exclude?: string[];
  type?: "user" | "context";
  userId?: string;
  fromConversationId?: string;
  permissions?: string[];
}

export interface UserInfo {
  id: string;
  name: string;
  displayName?: string;
  sortableName?: string;
  shortName?: string;
  sisUserId?: string;
  integrationId?: string;
  loginId?: string;
  avatarUrl?: string;
  enrollments?: Array<{
    type: string;
    state: string;
    courseSectionId?: string;
    courseId?: string;
  }>;
  email?: string;
  locale?: string;
  pronouns?: string;
  bio?: string;
}

export interface RecipientInfo {
  id: string;
  name: string;
  fullName?: string;
  commonCourses?: Record<string, string[]>;
  commonGroups?: Record<string, string[]>;
  avatarUrl?: string;
  pronouns?: string;
  userCount?: number; // For context recipients
}

/**
 * Find people in a specific course
 */
export async function findPeopleInCourse(
  params: FindPeopleParams,
): Promise<UserInfo[]> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    searchTerm,
    enrollmentType,
    enrollmentState = "active",
    include = ["enrollments", "avatar_url"],
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  if (!courseId && !courseName) {
    throw new Error("Either courseId or courseName must be provided");
  }

  try {
    // Resolve courseName to courseId if needed
    if (courseName && !courseId) {
      const courses = await listCourses({
        canvasBaseUrl,
        accessToken,
        enrollmentState: "all",
      });
      const matchedCourse = findBestMatch(courseName, courses, [
        "name",
        "courseCode",
        "nickname",
      ]);
      if (!matchedCourse) {
        throw new Error(
          `Could not find a course with the name "${courseName}".`,
        );
      }
      courseId = matchedCourse.id;
    }

    logger.info(
      `Finding people in course ${courseId}${searchTerm ? ` matching "${searchTerm}"` : ""}`,
    );

    const queryParams: Record<string, any> = {
      per_page: "100",
      enrollment_state: enrollmentState,
      include: include,
    };

    if (searchTerm) {
      queryParams.search_term = searchTerm;
    }

    if (enrollmentType) {
      queryParams.enrollment_type = enrollmentType;
    }

    const usersData = await fetchAllPaginated<any>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/courses/${courseId}/users`,
      queryParams,
    );

    const users: UserInfo[] = usersData.map((user) => ({
      id: user.id,
      name: user.name || user.display_name || `User ${user.id}`,
      displayName: user.display_name,
      sortableName: user.sortable_name,
      shortName: user.short_name,
      sisUserId: user.sis_user_id,
      integrationId: user.integration_id,
      loginId: user.login_id,
      avatarUrl: user.avatar_url,
      enrollments: user.enrollments?.map((enr: any) => ({
        type: enr.type,
        state: enr.enrollment_state,
        courseSectionId: enr.course_section_id,
        courseId: enr.course_id,
      })),
      email: user.email,
      locale: user.locale,
      pronouns: user.pronouns,
      bio: user.bio,
    }));

    return users;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to find people in course: ${error.message}`);
    } else {
      throw new Error("Failed to find people in course: Unknown error");
    }
  }
}

/**
 * Search for message recipients using Canvas search API
 * This endpoint may be restricted at some institutions
 */
export async function searchRecipients(
  params: SearchRecipientsParams,
): Promise<RecipientInfo[]> {
  const {
    canvasBaseUrl,
    accessToken,
    search,
    context,
    exclude,
    type,
    userId,
    fromConversationId,
    permissions,
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  try {
    logger.info(
      `Searching for recipients${search ? ` matching "${search}"` : ""}${context ? ` in context "${context}"` : ""}`,
    );

    const queryParams: Record<string, any> = {
      per_page: "100",
    };

    if (search) {
      queryParams.search = search;
    }

    if (context) {
      queryParams.context = context;
    }

    if (exclude && exclude.length > 0) {
      queryParams.exclude = exclude;
    }

    if (type) {
      queryParams.type = type;
    }

    if (userId) {
      queryParams.user_id = userId;
    }

    if (fromConversationId) {
      queryParams.from_conversation_id = fromConversationId;
    }

    if (permissions && permissions.length > 0) {
      queryParams.permissions = permissions;
    }

    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: "GET",
      apiPath: "/api/v1/search/recipients",
      params: queryParams,
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Handle the case where the endpoint is not available
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Search recipients endpoint is not available - institution may have restricted this feature. Use findPeopleInCourse instead.",
        );
      }

      throw new Error(
        `Failed to search recipients: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const recipientsData = await response.json();

    const recipients: RecipientInfo[] = recipientsData.map(
      (recipient: any) => ({
        id: recipient.id,
        name: recipient.name,
        fullName: recipient.full_name,
        commonCourses: recipient.common_courses,
        commonGroups: recipient.common_groups,
        avatarUrl: recipient.avatar_url,
        pronouns: recipient.pronouns,
        userCount: recipient.user_count,
      }),
    );

    return recipients;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to search recipients: ${error.message}`);
    } else {
      throw new Error("Failed to search recipients: Unknown error");
    }
  }
}

/**
 * Get user profile information
 */
export async function getUserProfile(params: {
  canvasBaseUrl: string;
  accessToken: string;
  userId: string;
  include?: (
    | "locale"
    | "avatar_url"
    | "permissions"
    | "email"
    | "effective_locale"
    | "bio"
    | "pronouns"
  )[];
}): Promise<UserInfo> {
  const {
    canvasBaseUrl,
    accessToken,
    userId,
    include = ["avatar_url", "email", "bio", "pronouns"],
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  if (!userId) {
    throw new Error("userId is required");
  }

  try {
    logger.info(`Getting profile for user ${userId}`);

    const queryParams: Record<string, any> = {};

    if (include && include.length > 0) {
      queryParams.include = include;
    }

    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: "GET",
      apiPath: `/api/v1/users/${userId}/profile`,
      params: queryParams,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get user profile: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const user = await response.json();

    return {
      id: user.id,
      name: user.name || user.display_name || `User ${user.id}`,
      displayName: user.display_name,
      sortableName: user.sortable_name,
      shortName: user.short_name,
      sisUserId: user.sis_user_id,
      integrationId: user.integration_id,
      loginId: user.login_id,
      avatarUrl: user.avatar_url,
      email: user.primary_email || user.email,
      locale: user.locale,
      pronouns: user.pronouns,
      bio: user.bio,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get user profile: ${error.message}`);
    } else {
      throw new Error("Failed to get user profile: Unknown error");
    }
  }
}

/**
 * Get current user's own profile
 */
export async function getMyProfile(params: {
  canvasBaseUrl: string;
  accessToken: string;
  include?: (
    | "locale"
    | "avatar_url"
    | "permissions"
    | "email"
    | "effective_locale"
    | "bio"
    | "pronouns"
  )[];
}): Promise<UserInfo> {
  return getUserProfile({
    ...params,
    userId: "self",
  });
}
