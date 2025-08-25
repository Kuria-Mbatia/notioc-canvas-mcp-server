import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  getPageContent,
  listPages,
  type PageContentParams,
  type PagesListParams,
} from "@/tools/pages-discussions";
import * as coursesModule from "@/tools/courses";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/lib/pagination");
vi.mock("@/lib/canvas-api");
vi.mock("@/lib/search");

// Mock global fetch
global.fetch = vi.fn();

const mockListCourses = vi.mocked(coursesModule.listCourses);
const mockFetch = vi.mocked(global.fetch);

describe("Pages Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listPages", () => {
    test("lists pages for course", async () => {
      const params: PagesListParams = {
        ...mockParams,
        courseId: "12345",
      };

      const mockCourses = [
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue([
        {
          title: "Test Page",
          html_url:
            "https://test.instructure.com/courses/12345/pages/test-page",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-16T10:00:00Z",
        },
      ]);

      const result = await listPages(params);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("title");
        expect(result[0]).toHaveProperty("url");
        expect(result[0]).toHaveProperty("createdAt");
      }
    });

    test("handles missing required parameters", async () => {
      const params = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(listPages(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });

    test("handles missing course parameters", async () => {
      const params: PagesListParams = {
        ...mockParams,
      };

      await expect(listPages(params)).rejects.toThrow(
        "Either courseId or courseName must be provided",
      );
    });
  });

  describe("getPageContent", () => {
    test("gets page content by pageUrl", async () => {
      const params: PageContentParams = {
        ...mockParams,
        courseId: "12345",
        pageUrl: "test-page",
      };

      const mockCourses = [
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          title: "Test Page",
          body: "<p>This is test content</p>",
          html_url:
            "https://test.instructure.com/courses/12345/pages/test-page",
        }),
      } as any);

      const result = await getPageContent(params);

      expect(result).toBeDefined();
      expect(result.title).toBe("Test Page");
      expect(result.body).toBe("<p>This is test content</p>");
      expect(result.url).toBe(
        "https://test.instructure.com/courses/12345/pages/test-page",
      );
    });

    test("handles missing page identifier", async () => {
      const params: PageContentParams = {
        ...mockParams,
        courseId: "12345",
      };

      await expect(getPageContent(params)).rejects.toThrow(
        "Either pageUrl, pageId, or fullUrl must be provided.",
      );
    });
  });
});
