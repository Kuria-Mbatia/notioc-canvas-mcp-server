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
  score: number | null;
  pointsPossible: number;
  gradedAt?: string | null;
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
      let enrollments;
      if (userId === 'self') {
        // For current user, get their own enrollment
        enrollments = await fetchAllPaginated<any>(
          canvasBaseUrl,
          accessToken,
          `/api/v1/courses/${course.id}/enrollments`,
          { type: ['StudentEnrollment'], include: ['current_score', 'final_score', 'grades'], per_page: '100' }
        );
      } else {
        // For specific user ID
        enrollments = await fetchAllPaginated<any>(
          canvasBaseUrl,
          accessToken,
          `/api/v1/courses/${course.id}/enrollments`,
          { user_id: userId, include: ['current_score', 'final_score', 'grades'], per_page: '100' }
        );
      }

      logger.info(`Found ${enrollments.length} enrollments for course ${course.id}`);
      const userEnrollment = enrollments.find((e: any) => 
        (userId === 'self' && e.type === 'StudentEnrollment') || 
        (userId !== 'self' && String(e.user_id) === String(userId))
      );

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

      // Fetch assignments for the course
      const assignments = await fetchAllPaginated<any>(
        canvasBaseUrl,
        accessToken,
        `/api/v1/courses/${course.id}/assignments`,
        { per_page: '100' }
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

      // Fetch submissions for the user in this course using the proper API
      let userSubmissions: any[] = [];
      try {
        // Use a more efficient approach - try to get all submissions at once first
        if (userId === 'self') {
          try {
            // Try to get all submissions for the course at once
            const response = await callCanvasAPI({
              canvasBaseUrl,
              accessToken,
              method: 'GET',
              apiPath: `/api/v1/courses/${course.id}/students/submissions?student_ids[]=self&include[]=assignment&include[]=submission_history&include[]=submission_comments&include[]=rubric_assessment&per_page=100`
            });
            
            if (response.ok) {
              userSubmissions = await response.json();
              logger.info(`Fetched ${userSubmissions.length} submissions for course ${course.id} efficiently`);
            } else {
              throw new Error(`Failed to fetch all submissions: ${response.status}`);
            }
          } catch (bulkError: any) {
            logger.warn(`Bulk submission fetch failed for course ${course.id}, falling back to individual assignment fetch: ${bulkError.message}`);
            
            // Fallback: fetch submissions for each assignment individually (with timeout)
            const ASSIGNMENT_TIMEOUT = 5000; // 5 second timeout per assignment
            for (const assignment of assignmentsToProcess.slice(0, 10)) { // Limit to first 10 assignments to avoid hanging
              try {
                const submissionPromise = callCanvasAPI({
                  canvasBaseUrl,
                  accessToken,
                  method: 'GET',
                  apiPath: `/api/v1/courses/${course.id}/assignments/${assignment.id}/submissions/self?include[]=submission_history&include[]=submission_comments&include[]=rubric_assessment`
                });
                
                // Add timeout to the promise
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Assignment fetch timeout')), ASSIGNMENT_TIMEOUT)
                );
                
                const response = await Promise.race([submissionPromise, timeoutPromise]) as Response;
                
                if (response.ok) {
                  const submissionData = await response.json();
                  if (submissionData) {
                    userSubmissions.push(submissionData);
                  }
                }
              } catch (assignmentError) {
                logger.warn(`Could not fetch submission for assignment ${assignment.id}: ${assignmentError}`);
                continue; // Skip this assignment and continue
              }
            }
          }
        } else {
          // For specific user ID, use the original approach but with limits
          for (const assignment of assignmentsToProcess.slice(0, 10)) { // Limit assignments
            try {
              const submissionData = await fetchAllPaginated<any>(
                canvasBaseUrl,
                accessToken,
                `/api/v1/courses/${course.id}/assignments/${assignment.id}/submissions`,
                { 
                  student_ids: [userId],
                  include: ['submission_history', 'submission_comments', 'rubric_assessment', 'user']
                }
              );
              
              if (submissionData && submissionData.length > 0) {
                userSubmissions.push(...submissionData);
              }
            } catch (assignmentError) {
              logger.warn(`Could not fetch submission for assignment ${assignment.id}: ${assignmentError}`);
              continue;
            }
          }
        }
      } catch (submissionError) {
        logger.warn(`Could not fetch submissions for course ${course.id}: ${submissionError}`);
      }

      // Create a map of assignment ID to submission for quick lookup
      const submissionMap = new Map();
      userSubmissions.forEach(sub => {
        if (sub.assignment_id) {
          submissionMap.set(sub.assignment_id, sub);
        }
      });

      for (const assignment of assignmentsToProcess) {
        const submission = submissionMap.get(assignment.id);
        
        if (submission) {
          const assignmentGrade: AssignmentGradeInfo = {
            assignmentId: String(assignment.id),
            assignmentName: assignment.name,
            score: submission.score,
            pointsPossible: assignment.points_possible,
            gradedAt: submission.graded_at,
            submissionStatus: submission.workflow_state || 'not_submitted',
            htmlUrl: assignment.html_url
          };

          if (includeSubmissions) {
            assignmentGrade.submission = submission; // Include full submission object
          }
          courseGradeInfo.assignments?.push(assignmentGrade);
        } else {
          // No submission found for this assignment
          const assignmentGrade: AssignmentGradeInfo = {
            assignmentId: String(assignment.id),
            assignmentName: assignment.name,
            score: null,
            pointsPossible: assignment.points_possible,
            gradedAt: null,
            submissionStatus: 'not_submitted',
            htmlUrl: assignment.html_url
          };
          courseGradeInfo.assignments?.push(assignmentGrade);
        }
      }
      
      gradeReports.push(courseGradeInfo);
    }

    return gradeReports;

  } catch (error) {
    if (error instanceof Error) {
      // Handle specific Canvas API errors gracefully
      if (error.message.includes('404') || error.message.includes('disabled') || error.message.includes('تم تعطيل')) {
        logger.warn(`Grades not available for course ${courseId}: ${error.message}`);
        return []; // Return empty array instead of throwing
      }
      if (error.message.includes('401') || error.message.includes('access token')) {
        throw new Error(`Authentication failed - please check your Canvas access token`);
      }
      if (error.message.includes('403') || error.message.includes('insufficient permissions')) {
        throw new Error(`Access denied - insufficient permissions to view grades`);
      }
      throw new Error(`Failed to fetch grades: ${error.message}`);
    } else {
      throw new Error('Failed to fetch grades: Unknown error');
    }
  }
}

// Additional interfaces for new functionality
export interface GradebookCategoriesParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
}

export interface GradebookCategoryInfo {
  name: string;
  weight: number;
  position: number;
  dropLowest: number;
  dropHighest: number;
  neverDrop: number[];
}

/**
 * Get gradebook categories/assignment groups and their weights
 */
export async function getGradebookCategories(params: GradebookCategoriesParams): Promise<GradebookCategoryInfo[]> {
  let { canvasBaseUrl, accessToken, courseId, courseName } = params;
  
  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  try {
    // Find course if needed
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'active' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find an active course with the name "${courseName}".`);
      }
      courseId = matchedCourse.id;
    }

    if (!courseId) {
      throw new Error('Either courseId or courseName must be provided');
    }

    logger.info(`Getting gradebook categories for course ${courseId}`);

    // Get assignment groups
    const assignmentGroups = await fetchAllPaginated<any>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/courses/${courseId}/assignment_groups`,
      {
        per_page: '100'
      }
    );

    // Transform to clean category info
    const categories: GradebookCategoryInfo[] = assignmentGroups.map((group: any) => ({
      name: group.name,
      weight: group.group_weight || 0,
      position: group.position,
      dropLowest: group.rules?.drop_lowest || 0,
      dropHighest: group.rules?.drop_highest || 0,
      neverDrop: group.rules?.never_drop || []
    }));

    // Sort by position
    categories.sort((a, b) => a.position - b.position);

    return categories;

  } catch (error) {
    if (error instanceof Error) {
      // Handle specific Canvas API errors gracefully
      if (error.message.includes('404') || error.message.includes('disabled') || error.message.includes('تم تعطيل')) {
        logger.warn(`Gradebook categories not available for course ${courseId}: ${error.message}`);
        return []; // Return empty array instead of throwing
      }
      if (error.message.includes('401') || error.message.includes('access token')) {
        throw new Error(`Authentication failed - please check your Canvas access token`);
      }
      if (error.message.includes('403') || error.message.includes('insufficient permissions')) {
        throw new Error(`Access denied - insufficient permissions to view gradebook for course ${courseId}`);
      }
      throw new Error(`Failed to get gradebook categories: ${error.message}`);
    } else {
      throw new Error('Failed to get gradebook categories: Unknown error');
    }
  }
}
