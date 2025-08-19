import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  calculateCourseAnalytics,
  generateWhatIfScenarios,
  getGradeTrends,
  type CourseAnalyticsParams,
  type WhatIfScenarioParams,
  type GradeTrendsParams,
} from "@/tools/analytics";
import * as coursesModule from "@/tools/courses";
import * as gradesModule from "@/tools/grades";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/tools/grades");
vi.mock("@/lib/canvas-api");
vi.mock("@/lib/pagination");

const mockListCourses = vi.mocked(coursesModule.listCourses);
const mockGetGrades = vi.mocked(gradesModule.getGrades);
const mockGetGradebookCategories = vi.mocked(
  gradesModule.getGradebookCategories,
);

describe("Analytics Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
    courseId: "12345",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateCourseAnalytics", () => {
    const mockGradeData = {
      courseId: "12345",
      courseName: "Test Course",
      currentScore: 85.5,
      finalGrade: "B",
      assignments: [
        {
          id: "1",
          name: "Assignment 1",
          score: 90,
          pointsPossible: 100,
          dueAt: "2024-01-15T23:59:00Z",
          assignmentGroupId: "group1",
        },
        {
          id: "2",
          name: "Assignment 2",
          score: 80,
          pointsPossible: 100,
          dueAt: "2024-01-20T23:59:00Z",
          assignmentGroupId: "group1",
        },
      ],
    };

    const mockCategories = [
      {
        id: "group1",
        name: "Assignments",
        weight: 80,
        dropLowest: 0,
        dropHighest: 0,
      },
    ];

    test("calculates basic course analytics", async () => {
      mockGetGrades.mockResolvedValue([mockGradeData]); // Return as array
      mockGetGradebookCategories.mockResolvedValue(mockCategories);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue([]);

      const result = await calculateCourseAnalytics(mockParams);

      expect(result).toBeDefined();
      expect(result.courseId).toBe("12345");
      expect(result.courseName).toBe("Test Course");
      expect(result.currentGrade.percentage).toBe(85.5);
      expect(result.currentGrade.letterGrade).toBe("B");
    });

    test("calculates category breakdown correctly", async () => {
      mockGetGrades.mockResolvedValue([mockGradeData]); // Return as array
      mockGetGradebookCategories.mockResolvedValue(mockCategories);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue([]);

      const result = await calculateCourseAnalytics(mockParams);

      expect(result.categoryBreakdown).toHaveLength(1);
      const category = result.categoryBreakdown[0];
      expect(category.categoryName).toBe("Assignments");
      expect(category.weight).toBe(80);
    });

    test("handles course lookup by name", async () => {
      const paramsWithName = {
        ...mockParams,
        courseId: undefined,
        courseName: "Test Course",
      };

      mockListCourses.mockResolvedValue([
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ]);
      mockGetGrades.mockResolvedValue([mockGradeData]); // Return as array
      mockGetGradebookCategories.mockResolvedValue(mockCategories);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue([]);

      const result = await calculateCourseAnalytics(paramsWithName);

      expect(mockListCourses).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        enrollmentState: "all",
      });
      expect(result.courseId).toBe("12345");
    });

    test("throws error when course not found", async () => {
      mockListCourses.mockResolvedValue([]);

      const paramsWithName = {
        ...mockParams,
        courseId: undefined,
        courseName: "Nonexistent Course",
      };

      await expect(calculateCourseAnalytics(paramsWithName)).rejects.toThrow(
        "Could not find course matching",
      );
    });
  });

  describe("generateWhatIfScenarios", () => {
    const mockAnalytics = {
      courseId: "12345",
      courseName: "Test Course",
      currentGrade: {
        percentage: 85.5,
        pointsEarned: 171,
        pointsPossible: 200,
      }, // From mockGradeData
      projectedGrade: {
        percentage: 85.5,
        pointsEarned: 256.5,
        pointsPossible: 300,
      }, // Total possible points
      upcomingAssignments: [
        {
          name: "Final Exam",
          points: 100,
          category: "Exams",
          dueDate: "2024-12-15",
          daysUntilDue: 30,
        },
      ],
      categoryBreakdown: [],
      statistics: {
        assignmentsCompleted: 2,
        assignmentsTotal: 3,
        completionRate: 66.67,
        averageScore: 85.5,
        gradeImprovement: null,
      },
    };

    test("calculates what-if scenarios", async () => {
      // Mock calculateCourseAnalytics
      const analyticsSpy = vi.spyOn(
        await import("@/tools/analytics"),
        "calculateCourseAnalytics",
      );
      analyticsSpy.mockResolvedValue(mockAnalytics);

      const whatIfParams: WhatIfScenarioParams = {
        ...mockParams,
        targetGrade: 90,
      };

      const result = await generateWhatIfScenarios(whatIfParams);

      expect(result.targetGrade).toBe(90);
      expect(result.currentGrade).toBe(85.5); // From mockGradeData.currentScore
      expect(result.courseId).toBe("12345");
      expect(result.courseName).toBe("Test Course");
      expect(typeof result.isAchievable).toBe("boolean");
      expect(Array.isArray(result.scenarios)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    test("converts letter grades to percentages", async () => {
      const analyticsSpy = vi.spyOn(
        await import("@/tools/analytics"),
        "calculateCourseAnalytics",
      );
      analyticsSpy.mockResolvedValue(mockAnalytics);

      const whatIfParams: WhatIfScenarioParams = {
        ...mockParams,
        targetLetterGrade: "A", // Should convert to 90%
      };

      const result = await generateWhatIfScenarios(whatIfParams);

      expect(result.targetGrade).toBe(95); // "A" converts to 95
      expect(result.targetLetterGrade).toBe("A");
    });
  });

  describe("getGradeTrends", () => {
    test("analyzes grade trends over time", async () => {
      const mockTrendData = {
        courseId: "12345",
        courseName: "Test Course",
        currentScore: 85,
        assignments: [
          {
            id: "1",
            name: "Assignment 1",
            score: 75,
            pointsPossible: 100,
            gradedAt: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            assignmentGroupId: "group1",
          },
          {
            id: "2",
            name: "Assignment 2",
            score: 85,
            pointsPossible: 100,
            gradedAt: new Date(
              Date.now() - 15 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            assignmentGroupId: "group1",
          },
          {
            id: "3",
            name: "Assignment 3",
            score: 95,
            pointsPossible: 100,
            gradedAt: new Date(
              Date.now() - 5 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            assignmentGroupId: "group1",
          },
        ],
      };

      mockGetGrades.mockResolvedValue([mockTrendData]); // Return as array

      const trendParams: GradeTrendsParams = {
        ...mockParams,
        daysBack: 90,
      };

      const result = await getGradeTrends(trendParams);

      expect(result.courseId).toBe("12345");
      expect(result.trendAnalysis.overallTrend).toBe("Improving");
      expect(result.timelineData).toHaveLength(3);
    });
  });
});
