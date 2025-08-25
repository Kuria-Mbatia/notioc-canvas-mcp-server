import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  getGrades,
  getGradebookCategories,
  type GetGradesParams,
} from "@/tools/grades";
import * as coursesModule from "@/tools/courses";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/lib/pagination");
vi.mock("@/lib/canvas-api");
vi.mock("@/lib/search");

const mockListCourses = vi.mocked(coursesModule.listCourses);

describe("Grades Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGrades", () => {
    const mockCourses = [
      { id: "12345", name: "Math 101", courseCode: "MATH101" },
      { id: "67890", name: "Physics 201", courseCode: "PHYS201" },
    ];

    const mockEnrollmentData = [
      {
        id: 1,
        course_id: 12345,
        user_id: "self",
        type: "StudentEnrollment",
        enrollment_state: "active",
        grades: {
          current_score: 85.5,
          final_score: 87.2,
          current_grade: "B",
          final_grade: "B+",
          html_url: "https://test.instructure.com/courses/12345/grades/self",
        },
      },
    ];

    const mockAssignmentData = [
      {
        id: 1,
        name: "Homework 1",
        points_possible: 100,
        html_url: "https://test.instructure.com/courses/12345/assignments/1",
        submission: {
          id: 101,
          user_id: "self",
          assignment_id: 1,
          score: 90,
          grade: "90",
          submission_type: "online_text_entry",
          workflow_state: "graded",
          graded_at: "2024-01-15T10:00:00Z",
          html_url:
            "https://test.instructure.com/courses/12345/assignments/1/submissions/self",
        },
      },
    ];

    test("gets grades for specific course by ID", async () => {
      const params: GetGradesParams = {
        ...mockParams,
        courseId: "12345",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockEnrollmentData,
      } as any);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockAssignmentData,
      );

      const result = await getGrades(params);

      expect(Array.isArray(result)).toBe(true);
      // Test passes if no errors are thrown during execution
    });

    test("handles missing required parameters", async () => {
      const params = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(getGrades(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });
  });

  describe("getGradebookCategories", () => {
    const mockCategoriesData = [
      {
        id: 1,
        name: "Assignments",
        weight: 60,
        position: 1,
        group_weight: null,
      },
      {
        id: 2,
        name: "Quizzes",
        weight: 25,
        position: 2,
        group_weight: null,
      },
    ];

    test("fetches gradebook categories for course", async () => {
      const params = {
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        courseId: "12345",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockCategoriesData,
      } as any);

      const result = await getGradebookCategories(params);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test("handles missing course ID", async () => {
      const params = {
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        courseId: "",
      };

      await expect(getGradebookCategories(params)).rejects.toThrow(
        "Either courseId or courseName must be provided",
      );
    });
  });
});
