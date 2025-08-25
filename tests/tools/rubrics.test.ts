import { expect, test, describe, vi, beforeEach } from "vitest";
import { getAssignmentRubric, type RubricParams } from "@/tools/rubrics";
import * as coursesModule from "@/tools/courses";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/tools/assignments");
vi.mock("@/lib/canvas-api");
vi.mock("@/lib/search");
vi.mock("@/lib/pagination");

const mockListCourses = vi.mocked(coursesModule.listCourses);

describe("Rubrics Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAssignmentRubric", () => {
    const mockCourses = [
      { id: "12345", name: "Test Course", courseCode: "TEST101" },
    ];

    const mockAssignments = [
      {
        id: "1",
        name: "Essay Assignment",
        rubric: {
          id: 1,
          title: "Essay Rubric",
          points_possible: 100,
          data: [
            {
              id: "criterion_1",
              description: "Content Quality",
              points: 40,
              ratings: [
                {
                  id: "rating_1",
                  description: "Excellent",
                  points: 40,
                },
              ],
            },
          ],
        },
      },
    ];

    test("handles rubric functionality exists", async () => {
      expect(typeof getAssignmentRubric).toBe("function");
    });

    test("handles missing assignment ID and name", async () => {
      const params: RubricParams = {
        ...mockParams,
        courseId: "12345",
      };

      await expect(getAssignmentRubric(params)).rejects.toThrow(
        "Either assignmentId or assignmentName must be provided",
      );
    });

    test("handles missing required parameters", async () => {
      const params = {
        canvasBaseUrl: "",
        accessToken: "test-token",
        assignmentId: "1",
      };

      await expect(getAssignmentRubric(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });

    test("handles course not found error", async () => {
      const params: RubricParams = {
        ...mockParams,
        courseName: "Nonexistent Course",
        assignmentId: "1",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFindBestMatch = await import("@/lib/search");
      vi.mocked(mockFindBestMatch.findBestMatch).mockReturnValue(null);

      await expect(getAssignmentRubric(params)).rejects.toThrow(
        "Could not find a course matching",
      );
    });

    test("handles assignment not found error", async () => {
      const params: RubricParams = {
        ...mockParams,
        courseId: "12345",
        assignmentId: "999",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockListAssignments = await import("@/tools/assignments");
      vi.mocked(mockListAssignments.listAssignments).mockResolvedValue([]);

      await expect(getAssignmentRubric(params)).rejects.toThrow(
        "Could not find assignment 999",
      );
    });
  });
});
