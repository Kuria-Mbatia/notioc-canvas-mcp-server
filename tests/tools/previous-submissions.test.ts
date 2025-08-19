import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  getPreviousSubmissions,
  type PreviousSubmissionsParams,
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

  describe("getPreviousSubmissions", () => {
    test("gets previous submissions for assignment", async () => {
      const params: PreviousSubmissionsParams = {
        ...mockParams,
        courseId: "12345",
        assignmentId: "1",
      };

      const mockCourses = [
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue([
        {
          id: 1,
          assignment_id: 1,
          user_id: 123,
          attempt: 1,
          score: 85,
          grade: "B",
          submitted_at: "2024-01-15T10:00:00Z",
          workflow_state: "graded",
        },
      ]);

      const result = await getPreviousSubmissions(params);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    test("handles missing assignment ID", async () => {
      const params: PreviousSubmissionsParams = {
        ...mockParams,
        courseId: "12345",
        assignmentId: "",
      };

      await expect(getPreviousSubmissions(params)).rejects.toThrow(
        "assignmentId is required",
      );
    });

    test("handles missing required parameters", async () => {
      const params = {
        canvasBaseUrl: "",
        accessToken: "test-token",
        assignmentId: "1",
      };

      await expect(getPreviousSubmissions(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });
  });
});