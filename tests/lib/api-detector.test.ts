import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import {
  testCourseAPIAvailability,
  getAPIRestrictionSummary,
  isAPIAvailable,
  getSuggestedFallbacks,
  type APITestResult,
} from "@/lib/api-detector";
import { getCachedDiscovery, setCachedDiscovery } from "@/lib/course-discovery";

// Mock dependencies
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock("@/lib/course-discovery", () => ({
  getCachedDiscovery: vi.fn(),
  setCachedDiscovery: vi.fn(),
  CANVAS_API_ENDPOINTS: [
    { name: "pages", path: "/pages" },
    { name: "files", path: "/files" },
    { name: "modules", path: "/modules" },
    { name: "assignments", path: "/assignments" },
  ],
}));

// Mock fetch globally
global.fetch = vi.fn();

const mockFetch = global.fetch as any;
const mockGetCachedDiscovery = getCachedDiscovery as any;
const mockSetCachedDiscovery = setCachedDiscovery as any;

describe("api-detector", () => {
  const testCourseId = "123456";
  const testBaseUrl = "https://test.instructure.com";
  const testAccessToken = "test-token";

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedDiscovery.mockReturnValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("testCourseAPIAvailability", () => {
    test("should return cached results when available and useCache is true", async () => {
      const mockCachedResult = {
        courseId: testCourseId,
        apiAvailability: {
          courseId: testCourseId,
          tested: new Date(),
          endpoints: {
            pages: { name: "pages", path: "/pages", available: true, status: 200 },
            files: { name: "files", path: "/files", available: false, status: 403 },
          },
        },
      };

      mockGetCachedDiscovery.mockReturnValue(mockCachedResult);

      const result = await testCourseAPIAvailability(
        testCourseId,
        testBaseUrl,
        testAccessToken,
        true
      );

      expect(result.courseId).toBe(testCourseId);
      expect(result.availability).toBe(mockCachedResult.apiAvailability);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should test all endpoints when no cache available", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("/pages")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: "OK",
          });
        }
        if (url.includes("/files")) {
          return Promise.resolve({
            ok: false,
            status: 403,
            statusText: "Forbidden",
            text: () => Promise.resolve(JSON.stringify({ message: "Access denied" })),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
        });
      });

      const result = await testCourseAPIAvailability(
        testCourseId,
        testBaseUrl,
        testAccessToken,
        false
      );

      expect(result.courseId).toBe(testCourseId);
      expect(result.summary.totalEndpoints).toBe(4);
      expect(result.summary.availableEndpoints).toBe(3);
      expect(result.summary.restrictedEndpoints).toBe(1);
      expect(result.summary.hasWorkingAPIs).toBe(true);
      expect(result.summary.hasRestrictedAPIs).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    test("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await testCourseAPIAvailability(
        testCourseId,
        testBaseUrl,
        testAccessToken,
        false
      );

      expect(result.summary.availableEndpoints).toBe(0);
      expect(result.summary.restrictedEndpoints).toBe(4);
      expect(result.summary.hasWorkingAPIs).toBe(false);
    });

    test("should cache results when useCache is true", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
      });

      await testCourseAPIAvailability(
        testCourseId,
        testBaseUrl,
        testAccessToken,
        true
      );

      expect(mockSetCachedDiscovery).toHaveBeenCalledWith(
        testCourseId,
        expect.objectContaining({
          courseId: testCourseId,
          apiAvailability: expect.any(Object),
        })
      );
    });

    test("should handle timeout errors", async () => {
      mockFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Timeout")), 100);
        });
      });

      const result = await testCourseAPIAvailability(
        testCourseId,
        testBaseUrl,
        testAccessToken,
        false
      );

      expect(result.summary.availableEndpoints).toBe(0);
      expect(result.availability.endpoints.pages.error).toBe("Request failed");
    });
  });

  describe("getAPIRestrictionSummary", () => {
    test("should return all available message when all APIs work", () => {
      const testResult: APITestResult = {
        courseId: testCourseId,
        availability: {
          courseId: testCourseId,
          tested: new Date(),
          endpoints: {
            pages: { name: "pages", path: "/pages", available: true, status: 200 },
            files: { name: "files", path: "/files", available: true, status: 200 },
            modules: { name: "modules", path: "/modules", available: true, status: 200 },
            assignments: { name: "assignments", path: "/assignments", available: true, status: 200 },
          } as any,
        },
        summary: {
          totalEndpoints: 4,
          availableEndpoints: 4,
          restrictedEndpoints: 0,
          hasWorkingAPIs: true,
          hasRestrictedAPIs: false,
          recommendWebDiscovery: false,
        },
        timing: { totalTime: 1000, averageResponseTime: 250 },
      };

      const summary = getAPIRestrictionSummary(testResult);
      expect(summary).toBe("All APIs available (4/4)");
    });

    test("should return all restricted message when no APIs work", () => {
      const testResult: APITestResult = {
        courseId: testCourseId,
        availability: {
          courseId: testCourseId,
          tested: new Date(),
          endpoints: {
            pages: { name: "pages", path: "/pages", available: false, status: 403 },
            files: { name: "files", path: "/files", available: false, status: 403 },
          } as any,
        },
        summary: {
          totalEndpoints: 2,
          availableEndpoints: 0,
          restrictedEndpoints: 2,
          hasWorkingAPIs: false,
          hasRestrictedAPIs: true,
          recommendWebDiscovery: true,
        },
        timing: { totalTime: 1000, averageResponseTime: 500 },
      };

      const summary = getAPIRestrictionSummary(testResult);
      expect(summary).toBe("All APIs restricted (0/2) - Web discovery recommended");
    });

    test("should return partial access message with restricted API names", () => {
      const testResult: APITestResult = {
        courseId: testCourseId,
        availability: {
          courseId: testCourseId,
          tested: new Date(),
          endpoints: {
            pages: { name: "pages", path: "/pages", available: true, status: 200 },
            files: { name: "files", path: "/files", available: false, status: 403 },
            modules: { name: "modules", path: "/modules", available: false, status: 404 },
          } as any,
        },
        summary: {
          totalEndpoints: 3,
          availableEndpoints: 1,
          restrictedEndpoints: 2,
          hasWorkingAPIs: true,
          hasRestrictedAPIs: true,
          recommendWebDiscovery: true,
        },
        timing: { totalTime: 1000, averageResponseTime: 333 },
      };

      const summary = getAPIRestrictionSummary(testResult);
      expect(summary).toBe("Partial API access (1/3 available). Restricted: files, modules");
    });
  });

  describe("isAPIAvailable", () => {
    const testResult: APITestResult = {
      courseId: testCourseId,
      availability: {
        courseId: testCourseId,
        tested: new Date(),
        endpoints: {
          pages: { name: "pages", path: "/pages", available: true, status: 200 },
          files: { name: "files", path: "/files", available: false, status: 403 },
        } as any,
      },
      summary: {
        totalEndpoints: 2,
        availableEndpoints: 1,
        restrictedEndpoints: 1,
        hasWorkingAPIs: true,
        hasRestrictedAPIs: true,
        recommendWebDiscovery: false,
      },
      timing: { totalTime: 1000, averageResponseTime: 500 },
    };

    test("should return true for available APIs", () => {
      expect(isAPIAvailable(testResult, "pages")).toBe(true);
    });

    test("should return false for restricted APIs", () => {
      expect(isAPIAvailable(testResult, "files")).toBe(false);
    });

    test("should return false for non-existent APIs", () => {
      expect(isAPIAvailable(testResult, "nonexistent")).toBe(false);
    });
  });

  describe("getSuggestedFallbacks", () => {
    test("should suggest appropriate fallbacks for restricted APIs", () => {
      const testResult: APITestResult = {
        courseId: testCourseId,
        availability: {
          courseId: testCourseId,
          tested: new Date(),
          endpoints: {
            pages: { name: "pages", path: "/pages", available: false, status: 404 },
            files: { name: "files", path: "/files", available: false, status: 403 },
            modules: { name: "modules", path: "/modules", available: false, status: 403 },
          } as any,
        },
        summary: {
          totalEndpoints: 3,
          availableEndpoints: 0,
          restrictedEndpoints: 3,
          hasWorkingAPIs: false,
          hasRestrictedAPIs: true,
          recommendWebDiscovery: true,
        },
        timing: { totalTime: 1000, averageResponseTime: 333 },
      };

      const fallbacks = getSuggestedFallbacks(testResult);

      expect(fallbacks).toHaveLength(3);
      expect(fallbacks.find(f => f.api === "pages")).toEqual({
        api: "pages",
        fallback: "Web interface discovery",
        reason: "Pages API disabled - try direct page URLs",
      });
      expect(fallbacks.find(f => f.api === "files")).toEqual({
        api: "files",
        fallback: "Extract from page content",
        reason: "Files API unauthorized - search for embedded file links",
      });
      expect(fallbacks.find(f => f.api === "modules")).toEqual({
        api: "modules",
        fallback: "Course navigation parsing",
        reason: "Modules API restricted - check course tabs/navigation",
      });
    });

    test("should return empty array when all APIs are available", () => {
      const testResult: APITestResult = {
        courseId: testCourseId,
        availability: {
          courseId: testCourseId,
          tested: new Date(),
          endpoints: {
            pages: { name: "pages", path: "/pages", available: true, status: 200 },
            files: { name: "files", path: "/files", available: true, status: 200 },
          } as any,
        },
        summary: {
          totalEndpoints: 2,
          availableEndpoints: 2,
          restrictedEndpoints: 0,
          hasWorkingAPIs: true,
          hasRestrictedAPIs: false,
          recommendWebDiscovery: false,
        },
        timing: { totalTime: 1000, averageResponseTime: 500 },
      };

      const fallbacks = getSuggestedFallbacks(testResult);
      expect(fallbacks).toHaveLength(0);
    });

    test("should suggest generic fallback for unknown API types", () => {
      const testResult: APITestResult = {
        courseId: testCourseId,
        availability: {
          courseId: testCourseId,
          tested: new Date(),
          endpoints: {
            unknown: { name: "unknown", path: "/unknown", available: false, status: 403 },
          } as any,
        },
        summary: {
          totalEndpoints: 1,
          availableEndpoints: 0,
          restrictedEndpoints: 1,
          hasWorkingAPIs: false,
          hasRestrictedAPIs: true,
          recommendWebDiscovery: true,
        },
        timing: { totalTime: 1000, averageResponseTime: 1000 },
      };

      const fallbacks = getSuggestedFallbacks(testResult);
      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0]).toEqual({
        api: "unknown",
        fallback: "Web interface",
        reason: "unknown API restricted - try web discovery",
      });
    });
  });
});
