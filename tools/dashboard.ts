// This tool provides a consolidated summary of important items for a user.

import { listCourses, CourseInfo } from './courses.js';
import { listAssignments, AssignmentInfo } from './assignments.js';
import { listDiscussions, DiscussionInfo } from './pages-discussions.js';
import { logger } from '../lib/logger.js';

export interface DashboardParams {
  canvasBaseUrl: string;
  accessToken: string;
}

export interface DashboardSummary {
  upcomingAssignments: (AssignmentInfo & { courseName: string })[];
  unreadAnnouncements: (DiscussionInfo & { courseName: string })[];
}

export async function getDashboardSummary(params: DashboardParams): Promise<DashboardSummary> {
  const { canvasBaseUrl, accessToken } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  try {
    const courses = await listCourses({ canvasBaseUrl, accessToken, enrollmentState: 'active' });

    // Fetch assignments and announcements in parallel, handling errors for each
    const assignmentPromises = courses.map(async (course) => {
      try {
        const assignments = await listAssignments({ canvasBaseUrl, accessToken, courseId: course.id, includeSubmissions: true });
        // Add courseName to each assignment for context
        return assignments.map(a => ({ ...a, courseName: course.name }));
      } catch (error) {
        logger.warn(`Failed to fetch assignments for course "${course.name}":`, error);
        return []; // Return empty array on error for this course
      }
    });

    const announcementPromises = courses.map(async (course) => {
      try {
        const announcements = await listDiscussions({ canvasBaseUrl, accessToken, courseId: course.id, onlyAnnouncements: true });
        // Add courseName to each announcement
        return announcements.map(a => ({ ...a, courseName: course.name }));
      } catch (error) {
        logger.warn(`Failed to fetch announcements for course "${course.name}":`, error);
        return []; // Return empty array on error
      }
    });

    const allAssignments = (await Promise.all(assignmentPromises)).flat();
    const allAnnouncements = (await Promise.all(announcementPromises)).flat();

    // Filter for upcoming assignments (due in the future and not yet submitted)
    const upcomingAssignments = allAssignments
      .filter(a => a.dueAt && new Date(a.dueAt) > new Date() && !a.hasSubmittedSubmissions)
      .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());

    // For announcements, we'll assume we want the most recent unread ones.
    // The Canvas API doesn't give us a reliable "unread" flag for announcements in the same way.
    // We'll sort by posted date and take the most recent ones. A more robust solution might
    // track read status on the client side.
    const recentAnnouncements = allAnnouncements
      .sort((a, b) => new Date(b.postedAt!).getTime() - new Date(a.postedAt!).getTime())
      .slice(0, 10); // Limit to 10 most recent for the dashboard

    return {
      upcomingAssignments,
      unreadAnnouncements: recentAnnouncements, // Renaming for clarity in the summary
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get dashboard summary: ${error.message}`);
    } else {
      throw new Error('Failed to get dashboard summary: Unknown error');
    }
  }
} 