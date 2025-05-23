// MCP Tool: List Canvas Assignments
// Adapted from /app/api/canvas-assignments/route.ts

import { callCanvasAPI, CanvasAssignment } from '../lib/canvas-api.js';

export interface AssignmentListParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  includeSubmissions?: boolean;
}

export interface AssignmentInfo {
  id: string;
  name: string;
  description?: string;
  dueAt?: string;
  pointsPossible?: number;
  submissionTypes?: string[];
  workflowState?: string;
  htmlUrl?: string;
  hasSubmittedSubmissions?: boolean;
}

export async function listAssignments(params: AssignmentListParams): Promise<AssignmentInfo[]> {
  const { canvasBaseUrl, accessToken, courseId, includeSubmissions = false } = params;

  if (!canvasBaseUrl || !accessToken || !courseId) {
    throw new Error('Missing required parameters: Canvas URL, Access Token, or Course ID');
  }

  try {
    const apiPath = `/api/v1/courses/${courseId}/assignments`;

    // Build query parameters
    const queryParams: Record<string, string> = {
      per_page: '100'
    };
    
    if (includeSubmissions) {
      queryParams.include = 'submission';
    }

    const canvasResponse = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath,
      params: queryParams
    });

    if (!canvasResponse.ok) {
      const errorText = await canvasResponse.text();
      throw new Error(`Canvas API Error (${canvasResponse.status}): ${errorText}`);
    }

    const assignmentsData: CanvasAssignment[] = await canvasResponse.json();

    // Map to the structure needed by MCP
    const assignments: AssignmentInfo[] = assignmentsData.map(assignment => ({
      id: String(assignment.id),
      name: assignment.name || `Assignment ${assignment.id}`,
      description: assignment.description,
      dueAt: assignment.due_at,
      pointsPossible: assignment.points_possible,
      submissionTypes: assignment.submission_types,
      workflowState: assignment.workflow_state,
      htmlUrl: assignment.html_url,
      hasSubmittedSubmissions: assignment.has_submitted_submissions,
    }));

    return assignments;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch assignments: ${error.message}`);
    } else {
      throw new Error('Failed to fetch assignments: Unknown error');
    }
  }
}
