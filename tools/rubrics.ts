// MCP Tool: Canvas Rubric Details and Analysis
// Provides detailed rubric information for assignments and grading optimization insights

import { listCourses } from './courses.js';
import { findBestMatch } from '../lib/search.js';
import { fetchAllPaginated } from '../lib/pagination.js';
import { listAssignments } from './assignments.js';

export interface RubricCriterion {
  id: string;
  description: string;
  longDescription?: string;
  points: number;
  ratings: RubricRating[];
  criterionUseRange?: boolean;
  ignoreForScoring?: boolean;
}

export interface RubricRating {
  id: string;
  description: string;
  longDescription?: string;
  points: number;
}

export interface RubricAssessment {
  [criterionId: string]: {
    points: number;
    rating_id?: string;
    comments?: string;
  };
}

export interface AssignmentRubric {
  assignmentId: string;
  assignmentName: string;
  totalPoints: number;
  criteria: RubricCriterion[];
  rubricAssessment?: RubricAssessment;
}

export interface RubricParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  assignmentId?: string;
  assignmentName?: string;
}

// Get detailed rubric information for a specific assignment
export async function getAssignmentRubric(params: RubricParams): Promise<AssignmentRubric> {
  const { canvasBaseUrl, accessToken, courseId, courseName, assignmentId, assignmentName } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  if (!assignmentId && !assignmentName) {
    throw new Error('Either assignmentId or assignmentName must be provided');
  }

  try {
    // Get course ID if needed
    let resolvedCourseId = courseId;
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find a course matching "${courseName}".`);
      }
      resolvedCourseId = matchedCourse.id;
    }

    // Get assignments with rubrics
    const assignments = await listAssignments({ 
      canvasBaseUrl, 
      accessToken, 
      courseId: resolvedCourseId,
      includeSubmissions: false
    });

    // Find the specific assignment
    let assignment;
    if (assignmentId) {
      assignment = assignments.find(a => a.id === assignmentId);
    } else if (assignmentName) {
      assignment = findBestMatch(assignmentName, assignments, ['name']);
    }

    if (!assignment) {
      throw new Error(`Could not find assignment ${assignmentId || assignmentName}`);
    }

    // Fetch detailed assignment data including rubric
    const apiPath = `/api/v1/courses/${resolvedCourseId}/assignments/${assignment.id}`;
    const queryParams = { include: ['rubric', 'rubric_assessment'] };

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

    const assignmentData = await response.json();

    if (!assignmentData.rubric || assignmentData.rubric.length === 0) {
      throw new Error(`Assignment "${assignment.name}" does not have a rubric`);
    }

    return {
      assignmentId: assignment.id,
      assignmentName: assignment.name,
      totalPoints: assignmentData.points_possible || 0,
      criteria: assignmentData.rubric.map((criterion: any) => ({
        id: criterion.id,
        description: criterion.description,
        longDescription: criterion.long_description,
        points: criterion.points,
        criterionUseRange: criterion.criterion_use_range,
        ignoreForScoring: criterion.ignore_for_scoring,
        ratings: criterion.ratings.map((rating: any) => ({
          id: rating.id,
          description: rating.description,
          longDescription: rating.long_description,
          points: rating.points
        }))
      })),
      rubricAssessment: assignmentData.rubric_assessment
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch assignment rubric: ${error.message}`);
    } else {
      throw new Error('Failed to fetch assignment rubric: Unknown error');
    }
  }
}

// Get rubric analysis across multiple assignments in a course
export async function getRubricAnalysis(params: {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  limit?: number;
}): Promise<{
  courseInfo: { id: string; name: string };
  assignmentsWithRubrics: number;
  totalAssignments: number;
  rubricThemes: Array<{
    theme: string;
    frequency: number;
    avgPoints: number;
    examples: string[];
  }>;
  pointDistribution: {
    totalRubricPoints: number;
    avgPointsPerCriterion: number;
    criteriaCount: number;
  };
  commonCriteria: Array<{
    description: string;
    frequency: number;
    avgPoints: number;
    assignments: string[];
  }>;
}> {
  const { canvasBaseUrl, accessToken, courseId, courseName, limit = 10 } = params;

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

    // Get all assignments with rubrics
    const assignments = await listAssignments({ 
      canvasBaseUrl, 
      accessToken, 
      courseId: resolvedCourseId,
      includeSubmissions: false
    });

    // Fetch detailed rubric data for assignments with rubrics
    const rubricPromises = assignments
      .filter(a => a.pointsPossible > 0) // Only scored assignments
      .slice(0, limit)
      .map(async (assignment) => {
        try {
          const apiPath = `/api/v1/courses/${resolvedCourseId}/assignments/${assignment.id}`;
          const url = new URL(`${canvasBaseUrl}${apiPath}`);
          url.searchParams.append('include[]', 'rubric');

          const response = await fetch(url.toString(), {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            return {
              assignment,
              rubric: data.rubric || []
            };
          }
        } catch (error) {
          // Silently skip failed requests
        }
        return null;
      });

    const rubricResults = await Promise.all(rubricPromises);
    const validRubrics = rubricResults.filter((r): r is NonNullable<typeof r> => r !== null && r.rubric.length > 0);

    // Analyze rubric themes and criteria
    const criteriaMap = new Map<string, {
      frequency: number;
      totalPoints: number;
      assignments: string[];
    }>();

    let totalRubricPoints = 0;
    let totalCriteria = 0;

    validRubrics.forEach(({ assignment, rubric }) => {
      rubric.forEach((criterion: any) => {
        const key = criterion.description.toLowerCase().trim();
        totalRubricPoints += criterion.points;
        totalCriteria++;

        if (criteriaMap.has(key)) {
          const existing = criteriaMap.get(key)!;
          existing.frequency++;
          existing.totalPoints += criterion.points;
          existing.assignments.push(assignment.name);
        } else {
          criteriaMap.set(key, {
            frequency: 1,
            totalPoints: criterion.points,
            assignments: [assignment.name]
          });
        }
      });
    });

    // Sort and format common criteria
    const commonCriteria = Array.from(criteriaMap.entries())
      .map(([description, data]) => ({
        description,
        frequency: data.frequency,
        avgPoints: Math.round((data.totalPoints / data.frequency) * 10) / 10,
        assignments: data.assignments.slice(0, 3) // Limit examples
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    // Identify rubric themes
    const rubricThemes = [
      {
        theme: 'Writing Quality',
        frequency: commonCriteria.filter(c => 
          c.description.includes('grammar') || 
          c.description.includes('writing') || 
          c.description.includes('mechanics') ||
          c.description.includes('punctuation')
        ).length,
        avgPoints: 0,
        examples: []
      },
      {
        theme: 'Content Analysis',
        frequency: commonCriteria.filter(c => 
          c.description.includes('analysis') || 
          c.description.includes('content') ||
          c.description.includes('understanding') ||
          c.description.includes('critical')
        ).length,
        avgPoints: 0,
        examples: []
      },
      {
        theme: 'Organization',
        frequency: commonCriteria.filter(c => 
          c.description.includes('organization') || 
          c.description.includes('structure') ||
          c.description.includes('format')
        ).length,
        avgPoints: 0,
        examples: []
      }
    ].filter(theme => theme.frequency > 0);

    return {
      courseInfo: {
        id: resolvedCourseId!,
        name: resolvedCourseName!
      },
      assignmentsWithRubrics: validRubrics.length,
      totalAssignments: assignments.length,
      rubricThemes,
      pointDistribution: {
        totalRubricPoints,
        avgPointsPerCriterion: totalCriteria > 0 ? Math.round((totalRubricPoints / totalCriteria) * 10) / 10 : 0,
        criteriaCount: totalCriteria
      },
      commonCriteria
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to analyze rubrics: ${error.message}`);
    } else {
      throw new Error('Failed to analyze rubrics: Unknown error');
    }
  }
}

// Get assignment feedback and rubric assessment for student submissions
export async function getAssignmentFeedback(params: {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  assignmentId?: string;
  assignmentName?: string;
  userId?: string; // Optional - if not provided, gets current user
}): Promise<{
  assignment: {
    id: string;
    name: string;
    points: number;
  };
  submission?: {
    score?: number;
    grade?: string;
    submittedAt?: string;
    workflowState: string;
    rubricAssessment?: RubricAssessment;
    comments?: Array<{
      comment: string;
      author: string;
      createdAt: string;
    }>;
  };
  rubric?: RubricCriterion[];
  feedback?: {
    totalScore?: number;
    totalPossible: number;
    criteriaFeedback: Array<{
      criterion: string;
      pointsEarned?: number;
      pointsPossible: number;
      performance?: string;
      comments?: string;
    }>;
  };
}> {
  const { canvasBaseUrl, accessToken, courseId, courseName, assignmentId, assignmentName, userId } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  if (!assignmentId && !assignmentName) {
    throw new Error('Either assignmentId or assignmentName must be provided');
  }

  try {
    // Get assignment with rubric first
    const rubricData = await getAssignmentRubric({
      canvasBaseUrl,
      accessToken,
      courseId,
      courseName,
      assignmentId,
      assignmentName
    });

    // Resolve course ID for submission path
    let resolvedCourseId = courseId;
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);
      if (!matchedCourse) {
        throw new Error(`Could not find a course matching "${courseName}".`);
      }
      resolvedCourseId = matchedCourse.id;
    }

    // Get submission data
    const submissionPath = userId 
      ? `/api/v1/courses/${resolvedCourseId}/assignments/${rubricData.assignmentId}/submissions/${userId}`
      : `/api/v1/courses/${resolvedCourseId}/assignments/${rubricData.assignmentId}/submissions/self`;

    const submissionUrl = new URL(`${canvasBaseUrl}${submissionPath}`);
    submissionUrl.searchParams.append('include[]', 'rubric_assessment');
    submissionUrl.searchParams.append('include[]', 'submission_comments');

    const submissionResponse = await fetch(submissionUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    let submission;
    if (submissionResponse.ok) {
      submission = await submissionResponse.json();
    }

    // Build feedback analysis
    let feedback;
    if (submission && submission.rubric_assessment) {
      const criteriaFeedback = rubricData.criteria.map(criterion => {
        const assessment = submission.rubric_assessment[criterion.id];
        return {
          criterion: criterion.description,
          pointsEarned: assessment?.points,
          pointsPossible: criterion.points,
          performance: assessment?.rating_id ? 
            criterion.ratings.find(r => r.id === assessment.rating_id)?.description : 
            undefined,
          comments: assessment?.comments
        };
      });

      feedback = {
        totalScore: submission.score,
        totalPossible: rubricData.totalPoints,
        criteriaFeedback
      };
    }

    return {
      assignment: {
        id: rubricData.assignmentId,
        name: rubricData.assignmentName,
        points: rubricData.totalPoints
      },
      submission: submission ? {
        score: submission.score,
        grade: submission.grade,
        submittedAt: submission.submitted_at,
        workflowState: submission.workflow_state,
        rubricAssessment: submission.rubric_assessment,
        comments: submission.submission_comments?.map((comment: any) => ({
          comment: comment.comment,
          author: comment.author_name,
          createdAt: comment.created_at
        }))
      } : undefined,
      rubric: rubricData.criteria,
      feedback
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get assignment feedback: ${error.message}`);
    } else {
      throw new Error('Failed to get assignment feedback: Unknown error');
    }
  }
}
