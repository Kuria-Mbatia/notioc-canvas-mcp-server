import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  getPreviousSubmissionContent,
  listSubmittedAssignments,
  type PreviousSubmissionParams,
} from "@/tools/previous-submissions";
import * as coursesModule from "@/tools/courses";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/lib/pagination");
vi.mock("@/lib/canvas-api");
vi.mock("@/lib/search");

const mockListCourses = vi.mocked(coursesModule.listCourses);

describe("Previous Submissions Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPreviousSubmissionContent", () => {
    test("gets previous submission content for assignment", async () => {
      const params: PreviousSubmissionParams = {
        ...mockParams,
        courseId: "12345",
        assignmentId: "1",
      };

      const mockCourses = [
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 1,
            name: "Test Assignment",
            description: "Test description",
            points_possible: 100,
            due_at: "2024-01-20T23:59:00Z",
            submission_types: ["online_upload"],
          }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: "123",
            score: 85,
            grade: "B",
            submitted_at: "2024-01-15T10:00:00Z",
            workflow_state: "graded",
            attempt: 1,
            attachments: [
              {
                id: 456,
                filename: "test.pdf",
                "content-type": "application/pdf",
                size: 1024,
                url: "https://test.com/file.pdf",
              },
            ],
          }),
        } as any);

      const result = await getPreviousSubmissionContent(params);

      expect(result).toBeDefined();
      expect(result.assignment.id).toBe("1");
      expect(result.submission.id).toBe("123");
      expect(result.files.length).toBe(1);
    });

    test("handles missing assignment ID and name", async () => {
      const params: PreviousSubmissionParams = {
        ...mockParams,
        courseId: "12345",
      };

      await expect(getPreviousSubmissionContent(params)).rejects.toThrow(
        "Either assignmentId or assignmentName must be provided",
      );
    });

    test("handles missing required parameters", async () => {
      const params = {
        canvasBaseUrl: "",
        accessToken: "test-token",
        assignmentId: "1",
      };

      await expect(getPreviousSubmissionContent(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });
  });

  describe("listSubmittedAssignments", () => {
    test("lists submitted assignments for course", async () => {
      const params = {
        ...mockParams,
        courseId: "12345",
      };

      const mockCourses = [
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => [
          {
            id: 1,
            name: "Assignment 1",
            submission_types: ["online_upload"],
            submission: {
              submitted_at: "2024-01-15T10:00:00Z",
              score: 85,
              attachments: [{ id: 1 }, { id: 2 }],
            },
          },
          {
            id: 2,
            name: "Assignment 2",
            submission_types: ["online_text_entry"],
            submission: {
              submitted_at: null, // Not submitted
              score: null,
              attachments: [],
            },
          },
        ],
      } as any);

      const result = await listSubmittedAssignments(params);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1); // Only submitted assignments
      expect(result[0].id).toBe("1");
      expect(result[0].fileCount).toBe(2);
    });

    test("handles missing course parameters", async () => {
      const params = {
        ...mockParams,
      };

      await expect(listSubmittedAssignments(params)).rejects.toThrow(
        "Either courseId or courseName must be provided",
      );
    });
  });
});
