import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  listCalendarEvents,
  type CalendarEventListParams,
} from "@/tools/calendar";
import * as coursesModule from "@/tools/courses";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/lib/pagination");
vi.mock("@/lib/search");

const mockListCourses = vi.mocked(coursesModule.listCourses);

describe("Calendar Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
    courseId: "12345",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listCalendarEvents", () => {
    const mockEventsData = [
      {
        id: 1,
        title: "Midterm Exam",
        start_at: "2024-03-15T10:00:00Z",
        end_at: "2024-03-15T12:00:00Z",
        type: "assignment" as const,
        html_url: "https://test.instructure.com/courses/12345/assignments/1",
        context_code: "course_12345",
      },
      {
        id: 2,
        title: "Office Hours",
        start_at: "2024-03-20T14:00:00Z",
        end_at: "2024-03-20T15:00:00Z",
        type: "event" as const,
        html_url:
          "https://test.instructure.com/courses/12345/calendar_events/2",
        context_code: "course_12345",
      },
    ];

    test("lists calendar events with basic parameters", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockEventsData,
      );

      const result = await listCalendarEvents(mockParams);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "1",
        title: "Midterm Exam",
        startAt: "2024-03-15T10:00:00Z",
        endAt: "2024-03-15T12:00:00Z",
        type: "assignment",
        url: "https://test.instructure.com/courses/12345/assignments/1",
        courseId: "12345",
      });
      expect(result[1]).toEqual({
        id: "2",
        title: "Office Hours",
        startAt: "2024-03-20T14:00:00Z",
        endAt: "2024-03-20T15:00:00Z",
        type: "event",
        url: "https://test.instructure.com/courses/12345/calendar_events/2",
        courseId: "12345",
      });
    });

    test("filters events by date range", async () => {
      const paramsWithDateRange = {
        ...mockParams,
        startDate: "2024-03-01",
        endDate: "2024-03-31",
      };

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockEventsData,
      );

      await listCalendarEvents(paramsWithDateRange);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/calendar_events",
        {
          type: "event",
          context_codes: ["course_12345"],
          per_page: "100",
          start_date: "2024-03-01",
          end_date: "2024-03-31",
        },
      );
    });

    test("filters events by type", async () => {
      const paramsWithType = {
        ...mockParams,
        type: "assignment" as const,
      };

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockEventsData,
      );

      await listCalendarEvents(paramsWithType);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/calendar_events",
        {
          type: "assignment",
          context_codes: ["course_12345"],
          per_page: "100",
        },
      );
    });

    test("finds course by name when courseId not provided", async () => {
      const paramsWithName = {
        ...mockParams,
        courseId: undefined,
        courseName: "Test Course",
      };

      mockListCourses.mockResolvedValue([
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ]);

      const mockFindBestMatch = await import("@/lib/search");
      vi.mocked(mockFindBestMatch.findBestMatch).mockReturnValue({
        id: "12345",
        name: "Test Course",
        courseCode: "TEST101",
      });

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockEventsData,
      );

      const result = await listCalendarEvents(paramsWithName);

      expect(mockListCourses).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        enrollmentState: "all",
      });
      expect(result).toHaveLength(2);
    });

    test("throws error when course not found by name", async () => {
      const paramsWithName = {
        ...mockParams,
        courseId: undefined,
        courseName: "Nonexistent Course",
      };

      mockListCourses.mockResolvedValue([
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ]);

      const mockFindBestMatch = await import("@/lib/search");
      vi.mocked(mockFindBestMatch.findBestMatch).mockReturnValue(null);

      await expect(listCalendarEvents(paramsWithName)).rejects.toThrow(
        'Could not find a course with the name "Nonexistent Course"',
      );
    });

    test("extracts courseId from context_code correctly", async () => {
      const mockEventWithDifferentCourse = [
        {
          id: 3,
          title: "Different Course Event",
          start_at: "2024-04-01T09:00:00Z",
          end_at: "2024-04-01T10:00:00Z",
          type: "event" as const,
          html_url:
            "https://test.instructure.com/courses/67890/calendar_events/3",
          context_code: "course_67890",
        },
      ];

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockEventWithDifferentCourse,
      );

      const result = await listCalendarEvents(mockParams);

      expect(result[0].courseId).toBe("67890");
    });

    test("handles empty events list", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue([]);

      const result = await listCalendarEvents(mockParams);

      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });

    test("throws error for missing required parameters", async () => {
      const invalidParams = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(listCalendarEvents(invalidParams)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });

    test("throws error when neither courseId nor courseName provided", async () => {
      const invalidParams = {
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
      };

      await expect(listCalendarEvents(invalidParams)).rejects.toThrow(
        "Either courseId or courseName must be provided",
      );
    });

    test("handles API errors gracefully", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockRejectedValue(
        new Error("Canvas API Error"),
      );

      await expect(listCalendarEvents(mockParams)).rejects.toThrow(
        "Failed to list calendar events: Canvas API Error",
      );
    });

    test("uses default event type when not specified", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue([]);

      await listCalendarEvents(mockParams);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/calendar_events",
        {
          type: "event", // Default type
          context_codes: ["course_12345"],
          per_page: "100",
        },
      );
    });

    test("transforms data correctly with all fields", async () => {
      const mockEventWithAllFields = [
        {
          id: 999,
          title: "Complex Event",
          start_at: "2024-05-15T08:30:00Z",
          end_at: "2024-05-15T09:30:00Z",
          type: "assignment" as const,
          html_url:
            "https://test.instructure.com/courses/12345/assignments/999",
          context_code: "course_12345",
        },
      ];

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockEventWithAllFields,
      );

      const result = await listCalendarEvents(mockParams);

      expect(result[0]).toEqual({
        id: "999",
        title: "Complex Event",
        startAt: "2024-05-15T08:30:00Z",
        endAt: "2024-05-15T09:30:00Z",
        type: "assignment",
        url: "https://test.instructure.com/courses/12345/assignments/999",
        courseId: "12345",
      });
    });
  });
});
