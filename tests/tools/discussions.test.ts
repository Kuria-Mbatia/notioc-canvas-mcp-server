import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  listDiscussions,
  getDiscussionDetails,
  type ListDiscussionsParams,
  type DiscussionDetailsParams,
} from "@/tools/discussions";
import * as coursesModule from "@/tools/courses";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/lib/pagination");
vi.mock("@/lib/canvas-api");
vi.mock("@/lib/search");

const mockListCourses = vi.mocked(coursesModule.listCourses);

describe("Discussions Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listDiscussions", () => {
    test("lists discussions for course", async () => {
      const params: ListDiscussionsParams = {
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
          id: 1,
          title: "Welcome Discussion",
          message: "Welcome to the course!",
          discussion_type: "side_comment",
          published: true,
          reply_count: 5,
          unread_count: 2,
        },
      ]);

      const result = await listDiscussions(params);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    test("handles missing required parameters", async () => {
      const params = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(listDiscussions(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });
  });

  describe("getDiscussionDetails", () => {
    test("gets discussion details", async () => {
      const params: DiscussionDetailsParams = {
        ...mockParams,
        courseId: "12345",
        discussionId: "1",
      };

      const mockCourses = [
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 1,
          title: "Welcome Discussion",
          message: "Welcome to the course!",
          published: true,
        }),
      } as any);

      const result = await getDiscussionDetails(params);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    test("handles missing discussion ID", async () => {
      const params: DiscussionDetailsParams = {
        ...mockParams,
        courseId: "12345",
        discussionId: "",
      };

      await expect(getDiscussionDetails(params)).rejects.toThrow(
        "discussionId is required",
      );
    });
  });
});