// MCP Tool: Canvas Analytics Dashboard
// Expose Canvas's built-in analytics dashboard (participation, engagement, assignment patterns)

import { logger } from '../lib/logger.js';

// Canvas Analytics Types
export interface StudentSummary {
  id: number;
  page_views: number;
  page_views_level: number; // 0=low, 1=medium, 2=high
  participations: number;
  participations_level: number; // 0=low, 1=medium, 2=high
  tardiness_breakdown: {
    total: number;
    on_time: number;
    late: number;
    missing: number;
    floating: number;
  };
}

export interface ActivityData {
  date: string;
  views: number;
  participations: number;
}

export interface AssignmentData {
  assignment_id: number;
  title: string;
  due_at: string | null;
  points_possible: number;
  non_digital_submission: boolean;
  submission: {
    submitted_at: string | null;
    score: number | null;
    late: boolean;
    missing: boolean;
    excused: boolean;
  } | null;
}

export interface CommunicationData {
  date: string;
  messages_sent: number;
  messages_received: number;
}

export interface GetCourseAnalyticsParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
  userId?: string; // Defaults to 'self' if not provided
}

/**
 * Get student summary analytics for a course
 * This is Canvas's native analytics dashboard data
 */
export async function getCourseAnalytics(params: GetCourseAnalyticsParams): Promise<StudentSummary> {
  const { canvasBaseUrl, accessToken, courseId, userId = 'self' } = params;

  try {
    logger.info(`[Analytics] Fetching course analytics for course ${courseId}`);

    // First, resolve user ID if 'self'
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

    // Get student summary analytics
    const summaryResponse = await fetch(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/analytics/users/${resolvedUserId}/student_summary`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!summaryResponse.ok) {
      // Analytics might not be available for all courses
      if (summaryResponse.status === 404) {
        throw new Error('Analytics not available for this course. Institutional analytics may be disabled.');
      }
      throw new Error(`Failed to fetch analytics: ${summaryResponse.statusText}`);
    }

    const summary: StudentSummary = await summaryResponse.json();

    logger.info(`[Analytics] Retrieved analytics: ${summary.page_views} page views, ${summary.participations} participations`);

    return summary;

  } catch (error) {
    logger.error('[Analytics] Error fetching course analytics:', error);
    throw error;
  }
}

/**
 * Get detailed activity data (page views and participations over time)
 */
export async function getActivityData(params: GetCourseAnalyticsParams): Promise<ActivityData[]> {
  const { canvasBaseUrl, accessToken, courseId, userId = 'self' } = params;

  try {
    logger.info(`[Analytics] Fetching activity data for course ${courseId}`);

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

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/analytics/users/${resolvedUserId}/activity`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Activity data not available for this course.');
      }
      throw new Error(`Failed to fetch activity data: ${response.statusText}`);
    }

    const activity: ActivityData[] = await response.json();

    logger.info(`[Analytics] Retrieved ${activity.length} days of activity data`);

    return activity;

  } catch (error) {
    logger.error('[Analytics] Error fetching activity data:', error);
    throw error;
  }
}

/**
 * Get assignment analytics data
 */
export async function getAssignmentAnalytics(params: GetCourseAnalyticsParams): Promise<AssignmentData[]> {
  const { canvasBaseUrl, accessToken, courseId, userId = 'self' } = params;

  try {
    logger.info(`[Analytics] Fetching assignment analytics for course ${courseId}`);

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

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/analytics/users/${resolvedUserId}/assignments`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Assignment analytics not available for this course.');
      }
      throw new Error(`Failed to fetch assignment analytics: ${response.statusText}`);
    }

    const assignments: AssignmentData[] = await response.json();

    logger.info(`[Analytics] Retrieved analytics for ${assignments.length} assignments`);

    return assignments;

  } catch (error) {
    logger.error('[Analytics] Error fetching assignment analytics:', error);
    throw error;
  }
}

/**
 * Get communication analytics (messaging activity)
 */
export async function getCommunicationAnalytics(params: GetCourseAnalyticsParams): Promise<CommunicationData[]> {
  const { canvasBaseUrl, accessToken, courseId, userId = 'self' } = params;

  try {
    logger.info(`[Analytics] Fetching communication analytics for course ${courseId}`);

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

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/analytics/users/${resolvedUserId}/communication`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Communication analytics not available for this course.');
      }
      throw new Error(`Failed to fetch communication analytics: ${response.statusText}`);
    }

    const communication: CommunicationData[] = await response.json();

    logger.info(`[Analytics] Retrieved ${communication.length} days of communication data`);

    return communication;

  } catch (error) {
    logger.error('[Analytics] Error fetching communication analytics:', error);
    throw error;
  }
}

/**
 * Format analytics summary for display
 */
export function formatAnalyticsSummary(
  summary: StudentSummary,
  activityData?: ActivityData[],
  assignmentData?: AssignmentData[]
): string {
  let output = `📊 Canvas Analytics Dashboard\n\n`;

  // Engagement levels
  const pageViewsLevel = ['🔴 Low', '🟡 Medium', '🟢 High'][summary.page_views_level] || 'Unknown';
  const participationsLevel = ['🔴 Low', '🟡 Medium', '🟢 High'][summary.participations_level] || 'Unknown';

  output += `**Engagement Metrics:**\n`;
  output += `📄 Page Views: ${summary.page_views} views (${pageViewsLevel})\n`;
  output += `💬 Participations: ${summary.participations} activities (${participationsLevel})\n`;
  output += `   (Participations = discussions, submissions, quizzes, etc.)\n\n`;

  // Tardiness breakdown
  const tardiness = summary.tardiness_breakdown;
  const totalAssignments = tardiness.total;
  const onTimePercent = totalAssignments > 0 ? Math.round((tardiness.on_time / totalAssignments) * 100) : 0;
  const latePercent = totalAssignments > 0 ? Math.round((tardiness.late / totalAssignments) * 100) : 0;
  const missingPercent = totalAssignments > 0 ? Math.round((tardiness.missing / totalAssignments) * 100) : 0;

  output += `**Assignment Submission Patterns:**\n`;
  output += `✅ On Time: ${tardiness.on_time} (${onTimePercent}%)\n`;
  output += `⏰ Late: ${tardiness.late} (${latePercent}%)\n`;
  output += `❌ Missing: ${tardiness.missing} (${missingPercent}%)\n`;
  if (tardiness.floating > 0) {
    output += `📝 No Due Date: ${tardiness.floating}\n`;
  }
  output += `📊 Total: ${totalAssignments} assignments\n\n`;

  // Recent activity trend (last 7 days)
  if (activityData && activityData.length > 0) {
    const recentActivity = activityData.slice(-7);
    const avgViews = Math.round(recentActivity.reduce((sum, day) => sum + day.views, 0) / recentActivity.length);
    const avgParticipations = Math.round(recentActivity.reduce((sum, day) => sum + day.participations, 0) / recentActivity.length);

    output += `**Recent Activity (Last 7 Days):**\n`;
    output += `📈 Avg Page Views/Day: ${avgViews}\n`;
    output += `💬 Avg Participations/Day: ${avgParticipations}\n\n`;
  }

  // Assignment performance
  if (assignmentData && assignmentData.length > 0) {
    const submittedAssignments = assignmentData.filter(a => a.submission && a.submission.submitted_at);
    const scoredAssignments = submittedAssignments.filter(a => a.submission!.score !== null);
    
    if (scoredAssignments.length > 0) {
      const avgScore = scoredAssignments.reduce((sum, a) => {
        const percentage = (a.submission!.score! / a.points_possible) * 100;
        return sum + percentage;
      }, 0) / scoredAssignments.length;

      output += `**Assignment Performance:**\n`;
      output += `📝 Submitted: ${submittedAssignments.length}/${assignmentData.length}\n`;
      output += `📊 Average Score: ${avgScore.toFixed(1)}%\n\n`;
    }
  }

  // Risk factors
  const riskFactors: string[] = [];
  if (summary.page_views_level === 0) {
    riskFactors.push('Low page views - consider increasing engagement');
  }
  if (summary.participations_level === 0) {
    riskFactors.push('Low participation - try contributing to discussions');
  }
  if (tardiness.missing > 0) {
    riskFactors.push(`${tardiness.missing} missing assignment${tardiness.missing > 1 ? 's' : ''}`);
  }
  if (tardiness.late > 2) {
    riskFactors.push('Multiple late submissions - plan ahead for deadlines');
  }

  if (riskFactors.length > 0) {
    output += `⚠️ **Areas for Improvement:**\n`;
    riskFactors.forEach(factor => output += `  • ${factor}\n`);
    output += '\n';
  }

  // Strengths
  const strengths: string[] = [];
  if (summary.page_views_level === 2) {
    strengths.push('High engagement with course materials');
  }
  if (summary.participations_level === 2) {
    strengths.push('Strong participation in course activities');
  }
  if (onTimePercent >= 90 && totalAssignments > 0) {
    strengths.push('Excellent on-time submission rate');
  }

  if (strengths.length > 0) {
    output += `✨ **Strengths:**\n`;
    strengths.forEach(strength => output += `  • ${strength}\n`);
    output += '\n';
  }

  output += `💡 **Note:** Analytics are calculated by Canvas based on your course activity and compared to class averages.`;

  return output;
}

/**
 * Get comprehensive student performance summary
 * Combines analytics + grades for complete picture
 */
export async function getStudentPerformanceSummary(params: GetCourseAnalyticsParams & {
  currentGrade?: number;
  courseName?: string;
}): Promise<string> {
  const { currentGrade, courseName } = params;

  try {
    // Get all analytics data
    const summary = await getCourseAnalytics(params);
    const activityData = await getActivityData(params).catch(() => undefined);
    const assignmentData = await getAssignmentAnalytics(params).catch(() => undefined);

    let output = courseName ? `📚 **${courseName}** - Performance Summary\n\n` : `📚 Performance Summary\n\n`;

    // Current grade if available
    if (currentGrade !== undefined) {
      const gradeEmoji = currentGrade >= 90 ? '🌟' : currentGrade >= 80 ? '✅' : currentGrade >= 70 ? '⚠️' : '🔴';
      output += `${gradeEmoji} **Current Grade: ${currentGrade.toFixed(1)}%**\n\n`;
    }

    // Add analytics summary
    output += formatAnalyticsSummary(summary, activityData, assignmentData);

    return output;

  } catch (error) {
    logger.error('[Analytics] Error generating performance summary:', error);
    throw error;
  }
}
