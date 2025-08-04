// MCP Tool: Get Canvas Grades
// This tool fetches detailed grade information for a student.

import { callCanvasAPI } from '../lib/canvas-api.js';
import { fetchAllPaginated } from '../lib/pagination.js';
import { listCourses } from './courses.js';
import { findBestMatch } from '../lib/search.js';
import { logger } from '../lib/logger.js';

export interface GetGradesParams {
  canvasBaseUrl: string;
  accessToken: string;
  userId?: string; // Defaults to 'self'
  courseId?: string;
  courseName?: string;
  assignmentId?: string;
  assignmentName?: string;
  includeSubmissions?: boolean; // Whether to include detailed submission data
}

export interface GradeInfo {
  courseId: string;
  courseName: string;
  currentScore?: number;
  finalScore?: number;
  finalGrade?: string;
  assignments?: AssignmentGradeInfo[];
}

export interface AssignmentGradeInfo {
  assignmentId: string;
  assignmentName: string;
  score: number;
  pointsPossible: number;
  gradedAt?: string;
  submissionStatus: string;
  htmlUrl?: string;
  submission?: any; // Detailed submission object if requested
}

export async function getGrades(params: GetGradesParams): Promise<GradeInfo[]> {
  let { canvasBaseUrl, accessToken, userId = 'self', courseId, courseName, assignmentId, assignmentName, includeSubmissions = false } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  const gradeReports: GradeInfo[] = [];

  try {
    let coursesToFetch: any[] = [];

    if (courseId || courseName) {
      // Fetch specific course if provided
      const allCourses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      let targetCourse;
      if (courseId) {
        targetCourse = allCourses.find(c => c.id === courseId);
      } else if (courseName) {
        targetCourse = findBestMatch(courseName, allCourses, ['name', 'courseCode', 'nickname']);
      }

      if (!targetCourse) {
        throw new Error(`Could not find course matching "${courseName || courseId}".`);
      }
      coursesToFetch.push(targetCourse);
    } else {
      // Fetch all active courses if no specific course is provided
      coursesToFetch = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'active' });
    }

    for (const course of coursesToFetch) {
      logger.info(`Fetching grades for user ${userId} in course ${course.name} (ID: ${course.id})`);

      // Fetch enrollments to get current and final scores/grades for the course
      const enrollments = await fetchAllPaginated<any>(
        canvasBaseUrl,
        accessToken,
        `/api/v1/courses/${course.id}/enrollments`,
        { user_id: userId, include: ['current_score', 'final_score', 'grades'] }
      );

      const userEnrollment = enrollments.find((e: any) => String(e.user_id) === String(userId));

      if (!userEnrollment) {
        logger.warn(`User ${userId} not enrolled in course ${course.name}. Skipping.`);
        continue;
      }

      const courseGradeInfo: GradeInfo = {
        courseId: course.id,
        courseName: course.name,
        currentScore: userEnrollment.grades?.current_score,
        finalScore: userEnrollment.grades?.final_score,
        finalGrade: userEnrollment.grades?.final_grade,
        assignments: []
      };

      // Fetch assignments and submissions for the course
      const assignments = await fetchAllPaginated<any>(
        canvasBaseUrl,
        accessToken,
        `/api/v1/courses/${course.id}/assignments`,
        { include: ['submission'], per_page: '100' }
      );

      let assignmentsToProcess = assignments;

      if (assignmentId || assignmentName) {
        let targetAssignment;
        if (assignmentId) {
          targetAssignment = assignments.find((a: any) => String(a.id) === String(assignmentId));
        } else if (assignmentName) {
          targetAssignment = findBestMatch(assignmentName, assignments, ['name']);
        }

        if (!targetAssignment) {
          throw new Error(`Could not find assignment matching "${assignmentName || assignmentId}" in course "${course.name}".`);
        }
        assignmentsToProcess = [targetAssignment];
      }

      for (const assignment of assignmentsToProcess) {
        const submission = assignment.submission; // Canvas API often includes submission directly with assignment
        
        if (submission) {
          const assignmentGrade: AssignmentGradeInfo = {
            assignmentId: String(assignment.id),
            assignmentName: assignment.name,
            score: submission.score,
            pointsPossible: assignment.points_possible,
            gradedAt: submission.graded_at,
            submissionStatus: submission.workflow_state,
            htmlUrl: assignment.html_url
          };

          if (includeSubmissions) {
            assignmentGrade.submission = submission; // Include full submission object
          }
          courseGradeInfo.assignments?.push(assignmentGrade);
        }
      }
      gradeReports.push(courseGradeInfo);
    }

    return gradeReports;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch grades: ${error.message}`);
    } else {
      throw new Error('Failed to fetch grades: Unknown error');
    }
  }
}
