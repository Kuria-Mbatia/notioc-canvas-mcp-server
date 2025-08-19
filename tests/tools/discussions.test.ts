import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  postDiscussionReply,
  replyToDiscussionEntry,
  type PostDiscussionReplyParams,
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

  describe("postDiscussionReply", () => {
    test("posts a reply to a discussion topic", async () => {
      const params: PostDiscussionReplyParams = {
        ...mockParams,
        courseId: "12345",
        topicId: "1",
        message: "This is a test reply",
      };

      const mockCourses = [
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "123",
          message: "This is a test reply",
          created_at: "2024-01-15T10:00:00Z",
          user_id: "456",
          user_name: "Test User",
        }),
      } as any);

      const result = await postDiscussionReply(params);

      expect(result).toBeDefined();
      expect(result.id).toBe("123");
      expect(result.message).toBe("This is a test reply");
    });

    test("handles missing required parameters", async () => {
      const params = {
        canvasBaseUrl: "",
        accessToken: "test-token",
        topicId: "1",
        message: "Test message",
      };

      await expect(postDiscussionReply(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });

    test("handles missing topic ID", async () => {
      const params: PostDiscussionReplyParams = {
        ...mockParams,
        courseId: "12345",
        topicId: "",
        message: "Test message",
      };

      await expect(postDiscussionReply(params)).rejects.toThrow(
        "Both topicId and message are required",
      );
    });

    test("handles missing message", async () => {
      const params: PostDiscussionReplyParams = {
        ...mockParams,
        courseId: "12345",
        topicId: "1",
        message: "",
      };

      await expect(postDiscussionReply(params)).rejects.toThrow(
        "Both topicId and message are required",
      );
    });
  });

  describe("replyToDiscussionEntry", () => {
    test("posts a threaded reply to a discussion entry", async () => {
      const params = {
        ...mockParams,
        courseId: "12345",
        topicId: "1",
        parentEntryId: "456",
        message: "This is a threaded reply",
      };

      const mockCourses = [
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "789",
          message: "This is a threaded reply",
          created_at: "2024-01-15T10:00:00Z",
          user_id: "123",
          user_name: "Test User",
        }),
      } as any);

      const result = await replyToDiscussionEntry(params);

      expect(result).toBeDefined();
      expect(result.id).toBe("789");
      expect(result.message).toBe("This is a threaded reply");
      expect(result.parentId).toBe("456");
    });

    test("handles missing parent entry ID", async () => {
      const params = {
        ...mockParams,
        courseId: "12345",
        topicId: "1",
        parentEntryId: "",
        message: "Test message",
      };

      await expect(replyToDiscussionEntry(params)).rejects.toThrow(
        "topicId, parentEntryId, and message are all required",
      );
    });
  });
});
