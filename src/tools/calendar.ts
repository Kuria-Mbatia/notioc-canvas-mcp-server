// MCP Tool: List Canvas Calendar Events

import { fetchAllPaginated } from "../lib/pagination.js";
import { listCourses } from "./courses.js";
import { findBestMatch } from "../lib/search.js";
import { logger } from "../lib/logger.js";

export interface CalendarEventListParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  startDate?: string; // ISO 8601 string
  endDate?: string; // ISO 8601 string
  type?: "event" | "assignment";
}

export interface CanvasCalendarEvent {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  type: "event" | "assignment";
  html_url: string;
  context_code: string; // e.g., "course_12345"
}

export interface CalendarEventInfo {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  type: "event" | "assignment";
  url: string;
  courseId: string;
}

export async function listCalendarEvents(
  params: CalendarEventListParams,
): Promise<CalendarEventInfo[]> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    startDate,
    endDate,
    type = "event",
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  if (!courseId && !courseName) {
    throw new Error("Either courseId or courseName must be provided");
  }

  try {
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

    logger.info(`Listing calendar events for course ${courseId}`);

    const queryParams: Record<string, any> = {
      type,
      context_codes: [`course_${courseId}`],
      per_page: "100",
    };

    if (startDate) queryParams.start_date = startDate;
    if (endDate) queryParams.end_date = endDate;

    const eventsData = await fetchAllPaginated<CanvasCalendarEvent>(
      canvasBaseUrl,
      accessToken,
      `/api/v1/calendar_events`,
      queryParams,
    );

    const events: CalendarEventInfo[] = eventsData.map((event) => ({
      id: String(event.id),
      title: event.title,
      startAt: event.start_at,
      endAt: event.end_at,
      type: event.type,
      url: event.html_url,
      courseId: event.context_code.replace("course_", ""),
    }));

    return events;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to list calendar events: ${error.message}`);
    } else {
      throw new Error("Failed to list calendar events: Unknown error");
    }
  }
}
