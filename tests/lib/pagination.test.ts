import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import {
  fetchAllPaginated,
  type CanvasCourse,
  type CanvasAssignment,
  type CanvasFile,
  type CanvasPage,
  type CanvasDiscussion,
} from "@/lib/pagination";

// Mock the canvas-api module
vi.mock("@/lib/canvas-api", () => ({
  callCanvasAPI: vi.fn(),
}));

// Mock parse-link-header
vi.mock("parse-link-header", () => ({
  default: vi.fn(),
}));

import { callCanvasAPI } from "@/lib/canvas-api";
import parseLinkHeader from "parse-link-header";

const mockCallCanvasAPI = callCanvasAPI as any;
const mockParseLinkHeader = parseLinkHeader as any;

describe("pagination", () => {
  const testBaseUrl = "https://test.instructure.com";
  const testAccessToken = "test-token-123";
  const testApiPath = "/api/v1/courses/123/assignments";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchAllPaginated", () => {
    test("should fetch single page of results", async () => {
      const mockData = [
        { id: 1, name: "Assignment 1" },
        { id: 2, name: "Assignment 2" },
      ];

      mockCallCanvasAPI.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
        headers: {
          get: () => null, // No Link header
        },
      });

      const results = await fetchAllPaginated(
        testBaseUrl,
        testAccessToken,
        testApiPath,
      );

      expect(results).toEqual(mockData);
      expect(mockCallCanvasAPI).toHaveBeenCalledWith({
        canvasBaseUrl: testBaseUrl,
        accessToken: testAccessToken,
        method: "GET",
        apiPath: testApiPath,
      });
    });

    test("should fetch multiple pages of results", async () => {
      const page1Data = [
        { id: 1, name: "Assignment 1" },
        { id: 2, name: "Assignment 2" },
      ];
      const page2Data = [
        { id: 3, name: "Assignment 3" },
        { id: 4, name: "Assignment 4" },
      ];

      // First call - page 1
      mockCallCanvasAPI.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page1Data),
        headers: {
          get: (header: string) => {
            if (header === "Link") {
              return '<https://test.instructure.com/api/v1/courses/123/assignments?page=2>; rel="next"';
            }
            return null;
          },
        },
      });

      // Mock parseLinkHeader for first call
      mockParseLinkHeader.mockReturnValueOnce({
        next: {
          url: "https://test.instructure.com/api/v1/courses/123/assignments?page=2",
        },
      });

      // Second call - page 2
      mockCallCanvasAPI.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(page2Data),
        headers: {
          get: () => null, // No more pages
        },
      });

      const results = await fetchAllPaginated(
        testBaseUrl,
        testAccessToken,
        testApiPath,
      );

      expect(results).toEqual([...page1Data, ...page2Data]);
      expect(mockCallCanvasAPI).toHaveBeenCalledTimes(2);
      expect(mockParseLinkHeader).toHaveBeenCalledTimes(1);
    });

    test("should handle query parameters", async () => {
      const mockData = [{ id: 1, name: "Test" }];
      const params = { per_page: 50, include: ["attachments"] };

      mockCallCanvasAPI.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
        headers: { get: () => null },
      });

      await fetchAllPaginated(
        testBaseUrl,
        testAccessToken,
        testApiPath,
        params,
      );

      expect(mockCallCanvasAPI).toHaveBeenCalledWith({
        canvasBaseUrl: testBaseUrl,
        accessToken: testAccessToken,
        method: "GET",
        apiPath: `${testApiPath}?per_page=50&include=attachments`,
      });
    });

    test("should handle 404 error with disabled resource", async () => {
      mockCallCanvasAPI.mockResolvedValue({
        ok: false,
        status: 404,
        text: () =>
          Promise.resolve("The resource has been disabled for this course"),
      });

      await expect(
        fetchAllPaginated(testBaseUrl, testAccessToken, testApiPath),
      ).rejects.toThrow(
        "Canvas API Error (404): The requested resource has been disabled for this course",
      );
    });

    test("should handle 404 error with not found resource", async () => {
      mockCallCanvasAPI.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not found"),
      });

      await expect(
        fetchAllPaginated(testBaseUrl, testAccessToken, testApiPath),
      ).rejects.toThrow(
        "Canvas API Error (404): The requested resource was not found or is not accessible",
      );
    });

    test("should handle 401 unauthorized error", async () => {
      mockCallCanvasAPI.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      await expect(
        fetchAllPaginated(testBaseUrl, testAccessToken, testApiPath),
      ).rejects.toThrow(
        "Canvas API Error (401): Invalid or expired access token",
      );
    });

    test("should handle 403 forbidden error", async () => {
      mockCallCanvasAPI.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      await expect(
        fetchAllPaginated(testBaseUrl, testAccessToken, testApiPath),
      ).rejects.toThrow(
        "Canvas API Error (403): Access denied - insufficient permissions",
      );
    });

    test("should handle other HTTP errors", async () => {
      mockCallCanvasAPI.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(
        fetchAllPaginated(testBaseUrl, testAccessToken, testApiPath),
      ).rejects.toThrow("Canvas API Error (500): Internal Server Error");
    });

    test("should handle Arabic text in disabled resource error", async () => {
      mockCallCanvasAPI.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("تم تعطيل هذا المورد"),
      });

      await expect(
        fetchAllPaginated(testBaseUrl, testAccessToken, testApiPath),
      ).rejects.toThrow(
        "Canvas API Error (404): The requested resource has been disabled for this course",
      );
    });

    test("should handle empty results", async () => {
      mockCallCanvasAPI.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
        headers: { get: () => null },
      });

      const results = await fetchAllPaginated(
        testBaseUrl,
        testAccessToken,
        testApiPath,
      );

      expect(results).toEqual([]);
    });

    test("should handle complex pagination with multiple pages", async () => {
      const pages = [
        [{ id: 1 }, { id: 2 }],
        [{ id: 3 }, { id: 4 }],
        [{ id: 5 }],
      ];

      // Setup mocks for each page
      pages.forEach((pageData, index) => {
        const isLastPage = index === pages.length - 1;
        const nextPageUrl = isLastPage
          ? null
          : `https://test.instructure.com/api/v1/courses/123/assignments?page=${index + 2}`;

        mockCallCanvasAPI.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(pageData),
          headers: {
            get: (header: string) => {
              if (header === "Link" && nextPageUrl) {
                return `<${nextPageUrl}>; rel="next"`;
              }
              return null;
            },
          },
        });

        if (nextPageUrl) {
          mockParseLinkHeader.mockReturnValueOnce({
            next: { url: nextPageUrl },
          });
        }
      });

      const results = await fetchAllPaginated(
        testBaseUrl,
        testAccessToken,
        testApiPath,
      );

      expect(results).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
        { id: 5 },
      ]);
      expect(mockCallCanvasAPI).toHaveBeenCalledTimes(3);
    });
  });

  describe("Interface Type Validations", () => {
    test("CanvasCourse interface should accept valid course data", () => {
      const course: CanvasCourse = {
        id: 123,
        name: "Test Course",
        course_code: "TEST101",
        enrollment_state: "active",
        nickname: "My Test Course",
      };

      expect(course.id).toBe(123);
      expect(course.name).toBe("Test Course");
      expect(course.course_code).toBe("TEST101");
    });

    test("CanvasAssignment interface should accept valid assignment data", () => {
      const assignment: CanvasAssignment = {
        id: 456,
        name: "Homework 1",
        description: "Complete the exercises",
        due_at: "2023-12-01T23:59:59Z",
        points_possible: 100,
        submission_types: ["online_text_entry"],
        workflow_state: "published",
        html_url: "https://test.instructure.com/courses/123/assignments/456",
        has_submitted_submissions: false,
        attachments: [
          {
            id: 789,
            filename: "instructions.pdf",
            url: "https://test.instructure.com/files/789",
            "content-type": "application/pdf",
          },
        ],
      };

      expect(assignment.id).toBe(456);
      expect(assignment.submission_types).toContain("online_text_entry");
      expect(assignment.attachments?.[0].filename).toBe("instructions.pdf");
    });

    test("CanvasFile interface should accept valid file data", () => {
      const file: CanvasFile = {
        id: 789,
        display_name: "document.pdf",
        url: "https://test.instructure.com/files/789/download",
        content_type: "application/pdf",
        size: 1024000,
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-02T00:00:00Z",
        html_url: "https://test.instructure.com/files/789",
        thumbnail_url: "https://test.instructure.com/files/789/thumbnail",
        folder_id: 100,
      };

      expect(file.id).toBe(789);
      expect(file.content_type).toBe("application/pdf");
      expect(file.size).toBe(1024000);
    });

    test("CanvasPage interface should accept valid page data", () => {
      const page: CanvasPage = {
        title: "Course Introduction",
        html_url: "https://test.instructure.com/courses/123/pages/intro",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-02T00:00:00Z",
        body: "<p>Welcome to the course!</p>",
      };

      expect(page.title).toBe("Course Introduction");
      expect(page.body).toBe("<p>Welcome to the course!</p>");
    });

    test("CanvasDiscussion interface should accept valid discussion data", () => {
      const discussion: CanvasDiscussion = {
        id: 101,
        title: "Week 1 Discussion",
        html_url:
          "https://test.instructure.com/courses/123/discussion_topics/101",
        posted_at: "2023-01-01T00:00:00Z",
        last_reply_at: "2023-01-03T12:00:00Z",
        discussion_type: "threaded",
      };

      expect(discussion.id).toBe(101);
      expect(discussion.discussion_type).toBe("threaded");
      expect(discussion.last_reply_at).toBe("2023-01-03T12:00:00Z");
    });

    test("interfaces should handle optional fields", () => {
      const minimalCourse: CanvasCourse = {
        id: 123,
      };

      const minimalPage: CanvasPage = {
        title: "Simple Page",
        html_url: "https://test.instructure.com/courses/123/pages/simple",
        created_at: "2023-01-01T00:00:00Z",
        updated_at: null,
      };

      expect(minimalCourse.id).toBe(123);
      expect(minimalCourse.name).toBeUndefined();
      expect(minimalPage.body).toBeUndefined();
      expect(minimalPage.updated_at).toBeNull();
    });
  });
});
