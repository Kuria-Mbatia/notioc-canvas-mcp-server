// MCP Tool: List Canvas Assignments
// Adapted from /app/api/canvas-assignments/route.ts

import { listCourses } from './courses.js';
import { findBestMatch } from '../lib/search.js';
import { fetchAllPaginated, CanvasAssignment } from '../lib/pagination.js';
import { parseCanvasUrl, isCanvasUrl } from '../lib/url-parser.js';

export interface AssignmentListParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  includeSubmissions?: boolean;
}

export interface AssignmentInfo {
  id: string;
  name: string;
  description: string;
  dueAt: string | null;
  pointsPossible: number;
  submissionTypes: string[];
  workflowState: string;
  htmlUrl: string;
  hasSubmittedSubmissions?: boolean;
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    contentType: string;
  }>;
  embeddedFileLinks?: Array<{
    id: string;
    url: string;
    text: string;
  }>;
}

// Extract file links from HTML content
function extractFileLinks(htmlContent: string, canvasBaseUrl: string): Array<{id: string, url: string, text: string}> {
  if (!htmlContent) return [];
  
  const links: Array<{id: string, url: string, text: string}> = [];
  
  // Enhanced regex patterns to find various Canvas file link formats
  const patterns = [
    // Standard href links: href="/courses/XXXX/files/YYYY" or href="/files/YYYY"
    /href="([^"]*(?:\/courses\/\d+)?\/files\/(\d+)[^"]*)">([^<]*)</g,
    
    // Direct Canvas file URLs in text: https://domain.instructure.com/courses/XXXX/files/YYYY
    /https?:\/\/[^\/]+\.instructure\.com\/courses\/\d+\/files\/(\d+)/g,
    
    // File URLs without full domain: /courses/XXXX/files/YYYY
    /\/courses\/\d+\/files\/(\d+)/g,
    
    // Simple file references: files/YYYY
    /files\/(\d+)/g
  ];
  
  patterns.forEach((regex, index) => {
    let match;
    while ((match = regex.exec(htmlContent)) !== null) {
      if (index === 0) {
        // Full href pattern with link text
        const [, fullUrl, fileId, linkText] = match;
        const completeUrl = fullUrl.startsWith('http') ? fullUrl : `${canvasBaseUrl}${fullUrl}`;
        links.push({
          id: fileId,
          url: completeUrl,
          text: linkText.trim()
        });
      } else {
        // Other patterns - just file ID
        const fileId = match[1];
        links.push({
          id: fileId,
          url: `${canvasBaseUrl}/files/${fileId}`,
          text: `File ${fileId}`
        });
      }
    }
  });
  
  // Remove duplicates based on file ID
  const uniqueLinks = links.filter((link, index, self) => 
    index === self.findIndex(l => l.id === link.id)
  );
  
  return uniqueLinks;
}

export async function listAssignments(params: AssignmentListParams): Promise<AssignmentInfo[]> {
  let { canvasBaseUrl, accessToken, courseId, courseName, includeSubmissions = false } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!courseId && !courseName) {
    throw new Error('Either courseId or courseName must be provided');
  }

  try {
    // If courseName is provided, find the courseId first
    if (courseName && !courseId) {
      const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'all' });
      if (courses.length === 0) {
        throw new Error('No courses found for this user.');
      }
      const matchedCourse = findBestMatch(courseName, courses, ['name', 'courseCode', 'nickname']);

      if (!matchedCourse) {
        throw new Error(`Could not find a course matching "${courseName}".`);
      }
      courseId = matchedCourse.id;
    }

    const apiPath = `/api/v1/courses/${courseId}/assignments`;

    // Build query parameters - include attachments and description
    const queryParams: Record<string, any> = {
      per_page: '100',
      include: ['attachments']
    };
    if (includeSubmissions) {
      queryParams.include.push('submission');
    }

    const assignmentsData = await fetchAllPaginated<CanvasAssignment>(
      canvasBaseUrl,
      accessToken,
      apiPath,
      queryParams
    );

    // Map to the structure needed by MCP with enhanced file discovery
    const assignments: AssignmentInfo[] = assignmentsData.map(assignment => {
      // Extract embedded file links from description
      const embeddedFileLinks = extractFileLinks(assignment.description || '', canvasBaseUrl);
      
      // Process attachments
      const attachments = assignment.attachments?.map(att => ({
        id: String(att.id),
        filename: att.filename,
        url: att.url,
        contentType: att['content-type'] || att.content_type || 'unknown'
      })) || [];

      return {
        id: String(assignment.id),
        name: assignment.name || `Assignment ${assignment.id}`,
        description: assignment.description,
        dueAt: assignment.due_at,
        pointsPossible: assignment.points_possible,
        submissionTypes: assignment.submission_types,
        workflowState: assignment.workflow_state,
        htmlUrl: assignment.html_url,
        hasSubmittedSubmissions: assignment.has_submitted_submissions,
        attachments,
        embeddedFileLinks
      };
    });

    return assignments;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch assignments: ${error.message}`);
    } else {
      throw new Error('Failed to fetch assignments: Unknown error');
    }
  }
}

// Get the full details and content for a specific assignment
export async function getAssignmentDetails(params: {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  assignmentName?: string;
  assignmentId?: string;
  fullUrl?: string; // New: accepts full Canvas assignment URL
}): Promise<AssignmentInfo & { allFiles: Array<{id: string, name: string, url: string, source: string}> }> {
  
  let { canvasBaseUrl, accessToken, courseId, courseName, assignmentName, assignmentId, fullUrl } = params;
  
  // Handle full Canvas URL
  if (fullUrl && isCanvasUrl(fullUrl)) {
    const parsedUrl = parseCanvasUrl(fullUrl);
    if (parsedUrl.courseId) {
      courseId = parsedUrl.courseId;
    }
    if (parsedUrl.assignmentId) {
      assignmentId = parsedUrl.assignmentId;
    }
    if (parsedUrl.baseUrl) {
      canvasBaseUrl = parsedUrl.baseUrl;
    }
  }
  
  let assignment: AssignmentInfo;
  
  if (assignmentId) {
    // If we have assignmentId, fetch directly
    const assignments = await listAssignments({ canvasBaseUrl, accessToken, courseId, courseName });
    const foundAssignment = assignments.find(a => a.id === assignmentId);
    if (!foundAssignment) {
      throw new Error(`Could not find assignment with ID "${assignmentId}"`);
    }
    assignment = foundAssignment;
  } else if (assignmentName) {
    // Use name matching as before
    const assignments = await listAssignments({ canvasBaseUrl, accessToken, courseId, courseName });
    const foundAssignment = findBestMatch(assignmentName, assignments, ['name']);
    if (!foundAssignment) {
      throw new Error(`Could not find assignment matching "${assignmentName}"`);
    }
    assignment = foundAssignment;
  } else {
    throw new Error('Either assignmentName, assignmentId, or fullUrl must be provided');
  }

  // Combine all files from attachments and embedded links
  const allFiles: Array<{id: string, name: string, url: string, source: string}> = [];
  
  // Add attachments
  assignment.attachments?.forEach(att => {
    allFiles.push({
      id: att.id,
      name: att.filename,
      url: att.url,
      source: 'attachment'
    });
  });
  
  // Add embedded file links
  assignment.embeddedFileLinks?.forEach(link => {
    allFiles.push({
      id: link.id,
      name: link.text || `File ${link.id}`,
      url: link.url,
      source: 'embedded'
    });
  });

  return {
    ...assignment,
    allFiles
  };
}
