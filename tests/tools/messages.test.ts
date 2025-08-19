import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  listConversations,
  getConversationDetails,
  type ListConversationsParams,
  type ConversationDetailsParams,
} from "@/tools/messages";

// Mock dependencies
vi.mock("@/lib/pagination");
vi.mock("@/lib/canvas-api");

describe("Messages Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listConversations", () => {
    test("lists conversations", async () => {
      const params: ListConversationsParams = mockParams;

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue([
        {
          id: 1,
          subject: "Test Conversation",
          workflow_state: "unread",
          last_message: "Hello there",
          participants: [{ id: 123, name: "John Doe" }],
        },
      ]);

      const result = await listConversations(params);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    test("handles missing required parameters", async () => {
      const params = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(listConversations(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });
  });

  describe("getConversationDetails", () => {
    test("gets conversation details", async () => {
      const params: ConversationDetailsParams = {
        ...mockParams,
        conversationId: "1",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 1,
          subject: "Test Conversation",
          messages: [
            {
              id: 1,
              body: "Hello there",
              author_id: 123,
              created_at: "2024-01-15T10:00:00Z",
            },
          ],
        }),
      } as any);

      const result = await getConversationDetails(params);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    test("handles missing conversation ID", async () => {
      const params: ConversationDetailsParams = {
        ...mockParams,
        conversationId: "",
      };

      await expect(getConversationDetails(params)).rejects.toThrow(
        "conversationId is required",
      );
    });
  });
});