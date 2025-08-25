import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  listModules,
  getModuleItems,
  type ListModulesParams,
  type ModuleItemsParams,
} from "@/tools/modules";
import * as coursesModule from "@/tools/courses";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/lib/pagination");
vi.mock("@/lib/canvas-api");
vi.mock("@/lib/search");

const mockListCourses = vi.mocked(coursesModule.listCourses);

describe("Modules Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listModules", () => {
    const mockModulesData = [
      {
        id: 1,
        name: "Introduction",
        position: 1,
        unlock_at: null,
        require_sequential_progress: false,
        prerequisite_module_ids: [],
        items_count: 3,
        items_url:
          "https://test.instructure.com/api/v1/courses/12345/modules/1/items",
        state: "completed",
        completed_at: "2024-01-15T10:00:00Z",
        publish_final_grade: false,
        published: true,
      },
      {
        id: 2,
        name: "Chapter 1: Basics",
        position: 2,
        unlock_at: "2024-01-20T00:00:00Z",
        require_sequential_progress: true,
        prerequisite_module_ids: [1],
        items_count: 5,
        items_url:
          "https://test.instructure.com/api/v1/courses/12345/modules/2/items",
        state: "started",
        completed_at: null,
        publish_final_grade: false,
        published: true,
      },
    ];

    const mockCourses = [
      { id: "12345", name: "Test Course", courseCode: "TEST101" },
    ];

    test("lists modules for course by ID", async () => {
      const params: ListModulesParams = {
        ...mockParams,
        courseId: "12345",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockModulesData,
      );

      const result = await listModules(params);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/modules",
        { per_page: "100", include: ["items"] },
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        name: "Introduction",
        position: 1,
        requireSequentialProgress: false,
        prerequisiteModuleIds: [],
        itemsCount: 3,
        state: "completed",
        published: true,
      });
    });

    test("lists modules for course by name", async () => {
      const params: ListModulesParams = {
        ...mockParams,
        courseName: "Test Course",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFindBestMatch = await import("@/lib/search");
      vi.mocked(mockFindBestMatch.findBestMatch).mockReturnValue(
        mockCourses[0],
      );

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockModulesData,
      );

      const result = await listModules(params);

      expect(mockFindBestMatch.findBestMatch).toHaveBeenCalledWith(
        "Test Course",
        mockCourses,
        ["name", "courseCode", "nickname"],
      );
      expect(result).toHaveLength(2);
    });

    test("includes module items when requested", async () => {
      const params: ListModulesParams = {
        ...mockParams,
        courseId: "12345",
        include: ["items"],
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockModulesData,
      );

      await listModules(params);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/modules",
        { per_page: "100", include: ["items"] },
      );
    });

    test("handles course not found error", async () => {
      const params: ListModulesParams = {
        ...mockParams,
        courseName: "Nonexistent Course",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFindBestMatch = await import("@/lib/search");
      vi.mocked(mockFindBestMatch.findBestMatch).mockReturnValue(null);

      await expect(listModules(params)).rejects.toThrow(
        "Could not find a course with the name",
      );
    });

    test("handles missing required parameters", async () => {
      const params = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(listModules(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });
  });

  describe("getModuleItems", () => {
    const mockModuleItemsData = [
      {
        id: 1,
        module_id: 1,
        position: 1,
        title: "Welcome Video",
        indent: 0,
        type: "ExternalUrl",
        content_id: null,
        html_url: "https://test.instructure.com/courses/12345/modules/items/1",
        external_url: "https://youtube.com/watch?v=abc123",
        new_tab: true,
        completion_requirement: {
          type: "must_view",
          completed: true,
        },
        published: true,
      },
      {
        id: 2,
        module_id: 1,
        position: 2,
        title: "Reading Assignment",
        indent: 1,
        type: "Assignment",
        content_id: 101,
        html_url: "https://test.instructure.com/courses/12345/assignments/101",
        completion_requirement: {
          type: "must_submit",
          completed: false,
        },
        content_details: {
          points_possible: 10,
          due_at: "2024-01-25T23:59:00Z",
          locked_for_user: false,
        },
        published: true,
      },
    ];

    const mockCourses = [
      { id: "12345", name: "Test Course", courseCode: "TEST101" },
    ];

    test("gets module items by course and module ID", async () => {
      const params: ModuleItemsParams = {
        ...mockParams,
        courseId: "12345",
        moduleId: "1",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockModuleItemsData,
      );

      const result = await getModuleItems(params);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/modules/1/items",
        { per_page: "100", include: ["content_details"] },
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        moduleId: "1",
        position: 1,
        title: "Welcome Video",
        type: "ExternalUrl",
        externalUrl: "https://youtube.com/watch?v=abc123",
        newTab: true,
        published: true,
      });
    });

    test("includes content details when requested", async () => {
      const params: ModuleItemsParams = {
        ...mockParams,
        courseId: "12345",
        moduleId: "1",
        include: ["content_details"],
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockModuleItemsData,
      );

      const result = await getModuleItems(params);

      expect(result[1].contentDetails).toBeDefined();
      expect(result[1].contentDetails?.pointsPossible).toBe(10);
      expect(result[1].contentDetails?.dueAt).toBe("2024-01-25T23:59:00Z");
    });

    test("handles completion requirements correctly", async () => {
      const params: ModuleItemsParams = {
        ...mockParams,
        courseId: "12345",
        moduleId: "1",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockModuleItemsData,
      );

      const result = await getModuleItems(params);

      expect(result[0].completionRequirement).toEqual({
        type: "must_view",
        completed: true,
      });
      expect(result[1].completionRequirement).toEqual({
        type: "must_submit",
        completed: false,
      });
    });

    test("handles missing module ID", async () => {
      const params: ModuleItemsParams = {
        ...mockParams,
        courseId: "12345",
        moduleId: "",
      };

      await expect(getModuleItems(params)).rejects.toThrow(
        "moduleId is required",
      );
    });
  });
});
