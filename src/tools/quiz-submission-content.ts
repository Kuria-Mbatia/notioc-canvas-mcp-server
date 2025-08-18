// MCP Tool: Quiz Submission Content Access
// Access completed quiz questions for educational review and study assistance

import { callCanvasAPI } from "../lib/canvas-api.js";
import { listCourses } from "./courses.js";
import { findBestMatch } from "../lib/search.js";
import { logger } from "../lib/logger.js";

export interface QuizSubmissionContentParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  quizId?: string;
  quizName?: string;
  submissionId?: string;
  includeAnswers?: boolean;
  includeUserResponses?: boolean;
}

export interface QuizQuestionContent {
  id: string;
  questionType: string;
  questionText: string;
  pointsPossible: number;
  answers?: QuizAnswerOption[];
  correctComments?: string;
  incorrectComments?: string;
  neutralComments?: string;
  userAnswer?: any;
  userScore?: number;
  correct?: boolean;
}

export interface QuizAnswerOption {
  id: string;
  text: string;
  weight: number;
  comments?: string;
}

export interface QuizSubmissionContent {
  quizId: string;
  quizTitle: string;
  submissionId: string;
  attempt: number;
  score: number;
  pointsPossible: number;
  submittedAt: string;
  questions: QuizQuestionContent[];
  timeSpent?: number;
  workflowState: string;
}

/**
 * Get quiz submission content for educational review
 * This accesses the legitimate Canvas endpoint for post-submission quiz review
 */
export async function getQuizSubmissionContent(
  params: QuizSubmissionContentParams,
): Promise<QuizSubmissionContent> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    quizId,
    quizName,
    submissionId,
    includeAnswers = true,
    includeUserResponses = true,
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  try {
    // If we need to resolve course name to ID
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

    // If we have a submissionId, use it directly
    if (submissionId) {
      return await getQuizSubmissionContentBySubmissionId(
        canvasBaseUrl,
        accessToken,
        submissionId,
        includeAnswers,
        includeUserResponses,
        undefined, // No submission metadata available
      );
    }

    // If we need to find the quiz by name
    if (quizName && !quizId && courseId) {
      const quizzesResponse = await callCanvasAPI({
        canvasBaseUrl,
        accessToken,
        method: "GET",
        apiPath: `/api/v1/courses/${courseId}/quizzes`,
        params: { per_page: "100" },
      });

      if (!quizzesResponse.ok) {
        throw new Error(`Failed to fetch quizzes: ${quizzesResponse.status}`);
      }

      const quizzes = await quizzesResponse.json();
      const matchedQuiz = quizzes.find((quiz: any) =>
        quiz.title?.toLowerCase().includes(quizName.toLowerCase()),
      );

      if (!matchedQuiz) {
        throw new Error(`Could not find a quiz with the name "${quizName}".`);
      }
      quizId = matchedQuiz.id;
    }

    if (!courseId || !quizId) {
      throw new Error(
        "Must provide either submissionId or (courseId/courseName + quizId/quizName)",
      );
    }

    // Get quiz submissions to find the user's submission
    const submissionsResponse = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: "GET",
      apiPath: `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions`,
      params: {
        include: ["submission", "user"],
        per_page: "100",
      },
    });

    if (!submissionsResponse.ok) {
      throw new Error(
        `Failed to fetch quiz submissions: ${submissionsResponse.status} - ${submissionsResponse.statusText}`,
      );
    }

    const submissionsData = await submissionsResponse.json();

    logger.info(
      `Raw submissions response type: ${typeof submissionsData}, isArray: ${Array.isArray(submissionsData)}`,
    );
    logger.info(`Response keys: ${Object.keys(submissionsData).join(", ")}`);

    // Handle Canvas API response format - quiz submissions are in quiz_submissions key
    let submissions = [];
    if (
      submissionsData.quiz_submissions &&
      Array.isArray(submissionsData.quiz_submissions)
    ) {
      submissions = submissionsData.quiz_submissions;
    } else if (Array.isArray(submissionsData)) {
      submissions = submissionsData;
    } else if (submissionsData.id) {
      // Single submission object
      submissions = [submissionsData];
    }

    logger.info(`Found ${submissions.length} submissions for quiz ${quizId}`);

    // Find the user's most recent completed submission
    const completedSubmissions = submissions.filter(
      (sub: any) => sub.workflow_state === "complete",
    );
    logger.info(`Found ${completedSubmissions.length} completed submissions`);

    const userSubmission = completedSubmissions.sort(
      (a: any, b: any) => b.attempt - a.attempt,
    )[0];

    if (!userSubmission) {
      // Try to get quiz assignment submission as fallback - this often works better
      logger.info(
        "No completed submission found via quiz submissions endpoint, trying assignment approach",
      );

      try {
        const assignmentResponse = await callCanvasAPI({
          canvasBaseUrl,
          accessToken,
          method: "GET",
          apiPath: `/api/v1/courses/${courseId}/assignments`,
          params: {
            include: ["submission"],
            per_page: "100",
          },
        });

        if (assignmentResponse.ok) {
          const assignments = await assignmentResponse.json();
          const quizAssignment = assignments.find(
            (a: any) => a.quiz_id === parseInt(quizId || "0"),
          );

          if (
            quizAssignment &&
            quizAssignment.submission &&
            quizAssignment.submission.workflow_state === "graded"
          ) {
            logger.info(
              `Found quiz assignment ${quizAssignment.id} with submission ${quizAssignment.submission.id}`,
            );

            // Use the assignment submission ID but treat it as a quiz submission
            return await getQuizSubmissionContentBySubmissionId(
              canvasBaseUrl,
              accessToken,
              quizAssignment.submission.id,
              includeAnswers,
              includeUserResponses,
              undefined, // No submission metadata available
            );
          }
        }
      } catch (fallbackError) {
        logger.error("Assignment fallback approach failed:", fallbackError);
      }

      throw new Error(
        "No completed quiz submissions found for this quiz. Make sure you have taken and submitted the quiz.",
      );
    }

    logger.info(
      `Found completed submission ${userSubmission.id} for quiz ${quizId}`,
    );

    // Pass the submission metadata along with the submission ID
    return await getQuizSubmissionContentBySubmissionId(
      canvasBaseUrl,
      accessToken,
      userSubmission.id,
      includeAnswers,
      includeUserResponses,
      userSubmission, // Pass the full submission object
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to get quiz submission content: ${error.message}`,
      );
    } else {
      throw new Error("Failed to get quiz submission content: Unknown error");
    }
  }
}

/**
 * Get quiz submission content by submission ID using the golden endpoint
 */
async function getQuizSubmissionContentBySubmissionId(
  canvasBaseUrl: string,
  accessToken: string,
  submissionId: string,
  includeAnswers: boolean,
  includeUserResponses: boolean,
  submissionMetadata?: any,
): Promise<QuizSubmissionContent> {
  logger.info(
    `Accessing quiz submission content for submission ${submissionId}`,
  );

  // Try to get quiz questions directly first - this is the golden endpoint
  let questionsResponse: any;
  let questionsData: any;

  try {
    questionsResponse = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: "GET",
      apiPath: `/api/v1/quiz_submissions/${submissionId}/questions`,
      params: {},
    });

    if (!questionsResponse.ok) {
      if (questionsResponse.status === 403) {
        throw new Error(
          "Access denied: This quiz submission may not be available for review, or the quiz may not be completed yet.",
        );
      }
      throw new Error(
        `Failed to fetch quiz questions: ${questionsResponse.status}`,
      );
    }

    questionsData = await questionsResponse.json();
    logger.info(
      `Successfully got quiz questions for submission ${submissionId}`,
    );
  } catch (error) {
    throw new Error(
      `Failed to fetch quiz questions: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  // Now try to get submission metadata - if this fails, we'll use what we have
  let submission: any = submissionMetadata || {
    id: submissionId,
    quiz_id: "unknown",
    attempt: 1,
    score: 0,
    workflow_state: "complete",
  };

  // If we don't have submission metadata, try to get it
  if (!submissionMetadata) {
    try {
      const submissionResponse = await callCanvasAPI({
        canvasBaseUrl,
        accessToken,
        method: "GET",
        apiPath: `/api/v1/quiz_submissions/${submissionId}`,
        params: { include: ["quiz"] },
      });

      if (submissionResponse.ok) {
        submission = await submissionResponse.json();
        logger.info(`Got quiz submission metadata for ${submission.id}`);
      } else {
        logger.info(
          `Could not get submission metadata (${submissionResponse.status}), using questions data only`,
        );
      }
    } catch (error) {
      logger.info("Using questions data without submission metadata");
    }
  } else {
    logger.info(`Using provided submission metadata for ${submissionId}`);
  }

  // Process the questions data
  const questions: QuizQuestionContent[] =
    questionsData.quiz_submission_questions?.map((q: any) => {
      const question: QuizQuestionContent = {
        id: q.id,
        questionType: q.question_type || "unknown",
        questionText: q.question_text || "",
        pointsPossible: q.points_possible || 0,
        userScore: q.points || 0,
        correct: q.correct,
      };

      // Add answers if available and requested
      if (includeAnswers && q.answers) {
        question.answers = q.answers.map((a: any) => ({
          id: a.id,
          text: a.text || a.answer_text || "",
          weight: a.weight || 0,
          comments: a.comments,
        }));
      }

      // Add user responses if available and requested
      if (includeUserResponses) {
        question.userAnswer = q.answer;
      }

      // Add feedback comments
      if (q.correct_comments) question.correctComments = q.correct_comments;
      if (q.incorrect_comments)
        question.incorrectComments = q.incorrect_comments;
      if (q.neutral_comments) question.neutralComments = q.neutral_comments;

      return question;
    }) || [];

  // Calculate score from questions if not available in submission
  const totalScore = questions.reduce((sum, q) => sum + (q.userScore || 0), 0);
  const totalPossible = questions.reduce(
    (sum, q) => sum + (q.pointsPossible || 0),
    0,
  );

  // If we have submission score but no per-question scores, estimate per-question points
  const submissionScore = submission.score || totalScore;
  const submissionPossible =
    submission.quiz?.points_possible ||
    submission.points_possible ||
    totalPossible ||
    20; // Default to 20 if unknown

  // If questions don't have individual scoring but we have overall score, estimate
  if (totalPossible === 0 && submissionPossible > 0 && questions.length > 0) {
    const estimatedPointsPerQuestion = submissionPossible / questions.length;
    questions.forEach((q) => {
      if (q.pointsPossible === 0) {
        q.pointsPossible = estimatedPointsPerQuestion;
        // Estimate user score based on correctness and overall performance
        if (q.correct !== undefined) {
          q.userScore = q.correct ? estimatedPointsPerQuestion : 0;
        } else {
          // If no correctness info, estimate based on overall performance ratio
          q.userScore =
            (submissionScore / submissionPossible) * estimatedPointsPerQuestion;
        }
      }
    });
  }

  const quizSubmissionContent: QuizSubmissionContent = {
    quizId: submission.quiz_id || "unknown",
    quizTitle: submission.quiz?.title || questionsData.quiz?.title || "Quiz",
    submissionId: submission.id,
    attempt: submission.attempt || 1,
    score: submissionScore,
    pointsPossible: submissionPossible,
    submittedAt: submission.finished_at || submission.submitted_at || "",
    timeSpent: submission.time_spent,
    workflowState: submission.workflow_state || "complete",
    questions,
  };

  logger.info(
    `Successfully retrieved ${questions.length} questions for quiz "${quizSubmissionContent.quizTitle}"`,
  );

  return quizSubmissionContent;
}

/**
 * Get user's quiz submission history for a specific quiz
 */
export async function getUserQuizSubmissionHistory(params: {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  quizId: string;
}): Promise<
  Array<{
    submissionId: string;
    attempt: number;
    score: number;
    submittedAt: string;
  }>
> {
  let { canvasBaseUrl, accessToken, courseId, courseName, quizId } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  // Resolve course name if needed
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
      throw new Error(`Could not find a course with the name "${courseName}".`);
    }
    courseId = matchedCourse.id;
  }

  if (!courseId) {
    throw new Error("Must provide courseId or courseName");
  }

  const submissionsResponse = await callCanvasAPI({
    canvasBaseUrl,
    accessToken,
    method: "GET",
    apiPath: `/api/v1/courses/${courseId}/quizzes/${quizId}/submissions`,
    params: { include: ["submission"], per_page: "100" },
  });

  if (!submissionsResponse.ok) {
    throw new Error(
      `Failed to fetch quiz submissions: ${submissionsResponse.status}`,
    );
  }

  const submissions = await submissionsResponse.json();

  return submissions
    .filter((sub: any) => sub.workflow_state === "complete")
    .map((sub: any) => ({
      submissionId: sub.id,
      attempt: sub.attempt || 1,
      score: sub.score || 0,
      submittedAt: sub.finished_at || sub.submitted_at || "",
    }))
    .sort((a: any, b: any) => b.attempt - a.attempt);
}
