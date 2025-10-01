/**
 * Current Courses Tool
 * Smart tool to get only the courses that are currently active/relevant
 */

import { callCanvasAPI, CanvasCourse } from '../lib/canvas-api.js';
import { logger } from '../lib/logger.js';
import { fetchAllPaginated } from '../lib/pagination.js';
import { 
  CourseWithDates, 
  categorizeCourses, 
  getCourseContextSummary 
} from '../lib/course-context.js';

export interface CurrentCoursesParams {
  canvasBaseUrl: string;
  accessToken: string;
  includeUpcoming?: boolean;
  includeRecentlyCompleted?: boolean;
  checkActivity?: boolean; // NEW: Check for recent assignment activity (slower but more accurate)
}

/**
 * Format data as a markdown table
 */
function formatTableOutput(data: Record<string, any>[]): string {
  if (data.length === 0) return 'No data available.';
  
  const keys = Object.keys(data[0]);
  let table = '| ' + keys.join(' | ') + ' |\n';
  table += '|' + keys.map(() => '---').join('|') + '|\n';
  
  for (const row of data) {
    table += '| ' + keys.map(key => row[key] || 'N/A').join(' | ') + ' |\n';
  }
  
  return table;
}

/**
 * Get current courses with smart filtering
 */
export async function getCurrentCourses(
  params: CurrentCoursesParams
): Promise<string> {
  const { canvasBaseUrl, accessToken, includeUpcoming = false, includeRecentlyCompleted = false } = params;
  
  try {
    // Fetch all active courses with enrollment, term data, concluded status, and user's enrollments
    const courses = await fetchAllPaginated<CanvasCourse>(
      canvasBaseUrl,
      accessToken,
      '/api/v1/courses',
      {
        enrollment_state: 'active',
        'include[]': ['term', 'concluded', 'sections'],
        per_page: '100',
      }
    );

    if (!Array.isArray(courses) || courses.length === 0) {
      return '⚠️ No active courses found. You may not be enrolled in any courses currently.';
    }

    // Transform to our course format
    const coursesWithDates: CourseWithDates[] = courses.map((course: any) => {
      // Extract user's enrollment type from sections
      let enrollmentType = 'student'; // default
      if (course.sections && Array.isArray(course.sections) && course.sections.length > 0) {
        const enrollment = course.sections[0];
        if (enrollment.enrollment_role) {
          // enrollment_role is like "StudentEnrollment", "TeacherEnrollment", etc.
          const role = enrollment.enrollment_role.toLowerCase();
          if (role.includes('teacher')) enrollmentType = 'teacher';
          else if (role.includes('ta')) enrollmentType = 'ta';
          else if (role.includes('designer')) enrollmentType = 'designer';
          else if (role.includes('observer')) enrollmentType = 'observer';
          else enrollmentType = 'student';
        }
      }
      
      return {
        id: course.id.toString(),
        name: course.name,
        courseCode: course.course_code,
        enrollmentState: 'active',
        enrollmentType: enrollmentType,
        startAt: course.start_at,
        endAt: course.end_at,
        termName: course.term?.name,
        termStartAt: course.term?.start_at,
        termEndAt: course.term?.end_at,
        termOverrides: course.term?.overrides, // Enrollment-type-specific date overrides
        concluded: course.concluded, // Canvas API tells us if course is concluded
        workflowState: course.workflow_state, // 'available', 'completed', 'unpublished'
      };
    });

    // Categorize courses
    const categorized = categorizeCourses(coursesWithDates);

    // OPTIONAL: Check for recent activity to further filter ambiguous courses
    if (params.checkActivity && categorized.currentCourses.length > 0) {
      // Only check courses that don't have clear date metadata OR semester patterns
      const ambiguousCourses = categorized.currentCourses.filter(c => {
        const hasMetadata = (c.startAt && c.endAt) || (c.termStartAt && c.termEndAt);
        const hasSemesterPattern = c.confidenceScore && c.confidenceScore >= 30;
        return !hasMetadata && !hasSemesterPattern;
      });
      
      if (ambiguousCourses.length > 0) {
        // Check each ambiguous course for upcoming assignments
        const now = new Date();
        const oneMonthFromNow = new Date(now);
        oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
        
        for (const course of ambiguousCourses) {
          try {
            const response = await callCanvasAPI({
              canvasBaseUrl,
              accessToken,
              method: 'GET',
              apiPath: `/api/v1/courses/${course.id}/assignments`,
              params: { per_page: '10', order_by: 'due_at' }
            });
            
            const assignments = await response.json();
            
            // Check if there are assignments due in the next month
            if (Array.isArray(assignments)) {
              const hasUpcoming = assignments.some((a: any) => {
                if (!a.due_at) return false;
                const dueDate = new Date(a.due_at);
                return dueDate >= now && dueDate <= oneMonthFromNow;
              });
              
              course.hasRecentActivity = hasUpcoming;
            } else {
              // If we got no assignments back, mark as unknown (don't filter out)
              course.hasRecentActivity = undefined;
            }
          } catch (error) {
            // Silently fail - mark as unknown so we don't filter it out
            course.hasRecentActivity = undefined;
            console.error(`Failed to check activity for course ${course.id}:`, error);
          }
        }
        
        // Re-filter: ONLY remove courses that definitively have NO activity
        categorized.currentCourses = categorized.currentCourses.filter(c => {
          // If hasRecentActivity is explicitly false, filter it out
          // If it's true or undefined (couldn't check), keep it
          return c.hasRecentActivity !== false;
        });
      }
    }
    
    // Sort by confidence score (if available)
    categorized.currentCourses.sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0));

    // Build output
    let output = getCourseContextSummary(categorized);

    // Add detailed table for current courses
    if (categorized.currentCourses.length > 0) {
      output += '\n### 📊 Current Courses Details\n\n';
      
      const tableData = categorized.currentCourses.map(course => {
        return {
          'Course ID': course.id,
          'Course Name': course.name,
          'Course Code': course.courseCode || 'N/A',
          'Term': course.termName || 'N/A',
          'Start Date': course.startAt ? new Date(course.startAt).toLocaleDateString() : 'N/A',
          'End Date': course.endAt ? new Date(course.endAt).toLocaleDateString() : 'N/A',
        };
      });

      output += formatTableOutput(tableData);
      output += '\n';
    }

    // Optionally include upcoming courses
    if (params.includeUpcoming && categorized.upcomingCourses.length > 0) {
      output += '\n### 🔜 Upcoming Courses Details\n\n';
      
      const upcomingData = categorized.upcomingCourses.map(course => ({
        'Course ID': course.id,
        'Course Name': course.name,
        'Course Code': course.courseCode || 'N/A',
        'Starts': course.startAt ? new Date(course.startAt).toLocaleDateString() : 'N/A',
      }));

      output += formatTableOutput(upcomingData);
      output += '\n';
    }

    // Optionally include recently completed
    if (params.includeRecentlyCompleted && categorized.recentlyCompletedCourses.length > 0) {
      output += '\n### ✅ Recently Completed Courses\n\n';
      
      const completedData = categorized.recentlyCompletedCourses.map(course => ({
        'Course ID': course.id,
        'Course Name': course.name,
        'Course Code': course.courseCode || 'N/A',
        'Ended': course.endAt ? new Date(course.endAt).toLocaleDateString() : 'N/A',
      }));

      output += formatTableOutput(completedData);
      output += '\n';
    }

    // Add usage guidance for LLMs
    output += '\n---\n\n';
    output += '**🎯 Usage Guidance:**\n\n';
    
    if (categorized.currentCourses.length > 0) {
      output += '- **For "What\'s due this week?" queries:** Use the Current Courses listed above\n';
      output += '- **For assignments:** Query assignments from Current Courses only\n';
      output += '- **For grades:** Focus on Current Courses for the most relevant information\n';
      output += `- **Quick access:** You have ${categorized.currentCourses.length} active course(s) to check\n`;
    } else {
      output += '- **No current courses detected:** The user may be between semesters\n';
      output += '- **Alternative:** Check upcoming courses or recently completed courses\n';
      output += '- **Tip:** Ask the user which specific course they want to check\n';
    }

    return output;

  } catch (error: any) {
    console.error('Error getting current courses:', error);
    return `❌ Error getting current courses: ${error.message}`;
  }
}
