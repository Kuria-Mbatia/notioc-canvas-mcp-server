import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  processCanvasURL,
  type ProcessCanvasURLParams,
} from "@/tools/url-processor";

// Mock dependencies
vi.mock("@/lib/url-processor");
vi.mock("@/tools/files");
vi.mock("@/tools/pages-discussions");

describe("URL Processor Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("processCanvasURL", () => {
    test("processes valid Canvas assignment URL", async () => {
      const params: ProcessCanvasURLParams = {
        ...mockParams,
        url: "https://test.instructure.com/courses/12345/assignments/67890",
      };

      const mockUrlProcessor = await import("@/lib/url-processor");
      vi.mocked(mockUrlProcessor.parseCanvasURL).mockReturnValue({
        isValid: true,
        type: "assignment",
        courseId: "12345",
        resourceId: "67890",
        resourceName: "Test Assignment",
        baseUrl: "https://test.instructure.com",
        url: "https://test.instructure.com/courses/12345/assignments/67890",
      });
      vi.mocked(mockUrlProcessor.validateCanvasURL).mockResolvedValue(true);
      vi.mocked(mockUrlProcessor.extractFileIdsFromHTML).mockReturnValue([
        {
          fileId: "file123",
          fileName: "document.pdf",
          url: "https://test.instructure.com/files/file123",
        },
      ]);
      vi.mocked(mockUrlProcessor.extractLinksFromHTML).mockReturnValue([
        {
          title: "External Link",
          url: "https://example.com",
          type: "external",
        },
      ]);

      const result = await processCanvasURL(params);

      expect(mockUrlProcessor.parseCanvasURL).toHaveBeenCalledWith(params.url);
      expect(mockUrlProcessor.validateCanvasURL).toHaveBeenCalledWith(
        params.url,
        params.accessToken,
      );

      expect(result.type).toBe("assignment");
      expect(result.courseId).toBe("12345");
      expect(result.resourceId).toBe("67890");
      expect(result.processed).toBe(true);
      expect(result.metadata.accessible).toBe(true);
      expect(typeof result.metadata.processingTime).toBe("number");
    });

    test("processes Canvas page URL with embedded content", async () => {
      const params: ProcessCanvasURLParams = {
        ...mockParams,
        url: "https://test.instructure.com/courses/12345/pages/test-page",
        extractEmbedded: true,
      };

      const mockUrlProcessor = await import("@/lib/url-processor");
      vi.mocked(mockUrlProcessor.parseCanvasURL).mockReturnValue({
        isValid: true,
        type: "page",
        courseId: "12345",
        resourceId: "test-page",
        resourceName: "Test Page",
        baseUrl: "https://test.instructure.com",
        url: "https://test.instructure.com/courses/12345/pages/test-page",
      });
      vi.mocked(mockUrlProcessor.validateCanvasURL).mockResolvedValue(true);
      vi.mocked(mockUrlProcessor.extractFileIdsFromHTML).mockReturnValue([]);
      vi.mocked(mockUrlProcessor.extractLinksFromHTML).mockReturnValue([]);

      const mockGetPageContent = await import("@/tools/pages-discussions");
      vi.mocked(mockGetPageContent.getPageContent).mockResolvedValue({
        title: "Test Page",
        body: "<p>This is test page content</p>",
        url: "https://test.instructure.com/courses/12345/pages/test-page",
      });

      const result = await processCanvasURL(params);

      expect(result.type).toBe("page");
      expect(result.processed).toBe(true);
    });

    test("processes Canvas file URL", async () => {
      const params: ProcessCanvasURLParams = {
        ...mockParams,
        url: "https://test.instructure.com/courses/12345/files/98765",
        processFiles: true,
      };

      const mockUrlProcessor = await import("@/lib/url-processor");
      vi.mocked(mockUrlProcessor.parseCanvasURL).mockReturnValue({
        isValid: true,
        type: "file",
        courseId: "12345",
        resourceId: "98765",
        resourceName: "test-document.pdf",
        baseUrl: "https://test.instructure.com",
        url: "https://test.instructure.com/courses/12345/files/98765",
      });
      vi.mocked(mockUrlProcessor.validateCanvasURL).mockResolvedValue(true);

      const mockGetFileContent = await import("@/tools/files");
      vi.mocked(mockGetFileContent.getFileContent).mockResolvedValue({
        name: "test-document.pdf",
        content: "This is the file content",
        url: "https://test.instructure.com/files/98765",
        metadata: {
          mode: "preview",
          truncated: false,
          cached: false,
          processingTime: 100,
          originalSize: 1024,
        },
      });

      const result = await processCanvasURL(params);

      expect(result.type).toBe("file");
      expect(result.content).toBe("This is the file content");
      expect(result.resourceName).toBe("test-document.pdf");
    });

    test("handles invalid Canvas URL", async () => {
      const params: ProcessCanvasURLParams = {
        ...mockParams,
        url: "https://invalid-url.com/not-canvas",
      };

      const mockUrlProcessor = await import("@/lib/url-processor");
      vi.mocked(mockUrlProcessor.parseCanvasURL).mockReturnValue({
        isValid: false,
        type: "unknown",
        courseId: "",
        resourceId: "",
        resourceName: "",
        baseUrl: "",
        url: "https://invalid-url.com/not-canvas",
      });

      const result = await processCanvasURL(params);

      expect(result.processed).toBe(false);
      expect(result.error).toBe("Invalid Canvas URL format");
      expect(result.metadata.accessible).toBe(false);
    });

    test("handles inaccessible Canvas URL", async () => {
      const params: ProcessCanvasURLParams = {
        ...mockParams,
        url: "https://test.instructure.com/courses/12345/assignments/67890",
      };

      const mockUrlProcessor = await import("@/lib/url-processor");
      vi.mocked(mockUrlProcessor.parseCanvasURL).mockReturnValue({
        isValid: true,
        type: "assignment",
        courseId: "12345",
        resourceId: "67890",
        resourceName: "Test Assignment",
        baseUrl: "https://test.instructure.com",
        url: "https://test.instructure.com/courses/12345/assignments/67890",
      });
      vi.mocked(mockUrlProcessor.validateCanvasURL).mockResolvedValue(false);

      const result = await processCanvasURL(params);

      expect(result.processed).toBe(false);
      expect(result.error).toBe("URL not accessible with current permissions");
      expect(result.metadata.accessible).toBe(false);
    });

    test("extracts embedded files when requested", async () => {
      const params: ProcessCanvasURLParams = {
        ...mockParams,
        url: "https://test.instructure.com/courses/12345/pages/test-page",
        extractEmbedded: true,
      };

      const mockUrlProcessor = await import("@/lib/url-processor");
      vi.mocked(mockUrlProcessor.parseCanvasURL).mockReturnValue({
        isValid: true,
        type: "page",
        courseId: "12345",
        resourceId: "test-page",
        resourceName: "Test Page",
        baseUrl: "https://test.instructure.com",
        url: "https://test.instructure.com/courses/12345/pages/test-page",
      });
      vi.mocked(mockUrlProcessor.validateCanvasURL).mockResolvedValue(true);
      vi.mocked(mockUrlProcessor.extractFileIdsFromHTML).mockReturnValue([
        {
          fileId: "file1",
          fileName: "doc1.pdf",
          url: "https://test.instructure.com/files/file1",
        },
        {
          fileId: "file2",
          fileName: "doc2.docx",
          url: "https://test.instructure.com/files/file2",
        },
      ]);
      vi.mocked(mockUrlProcessor.extractLinksFromHTML).mockReturnValue([
        {
          title: "External Resource",
          url: "https://example.com",
          type: "external",
        },
      ]);

      const mockGetPageContent = await import("@/tools/pages-discussions");
      vi.mocked(mockGetPageContent.getPageContent).mockResolvedValue({
        title: "Test Page",
        body: "<p>Page with embedded files</p>",
        url: "https://test.instructure.com/courses/12345/pages/test-page",
      });

      const result = await processCanvasURL(params);

      expect(result.processed).toBe(true);
    });

    test("handles discussion URL", async () => {
      const params: ProcessCanvasURLParams = {
        ...mockParams,
        url: "https://test.instructure.com/courses/12345/discussion_topics/54321",
      };

      const mockUrlProcessor = await import("@/lib/url-processor");
      vi.mocked(mockUrlProcessor.parseCanvasURL).mockReturnValue({
        isValid: true,
        type: "discussion",
        courseId: "12345",
        resourceId: "54321",
        resourceName: "Test Discussion",
        baseUrl: "https://test.instructure.com",
        url: "https://test.instructure.com/courses/12345/discussion_topics/54321",
      });
      vi.mocked(mockUrlProcessor.validateCanvasURL).mockResolvedValue(true);
      vi.mocked(mockUrlProcessor.extractFileIdsFromHTML).mockReturnValue([]);
      vi.mocked(mockUrlProcessor.extractLinksFromHTML).mockReturnValue([]);

      const result = await processCanvasURL(params);

      expect(result.type).toBe("discussion");
      expect(result.courseId).toBe("12345");
      expect(result.resourceId).toBe("54321");
      expect(result.processed).toBe(true);
    });

    test("handles processing errors gracefully", async () => {
      const params: ProcessCanvasURLParams = {
        ...mockParams,
        url: "https://test.instructure.com/courses/12345/pages/test-page",
      };

      const mockUrlProcessor = await import("@/lib/url-processor");
      vi.mocked(mockUrlProcessor.parseCanvasURL).mockReturnValue({
        isValid: true,
        type: "page",
        courseId: "12345",
        resourceId: "test-page",
        resourceName: "Test Page",
        baseUrl: "https://test.instructure.com",
        url: "https://test.instructure.com/courses/12345/pages/test-page",
      });
      vi.mocked(mockUrlProcessor.validateCanvasURL).mockResolvedValue(true);

      const mockGetPageContent = await import("@/tools/pages-discussions");
      vi.mocked(mockGetPageContent.getPageContent).mockRejectedValue(
        new Error("API Error"),
      );

      const result = await processCanvasURL(params);

      expect(result.processed).toBe(true);
    });

    test("measures processing time correctly", async () => {
      const params: ProcessCanvasURLParams = {
        ...mockParams,
        url: "https://test.instructure.com/courses/12345/assignments/67890",
      };

      const mockUrlProcessor = await import("@/lib/url-processor");
      vi.mocked(mockUrlProcessor.parseCanvasURL).mockReturnValue({
        isValid: true,
        type: "assignment",
        courseId: "12345",
        resourceId: "67890",
        resourceName: "Test Assignment",
        baseUrl: "https://test.instructure.com",
        url: "https://test.instructure.com/courses/12345/assignments/67890",
      });
      vi.mocked(mockUrlProcessor.validateCanvasURL).mockResolvedValue(true);

      const result = await processCanvasURL(params);

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.metadata.processingTime).toBe("number");
    });

    test("sets correct method based on processing type", async () => {
      const params: ProcessCanvasURLParams = {
        ...mockParams,
        url: "https://test.instructure.com/courses/12345/files/98765",
        processFiles: true,
      };

      const mockUrlProcessor = await import("@/lib/url-processor");
      vi.mocked(mockUrlProcessor.parseCanvasURL).mockReturnValue({
        isValid: true,
        type: "file",
        courseId: "12345",
        resourceId: "98765",
        resourceName: "test.pdf",
        baseUrl: "https://test.instructure.com",
        url: "https://test.instructure.com/courses/12345/files/98765",
      });
      vi.mocked(mockUrlProcessor.validateCanvasURL).mockResolvedValue(true);

      const mockGetFileContent = await import("@/tools/files");
      vi.mocked(mockGetFileContent.getFileContent).mockResolvedValue({
        name: "test.pdf",
        content: "File content",
        url: "https://test.instructure.com/files/98765",
        metadata: {
          mode: "preview",
          truncated: false,
          cached: false,
          processingTime: 50,
          originalSize: 1024,
        },
      });

      const result = await processCanvasURL(params);

      expect(result.metadata.method).toBe("api");
    });
  });
});
