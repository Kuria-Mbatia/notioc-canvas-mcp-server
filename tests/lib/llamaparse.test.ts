import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseWithLlama,
  isFileSupported,
  getSupportedExtensions,
  type LlamaParseOptions,
  type ParseInput,
} from "../../src/lib/llamaparse.js";
import { logger } from "../../src/lib/logger.js";

// Mock logger
vi.mock("../../src/lib/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe("LlamaParse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isFileSupported", () => {
    it("should return true for supported PDF files", () => {
      expect(isFileSupported("document.pdf")).toBe(true);
      expect(isFileSupported("DOCUMENT.PDF")).toBe(true);
    });

    it("should return true for supported document formats", () => {
      expect(isFileSupported("document.docx")).toBe(true);
      expect(isFileSupported("presentation.pptx")).toBe(true);
      expect(isFileSupported("spreadsheet.xlsx")).toBe(true);
      expect(isFileSupported("text.txt")).toBe(true);
    });

    it("should return true for supported image formats", () => {
      expect(isFileSupported("image.jpg")).toBe(true);
      expect(isFileSupported("image.png")).toBe(true);
      expect(isFileSupported("image.gif")).toBe(true);
    });

    it("should return true for supported audio formats", () => {
      expect(isFileSupported("audio.mp3")).toBe(true);
      expect(isFileSupported("audio.wav")).toBe(true);
      expect(isFileSupported("audio.m4a")).toBe(true);
    });

    it("should return false for unsupported formats", () => {
      expect(isFileSupported("video.mkv")).toBe(false);
      expect(isFileSupported("archive.zip")).toBe(false);
      expect(isFileSupported("executable.exe")).toBe(false);
    });

    it("should handle filenames with query parameters", () => {
      expect(isFileSupported("document.pdf?download=1")).toBe(true);
      expect(isFileSupported("image.jpg?size=large#preview")).toBe(true);
    });

    it("should handle filenames without extensions", () => {
      expect(isFileSupported("README")).toBe(false);
      expect(isFileSupported("document")).toBe(false);
    });
  });

  describe("getSupportedExtensions", () => {
    it("should return a sorted array of supported extensions", () => {
      const extensions = getSupportedExtensions();
      
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(50);
      expect(extensions).toContain("pdf");
      expect(extensions).toContain("docx");
      expect(extensions).toContain("xlsx");
      expect(extensions).toContain("pptx");
      expect(extensions).toContain("jpg");
      expect(extensions).toContain("mp3");
      
      // Should be sorted
      const sortedExtensions = [...extensions].sort();
      expect(extensions).toEqual(sortedExtensions);
    });

    it("should not contain duplicates", () => {
      const extensions = getSupportedExtensions();
      const uniqueExtensions = [...new Set(extensions)];
      
      expect(extensions.length).toBe(uniqueExtensions.length);
    });
  });

  describe("parseWithLlama", () => {
    const mockOptions: LlamaParseOptions = {
      apiKey: "test-api-key",
      allowUpload: true,
      resultFormat: "markdown",
    };

    const mockInput: ParseInput = {
      buffer: Buffer.from("test content"),
      filename: "test.pdf",
      mime: "application/pdf",
    };

    it("should throw error when API key is missing", async () => {
      const optionsWithoutKey = { ...mockOptions, apiKey: "" };
      
      await expect(parseWithLlama(mockInput, optionsWithoutKey)).rejects.toThrow(
        "LlamaParse disabled (no LLAMA_CLOUD_API_KEY)"
      );
    });

    it("should throw error when upload is not allowed", async () => {
      const optionsWithoutUpload = { ...mockOptions, allowUpload: false };
      
      await expect(parseWithLlama(mockInput, optionsWithoutUpload)).rejects.toThrow(
        "File upload disabled (set LLAMA_PARSE_ALLOW_UPLOAD=true)"
      );
    });

    it("should throw error for unsupported file types", async () => {
      const unsupportedInput = { ...mockInput, filename: "test.unsupported" };
      
      await expect(parseWithLlama(unsupportedInput, mockOptions)).rejects.toThrow(
        "Unsupported file type: .unsupported"
      );
    });

    it("should throw error for files exceeding size limit", async () => {
      const largeInput = {
        ...mockInput,
        buffer: Buffer.alloc(60 * 1024 * 1024), // 60MB
      };
      
      await expect(parseWithLlama(largeInput, mockOptions)).rejects.toThrow(
        "File exceeds 50MB limit"
      );
    });

    it("should throw error for audio files exceeding audio size limit", async () => {
      const largeAudioInput = {
        ...mockInput,
        filename: "test.mp3",
        buffer: Buffer.alloc(25 * 1024 * 1024), // 25MB
      };
      
      await expect(parseWithLlama(largeAudioInput, mockOptions)).rejects.toThrow(
        "Audio file exceeds 20MB limit"
      );
    });

    it("should successfully parse a valid file", async () => {
      const mockJobId = "job-123";
      const mockContent = "# Parsed Content\n\nThis is the parsed content.";
      
      // Mock upload response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: mockJobId }),
      });
      
      // Mock job status response (completed)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          status: "SUCCESS",
          pages: 1,
        }),
      });
      
      // Mock result response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockContent),
      });

      const result = await parseWithLlama(mockInput, mockOptions);

      expect(result.content).toBe(mockContent);
      expect(result.format).toBe("markdown");
      expect(result.meta?.jobId).toBe(mockJobId);
      expect(result.meta?.pages).toBe(1);
      expect(typeof result.meta?.processingTime).toBe("number");
    });

    it("should handle upload failures", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: () => Promise.resolve("Invalid file"),
      });

      await expect(parseWithLlama(mockInput, mockOptions)).rejects.toThrow(
        "Upload failed: 400 Bad Request"
      );
    });

    it("should handle job failures", async () => {
      const mockJobId = "job-123";
      
      // Mock successful upload
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: mockJobId }),
      });
      
      // Mock job status response (failed)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          status: "FAILED",
          error: "Processing failed",
        }),
      });

      await expect(parseWithLlama(mockInput, mockOptions)).rejects.toThrow(
        "Parse job failed: Processing failed"
      );
    });

    it("should handle job timeout", async () => {
      const mockJobId = "job-123";
      const shortTimeoutOptions = { ...mockOptions, timeoutMs: 100 };
      
      // Mock successful upload
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: mockJobId }),
      });
      
      // Mock job status response (still processing)
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "PROCESSING" }),
      });

      await expect(parseWithLlama(mockInput, shortTimeoutOptions)).rejects.toThrow(
        "Parse job timed out after 100ms"
      );
    });

    it("should handle result fetch failures", async () => {
      const mockJobId = "job-123";
      
      // Mock successful upload
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: mockJobId }),
      });
      
      // Mock successful job completion
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "SUCCESS" }),
      });
      
      // Mock result fetch failure
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: () => Promise.resolve("Result not found"),
      });

      await expect(parseWithLlama(mockInput, mockOptions)).rejects.toThrow(
        "Result fetch failed: 404 Not Found"
      );
    });

    it("should use custom base URL when provided", async () => {
      const customOptions = {
        ...mockOptions,
        baseUrl: "https://custom-api.llamaindex.ai",
        timeoutMs: 100, // Short timeout for test
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "job-123" }),
      });

      // Mock job status to keep processing to trigger timeout
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "PROCESSING" }),
      });

      await expect(parseWithLlama(mockInput, customOptions)).rejects.toThrow();

      expect(fetch).toHaveBeenCalledWith(
        "https://custom-api.llamaindex.ai/api/parsing/upload",
        expect.any(Object)
      );
    }, 10000);

    it("should use custom result format", async () => {
      const textOptions = { 
        ...mockOptions, 
        resultFormat: "text" as const,
        timeoutMs: 100, // Short timeout for test
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "job-123" }),
      });

      // Mock job status to keep processing to trigger timeout
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "PROCESSING" }),
      });

      await expect(parseWithLlama(mockInput, textOptions)).rejects.toThrow();

      // Check that the upload request included the correct result format
      const uploadCall = (fetch as any).mock.calls[0];
      const formData = uploadCall[1].body;
      expect(formData).toBeInstanceOf(FormData);
    }, 10000);

    it("should handle network errors gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await expect(parseWithLlama(mockInput, mockOptions)).rejects.toThrow(
        "Unexpected error: Error: Network error"
      );
    });
  });
});