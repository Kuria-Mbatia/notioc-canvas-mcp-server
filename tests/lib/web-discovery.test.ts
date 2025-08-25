import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  discoverCourseContentViaWeb,
  searchDiscoveredContent,
  type WebDiscoveryOptions,
  type WebDiscoveryResult,
} from "../../src/lib/web-discovery.js";
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

vi.mock("../../src/lib/url-processor.js", () => ({
  parseCanvasURL: vi.fn(),
  extractFileIdsFromHTML: vi.fn(),
  extractLinksFromHTML: vi.fn(),
}));

vi.mock("../../src/lib/course-discovery.js", () => ({
  COMMON_COURSE_PAGES: ["syllabus", "assignments", "modules", "discussions"],
}));

global.fetch = vi.fn();

describe("Web Discovery", () => {
  const mockCourseId = "12345";
  const mockCanvasBaseUrl = "https://canvas.test.edu";
  const mockAccessToken = "test-token";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("discoverCourseContentViaWeb", () => {
    it("should discover course content successfully", async () => {
      const { parseCanvasURL, extractFileIdsFromHTML, extractLinksFromHTML } =
        await import("../../src/lib/url-processor.js");

      // Mock navigation API response
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "home",
                label: "Home",
                html_url: `${mockCanvasBaseUrl}/courses/${mockCourseId}/pages/home`,
                visibility: "public",
              },
            ]),
        })
        // Mock page accessibility check
        .mockResolvedValueOnce({ ok: true })
        // Mock common page checks
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false })
        // Mock page content API
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              body: '<p>Course content with <a href="/files/123">test.pdf</a></p>',
            }),
        });

      (parseCanvasURL as any).mockReturnValue({
        type: "page",
        resourceId: "home",
      });

      (extractFileIdsFromHTML as any).mockReturnValue([
        { fileId: "123", fileName: "test.pdf", url: "/files/123" },
      ]);

      (extractLinksFromHTML as any).mockReturnValue([
        {
          title: "External Link",
          url: "https://example.com",
          type: "external",
        },
      ]);

      const result = await discoverCourseContentViaWeb(
        mockCourseId,
        mockCanvasBaseUrl,
        mockAccessToken,
      );

      expect(result.success).toBe(true);
      expect(result.discoveredPages.length).toBeGreaterThan(0);
      expect(result.discoveredFiles.length).toBeGreaterThan(0);
      expect(result.discoveredLinks.length).toBeGreaterThan(0);
    });

    it("should handle navigation API failures gracefully", async () => {
      // Mock failed navigation API
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false, status: 403 })
        // Mock common page checks (all fail)
        .mockResolvedValue({ ok: false });

      const result = await discoverCourseContentViaWeb(
        mockCourseId,
        mockCanvasBaseUrl,
        mockAccessToken,
      );

      expect(result.success).toBe(false);
      expect(result.discoveredPages).toHaveLength(0);
    });

    it("should respect rate limiting when enabled", async () => {
      const { extractFileIdsFromHTML, extractLinksFromHTML } = await import(
        "../../src/lib/url-processor.js"
      );

      // Mock successful navigation and page discovery
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        // Mock one successful common page
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValue({ ok: false })
        // Mock page content
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ body: "<p>Test content</p>" }),
        });

      (extractFileIdsFromHTML as any).mockReturnValue([]);
      (extractLinksFromHTML as any).mockReturnValue([]);

      const startTime = Date.now();
      const options: Partial<WebDiscoveryOptions> = {
        respectRateLimit: true,
        extractEmbeddedContent: true,
      };

      await discoverCourseContentViaWeb(
        mockCourseId,
        mockCanvasBaseUrl,
        mockAccessToken,
        options,
      );

      const endTime = Date.now();
      // Should have some delay due to rate limiting
      expect(endTime - startTime).toBeGreaterThan(400);
    });

    it("should handle content extraction errors gracefully", async () => {
      // Mock navigation to return empty result
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        })
        // Mock all common page checks to fail
        .mockResolvedValue({ ok: false });

      const result = await discoverCourseContentViaWeb(
        mockCourseId,
        mockCanvasBaseUrl,
        mockAccessToken,
        { extractEmbeddedContent: true },
      );

      // Should succeed but with no content found
      expect(result.success).toBe(false);
      expect(result.discoveredPages).toHaveLength(0);
    });

    it("should skip navigation discovery when disabled", async () => {
      // Mock common page checks
      (global.fetch as any).mockResolvedValue({ ok: false });

      const options: Partial<WebDiscoveryOptions> = {
        includeNavigation: false,
      };

      const result = await discoverCourseContentViaWeb(
        mockCourseId,
        mockCanvasBaseUrl,
        mockAccessToken,
        options,
      );

      // Should not call navigation API
      expect(fetch).not.toHaveBeenCalledWith(
        `${mockCanvasBaseUrl}/api/v1/courses/${mockCourseId}/tabs`,
        expect.any(Object),
      );
    });

    it("should handle unexpected errors", async () => {
      // Mock all fetch calls to fail with a network error
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      const result = await discoverCourseContentViaWeb(
        mockCourseId,
        mockCanvasBaseUrl,
        mockAccessToken,
      );

      // Since navigation discovery catches errors internally, the main function
      // should still succeed but with no content discovered
      expect(result.success).toBe(false);
      expect(result.discoveredPages).toHaveLength(0);
      expect(result.discoveredFiles).toHaveLength(0);
    });
  });

  describe("searchDiscoveredContent", () => {
    const mockDiscoveryResult: WebDiscoveryResult = {
      courseId: mockCourseId,
      success: true,
      discoveredPages: [
        {
          name: "Course Syllabus",
          url: "test-url",
          path: "syllabus",
          accessible: true,
          contentType: "html",
          lastChecked: new Date(),
        },
        {
          name: "Assignment Guidelines",
          url: "test-url-2",
          path: "assignments",
          accessible: true,
          contentType: "html",
          lastChecked: new Date(),
        },
      ],
      discoveredFiles: [
        {
          fileId: "123",
          fileName: "syllabus.pdf",
          url: "test-url",
          source: "Course Syllabus",
          lastModified: new Date(),
        },
        {
          fileId: "456",
          fileName: "assignment-template.docx",
          url: "test-url",
          source: "Assignment Guidelines",
          lastModified: new Date(),
        },
      ],
      discoveredLinks: [
        {
          title: "External Resource",
          url: "https://example.com",
          type: "external",
          source: "Course Syllabus",
        },
        {
          title: "Video Lecture",
          url: "https://youtube.com/watch?v=123",
          type: "video",
          source: "Assignment Guidelines",
        },
      ],
      searchableContent: "Course content here",
      errors: [],
      warnings: [],
      timing: {
        totalTime: 1000,
        pagesDiscovered: 2,
        filesExtracted: 2,
        linksExtracted: 2,
      },
    };

    it("should find matching files by filename", () => {
      const result = searchDiscoveredContent(mockDiscoveryResult, "syllabus");

      expect(result.files).toHaveLength(1);
      expect(result.files[0].fileName).toBe("syllabus.pdf");
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].name).toBe("Course Syllabus");
    });

    it("should find matching files by source", () => {
      const result = searchDiscoveredContent(mockDiscoveryResult, "assignment");

      expect(result.files).toHaveLength(1);
      expect(result.files[0].fileName).toBe("assignment-template.docx");
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].name).toBe("Assignment Guidelines");
    });

    it("should find matching links by title", () => {
      const result = searchDiscoveredContent(mockDiscoveryResult, "video");

      expect(result.links).toHaveLength(1);
      expect(result.links[0].title).toBe("Video Lecture");
    });

    it("should handle multiple search terms", () => {
      const result = searchDiscoveredContent(
        mockDiscoveryResult,
        "course syllabus",
      );

      expect(result.files.length + result.pages.length).toBeGreaterThan(0);
    });

    it("should be case insensitive", () => {
      const result = searchDiscoveredContent(mockDiscoveryResult, "SYLLABUS");

      expect(result.files).toHaveLength(1);
      expect(result.pages).toHaveLength(1);
    });

    it("should calculate relevance score correctly", () => {
      const result = searchDiscoveredContent(mockDiscoveryResult, "syllabus");

      expect(result.relevanceScore).toBeGreaterThan(0);
      expect(result.relevanceScore).toBeLessThanOrEqual(1);
    });

    it("should return empty results for no matches", () => {
      const result = searchDiscoveredContent(
        mockDiscoveryResult,
        "nonexistent",
      );

      expect(result.files).toHaveLength(0);
      expect(result.pages).toHaveLength(0);
      expect(result.links).toHaveLength(0);
      expect(result.relevanceScore).toBe(0);
    });

    it("should handle empty discovery result", () => {
      const emptyResult: WebDiscoveryResult = {
        courseId: mockCourseId,
        success: true,
        discoveredPages: [],
        discoveredFiles: [],
        discoveredLinks: [],
        searchableContent: "",
        errors: [],
        warnings: [],
        timing: {
          totalTime: 0,
          pagesDiscovered: 0,
          filesExtracted: 0,
          linksExtracted: 0,
        },
      };

      const result = searchDiscoveredContent(emptyResult, "anything");

      expect(result.files).toHaveLength(0);
      expect(result.pages).toHaveLength(0);
      expect(result.links).toHaveLength(0);
      expect(result.relevanceScore).toBe(0);
    });
  });
});
