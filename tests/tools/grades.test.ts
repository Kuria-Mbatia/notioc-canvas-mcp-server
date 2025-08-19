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

    const mockEnrollments = [
      {
        course_id: 12345,
        user_id: 1,
        grades: {
          current_score: 85.5,
          final_score: 85.5,
          current_grade: "B",
          final_grade: "B",
        },
      },
    ];

    test("gets grades for all active courses", async () => {
      const params: GetGradesParams = {
        ...mockParams,
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEnrollments,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        } as any);

      const result = await getGrades(params);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        courseId: "12345",
        courseName: "Math 101",
        currentScore: 85.5,
        finalGrade: "B",
      });
    });

    test("gets grades for specific course by ID", async () => {
      const params: GetGradesParams = {
        ...mockParams,
        courseId: "12345",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEnrollments,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        } as any);

      const result = await getGrades(params);

      expect(result).toHaveLength(1);
      expect(result[0].courseId).toBe("12345");
      expect(result[0].courseName).toBe("Math 101");
    });

    test("throws error for missing required parameters", async () => {
      const params: GetGradesParams = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(getGrades(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });
  });

  describe("getGradebookCategories", () => {
    const mockCategories = [
      {
        id: 1,
        name: "Assignments",
        weight: 60,
        group_weight: 60,
        position: 1,
      },
    ];

    test("gets gradebook categories for course", async () => {
      const params = {
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        courseId: "12345",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockCategories,
      } as any);

      const result = await getGradebookCategories(params);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "1",
        name: "Assignments",
        weight: 60,
      });
    });
  });
});