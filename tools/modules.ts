// MCP Tool: Canvas Course Modules
// Implementation of Canvas modules functionality

import { callCanvasAPI, CanvasModule, CanvasModuleItem } from '../lib/canvas-api.js';
import { fetchAllPaginated } from '../lib/pagination.js';
import { listCourses } from './courses.js';
import { findBestMatch } from '../lib/search.js';
import { logger } from '../lib/logger.js';

export interface ListModulesParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  include?: ('items' | 'content_details')[];
  searchTerm?: string;
  studentId?: string;
}

export interface ModuleItemsParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  moduleId: string;
  include?: ('content_details' | 'mastery_paths')[];
  searchTerm?: string;
  studentId?: string;
}

export interface ModuleInfo {
  id: string;
  name: string;
  position: number;
  unlockAt?: string;
  requireSequentialProgress: boolean;
  prerequisiteModuleIds: string[];
  itemsCount: number;
  itemsUrl: string;
  items?: ModuleItemInfo[];
  state?: string;
  completedAt?: string;
  publishFinalGrade?: boolean;
  published?: boolean;
}

export interface ModuleItemInfo {
  id: string;
  moduleId: string;
  position: number;
  title: string;
  indent: number;
  type: string;
  contentId?: string;
  htmlUrl?: string;
  apiUrl?: string;
  pageUrl?: string;
  externalUrl?: string;
  newTab?: boolean;
  completionRequirement?: {
    type: string;
    minScore?: number;
    completed: boolean;
  };
  contentDetails?: {
    pointsPossible?: number;
    dueAt?: string;
    unlockAt?: string;
    lockAt?: string;
    lockedForUser?: boolean;
    lockExplanation?: string;
    lockInfo?: any;
  };
  masteryPaths?: any;
  published?: boolean;
}

/**
 * List modules in a course
 */
export async function listModules(params: ListModulesParams): Promise<ModuleInfo[]> {
  let { canvasBaseUrl, accessToken, courseId, courseName, include = ['items'], searchTerm, studentId } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
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

    logger.info(`Listing modules for course ${courseId}${searchTerm ? ` matching "${searchTerm}"` : ''}`);

    const queryParams: Record<string, any> = {
      per_page: '100'
    };

    if (include && include.length > 0) {
      queryParams.include = include;
    }

    if (studentId) {
      queryParams.student_id = studentId;
    }

    const modulesData = await fetchAllPaginated<CanvasModule>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/courses/${courseId}/modules`,
      queryParams
    );

    let modules: ModuleInfo[] = modulesData.map(module => ({
      id: module.id,
      name: module.name || `Module ${module.id}`,
      position: module.position || 0,
      unlockAt: module.unlock_at,
      requireSequentialProgress: module.require_sequential_progress || false,
      prerequisiteModuleIds: module.prerequisite_module_ids || [],
      itemsCount: module.items_count || 0,
      itemsUrl: module.items_url || '',
      items: module.items?.map(item => ({
        id: item.id,
        moduleId: module.id,
        position: item.position || 0,
        title: item.title || `Item ${item.id}`,
        indent: item.indent || 0,
        type: item.type || 'unknown',
        contentId: item.content_id,
        htmlUrl: item.html_url,
        apiUrl: item.url,
        pageUrl: item.page_url,
        externalUrl: item.external_url,
        newTab: item.new_tab || false,
        completionRequirement: item.completion_requirement ? {
          type: item.completion_requirement.type,
          minScore: item.completion_requirement.min_score,
          completed: item.completion_requirement.completed || false
        } : undefined,
        contentDetails: item.content_details ? {
          pointsPossible: item.content_details.points_possible,
          dueAt: item.content_details.due_at,
          unlockAt: item.content_details.unlock_at,
          lockAt: item.content_details.lock_at,
          lockedForUser: item.content_details.locked_for_user,
          lockExplanation: item.content_details.lock_explanation,
          lockInfo: item.content_details.lock_info
        } : undefined,
        masteryPaths: item.mastery_paths,
        published: item.published
      })) || [],
      state: module.state,
      completedAt: module.completed_at,
      publishFinalGrade: module.publish_final_grade,
      published: module.published
    }));

    // Apply search term filtering if provided
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      modules = modules.filter(module => 
        module.name.toLowerCase().includes(lowerSearchTerm) ||
        module.items?.some(item => 
          item.title.toLowerCase().includes(lowerSearchTerm)
        )
      );
    }

    return modules;

  } catch (error) {
    if (error instanceof Error) {
      // Handle specific Canvas API errors gracefully
      if (error.message.includes('404') || error.message.includes('disabled') || error.message.includes('تم تعطيل')) {
        logger.warn(`Modules not available for course ${courseId}: ${error.message}`);
        return []; // Return empty array instead of throwing
      }
      if (error.message.includes('401') || error.message.includes('access token')) {
        throw new Error(`Authentication failed - please check your Canvas access token`);
      }
      if (error.message.includes('403') || error.message.includes('insufficient permissions')) {
        throw new Error(`Access denied - insufficient permissions to view modules for course ${courseId}`);
      }
      throw new Error(`Failed to list modules: ${error.message}`);
    } else {
      throw new Error('Failed to list modules: Unknown error');
    }
  }
}

/**
 * Get items for a specific module
 */
export async function getModuleItems(params: ModuleItemsParams): Promise<ModuleItemInfo[]> {
  let { canvasBaseUrl, accessToken, courseId, courseName, moduleId, include = ['content_details'], searchTerm, studentId } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  if (!moduleId) {
    throw new Error('moduleId is required');
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

    logger.info(`Getting items for module ${moduleId} in course ${courseId}${searchTerm ? ` matching "${searchTerm}"` : ''}`);

    const queryParams: Record<string, any> = {
      per_page: '100'
    };

    if (include && include.length > 0) {
      queryParams.include = include;
    }

    if (studentId) {
      queryParams.student_id = studentId;
    }

    const itemsData = await fetchAllPaginated<CanvasModuleItem>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/courses/${courseId}/modules/${moduleId}/items`,
      queryParams
    );

    let items: ModuleItemInfo[] = itemsData.map(item => ({
      id: item.id,
      moduleId: moduleId,
      position: item.position || 0,
      title: item.title || `Item ${item.id}`,
      indent: item.indent || 0,
      type: item.type || 'unknown',
      contentId: item.content_id,
      htmlUrl: item.html_url,
      apiUrl: item.url,
      pageUrl: item.page_url,
      externalUrl: item.external_url,
      newTab: item.new_tab || false,
      completionRequirement: item.completion_requirement ? {
        type: item.completion_requirement.type,
        minScore: item.completion_requirement.min_score,
        completed: item.completion_requirement.completed || false
      } : undefined,
      contentDetails: item.content_details ? {
        pointsPossible: item.content_details.points_possible,
        dueAt: item.content_details.due_at,
        unlockAt: item.content_details.unlock_at,
        lockAt: item.content_details.lock_at,
        lockedForUser: item.content_details.locked_for_user,
        lockExplanation: item.content_details.lock_explanation,
        lockInfo: item.content_details.lock_info
      } : undefined,
      masteryPaths: item.mastery_paths,
      published: item.published
    }));

    // Apply search term filtering if provided
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(lowerSearchTerm)
      );
    }

    return items;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get module items: ${error.message}`);
    } else {
      throw new Error('Failed to get module items: Unknown error');
    }
  }
}

/**
 * Get details of a specific module
 */
export async function getModuleDetails(params: {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  moduleId: string;
  include?: ('items' | 'content_details')[];
  studentId?: string;
}): Promise<ModuleInfo> {
  let { canvasBaseUrl, accessToken, courseId, courseName, moduleId, include = ['items', 'content_details'], studentId } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  if (!moduleId) {
    throw new Error('moduleId is required');
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

    logger.info(`Getting details for module ${moduleId} in course ${courseId}`);

    const queryParams: Record<string, any> = {};

    if (include && include.length > 0) {
      queryParams.include = include;
    }

    if (studentId) {
      queryParams.student_id = studentId;
    }

    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: `/api/v1/courses/${courseId}/modules/${moduleId}`,
      params: queryParams
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get module details: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const module: CanvasModule = await response.json();

    return {
      id: module.id,
      name: module.name || `Module ${module.id}`,
      position: module.position || 0,
      unlockAt: module.unlock_at,
      requireSequentialProgress: module.require_sequential_progress || false,
      prerequisiteModuleIds: module.prerequisite_module_ids || [],
      itemsCount: module.items_count || 0,
      itemsUrl: module.items_url || '',
      items: module.items?.map(item => ({
        id: item.id,
        moduleId: module.id,
        position: item.position || 0,
        title: item.title || `Item ${item.id}`,
        indent: item.indent || 0,
        type: item.type || 'unknown',
        contentId: item.content_id,
        htmlUrl: item.html_url,
        apiUrl: item.url,
        pageUrl: item.page_url,
        externalUrl: item.external_url,
        newTab: item.new_tab || false,
        completionRequirement: item.completion_requirement ? {
          type: item.completion_requirement.type,
          minScore: item.completion_requirement.min_score,
          completed: item.completion_requirement.completed || false
        } : undefined,
        contentDetails: item.content_details ? {
          pointsPossible: item.content_details.points_possible,
          dueAt: item.content_details.due_at,
          unlockAt: item.content_details.unlock_at,
          lockAt: item.content_details.lock_at,
          lockedForUser: item.content_details.locked_for_user,
          lockExplanation: item.content_details.lock_explanation,
          lockInfo: item.content_details.lock_info
        } : undefined,
        masteryPaths: item.mastery_paths,
        published: item.published
      })) || [],
      state: module.state,
      completedAt: module.completed_at,
      publishFinalGrade: module.publish_final_grade,
      published: module.published
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get module details: ${error.message}`);
    } else {
      throw new Error('Failed to get module details: Unknown error');
    }
  }
} 