// MCP Tool: Get Canvas Assignment Submission Comments & Feedback
// Phase 1: Direct access to submission comments for Claude analysis

import { callCanvasAPI } from "../lib/canvas-api.js";
import { fetchAllPaginated } from "../lib/pagination.js";
import { listCourses } from "./courses.js";
import { findBestMatch } from "../lib/search.js";
import { logger } from "../lib/logger.js";

export interface GetSubmissionCommentsParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  assignmentId?: string;
  assignmentName?: string;
  userId?: string; // Defaults to 'self'
  includeRubricAssessment?: boolean; // Include rubric grading details
  includeSubmissionHistory?: boolean; // Include submission attempts
}

export interface SubmissionCommentInfo {
  assignmentId: string;
  assignmentName: string;
  submissionId: string;
  userId: string;
  score: number | null;
  grade: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
  workflowState: string;
  late: boolean;
  excused: boolean;
  comments: CommentDetail[];
  rubricAssessment?: RubricAssessmentDetail[];
  submissionHistory?: SubmissionAttempt[];
}

export interface CommentDetail {
  id: string;
  authorId: string;
  authorName: string;
  comment: string;
  createdAt: string;
  editedAt?: string;
  attachments?: AttachmentDetail[];
}

export interface AttachmentDetail {
  id: string;
  filename: string;
  contentType: string;
  url: string;
  size: number;
}

export interface RubricAssessmentDetail {
  criterionId: string;
  criterionDescription: string;
  pointsEarned: number | null;
  pointsPossible: number;
  ratingId?: string;
  ratingDescription?: string;
  comments?: string;
}

export interface SubmissionAttempt {
  attempt: number;
  submittedAt: string | null;
  score: number | null;
  grade: string | null;
  body?: string;
  url?: string;
  attachments?: AttachmentDetail[];
}

export interface GetDetailedSubmissionParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  assignmentId?: string;
  assignmentName?: string;
  userId?: string; // Defaults to 'self'
}

export interface DetailedSubmissionInfo {
  assignment: {
    id: string;
    name: string;
    pointsPossible: number;
    description: string;
    dueAt: string | null;
    submissionTypes: string[];
  };
  submission: {
    id: string;
    userId: string;
    score: number | null;
    grade: string | null;
    submittedAt: string | null;
    gradedAt: string | null;
    workflowState: string;
    late: boolean;
    excused: boolean;
    body?: string;
    url?: string;
    attachments?: AttachmentDetail[];
  };
  comments: CommentDetail[];
  rubricAssessment?: RubricAssessmentDetail[];
  rubricCriteria?: Array<{
    id: string;
    description: string;
    longDescription?: string;
    points: number;
    ratings: Array<{
      id: string;
      description: string;
      longDescription?: string;
      points: number;
    }>;
  }>;
}

/**
 * Get submission comments for a specific assignment
 */
export async function getSubmissionComments(
  params: GetSubmissionCommentsParams,
): Promise<SubmissionCommentInfo> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    assignmentId,
    assignmentName,
    userId = "self",
    includeRubricAssessment = true,
    includeSubmissionHistory = false,
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  if (!courseId && !courseName) {
    throw new Error("Either courseId or courseName must be provided");
  }

  if (!assignmentId && !assignmentName) {
    throw new Error("Either assignmentId or assignmentName must be provided");
  }

  try {
    // Find course if needed
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
        throw new Error(`Could not find course matching "${courseName}"`);
      }
      courseId = matchedCourse.id;
    }

    // Find assignment if needed
    if (assignmentName && !assignmentId) {
      const assignments = await fetchAllPaginated<any>(
        canvasBaseUrl,
        accessToken,
        `/api/v1/courses/${courseId}/assignments`,
        { per_page: "100" },
      );

      const matchedAssignment = findBestMatch(assignmentName, assignments, [
        "name",
      ]);
      if (!matchedAssignment) {
        throw new Error(
          `Could not find assignment matching "${assignmentName}" in course`,
        );
      }
      assignmentId = String(matchedAssignment.id);
    }

    logger.info(
      `Getting submission comments for assignment ${assignmentId} in course ${courseId}`,
    );

    // Build include parameters
    const includeParams = ["submission_comments", "user"];
    if (includeRubricAssessment) {
      includeParams.push("rubric_assessment");
    }
    if (includeSubmissionHistory) {
      includeParams.push("submission_history");
    }

    // Get the submission
    const submissionEndpoint =
      userId === "self"
        ? `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`
        : `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;

    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: "GET",
      apiPath: `${submissionEndpoint}?include[]=${includeParams.join("&include[]=")}`,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch submission: ${response.status} ${response.statusText}`,
      );
    }

    const submissionData = await response.json();

    // Get assignment details
    const assignmentResponse = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: "GET",
      apiPath: `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    });

    const assignmentData = assignmentResponse.ok
      ? await assignmentResponse.json()
      : null;

    // Process comments
    const comments: CommentDetail[] = (
      submissionData.submission_comments || []
    ).map((comment: any) => ({
      id: String(comment.id),
      authorId: String(comment.author_id),
      authorName: comment.author_name || "Unknown",
      comment: comment.comment || "",
      createdAt: comment.created_at,
      editedAt: comment.edited_at,
      attachments: (comment.attachments || []).map((att: any) => ({
        id: String(att.id),
        filename: att.filename,
        contentType: att["content-type"] || att.content_type || "unknown",
        url: att.url,
        size: att.size || 0,
      })),
    }));

    // Process rubric assessment if included
    let rubricAssessment: RubricAssessmentDetail[] | undefined;
    if (includeRubricAssessment && submissionData.rubric_assessment) {
      rubricAssessment = Object.entries(submissionData.rubric_assessment).map(
        ([criterionId, assessment]: [string, any]) => ({
          criterionId,
          criterionDescription:
            assessment.criterion_description || "Unknown Criterion",
          pointsEarned:
            assessment.points !== undefined ? Number(assessment.points) : null,
          pointsPossible: assessment.points_possible || 0,
          ratingId: assessment.rating_id
            ? String(assessment.rating_id)
            : undefined,
          ratingDescription: assessment.rating_description,
          comments: assessment.comments,
        }),
      );
    }

    // Process submission history if included
    let submissionHistory: SubmissionAttempt[] | undefined;
    if (includeSubmissionHistory && submissionData.submission_history) {
      submissionHistory = submissionData.submission_history.map(
        (attempt: any) => ({
          attempt: attempt.attempt || 1,
          submittedAt: attempt.submitted_at,
          score: attempt.score,
          grade: attempt.grade,
          body: attempt.body,
          url: attempt.url,
          attachments: (attempt.attachments || []).map((att: any) => ({
            id: String(att.id),
            filename: att.filename,
            contentType: att["content-type"] || att.content_type || "unknown",
            url: att.url,
            size: att.size || 0,
          })),
        }),
      );
    }

    const result: SubmissionCommentInfo = {
      assignmentId: String(assignmentId),
      assignmentName: assignmentData?.name || `Assignment ${assignmentId}`,
      submissionId: String(submissionData.id),
      userId: String(submissionData.user_id),
      score: submissionData.score,
      grade: submissionData.grade,
      submittedAt: submissionData.submitted_at,
      gradedAt: submissionData.graded_at,
      workflowState: submissionData.workflow_state,
      late: submissionData.late || false,
      excused: submissionData.excused || false,
      comments,
      rubricAssessment,
      submissionHistory,
    };

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get submission comments: ${error.message}`);
    } else {
      throw new Error("Failed to get submission comments: Unknown error");
    }
  }
}

/**
 * Get detailed submission info with all feedback in one call
 */
export async function getDetailedSubmission(
  params: GetDetailedSubmissionParams,
): Promise<DetailedSubmissionInfo> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    assignmentId,
    assignmentName,
    userId = "self",
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  if (!courseId && !courseName) {
    throw new Error("Either courseId or courseName must be provided");
  }

  if (!assignmentId && !assignmentName) {
    throw new Error("Either assignmentId or assignmentName must be provided");
  }

  try {
    // Find course if needed
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
        throw new Error(`Could not find course matching "${courseName}"`);
      }
      courseId = matchedCourse.id;
    }

    // Get assignment details first
    let assignment: any;
    if (assignmentId) {
      const assignmentResponse = await callCanvasAPI({
        canvasBaseUrl,
        accessToken,
        method: "GET",
        apiPath: `/api/v1/courses/${courseId}/assignments/${assignmentId}?include[]=rubric`,
      });

      if (!assignmentResponse.ok) {
        throw new Error(
          `Failed to fetch assignment: ${assignmentResponse.status}`,
        );
      }
      assignment = await assignmentResponse.json();
    } else {
      // Find assignment by name
      const assignments = await fetchAllPaginated<any>(
        canvasBaseUrl,
        accessToken,
        `/api/v1/courses/${courseId}/assignments`,
        { per_page: "100", include: ["rubric"] },
      );

      assignment = findBestMatch(assignmentName!, assignments, ["name"]);
      if (!assignment) {
        throw new Error(
          `Could not find assignment matching "${assignmentName}" in course`,
        );
      }
      assignmentId = String(assignment.id);
    }

    // Get submission with all details
    const submissionEndpoint =
      userId === "self"
        ? `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`
        : `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;

    const submissionResponse = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: "GET",
      apiPath: `${submissionEndpoint}?include[]=submission_comments&include[]=rubric_assessment&include[]=user&include[]=attachments`,
    });

    if (!submissionResponse.ok) {
      throw new Error(
        `Failed to fetch submission: ${submissionResponse.status}`,
      );
    }

    const submissionData = await submissionResponse.json();

    // Process comments
    const comments: CommentDetail[] = (
      submissionData.submission_comments || []
    ).map((comment: any) => ({
      id: String(comment.id),
      authorId: String(comment.author_id),
      authorName: comment.author_name || "Unknown",
      comment: comment.comment || "",
      createdAt: comment.created_at,
      editedAt: comment.edited_at,
      attachments: (comment.attachments || []).map((att: any) => ({
        id: String(att.id),
        filename: att.filename,
        contentType: att["content-type"] || att.content_type || "unknown",
        url: att.url,
        size: att.size || 0,
      })),
    }));

    // Process rubric assessment
    let rubricAssessment: RubricAssessmentDetail[] | undefined;
    if (submissionData.rubric_assessment) {
      rubricAssessment = Object.entries(submissionData.rubric_assessment).map(
        ([criterionId, assessment]: [string, any]) => ({
          criterionId,
          criterionDescription:
            assessment.criterion_description || "Unknown Criterion",
          pointsEarned:
            assessment.points !== undefined ? Number(assessment.points) : null,
          pointsPossible: assessment.points_possible || 0,
          ratingId: assessment.rating_id
            ? String(assessment.rating_id)
            : undefined,
          ratingDescription: assessment.rating_description,
          comments: assessment.comments,
        }),
      );
    }

    // Process rubric criteria from assignment
    let rubricCriteria;
    if (assignment.rubric) {
      rubricCriteria = assignment.rubric.map((criterion: any) => ({
        id: String(criterion.id),
        description: criterion.description,
        longDescription: criterion.long_description,
        points: criterion.points,
        ratings: (criterion.ratings || []).map((rating: any) => ({
          id: String(rating.id),
          description: rating.description,
          longDescription: rating.long_description,
          points: rating.points,
        })),
      }));
    }

    const result: DetailedSubmissionInfo = {
      assignment: {
        id: String(assignment.id),
        name: assignment.name,
        pointsPossible: assignment.points_possible || 0,
        description: assignment.description || "",
        dueAt: assignment.due_at,
        submissionTypes: assignment.submission_types || [],
      },
      submission: {
        id: String(submissionData.id),
        userId: String(submissionData.user_id),
        score: submissionData.score,
        grade: submissionData.grade,
        submittedAt: submissionData.submitted_at,
        gradedAt: submissionData.graded_at,
        workflowState: submissionData.workflow_state,
        late: submissionData.late || false,
        excused: submissionData.excused || false,
        body: submissionData.body,
        url: submissionData.url,
        attachments: (submissionData.attachments || []).map((att: any) => ({
          id: String(att.id),
          filename: att.filename,
          contentType: att["content-type"] || att.content_type || "unknown",
          url: att.url,
          size: att.size || 0,
        })),
      },
      comments,
      rubricAssessment,
      rubricCriteria,
    };

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get detailed submission: ${error.message}`);
    } else {
      throw new Error("Failed to get detailed submission: Unknown error");
    }
  }
}
