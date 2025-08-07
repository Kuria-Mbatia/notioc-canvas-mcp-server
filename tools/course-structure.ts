// MCP Tool: Canvas Course Structure and Navigation Intelligence
// Provides syllabus parsing and module prerequisite analysis

import { listCourses } from './courses.js';
import { findBestMatch } from '../lib/search.js';
import { fetchAllPaginated } from '../lib/pagination.js';

export interface CourseModule {
  id: string;
  name: string;
  position: number;
  state: string;
  unlockAt?: string;
  prerequisiteModuleIds: string[];
  completionRequirements: ModuleCompletionRequirement[];
  items: ModuleItem[];
  published: boolean;
}

export interface ModuleItem {
  id: string;
  title: string;
  type: string;
  moduleId: string;
  position: number;
  published: boolean;
  completionRequirement?: {
    type: string;
    minScore?: number;
    completed?: boolean;
  };
  contentId?: string;
  url?: string;
}

export interface ModuleCompletionRequirement {
  type: string;
  minScore?: number;
  completed?: boolean;
}

export interface CourseStructureParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
}

export interface CourseSyllabus {
  courseId: string;
  courseName: string;
  syllabusBody?: string;
  syllabusPages: Array<{
    title: string;
    url: string;
    content?: string;
  }>;
  syllabusFiles: Array<{
    name: string;
    url: string;
    size: number;
    contentType: string;
  }>;
  extractedInfo: {
    gradingPolicy?: string;
    attendancePolicy?: string;
    latePolicy?: string;
    contactInfo?: Array<{
      type: string;
      info: string;
    }>;
    importantDates?: Array<{
      date: string;
      event: string;
    }>;
  };
}

export interface CourseNavigation {
  courseId: string;
  courseName: string;
  modules: CourseModule[];
  prerequisiteMap: Map<string, string[]>;
  completionStatus: {
    totalModules: number;
    completedModules: number;
    totalItems: number;
    completedItems: number;
    overallProgress: number;
  };
  nextSteps: Array<{
    moduleId: string;
    moduleName: string;
    reason: string;
    blockedBy?: string[];
  }>;
}

// Get comprehensive course structure and module navigation
export async function getCourseNavigation(params: CourseStructureParams): Promise<CourseNavigation> {
  const { canvasBaseUrl, accessToken, courseId, courseName } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  try {
    // Get course ID if needed
    let resolvedCourseId = courseId;
    let resolvedCourseName = courseName;
    
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find a course matching "${courseName}".`);
      }
      resolvedCourseId = matchedCourse.id;
      resolvedCourseName = matchedCourse.name;
    } else if (courseId && !courseName) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const course = courses.find(c => c.id === courseId);
      resolvedCourseName = course?.name || courseId;
    }

    // Fetch modules with detailed information
    const apiPath = `/api/v1/courses/${resolvedCourseId}/modules`;
    const queryParams = {
      include: ['items', 'content_details'],
      per_page: '100'
    };

    const url = new URL(`${canvasBaseUrl}${apiPath}`);
    Object.entries(queryParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(`${key}[]`, String(v)));
      } else {
        url.searchParams.append(key, String(value));
      }
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
    }

    const modulesData = await response.json();

    // Transform modules data
    const modules: CourseModule[] = modulesData.map((module: any) => ({
      id: module.id.toString(),
      name: module.name,
      position: module.position,
      state: module.state,
      unlockAt: module.unlock_at,
      prerequisiteModuleIds: module.prerequisite_module_ids?.map((id: number) => id.toString()) || [],
      completionRequirements: module.completion_requirements || [],
      items: (module.items || []).map((item: any) => ({
        id: item.id.toString(),
        title: item.title,
        type: item.type,
        moduleId: module.id.toString(),
        position: item.position,
        published: item.published,
        completionRequirement: item.completion_requirement,
        contentId: item.content_id?.toString(),
        url: item.html_url
      })),
      published: module.published
    }));

    // Build prerequisite map
    const prerequisiteMap = new Map<string, string[]>();
    modules.forEach(module => {
      if (module.prerequisiteModuleIds.length > 0) {
        prerequisiteMap.set(module.id, module.prerequisiteModuleIds);
      }
    });

    // Calculate completion status
    const completionStatus = {
      totalModules: modules.length,
      completedModules: modules.filter(m => m.state === 'completed').length,
      totalItems: modules.reduce((total, m) => total + m.items.length, 0),
      completedItems: modules.reduce((total, m) => 
        total + m.items.filter(item => 
          item.completionRequirement?.completed === true
        ).length, 0
      ),
      overallProgress: 0
    };

    completionStatus.overallProgress = completionStatus.totalModules > 0 
      ? Math.round((completionStatus.completedModules / completionStatus.totalModules) * 100)
      : 0;

    // Determine next steps
    const nextSteps: Array<{
      moduleId: string;
      moduleName: string;
      reason: string;
      blockedBy?: string[];
    }> = [];

    modules.forEach(module => {
      if (module.state !== 'completed') {
        if (module.prerequisiteModuleIds.length === 0) {
          nextSteps.push({
            moduleId: module.id,
            moduleName: module.name,
            reason: 'Available - no prerequisites'
          });
        } else {
          const incompletePrereqs = module.prerequisiteModuleIds.filter(prereqId => {
            const prereqModule = modules.find(m => m.id === prereqId);
            return prereqModule?.state !== 'completed';
          });

          if (incompletePrereqs.length === 0) {
            nextSteps.push({
              moduleId: module.id,
              moduleName: module.name,
              reason: 'Available - prerequisites met'
            });
          } else {
            const blockedByNames = incompletePrereqs.map(prereqId => {
              const prereqModule = modules.find(m => m.id === prereqId);
              return prereqModule?.name || `Module ${prereqId}`;
            });

            nextSteps.push({
              moduleId: module.id,
              moduleName: module.name,
              reason: 'Blocked by incomplete prerequisites',
              blockedBy: blockedByNames
            });
          }
        }
      }
    });

    return {
      courseId: resolvedCourseId!,
      courseName: resolvedCourseName!,
      modules,
      prerequisiteMap,
      completionStatus,
      nextSteps: nextSteps.slice(0, 5) // Limit to top 5 next steps
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get course navigation: ${error.message}`);
    } else {
      throw new Error('Failed to get course navigation: Unknown error');
    }
  }
}

// Get course syllabus from multiple sources
export async function getCourseSyllabus(params: CourseStructureParams): Promise<CourseSyllabus> {
  const { canvasBaseUrl, accessToken, courseId, courseName } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  try {
    // Get course ID if needed
    let resolvedCourseId = courseId;
    let resolvedCourseName = courseName;
    
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find a course matching "${courseName}".`);
      }
      resolvedCourseId = matchedCourse.id;
      resolvedCourseName = matchedCourse.name;
    } else if (courseId && !courseName) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const course = courses.find(c => c.id === courseId);
      resolvedCourseName = course?.name || courseId;
    }

    // Try the assignments/syllabus endpoint first (more reliable)
    let syllabusBody: string | undefined;
    
    try {
      const syllabusUrl = `${canvasBaseUrl}/api/v1/courses/${resolvedCourseId}/assignments/syllabus`;
      const syllabusResponse = await fetch(syllabusUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (syllabusResponse.ok) {
        const syllabusData = await syllabusResponse.json();
        if (syllabusData && syllabusData.syllabus_body) {
          syllabusBody = syllabusData.syllabus_body;
        }
      }
    } catch (error) {
      // Fall back to course endpoint if assignments/syllabus fails
    }

    // Fallback: Get course details for syllabus body
    if (!syllabusBody) {
      const courseUrl = `${canvasBaseUrl}/api/v1/courses/${resolvedCourseId}?include[]=syllabus_body`;
      const courseResponse = await fetch(courseUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!courseResponse.ok) {
        throw new Error(`Failed to fetch course details: ${courseResponse.status}`);
      }

      const courseData = await courseResponse.json();
      syllabusBody = courseData.syllabus_body;
    }

    // Initialize result
    const syllabus: CourseSyllabus = {
      courseId: resolvedCourseId!,
      courseName: resolvedCourseName!,
      syllabusBody: syllabusBody,
      syllabusPages: [],
      syllabusFiles: [],
      extractedInfo: {
        contactInfo: [],
        importantDates: []
      }
    };

    // Try to get syllabus pages (may be disabled)
    try {
      const pagesUrl = `${canvasBaseUrl}/api/v1/courses/${resolvedCourseId}/pages`;
      const pagesResponse = await fetch(pagesUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (pagesResponse.ok) {
        const pages = await pagesResponse.json();
        const syllabusPages = pages.filter((page: any) => 
          page.title.toLowerCase().includes('syllabus') || 
          page.url.toLowerCase().includes('syllabus')
        );

        syllabus.syllabusPages = syllabusPages.map((page: any) => ({
          title: page.title,
          url: page.url,
          content: page.body
        }));
      }
    } catch (error) {
      // Pages may be disabled, continue without them
    }

    // Try to get syllabus files (may be disabled)
    try {
      const filesUrl = `${canvasBaseUrl}/api/v1/courses/${resolvedCourseId}/files?search_term=syllabus&per_page=50`;
      const filesResponse = await fetch(filesUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (filesResponse.ok) {
        const files = await filesResponse.json();
        syllabus.syllabusFiles = files.map((file: any) => ({
          name: file.display_name,
          url: file.url,
          size: file.size,
          contentType: file.content_type || file['content-type'] || 'unknown'
        }));
      }
    } catch (error) {
      // Files may be disabled, continue without them
    }

    // Extract information from syllabus body if available
    if (syllabus.syllabusBody) {
      syllabus.extractedInfo = extractSyllabusInfo(syllabus.syllabusBody);
    }

    return syllabus;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get course syllabus: ${error.message}`);
    } else {
      throw new Error('Failed to get course syllabus: Unknown error');
    }
  }
}

// Extract structured information from syllabus text
function extractSyllabusInfo(syllabusText: string): CourseSyllabus['extractedInfo'] {
  const info: CourseSyllabus['extractedInfo'] = {
    contactInfo: [],
    importantDates: []
  };

  if (!syllabusText) return info;

  const text = syllabusText.toLowerCase();

  // Extract grading policy
  const gradingPatterns = [
    /grading\s*policy[:\s]*(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /grade\s*distribution[:\s]*(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /assessment[:\s]*(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];

  for (const pattern of gradingPatterns) {
    const match = syllabusText.match(pattern);
    if (match) {
      info.gradingPolicy = match[1].trim();
      break;
    }
  }

  // Extract attendance policy
  const attendancePatterns = [
    /attendance\s*policy[:\s]*(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /attendance[:\s]*(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];

  for (const pattern of attendancePatterns) {
    const match = syllabusText.match(pattern);
    if (match) {
      info.attendancePolicy = match[1].trim();
      break;
    }
  }

  // Extract late policy
  const latePatterns = [
    /late\s*policy[:\s]*(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /late\s*submission[:\s]*(.*?)(?:\n\n|\n[A-Z]|$)/i,
    /late\s*work[:\s]*(.*?)(?:\n\n|\n[A-Z]|$)/i
  ];

  for (const pattern of latePatterns) {
    const match = syllabusText.match(pattern);
    if (match) {
      info.latePolicy = match[1].trim();
      break;
    }
  }

  // Extract contact information
  const emailMatches = syllabusText.match(/[\w\.-]+@[\w\.-]+\.\w+/g);
  if (emailMatches) {
    emailMatches.forEach(email => {
      info.contactInfo!.push({
        type: 'email',
        info: email
      });
    });
  }

  const phoneMatches = syllabusText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
  if (phoneMatches) {
    phoneMatches.forEach(phone => {
      info.contactInfo!.push({
        type: 'phone',
        info: phone
      });
    });
  }

  // Extract office hours
  const officeHoursPattern = /office\s*hours?[:\s]*(.*?)(?:\n\n|\n[A-Z]|$)/i;
  const officeHoursMatch = syllabusText.match(officeHoursPattern);
  if (officeHoursMatch) {
    info.contactInfo!.push({
      type: 'office_hours',
      info: officeHoursMatch[1].trim()
    });
  }

  return info;
}
