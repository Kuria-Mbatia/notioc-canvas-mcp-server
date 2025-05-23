// MCP Tool: List Canvas Courses
// Adapted from /app/api/canvas-courses/route.ts

import { callCanvasAPI, CanvasCourse } from '../lib/canvas-api.js';

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
}

export async function listCourses(params: CourseListParams): Promise<CourseInfo[]> {
  const { canvasBaseUrl, accessToken, enrollmentState = 'active' } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  try {
    // Build query parameters
    const queryParams: Record<string, string> = {
      per_page: '100'
    };
    
    if (enrollmentState !== 'all') {
      queryParams.enrollment_state = enrollmentState;
    }

    // Call Canvas API to get the list of courses
    const coursesResponse = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: '/api/v1/courses',
      params: queryParams,
    });

    if (!coursesResponse.ok) {
      const errorText = await coursesResponse.text();
      throw new Error(`Canvas API Error (${coursesResponse.status}): ${errorText}`);
    }

    const coursesData: CanvasCourse[] = await coursesResponse.json();

    // Filter and map to the structure needed by MCP
    const courses: CourseInfo[] = coursesData
      .map(course => ({
        id: String(course.id),
        name: course.name || course.course_code || `Course ${course.id}`,
        courseCode: course.course_code,
        enrollmentState: course.enrollment_state,
      }))
      .filter(course => course.name) // Filter out courses without names
      .sort((a, b) => a.name.localeCompare(b.name));

    return courses;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch courses: ${error.message}`);
    } else {
      throw new Error('Failed to fetch courses: Unknown error');
    }
  }
}
