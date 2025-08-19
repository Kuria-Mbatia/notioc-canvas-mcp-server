import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  performSmartSearch,
  getCourseContentOverview,
  clearContentCache,
  type SmartSearchParams,
} from "@/tools/smart-search";

// Mock dependencies
vi.mock("@/lib/content-extraction");
vi.mock("@/lib/small-model");
vi.mock("@/lib/logger");

describe("Smart Search Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
    courseId: "12345",
    query: "test query",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("performSmartSearch", () => {
    test("performs smart search successfully", async () => {
      const params: SmartSearchParams = {
        ...mockParams,
        maxResults: 5,
        returnMode: "refs",
      };

      const mockSmartSearch = await import("@/lib/content-extraction");
      vi.mocked(mockSmartSearch.smartSearch).mockResolvedValue({
        files: [
          {
            fileId: "1",
            fileName: "test.pdf",
            url: "https://test.com/file.pdf",
            source: "course_files",
            relevance: 0.9,
          },
        ],
        pages: [],
        links: [],
        totalResults: 1,
        searchTime: 100,
        extractionUsed: true,
      });

      const mockGetExtractionStats = vi.mocked(mockSmartSearch.getExtractionStats);
      mockGetExtractionStats.mockResolvedValue({
        hasCache: true,
        contentCounts: { files: 1, pages: 0, links: 0 },
        apiStatus: "available",
        lastUpdate: new Date(),
        cacheAge: 1000,
      });

      const result = await performSmartSearch(params);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.query).toBe("test query");
    });

    test("handles missing course ID", async () => {
      const params: SmartSearchParams = {
        ...mockParams,
        courseId: undefined,
      };

      const result = await performSmartSearch(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Course ID is required");
    });
  });

  describe("getCourseContentOverview", () => {
    test("gets course content overview", async () => {
      const mockGetExtractionStats = await import("@/lib/content-extraction");
      vi.mocked(mockGetExtractionStats.getExtractionStats).mockResolvedValue({
        hasCache: true,
        contentCounts: { files: 10, pages: 5, links: 3 },
        apiStatus: "available",
        lastUpdate: new Date(),
        cacheAge: 1000,
      });

      const result = await getCourseContentOverview(
        "12345",
        "https://test.instructure.com",
        "test-token",
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.courseId).toBe("12345");
      expect(result.contentSummary.totalFiles).toBe(10);
    });
  });

  describe("clearContentCache", () => {
    test("clears content cache", () => {
      const result = clearContentCache("12345");

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toContain("Cleared content cache for course 12345");
    });

    test("clears all content cache", () => {
      const result = clearContentCache();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toContain("Cleared content cache for all courses");
    });
  });
});
