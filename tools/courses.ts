// MCP Tool: List Canvas Courses
// Adapted from /app/api/canvas-courses/route.ts

import { callCanvasAPI, CanvasCourse } from '../lib/canvas-api.js';
import { logger } from '../lib/logger.js';
import { fetchAllPaginated } from '../lib/pagination.js';

export interface CourseListParams {
  canvasBaseUrl: string;
  accessToken: string;
  enrollmentState?: 'active' | 'completed' | 'all';
}

export interface CourseInfo {
  id: string;
  name: string;
  courseCode?: string;
  enrollmentState?: string;
  nickname?: string;
}

export async function listCourses(params: CourseListParams): Promise<CourseInfo[]> {
  const { canvasBaseUrl, accessToken, enrollmentState = 'active' } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  try {
    // Build query parameters
    const queryParams: Record<string, any> = {
      per_page: '100',
      include: ['course_nickname'],
    };
    
    if (enrollmentState && enrollmentState !== 'all') {
      queryParams.enrollment_state = enrollmentState;
    }

    // Call Canvas API to get the list of courses
    const coursesData = await fetchAllPaginated<CanvasCourse>(
      canvasBaseUrl,
      accessToken,
      '/api/v1/courses',
      queryParams
    );

    // Filter and map to the structure needed by MCP
    const courses: CourseInfo[] = coursesData
      .map(course => ({
        id: String(course.id),
        name: course.name || course.course_code || `Course ${course.id}`,
        courseCode: course.course_code,
        enrollmentState: course.enrollment_state,
        nickname: course.nickname,
      }))
      .filter(course => course.name) // Filter out courses without names
      .sort((a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name));

    return courses;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch courses: ${error.message}`);
    } else {
      throw new Error('Failed to fetch courses: Unknown error');
    }
  }
}

export interface SyllabusInfo {
  body: string | null;
  url: string;
}

export async function getCourseSyllabus(params: { canvasBaseUrl: string; accessToken: string; courseId: string; }): Promise<SyllabusInfo> {
    const { canvasBaseUrl, accessToken, courseId } = params;

    if (!canvasBaseUrl || !accessToken || !courseId) {
        throw new Error('Missing Canvas URL, Access Token, or Course ID');
    }

    try {
        const courseUrl = `${canvasBaseUrl}/api/v1/courses/${courseId}?include[]=syllabus_body`;
        const response = await fetch(courseUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch course syllabus: ${response.status} ${response.statusText}`);
        }

        const courseData: { syllabus_body?: string, html_url: string } = await response.json();
        
        return {
            body: courseData.syllabus_body || null,
            url: `${courseData.html_url}/assignments/syllabus`,
        };
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch course syllabus for course ${courseId}: ${error.message}`);
        } else {
            throw new Error(`Failed to fetch course syllabus for course ${courseId}: Unknown error`);
        }
    }
}
