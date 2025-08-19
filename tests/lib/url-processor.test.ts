import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseCanvasURL,
  webUrlToApiUrl,
  extractFileIdsFromHTML,
  extractLinksFromHTML,
  validateCanvasURL,
} from "../../src/lib/url-processor.js";

global.fetch = vi.fn();

describe("URL Processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseCanvasURL", () => {
    it("should parse file URLs correctly", () => {
      const url = "https://canvas.test.edu/courses/12345/files/67890";
      const result = parseCanvasURL(url);

      expect(result.type).toBe("file");
      expect(result.courseId).toBe("12345");
      expect(result.resourceId).toBe("67890");
      expect(result.isValid).toBe(true);
    });

    it("should parse page URLs correctly", () => {
      const url = "https://canvas.test.edu/courses/12345/pages/syllabus";
      const result = parseCanvasURL(url);

      expect(result.type).toBe("page");
      expect(result.courseId).toBe("12345");
      expect(result.resourceId).toBe("syllabus");
      expect(result.isValid).toBe(true);
    });

    it("should handle invalid URLs gracefully", () => {
      const url = "not-a-valid-url";
      const result = parseCanvasURL(url);

      expect(result.type).toBe("unknown");
      expect(result.isValid).toBe(false);
    });
  });

  describe("webUrlToApiUrl", () => {
    it("should convert file URLs to API endpoints", () => {
      const urlInfo = {
        type: "file" as const,
        courseId: "12345",
        resourceId: "67890",
        url: "test",
        baseUrl: "https://canvas.test.edu",
        isValid: true,
      };

      const apiUrl = webUrlToApiUrl(urlInfo);
      expect(apiUrl).toBe("https://canvas.test.edu/api/v1/files/67890");
    });
  });

  describe("extractFileIdsFromHTML", () => {
    it("should extract file IDs from HTML", () => {
      const html = '<a href="/files/12345/download">Document.pdf</a>';
      const files = extractFileIdsFromHTML(html, "https://canvas.test.edu");

      expect(files).toHaveLength(1);
      expect(files[0].fileId).toBe("12345");
      expect(files[0].fileName).toBe("Document.pdf");
    });
  });

  describe("extractLinksFromHTML", () => {
    it("should extract external links", () => {
      const html = '<a href="https://example.com">External Link</a>';
      const links = extractLinksFromHTML(html);

      expect(links).toHaveLength(1);
      expect(links[0].title).toBe("External Link");
      expect(links[0].type).toBe("external");
    });
  });

  describe("validateCanvasURL", () => {
    it("should return true for accessible URLs", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const isValid = await validateCanvasURL("https://test.com", "token");
      expect(isValid).toBe(true);
    });

    it("should return false for network errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const isValid = await validateCanvasURL("https://test.com", "token");
      expect(isValid).toBe(false);
    });
  });
});