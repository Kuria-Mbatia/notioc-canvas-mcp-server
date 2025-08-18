// MCP Tool: Previous Submission Content Access
// For reviewing submitted files from longer projects and assignments

import { callCanvasAPI } from "../lib/canvas-api.js";
import { listCourses } from "./courses.js";
import { findBestMatch } from "../lib/search.js";
import { logger } from "../lib/logger.js";
import { readFileById } from "./files.js";

export interface PreviousSubmissionParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  assignmentId?: string;
  assignmentName?: string;
  includeFileContent?: boolean; // Whether to read file content automatically
  userId?: string; // Default to 'self'
}

export interface SubmissionFileInfo {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  content?: string; // Only if includeFileContent is true
}

export interface PreviousSubmissionInfo {
  assignment: {
    id: string;
    name: string;
    description: string;
    pointsPossible: number;
    dueAt: string | null;
    submissionTypes: string[];
  };
  submission: {
    id: string;
    score: number | null;
    grade: string | null;
    submittedAt: string | null;
    workflowState: string;
    attempt: number;
    body?: string; // Text submission content
    url?: string; // URL submission
  };
  files: SubmissionFileInfo[];
  submissionHistory?: Array<{
    attempt: number;
    submittedAt: string | null;
    files: SubmissionFileInfo[];
  }>;
}

/**
 * Get previous submission content for review and analysis
 * Perfect for longer projects where you want to review what you submitted
 */
export async function getPreviousSubmissionContent(
  params: PreviousSubmissionParams,
): Promise<PreviousSubmissionInfo> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    assignmentId,
    assignmentName,
    includeFileContent = false,
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
        apiPath: `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
      });

      if (!assignmentResponse.ok) {
        throw new Error(
          `Failed to fetch assignment: ${assignmentResponse.status}`,
        );
      }
      assignment = await assignmentResponse.json();
    } else {
      // Find assignment by name
      const assignmentsResponse = await callCanvasAPI({
        canvasBaseUrl,
        accessToken,
        method: "GET",
        apiPath: `/api/v1/courses/${courseId}/assignments`,
        params: { per_page: "100" },
      });

      if (!assignmentsResponse.ok) {
        throw new Error(
          `Failed to fetch assignments: ${assignmentsResponse.status}`,
        );
      }

      const assignments = await assignmentsResponse.json();
      assignment = findBestMatch(assignmentName!, assignments, ["name"]);
      if (!assignment) {
        throw new Error(
          `Could not find assignment matching "${assignmentName}" in course`,
        );
      }
      assignmentId = String(assignment.id);
    }

    logger.info(
      `Getting previous submission content for assignment "${assignment.name}" (${assignmentId})`,
    );

    // Get submission with history
    const submissionEndpoint =
      userId === "self"
        ? `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/self`
        : `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;

    const submissionResponse = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: "GET",
      apiPath: `${submissionEndpoint}?include[]=submission_history&include[]=attachments`,
    });

    if (!submissionResponse.ok) {
      throw new Error(
        `Failed to fetch submission: ${submissionResponse.status}`,
      );
    }

    const submissionData = await submissionResponse.json();

    if (!submissionData.submitted_at) {
      throw new Error("No submission found for this assignment");
    }

    // Process current submission files
    const processFiles = async (
      attachments: any[],
    ): Promise<SubmissionFileInfo[]> => {
      const files: SubmissionFileInfo[] = [];

      for (const att of attachments || []) {
        const fileInfo: SubmissionFileInfo = {
          id: String(att.id),
          filename: att.filename,
          contentType: att["content-type"] || att.content_type || "unknown",
          size: att.size || 0,
          url: att.url,
        };

        // Read file content if requested
        if (includeFileContent) {
          try {
            // Try multiple approaches to get file content
            let fileContent;

            // First try the standard file API
            try {
              fileContent = await readFileById({
                canvasBaseUrl,
                accessToken,
                fileId: fileInfo.id,
              });
              fileInfo.content = fileContent.content;
              logger.info(
                `Read content for ${fileInfo.filename} via file API (${fileContent.content.length} chars)`,
              );
            } catch (apiError) {
              logger.warn(
                `File API failed for ${fileInfo.filename}, trying direct URL: ${apiError}`,
              );

              // Try direct URL download with proper authentication
              try {
                const directResponse = await fetch(fileInfo.url, {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "User-Agent": "Canvas-MCP-Client/1.0",
                  },
                  redirect: "follow",
                });

                if (directResponse.ok) {
                  const contentType =
                    directResponse.headers.get("content-type");
                  if (
                    contentType?.includes("text") ||
                    contentType?.includes("json")
                  ) {
                    fileInfo.content = await directResponse.text();
                  } else {
                    // For binary files, try to extract text or provide a description
                    const buffer = await directResponse.arrayBuffer();
                    fileInfo.content = `[Binary file: ${fileInfo.filename}, ${buffer.byteLength} bytes, type: ${contentType}]`;
                  }
                  logger.info(
                    `Read content for ${fileInfo.filename} via direct URL (${fileInfo.content.length} chars)`,
                  );
                } else {
                  throw new Error(
                    `Direct download failed: ${directResponse.status} ${directResponse.statusText}`,
                  );
                }
              } catch (directError) {
                logger.warn(
                  `Direct URL download failed for ${fileInfo.filename}: ${directError}`,
                );
                fileInfo.content = `[Could not download file content. File available at: ${fileInfo.url}]`;
              }
            }
          } catch (fileError) {
            logger.warn(
              `Could not read content for ${fileInfo.filename}: ${fileError}`,
            );
            fileInfo.content = `[Error reading file: ${fileError instanceof Error ? fileError.message : "Unknown error"}]`;
          }
        }

        files.push(fileInfo);
      }

      return files;
    };

    // Process current submission files
    const currentFiles = await processFiles(submissionData.attachments || []);

    // Process submission history if available
    let submissionHistory:
      | Array<{
          attempt: number;
          submittedAt: string | null;
          files: SubmissionFileInfo[];
        }>
      | undefined;

    if (
      submissionData.submission_history &&
      submissionData.submission_history.length > 1
    ) {
      submissionHistory = [];

      for (const historyItem of submissionData.submission_history) {
        if (historyItem.submitted_at) {
          const historyFiles = await processFiles(
            historyItem.attachments || [],
          );
          submissionHistory.push({
            attempt: historyItem.attempt || 1,
            submittedAt: historyItem.submitted_at,
            files: historyFiles,
          });
        }
      }
    }

    const result: PreviousSubmissionInfo = {
      assignment: {
        id: String(assignment.id),
        name: assignment.name,
        description: assignment.description || "",
        pointsPossible: assignment.points_possible || 0,
        dueAt: assignment.due_at,
        submissionTypes: assignment.submission_types || [],
      },
      submission: {
        id: String(submissionData.id),
        score: submissionData.score,
        grade: submissionData.grade,
        submittedAt: submissionData.submitted_at,
        workflowState: submissionData.workflow_state,
        attempt: submissionData.attempt || 1,
        body: submissionData.body,
        url: submissionData.url,
      },
      files: currentFiles,
      submissionHistory,
    };

    logger.info(
      `Retrieved submission with ${currentFiles.length} files for "${assignment.name}"`,
    );

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to get previous submission content: ${error.message}`,
      );
    } else {
      throw new Error(
        "Failed to get previous submission content: Unknown error",
      );
    }
  }
}

/**
 * Get a list of all submitted assignments for easy browsing
 */
export async function listSubmittedAssignments(params: {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  userId?: string;
}): Promise<
  Array<{
    id: string;
    name: string;
    submittedAt: string;
    score: number | null;
    fileCount: number;
    submissionTypes: string[];
  }>
> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    userId = "self",
  } = params;

  if (!courseId && !courseName) {
    throw new Error("Either courseId or courseName must be provided");
  }

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

  // Get assignments with submissions
  const assignmentsResponse = await callCanvasAPI({
    canvasBaseUrl,
    accessToken,
    method: "GET",
    apiPath: `/api/v1/courses/${courseId}/assignments`,
    params: {
      include: ["submission"],
      per_page: "100",
    },
  });

  if (!assignmentsResponse.ok) {
    throw new Error(
      `Failed to fetch assignments: ${assignmentsResponse.status}`,
    );
  }

  const assignments = await assignmentsResponse.json();

  // Filter to only assignments with submissions
  const submittedAssignments = assignments
    .filter(
      (assignment: any) =>
        assignment.submission && assignment.submission.submitted_at,
    )
    .map((assignment: any) => ({
      id: String(assignment.id),
      name: assignment.name,
      submittedAt: assignment.submission.submitted_at,
      score: assignment.submission.score,
      fileCount: assignment.submission.attachments
        ? assignment.submission.attachments.length
        : 0,
      submissionTypes: assignment.submission_types || [],
    }))
    .sort(
      (a: any, b: any) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );

  return submittedAssignments;
}
