// MCP Tool: Canvas Peer Reviews
// Expose peer review assignments - students miss these because Canvas doesn't surface them well

import { logger } from '../lib/logger.js';

// Peer Review Types
export interface PeerReview {
  id?: number;
  asset_id: number; // Assignment ID
  asset_type: string;
  assessor_id: number;
  assessor: {
    id: number;
    display_name: string;
    avatar_image_url?: string;
    html_url?: string;
    anonymous?: boolean;
  };
  user_id: number; // The person being assessed
  user?: {
    id: number;
    display_name: string;
    avatar_image_url?: string;
    html_url?: string;
    anonymous?: boolean;
  };
  workflow_state: string;
  submission_id?: number;
  submission_comments?: any[];
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PeerReviewSubmission {
  id: number;
  assignment_id: number;
  user_id: number;
  submitted_at: string | null;
  body?: string;
  preview_url?: string;
  attachments?: Array<{
    id: number;
    filename: string;
    display_name: string;
    url: string;
    size: number;
    'content-type': string;
  }>;
  submission_comments?: Array<{
    id: number;
    author_id: number;
    author_name: string;
    comment: string;
    created_at: string;
  }>;
}

export interface GetPeerReviewsParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  assignmentId?: string;
  userId?: string; // Defaults to 'self'
}

export interface GetPeerReviewSubmissionParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  assignmentId: string;
  submissionId: string;
}

/**
 * List peer reviews for an assignment
 * Returns both reviews TO complete and reviews OF your work
 */
export async function listPeerReviews(params: GetPeerReviewsParams): Promise<{
  myReviewsToComplete: PeerReview[];
  reviewsOfMyWork: PeerReview[];
  assignmentTitle?: string;
  assignmentDueAt?: string;
}> {
  const { canvasBaseUrl, accessToken, courseId, assignmentId, userId = 'self' } = params;

  try {
    logger.info(`[PeerReviews] Fetching peer reviews for assignment ${assignmentId}`);

    // Resolve user ID if needed
    let resolvedUserId = userId;
    if (userId === 'self') {
      const userResponse = await fetch(`${canvasBaseUrl}/api/v1/users/self`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to resolve user ID: ${userResponse.statusText}`);
      }

      const userData = await userResponse.json();
      resolvedUserId = userData.id.toString();
    }

    // Get assignment details for context
    let assignmentTitle: string | undefined;
    let assignmentDueAt: string | undefined;
    
    if (assignmentId) {
      try {
        const assignmentResponse = await fetch(
          `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );

        if (assignmentResponse.ok) {
          const assignment = await assignmentResponse.json();
          assignmentTitle = assignment.name;
          assignmentDueAt = assignment.due_at;
        }
      } catch (err) {
        logger.warn('[PeerReviews] Could not fetch assignment details:', err);
      }
    }

    // Get all peer reviews for the assignment
    const reviewsResponse = await fetch(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/peer_reviews?include[]=user&include[]=submission_comments`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!reviewsResponse.ok) {
      if (reviewsResponse.status === 404) {
        throw new Error('Peer reviews not available for this assignment. Assignment may not have peer reviews enabled.');
      }
      throw new Error(`Failed to fetch peer reviews: ${reviewsResponse.statusText}`);
    }

    const allReviews: PeerReview[] = await reviewsResponse.json();

    // Split into reviews TO complete (where I am assessor) and reviews OF my work (where I am user)
    const myReviewsToComplete = allReviews.filter(
      review => review.assessor_id.toString() === resolvedUserId
    );

    const reviewsOfMyWork = allReviews.filter(
      review => review.user_id.toString() === resolvedUserId
    );

    logger.info(`[PeerReviews] Found ${myReviewsToComplete.length} reviews to complete, ${reviewsOfMyWork.length} reviews of my work`);

    return {
      myReviewsToComplete,
      reviewsOfMyWork,
      assignmentTitle,
      assignmentDueAt,
    };

  } catch (error) {
    logger.error('[PeerReviews] Error fetching peer reviews:', error);
    throw error;
  }
}

/**
 * Get all peer reviews across all courses
 * Useful for "Do I have any peer reviews to complete?"
 */
export async function getAllPeerReviews(params: {
  canvasBaseUrl: string;
  accessToken: string;
  userId?: string;
}): Promise<Array<{
  courseId: string;
  courseName: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentDueAt: string | null;
  reviewsToComplete: number;
  reviewsReceived: number;
}>> {
  const { canvasBaseUrl, accessToken, userId = 'self' } = params;

  try {
    logger.info('[PeerReviews] Fetching all peer reviews across courses');

    // Resolve user ID
    let resolvedUserId = userId;
    if (userId === 'self') {
      const userResponse = await fetch(`${canvasBaseUrl}/api/v1/users/self`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!userResponse.ok) {
        throw new Error(`Failed to resolve user ID: ${userResponse.statusText}`);
      }

      const userData = await userResponse.json();
      resolvedUserId = userData.id.toString();
    }

    // Get all active courses
    const coursesResponse = await fetch(
      `${canvasBaseUrl}/api/v1/courses?enrollment_state=active&per_page=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!coursesResponse.ok) {
      throw new Error(`Failed to fetch courses: ${coursesResponse.statusText}`);
    }

    const courses = await coursesResponse.json();

    const peerReviewSummary: Array<{
      courseId: string;
      courseName: string;
      assignmentId: string;
      assignmentTitle: string;
      assignmentDueAt: string | null;
      reviewsToComplete: number;
      reviewsReceived: number;
    }> = [];

    // For each course, get assignments with peer reviews
    for (const course of courses) {
      try {
        const assignmentsResponse = await fetch(
          `${canvasBaseUrl}/api/v1/courses/${course.id}/assignments?per_page=100`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );

        if (!assignmentsResponse.ok) continue;

        const assignments = await assignmentsResponse.json();

        // Filter assignments with peer reviews enabled
        const peerReviewAssignments = assignments.filter((a: any) => a.peer_reviews);

        for (const assignment of peerReviewAssignments) {
          try {
            const reviewsData = await listPeerReviews({
              canvasBaseUrl,
              accessToken,
              courseId: course.id.toString(),
              assignmentId: assignment.id.toString(),
              userId: resolvedUserId,
            });

            // Only include if there are reviews to complete or received
            if (reviewsData.myReviewsToComplete.length > 0 || reviewsData.reviewsOfMyWork.length > 0) {
              peerReviewSummary.push({
                courseId: course.id.toString(),
                courseName: course.name,
                assignmentId: assignment.id.toString(),
                assignmentTitle: assignment.name,
                assignmentDueAt: assignment.due_at,
                reviewsToComplete: reviewsData.myReviewsToComplete.length,
                reviewsReceived: reviewsData.reviewsOfMyWork.length,
              });
            }
          } catch (err) {
            // Skip assignments with errors
            logger.warn(`[PeerReviews] Could not fetch reviews for assignment ${assignment.id}:`, err);
          }
        }
      } catch (err) {
        logger.warn(`[PeerReviews] Could not fetch assignments for course ${course.id}:`, err);
      }
    }

    logger.info(`[PeerReviews] Found ${peerReviewSummary.length} assignments with peer reviews`);

    return peerReviewSummary;

  } catch (error) {
    logger.error('[PeerReviews] Error fetching all peer reviews:', error);
    throw error;
  }
}

/**
 * Get submission content for peer review
 */
export async function getPeerReviewSubmission(params: GetPeerReviewSubmissionParams): Promise<PeerReviewSubmission> {
  const { canvasBaseUrl, accessToken, courseId, assignmentId, submissionId } = params;

  try {
    logger.info(`[PeerReviews] Fetching submission ${submissionId} for peer review`);

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}?include[]=submission_comments`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch submission: ${response.statusText}`);
    }

    const submission: PeerReviewSubmission = await response.json();

    logger.info(`[PeerReviews] Retrieved submission for user ${submission.user_id}`);

    return submission;

  } catch (error) {
    logger.error('[PeerReviews] Error fetching submission:', error);
    throw error;
  }
}

/**
 * Format peer reviews for display
 */
export function formatPeerReviews(data: {
  myReviewsToComplete: PeerReview[];
  reviewsOfMyWork: PeerReview[];
  assignmentTitle?: string;
  assignmentDueAt?: string;
}): string {
  const { myReviewsToComplete, reviewsOfMyWork, assignmentTitle, assignmentDueAt } = data;

  let output = `📝 Peer Reviews`;
  
  if (assignmentTitle) {
    output += `: **${assignmentTitle}**`;
  }
  
  if (assignmentDueAt) {
    const dueDate = new Date(assignmentDueAt);
    output += `\n📅 Due: ${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString()}`;
  }
  
  output += '\n\n';

  // Reviews TO complete
  if (myReviewsToComplete.length > 0) {
    output += `⏳ **Reviews You Need to Complete (${myReviewsToComplete.length}):**\n\n`;

    for (const review of myReviewsToComplete) {
      const studentName = review.user?.anonymous 
        ? 'Anonymous Student' 
        : (review.user?.display_name || `Student ${review.user_id}`);
      
      const status = review.completed_at ? '✅ Complete' : '❌ Incomplete';
      const completedDate = review.completed_at 
        ? `\n   Completed: ${new Date(review.completed_at).toLocaleString()}`
        : '';

      output += `  ${status} - Review submission by **${studentName}**\n`;
      output += `   Submission ID: ${review.submission_id}\n`;
      output += completedDate;
      
      if (review.submission_comments && review.submission_comments.length > 0) {
        output += `\n   Comments: ${review.submission_comments.length} comment${review.submission_comments.length > 1 ? 's' : ''}\n`;
      }
      
      output += '\n';
    }
  } else {
    output += `✅ **No peer reviews to complete**\n\n`;
  }

  // Reviews OF my work
  if (reviewsOfMyWork.length > 0) {
    output += `📬 **Reviews of Your Work (${reviewsOfMyWork.length}):**\n\n`;

    for (const review of reviewsOfMyWork) {
      const reviewerName = review.assessor?.anonymous 
        ? 'Anonymous Reviewer' 
        : (review.assessor?.display_name || `Reviewer ${review.assessor_id}`);
      
      const status = review.completed_at ? '✅ Completed' : '⏳ Pending';
      const completedDate = review.completed_at 
        ? ` on ${new Date(review.completed_at).toLocaleDateString()}`
        : '';

      output += `  ${status} - **${reviewerName}**${completedDate}\n`;
      
      if (review.submission_comments && review.submission_comments.length > 0) {
        output += `   💬 Feedback: ${review.submission_comments.length} comment${review.submission_comments.length > 1 ? 's' : ''}\n`;
      }
      
      output += '\n';
    }
  } else {
    output += `⏳ **No reviews received yet**\n\n`;
  }

  output += `💡 **Tip:** Use get_peer_review_submission to read the submission content you need to review.`;

  return output;
}

/**
 * Format all peer reviews summary
 */
export function formatAllPeerReviews(summary: Array<{
  courseId: string;
  courseName: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentDueAt: string | null;
  reviewsToComplete: number;
  reviewsReceived: number;
}>): string {
  if (summary.length === 0) {
    return '✅ No peer reviews pending! You\'re all caught up.';
  }

  let output = `📝 All Peer Reviews (${summary.length} assignments)\n\n`;

  // Sort by due date (soonest first)
  const sorted = summary.sort((a, b) => {
    if (!a.assignmentDueAt) return 1;
    if (!b.assignmentDueAt) return -1;
    return new Date(a.assignmentDueAt).getTime() - new Date(b.assignmentDueAt).getTime();
  });

  for (const item of sorted) {
    const incomplete = item.reviewsToComplete;
    const urgency = incomplete > 0 ? '⚠️' : '✅';
    
    output += `${urgency} **${item.courseName}** - ${item.assignmentTitle}\n`;
    
    if (item.assignmentDueAt) {
      const dueDate = new Date(item.assignmentDueAt);
      output += `   📅 Due: ${dueDate.toLocaleDateString()}\n`;
    }
    
    if (incomplete > 0) {
      output += `   ⏳ ${incomplete} review${incomplete > 1 ? 's' : ''} to complete\n`;
    }
    
    if (item.reviewsReceived > 0) {
      output += `   📬 ${item.reviewsReceived} review${item.reviewsReceived > 1 ? 's' : ''} received\n`;
    }
    
    output += `   🆔 Course: ${item.courseId}, Assignment: ${item.assignmentId}\n\n`;
  }

  const totalIncomplete = sorted.reduce((sum, item) => sum + item.reviewsToComplete, 0);
  
  if (totalIncomplete > 0) {
    output += `⚠️ **Action Required:** ${totalIncomplete} peer review${totalIncomplete > 1 ? 's' : ''} to complete!\n\n`;
  }

  output += `💡 **Tip:** Use list_peer_reviews_for_assignment to see details for a specific assignment.`;

  return output;
}
