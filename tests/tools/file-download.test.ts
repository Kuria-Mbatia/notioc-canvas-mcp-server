import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  downloadSubmissionFile,
  type CanvasFileDownloadParams,
} from "@/tools/file-download";

// Mock dependencies
vi.mock("@/lib/canvas-api");

describe("File Download Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe("downloadSubmissionFile", () => {
    const mockFileInfo = {
      display_name: "assignment.pdf",
      size: 1024,
      "content-type": "application/pdf",
      url: "https://test.instructure.com/files/12345/download",
    };

    test("downloads file using direct file ID", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        fileId: "12345",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockFileInfo,
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: new Map([
          ["content-type", "application/pdf"],
          ["content-length", "1024"],
        ]),
        arrayBuffer: async () => new ArrayBuffer(1024),
      } as any);

      const result = await downloadSubmissionFile(params);

      expect(result.filename).toBe("assignment.pdf");
      expect(result.contentType).toBe("application/pdf");
      expect(result.size).toBe(1024);
      expect(result.content).toContain("[PDF File: assignment.pdf");
    });

    test("extracts file ID from submission URL", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        submissionUrl: "https://test.instructure.com/courses/123/assignments/456/submissions/789?download=12345",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockFileInfo,
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: new Map([
          ["content-type", "application/pdf"],
          ["content-length", "1024"],
        ]),
        arrayBuffer: async () => new ArrayBuffer(1024),
      } as any);

      const result = await downloadSubmissionFile(params);

      expect(mockCallCanvasAPI.callCanvasAPI).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        method: "GET",
        apiPath: "/api/v1/files/12345",
      });
      expect(result.filename).toBe("assignment.pdf");
    });

    test("handles text files correctly", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        fileId: "12345",
      };

      const mockTextFileInfo = {
        ...mockFileInfo,
        display_name: "essay.txt",
        "content-type": "text/plain",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockTextFileInfo,
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: new Map([
          ["content-type", "text/plain"],
          ["content-length", "500"],
        ]),
        text: async () => "This is the essay content.",
      } as any);

      const result = await downloadSubmissionFile(params);

      expect(result.filename).toBe("essay.txt");
      expect(result.contentType).toBe("text/plain");
      expect(result.content).toBe("This is the essay content.");
    });

    test("handles JSON files correctly", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        fileId: "12345",
      };

      const mockJsonFileInfo = {
        ...mockFileInfo,
        display_name: "data.json",
        "content-type": "application/json",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockJsonFileInfo,
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: new Map([
          ["content-type", "application/json"],
          ["content-length", "100"],
        ]),
        text: async () => '{"key": "value"}',
      } as any);

      const result = await downloadSubmissionFile(params);

      expect(result.content).toBe('{"key": "value"}');
    });

    test("handles binary files correctly", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        fileId: "12345",
      };

      const mockBinaryFileInfo = {
        ...mockFileInfo,
        display_name: "image.png",
        "content-type": "image/png",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockBinaryFileInfo,
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: new Map([
          ["content-type", "image/png"],
          ["content-length", "2048"],
        ]),
        arrayBuffer: async () => new ArrayBuffer(2048),
      } as any);

      const result = await downloadSubmissionFile(params);

      expect(result.filename).toBe("image.png");
      expect(result.content).toContain("[Binary File: image.png");
      expect(result.content).toContain("2048 bytes");
    });

    test("tries multiple download strategies", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        fileId: "12345",
        courseId: "123",
        assignmentId: "456",
        submissionId: "789",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockFileInfo,
      } as any);

      // First URL fails, second succeeds
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([
            ["content-type", "application/pdf"],
            ["content-length", "1024"],
          ]),
          arrayBuffer: async () => new ArrayBuffer(1024),
        } as any);

      const result = await downloadSubmissionFile(params);

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.filename).toBe("assignment.pdf");
    });

    test("throws error when submission URL has no download parameter", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        submissionUrl: "https://test.instructure.com/courses/123/assignments/456/submissions/789",
      };

      await expect(downloadSubmissionFile(params)).rejects.toThrow(
        "Could not extract file ID from submission URL",
      );
    });

    test("throws error when no file ID provided", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
      };

      await expect(downloadSubmissionFile(params)).rejects.toThrow(
        "No file ID provided or could be extracted",
      );
    });

    test("throws error when file info API fails", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        fileId: "12345",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any);

      await expect(downloadSubmissionFile(params)).rejects.toThrow(
        "Failed to get file info: 404 Not Found",
      );
    });

    test("throws error when all download strategies fail", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        fileId: "12345",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockFileInfo,
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as any);

      await expect(downloadSubmissionFile(params)).rejects.toThrow(
        "All download strategies failed",
      );
    });

    test("uses content-type from response headers", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        fileId: "12345",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockFileInfo, "content-type": "text/plain" }),
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: new Map([
          ["content-type", "text/markdown"], // Different from file info
          ["content-length", "200"],
        ]),
        text: async () => "# Markdown content",
      } as any);

      const result = await downloadSubmissionFile(params);

      expect(result.contentType).toBe("text/markdown"); // Should use response header
      expect(result.content).toBe("# Markdown content");
    });

    test("falls back to file info content-type when response header missing", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        fileId: "12345",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockFileInfo,
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: new Map(), // No content-type header
        arrayBuffer: async () => new ArrayBuffer(1024),
      } as any);

      const result = await downloadSubmissionFile(params);

      expect(result.contentType).toBe("application/pdf"); // From file info
    });

    test("uses default content-type when both sources missing", async () => {
      const params: CanvasFileDownloadParams = {
        ...mockParams,
        fileId: "12345",
      };

      const mockFileInfoNoType = {
        ...mockFileInfo,
        "content-type": undefined,
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockFileInfoNoType,
      } as any);

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: new Map(),
        arrayBuffer: async () => new ArrayBuffer(1024),
      } as any);

      const result = await downloadSubmissionFile(params);

      expect(result.contentType).toBe("application/octet-stream");
    });
  });
});