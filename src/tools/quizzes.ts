// MCP Tool: Canvas Quizzes
// Implementation of Canvas quiz functionality

import { callCanvasAPI } from "../lib/canvas-api.js";
import { fetchAllPaginated } from "../lib/pagination.js";
import { listCourses } from "./courses.js";
import { findBestMatch } from "../lib/search.js";
import { logger } from "../lib/logger.js";

export interface ListQuizzesParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  searchTerm?: string;
}

export interface QuizDetailsParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  quizId: string;
  include?: ("assignment" | "submissions" | "all_dates" | "permissions")[];
}

export interface QuizSubmissionsParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  quizId: string;
  include?: ("submission" | "quiz" | "user")[];
}

export interface QuizInfo {
  id: string;
  title: string;
  description?: string;
  htmlUrl: string;
  mobileUrl?: string;
  previewUrl?: string;
  quizType: string;
  assignmentGroupId?: string;
  timeLimit?: number;
  shuffleAnswers?: boolean;
  hideResults?: string;
  showCorrectAnswers?: boolean;
  showCorrectAnswersLastAttempt?: boolean;
  showCorrectAnswersAt?: string;
  hideCorrectAnswersAt?: string;
  allowedAttempts: number;
  scoringPolicy?: string;
  oneQuestionAtATime?: boolean;
  cantGoBack?: boolean;
  accessCode?: string;
  ipFilter?: string;
  dueAt?: string;
  lockAt?: string;
  unlockAt?: string;
  published: boolean;
  unpublishable: boolean;
  lockedForUser: boolean;
  lockInfo?: any;
  lockExplanation?: string;
  speedgraderUrl?: string;
  quizExtensionsUrl?: string;
  pointsPossible: number;
  questionCount: number;
  questionTypes: string[];
  hasAccessCode: boolean;
  postToSis: boolean;
  migrationId?: string;
}

export interface QuizSubmissionInfo {
  id: string;
  quizId: string;
  userId?: string;
  submissionId?: string;
  startedAt?: string;
  finishedAt?: string;
  endAt?: string;
  attempt: number;
  extraAttempts?: number;
  extraTime?: number;
  manuallyUnlocked?: boolean;
  timeSpent?: number;
  score?: number;
  scoreBeforeRegrade?: number;
  keptScore?: number;
  fudgePoints?: number;
  hasSeenResults?: boolean;
  workflowState: string;
  quizPointsPossible?: number;
  validationToken?: string;
  htmlUrl?: string;
}

/**
 * List quizzes in a course
 */
export async function listQuizzes(
  params: ListQuizzesParams,
): Promise<QuizInfo[]> {
  let { canvasBaseUrl, accessToken, courseId, courseName, searchTerm } = params;

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
      `Listing quizzes for course ${courseId}${searchTerm ? ` matching "${searchTerm}"` : ""}`,
    );

    const queryParams: Record<string, any> = {
      per_page: "100",
    };

    if (searchTerm) {
      queryParams.search_term = searchTerm;
    }

    const quizzesData = await fetchAllPaginated<any>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/courses/${courseId}/quizzes`,
      queryParams,
    );

    const quizzes: QuizInfo[] = quizzesData.map((quiz) => ({
      id: quiz.id,
      title: quiz.title || `Quiz ${quiz.id}`,
      description: quiz.description,
      htmlUrl: quiz.html_url,
      mobileUrl: quiz.mobile_url,
      previewUrl: quiz.preview_url,
      quizType: quiz.quiz_type || "practice_quiz",
      assignmentGroupId: quiz.assignment_group_id,
      timeLimit: quiz.time_limit,
      shuffleAnswers: quiz.shuffle_answers || false,
      hideResults: quiz.hide_results,
      showCorrectAnswers: quiz.show_correct_answers || false,
      showCorrectAnswersLastAttempt:
        quiz.show_correct_answers_last_attempt || false,
      showCorrectAnswersAt: quiz.show_correct_answers_at,
      hideCorrectAnswersAt: quiz.hide_correct_answers_at,
      allowedAttempts: quiz.allowed_attempts || 1,
      scoringPolicy: quiz.scoring_policy,
      oneQuestionAtATime: quiz.one_question_at_a_time || false,
      cantGoBack: quiz.cant_go_back || false,
      accessCode: quiz.access_code,
      ipFilter: quiz.ip_filter,
      dueAt: quiz.due_at,
      lockAt: quiz.lock_at,
      unlockAt: quiz.unlock_at,
      published: quiz.published || false,
      unpublishable: quiz.unpublishable || false,
      lockedForUser: quiz.locked_for_user || false,
      lockInfo: quiz.lock_info,
      lockExplanation: quiz.lock_explanation,
      speedgraderUrl: quiz.speedgrader_url,
      quizExtensionsUrl: quiz.quiz_extensions_url,
      pointsPossible: quiz.points_possible || 0,
      questionCount: quiz.question_count || 0,
      questionTypes: quiz.question_types || [],
      hasAccessCode: quiz.has_access_code || false,
      postToSis: quiz.post_to_sis || false,
      migrationId: quiz.migration_id,
    }));

    // Apply search term filtering if provided (client-side filtering as backup)
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      return quizzes.filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(lowerSearchTerm) ||
          (quiz.description &&
            quiz.description.toLowerCase().includes(lowerSearchTerm)),
      );
    }

    return quizzes;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to list quizzes: ${error.message}`);
    } else {
      throw new Error("Failed to list quizzes: Unknown error");
    }
  }
}

/**
 * Get details of a specific quiz
 */
export async function getQuizDetails(
  params: QuizDetailsParams,
): Promise<
  QuizInfo & { assignment?: any; submissions?: QuizSubmissionInfo[] }
> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    quizId,
    include = ["assignment"],
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  if (!courseId && !courseName) {
    throw new Error("Either courseId or courseName must be provided");
  }

  if (!quizId) {
    throw new Error("quizId is required");
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

    logger.info(`Getting details for quiz ${quizId} in course ${courseId}`);

    const queryParams: Record<string, any> = {};

    if (include && include.length > 0) {
      queryParams.include = include;
    }

    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: "GET",
      apiPath: `/api/v1/courses/${courseId}/quizzes/${quizId}`,
      params: queryParams,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get quiz details: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const quiz = await response.json();

    const quizInfo: QuizInfo = {
      id: quiz.id,
      title: quiz.title || `Quiz ${quiz.id}`,
      description: quiz.description,
      htmlUrl: quiz.html_url,
      mobileUrl: quiz.mobile_url,
      previewUrl: quiz.preview_url,
      quizType: quiz.quiz_type || "practice_quiz",
      assignmentGroupId: quiz.assignment_group_id,
      timeLimit: quiz.time_limit,
      shuffleAnswers: quiz.shuffle_answers || false,
      hideResults: quiz.hide_results,
      showCorrectAnswers: quiz.show_correct_answers || false,
      showCorrectAnswersLastAttempt:
        quiz.show_correct_answers_last_attempt || false,
      showCorrectAnswersAt: quiz.show_correct_answers_at,
      hideCorrectAnswersAt: quiz.hide_correct_answers_at,
      allowedAttempts: quiz.allowed_attempts || 1,
      scoringPolicy: quiz.scoring_policy,
      oneQuestionAtATime: quiz.one_question_at_a_time || false,
      cantGoBack: quiz.cant_go_back || false,
      accessCode: quiz.access_code,
      ipFilter: quiz.ip_filter,
      dueAt: quiz.due_at,
      lockAt: quiz.lock_at,
      unlockAt: quiz.unlock_at,
      published: quiz.published || false,
      unpublishable: quiz.unpublishable || false,
      lockedForUser: quiz.locked_for_user || false,
      lockInfo: quiz.lock_info,
      lockExplanation: quiz.lock_explanation,
      speedgraderUrl: quiz.speedgrader_url,
      quizExtensionsUrl: quiz.quiz_extensions_url,
      pointsPossible: quiz.points_possible || 0,
      questionCount: quiz.question_count || 0,
      questionTypes: quiz.question_types || [],
      hasAccessCode: quiz.has_access_code || false,
      postToSis: quiz.post_to_sis || false,
      migrationId: quiz.migration_id,
    };

    const result: any = quizInfo;

    if (quiz.assignment && include.includes("assignment")) {
      result.assignment = quiz.assignment;
    }

    if (quiz.submissions && include.includes("submissions")) {
      result.submissions = quiz.submissions.map((sub: any) => ({
        id: sub.id,
        quizId: sub.quiz_id,
        userId: sub.user_id,
        submissionId: sub.submission_id,
        startedAt: sub.started_at,
        finishedAt: sub.finished_at,
        endAt: sub.end_at,
        attempt: sub.attempt || 1,
        extraAttempts: sub.extra_attempts,
        extraTime: sub.extra_time,
        manuallyUnlocked: sub.manually_unlocked || false,
        timeSpent: sub.time_spent,
        score: sub.score,
        scoreBeforeRegrade: sub.score_before_regrade,
        keptScore: sub.kept_score,
        fudgePoints: sub.fudge_points,
        hasSeenResults: sub.has_seen_results || false,
        workflowState: sub.workflow_state || "untaken",
        quizPointsPossible: sub.quiz_points_possible,
        validationToken: sub.validation_token,
        htmlUrl: sub.html_url,
      }));
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get quiz details: ${error.message}`);
    } else {
      throw new Error("Failed to get quiz details: Unknown error");
    }
  }
}

/**
 * Get quiz submissions for a specific quiz
 */
export async function getQuizSubmissions(
  params: QuizSubmissionsParams,
): Promise<QuizSubmissionInfo[]> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    quizId,
    include = ["submission", "user"],
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  if (!courseId && !courseName) {
    throw new Error("Either courseId or courseName must be provided");
  }

  if (!quizId) {
    throw new Error("quizId is required");
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

    logger.info(`Getting submissions for quiz ${quizId} in course ${courseId}`);

    const queryParams: Record<string, any> = {
      per_page: "100",
    };

    if (include && include.length > 0) {
      queryParams.include = include;
    }

    const submissionsData = await fetchAllPaginated<any>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions`,
      queryParams,
    );

    const submissions: QuizSubmissionInfo[] = submissionsData.map((sub) => ({
      id: sub.id,
      quizId: sub.quiz_id,
      userId: sub.user_id,
      submissionId: sub.submission_id,
      startedAt: sub.started_at,
      finishedAt: sub.finished_at,
      endAt: sub.end_at,
      attempt: sub.attempt || 1,
      extraAttempts: sub.extra_attempts,
      extraTime: sub.extra_time,
      manuallyUnlocked: sub.manually_unlocked || false,
      timeSpent: sub.time_spent,
      score: sub.score,
      scoreBeforeRegrade: sub.score_before_regrade,
      keptScore: sub.kept_score,
      fudgePoints: sub.fudge_points,
      hasSeenResults: sub.has_seen_results || false,
      workflowState: sub.workflow_state || "untaken",
      quizPointsPossible: sub.quiz_points_possible,
      validationToken: sub.validation_token,
      htmlUrl: sub.html_url,
    }));

    return submissions;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get quiz submissions: ${error.message}`);
    } else {
      throw new Error("Failed to get quiz submissions: Unknown error");
    }
  }
}
