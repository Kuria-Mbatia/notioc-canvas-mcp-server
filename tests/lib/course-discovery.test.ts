import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import {
  getCachedDiscovery,
  setCachedDiscovery,
  clearDiscoveryCache,
  CANVAS_API_ENDPOINTS,
  DEFAULT_DISCOVERY_CONFIG,
  type CourseContentIndex,
  type CourseAPIAvailability,
} from "@/lib/course-discovery";

describe("course-discovery", () => {
  const testCourseId = "12345";
  const testCourseId2 = "67890";

  // Mock CourseAPIAvailability for testing
  const mockApiAvailability: CourseAPIAvailability = {
    courseId: testCourseId,
    tested: new Date(),
    endpoints: {
      pages: { name: "pages", path: "/pages", available: true, status: 200 },
      files: { name: "files", path: "/files", available: true, status: 200 },
      modules: { name: "modules", path: "/modules", available: false, status: 403 },
      assignments: { name: "assignments", path: "/assignments", available: true, status: 200 },
      discussions: { name: "discussions", path: "/discussion_topics", available: true, status: 200 },
      announcements: { name: "announcements", path: "/announcements", available: false, status: 404 },
      tabs: { name: "tabs", path: "/tabs", available: true, status: 200 },
    },
  };

  const createMockContentIndex = (courseId: string, lastScanned: Date = new Date()): CourseContentIndex => ({
    courseId,
    courseName: `Test Course ${courseId}`,
    lastScanned,
    apiAvailability: { ...mockApiAvailability, courseId },
    discoveredPages: [
      {
        name: "Course Introduction",
        url: `https://test.instructure.com/courses/${courseId}/pages/introduction`,
        path: "/pages/introduction",
        accessible: true,
        contentType: "text/html",
        lastChecked: new Date(),
      },
    ],
    discoveredFiles: [
      {
        fileId: "file123",
        fileName: "syllabus.pdf",
        url: `https://test.instructure.com/courses/${courseId}/files/file123`,
        source: "Course Introduction",
        fileType: "application/pdf",
        size: 1024000,
      },
    ],
    discoveredLinks: [
      {
        title: "External Resource",
        url: "https://example.com/resource",
        type: "external",
        source: "Course Introduction",
      },
    ],
    searchableContent: "Course Introduction syllabus external resource",
    metadata: {
      totalFiles: 1,
      totalPages: 1,
      hasRestrictedAPIs: true,
      discoveryMethod: "hybrid",
    },
  });

  beforeEach(() => {
    // Clear cache before each test
    clearDiscoveryCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up after each test
    clearDiscoveryCache();
    vi.resetAllMocks();
  });

  describe("setCachedDiscovery", () => {
    test("should store course content index in cache", () => {
      const mockIndex = createMockContentIndex(testCourseId);
      
      setCachedDiscovery(testCourseId, mockIndex);
      
      const retrieved = getCachedDiscovery(testCourseId);
      expect(retrieved).toEqual(mockIndex);
    });

    test("should overwrite existing cache entry", () => {
      const mockIndex1 = createMockContentIndex(testCourseId);
      const mockIndex2 = createMockContentIndex(testCourseId);
      mockIndex2.courseName = "Updated Course Name";
      
      setCachedDiscovery(testCourseId, mockIndex1);
      setCachedDiscovery(testCourseId, mockIndex2);
      
      const retrieved = getCachedDiscovery(testCourseId);
      expect(retrieved?.courseName).toBe("Updated Course Name");
    });

    test("should handle multiple course IDs independently", () => {
      const mockIndex1 = createMockContentIndex(testCourseId);
      const mockIndex2 = createMockContentIndex(testCourseId2);
      
      setCachedDiscovery(testCourseId, mockIndex1);
      setCachedDiscovery(testCourseId2, mockIndex2);
      
      expect(getCachedDiscovery(testCourseId)).toEqual(mockIndex1);
      expect(getCachedDiscovery(testCourseId2)).toEqual(mockIndex2);
    });
  });

  describe("getCachedDiscovery", () => {
    test("should return null for non-existent cache entry", () => {
      const result = getCachedDiscovery("nonexistent");
      expect(result).toBeNull();
    });

    test("should return cached content index for valid course ID", () => {
      const mockIndex = createMockContentIndex(testCourseId);
      setCachedDiscovery(testCourseId, mockIndex);
      
      const result = getCachedDiscovery(testCourseId);
      expect(result).toEqual(mockIndex);
    });

    test("should return null for expired cache entries", () => {
      // Create an index with a very old timestamp
      const oldDate = new Date(Date.now() - DEFAULT_DISCOVERY_CONFIG.cacheTimeout - 1000);
      const mockIndex = createMockContentIndex(testCourseId, oldDate);
      
      setCachedDiscovery(testCourseId, mockIndex);
      
      const result = getCachedDiscovery(testCourseId);
      expect(result).toBeNull();
    });

    test("should return valid cache entry within timeout period", () => {
      // Create an index with a recent timestamp
      const recentDate = new Date(Date.now() - 1000); // 1 second ago
      const mockIndex = createMockContentIndex(testCourseId, recentDate);
      
      setCachedDiscovery(testCourseId, mockIndex);
      
      const result = getCachedDiscovery(testCourseId);
      expect(result).toEqual(mockIndex);
    });

    test("should clean up expired entries automatically", () => {
      const oldDate = new Date(Date.now() - DEFAULT_DISCOVERY_CONFIG.cacheTimeout - 1000);
      const mockIndex = createMockContentIndex(testCourseId, oldDate);
      
      setCachedDiscovery(testCourseId, mockIndex);
      
      // First call should return null and clean up
      expect(getCachedDiscovery(testCourseId)).toBeNull();
      
      // Second call should still return null (entry was cleaned up)
      expect(getCachedDiscovery(testCourseId)).toBeNull();
    });

    test("should handle edge case at exact cache timeout boundary", () => {
      const boundaryDate = new Date(Date.now() - DEFAULT_DISCOVERY_CONFIG.cacheTimeout);
      const mockIndex = createMockContentIndex(testCourseId, boundaryDate);
      
      setCachedDiscovery(testCourseId, mockIndex);
      
      const result = getCachedDiscovery(testCourseId);
      // At exactly the timeout boundary, should still return the cached value (uses > not >=)
      expect(result).toEqual(mockIndex);
    });

    test("should return null when cache age exceeds timeout", () => {
      const expiredDate = new Date(Date.now() - DEFAULT_DISCOVERY_CONFIG.cacheTimeout - 1);
      const mockIndex = createMockContentIndex(testCourseId, expiredDate);
      
      setCachedDiscovery(testCourseId, mockIndex);
      
      const result = getCachedDiscovery(testCourseId);
      expect(result).toBeNull();
    });
  });

  describe("clearDiscoveryCache", () => {
    test("should clear specific course cache entry", () => {
      const mockIndex1 = createMockContentIndex(testCourseId);
      const mockIndex2 = createMockContentIndex(testCourseId2);
      
      setCachedDiscovery(testCourseId, mockIndex1);
      setCachedDiscovery(testCourseId2, mockIndex2);
      
      clearDiscoveryCache(testCourseId);
      
      expect(getCachedDiscovery(testCourseId)).toBeNull();
      expect(getCachedDiscovery(testCourseId2)).toEqual(mockIndex2);
    });

    test("should clear all cache entries when no course ID provided", () => {
      const mockIndex1 = createMockContentIndex(testCourseId);
      const mockIndex2 = createMockContentIndex(testCourseId2);
      
      setCachedDiscovery(testCourseId, mockIndex1);
      setCachedDiscovery(testCourseId2, mockIndex2);
      
      clearDiscoveryCache();
      
      expect(getCachedDiscovery(testCourseId)).toBeNull();
      expect(getCachedDiscovery(testCourseId2)).toBeNull();
    });

    test("should handle clearing non-existent cache entry gracefully", () => {
      expect(() => clearDiscoveryCache("nonexistent")).not.toThrow();
    });

    test("should handle clearing empty cache gracefully", () => {
      expect(() => clearDiscoveryCache()).not.toThrow();
      expect(() => clearDiscoveryCache("any-id")).not.toThrow();
    });
  });

  describe("DEFAULT_DISCOVERY_CONFIG", () => {
    test("should have expected default values", () => {
      expect(DEFAULT_DISCOVERY_CONFIG).toEqual({
        enabled: true,
        cacheTimeout: 3600000, // 1 hour
        maxRetries: 3,
        respectRateLimit: true,
      });
    });
  });

  describe("CANVAS_API_ENDPOINTS", () => {
    test("should contain expected endpoint definitions", () => {
      expect(CANVAS_API_ENDPOINTS).toBeDefined();
      expect(Array.isArray(CANVAS_API_ENDPOINTS)).toBe(true);
      expect(CANVAS_API_ENDPOINTS.length).toBeGreaterThan(0);
      
      // Check that each endpoint has required properties
      CANVAS_API_ENDPOINTS.forEach(endpoint => {
        expect(endpoint).toHaveProperty("name");
        expect(endpoint).toHaveProperty("path");
        expect(typeof endpoint.name).toBe("string");
        expect(typeof endpoint.path).toBe("string");
      });
    });

    test("should include common Canvas API endpoints", () => {
      const endpointNames = CANVAS_API_ENDPOINTS.map(e => e.name);
      
      expect(endpointNames).toContain("pages");
      expect(endpointNames).toContain("files");
      expect(endpointNames).toContain("assignments");
      expect(endpointNames).toContain("modules");
    });
  });

  describe("Integration scenarios", () => {
    test("should handle complete cache lifecycle", () => {
      const mockIndex = createMockContentIndex(testCourseId);
      
      // Initially empty
      expect(getCachedDiscovery(testCourseId)).toBeNull();
      
      // Set cache
      setCachedDiscovery(testCourseId, mockIndex);
      expect(getCachedDiscovery(testCourseId)).toEqual(mockIndex);
      
      // Update cache
      const updatedIndex = { ...mockIndex, courseName: "Updated Course" };
      setCachedDiscovery(testCourseId, updatedIndex);
      expect(getCachedDiscovery(testCourseId)?.courseName).toBe("Updated Course");
      
      // Clear specific entry
      clearDiscoveryCache(testCourseId);
      expect(getCachedDiscovery(testCourseId)).toBeNull();
    });

    test("should handle concurrent cache operations", () => {
      const mockIndex1 = createMockContentIndex("course1");
      const mockIndex2 = createMockContentIndex("course2");
      const mockIndex3 = createMockContentIndex("course3");
      
      // Set multiple entries
      setCachedDiscovery("course1", mockIndex1);
      setCachedDiscovery("course2", mockIndex2);
      setCachedDiscovery("course3", mockIndex3);
      
      // Verify all are cached
      expect(getCachedDiscovery("course1")).toEqual(mockIndex1);
      expect(getCachedDiscovery("course2")).toEqual(mockIndex2);
      expect(getCachedDiscovery("course3")).toEqual(mockIndex3);
      
      // Clear one specific entry
      clearDiscoveryCache("course2");
      
      // Verify selective clearing
      expect(getCachedDiscovery("course1")).toEqual(mockIndex1);
      expect(getCachedDiscovery("course2")).toBeNull();
      expect(getCachedDiscovery("course3")).toEqual(mockIndex3);
      
      // Clear all remaining
      clearDiscoveryCache();
      
      // Verify complete clearing
      expect(getCachedDiscovery("course1")).toBeNull();
      expect(getCachedDiscovery("course3")).toBeNull();
    });
  });
});
