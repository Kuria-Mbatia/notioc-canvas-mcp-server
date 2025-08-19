import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type MockedFunction,
} from "vitest";
import {
  extractCourseContent,
  smartSearch,
  getContentByFileId,
  clearCourseCache,
  getExtractionStats,
} from "../../src/lib/content-extraction.js";
import { logger } from "../../src/lib/logger.js";

// Mock dependencies
vi.mock("../../src/lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../src/lib/api-detector.js", () => ({
  testCourseAPIAvailability: vi.fn(),
  getAPIRestrictionSummary: vi.fn(),
  getSuggestedFallbacks: vi.fn(),
}));

vi.mock("../../src/lib/web-discovery.js", () => ({
  discoverCourseContentViaWeb: vi.fn(),
  searchDiscoveredContent: vi.fn(),
}));

vi.mock("../../src/lib/course-discovery.js", () => ({
  getCachedDiscovery: vi.fn(),
  setCachedDiscovery: vi.fn(),
  clearDiscoveryCache: vi.fn(),
}));

global.fetch = vi.fn();

describe("Content Extraction Engine", () => {
  const mockCourseId = "12345";
  const mockCanvasBaseUrl = "https://canvas.test.edu";
  const mockAccessToken = "test-token";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractCourseContent", () => {
    it("should return cached content when available", async () => {
      const { getCachedDiscovery } = await import(
        "../../src/lib/course-discovery.js"
      );
      const mockCachedContent = {
        courseId: mockCourseId,
        lastScanned: new Date(),
        apiAvailability: {},
        discoveredPages: [],
        discoveredFiles: [],
        discoveredLinks: [],
        searchableContent: "",
        metadata: {
          totalFiles: 0,
          totalPages: 0,
          hasRestrictedAPIs: false,
          discoveryMethod: "api" as const,
        },
      };

      (
        getCachedDiscovery as MockedFunction<typeof getCachedDiscovery>
      ).mockReturnValue(mockCachedContent);

      const result = await extractCourseContent(
        mockCourseId,
        mockCanvasBaseUrl,
        mockAccessToken,
        { forceRefresh: false },
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe("cached");
      expect(result.courseIndex).toEqual(mockCachedContent);
    });

    it("should handle extraction errors gracefully", async () => {
      const { getCachedDiscovery } = await import(
        "../../src/lib/course-discovery.js"
      );
      const { testCourseAPIAvailability } = await import(
        "../../src/lib/api-detector.js"
      );

      (
        getCachedDiscovery as MockedFunction<typeof getCachedDiscovery>
      ).mockReturnValue(null);
      (
        testCourseAPIAvailability as MockedFunction<
          typeof testCourseAPIAvailability
        >
      ).mockRejectedValue(new Error("API test failed"));

      const result = await extractCourseContent(
        mockCourseId,
        mockCanvasBaseUrl,
        mockAccessToken,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        "Content extraction failed: API test failed",
      );
    });
  });

  describe("clearCourseCache", () => {
    it("should clear cache for specific course", async () => {
      const { clearDiscoveryCache } = await import(
        "../../src/lib/course-discovery.js"
      );

      clearCourseCache(mockCourseId);

      expect(clearDiscoveryCache).toHaveBeenCalledWith(mockCourseId);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Cleared cache for course ${mockCourseId}`),
      );
    });
  });
});
