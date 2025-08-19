import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  generateCacheKey,
  compressToPreview,
  getCachedFileContent,
  setCachedFileContent,
  shouldRevalidateCache,
  clearFileCache,
  getFileCacheStats,
  cleanupExpiredEntries,
  DEFAULT_FILE_CACHE_CONFIG,
  type FileCacheEntry,
  type FileCacheConfig,
} from "../../src/lib/file-cache.js";
import { logger } from "../../src/lib/logger.js";

// Mock logger
vi.mock("../../src/lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("File Cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Clear cache before each test
    clearFileCache();
  });

  afterEach(() => {
    // Cleanup after each test
    clearFileCache();
    vi.useRealTimers();
  });

  describe("generateCacheKey", () => {
    it("should generate consistent cache keys", () => {
      const key1 = generateCacheKey("123", "etag-abc", 1024, "markdown");
      const key2 = generateCacheKey("123", "etag-abc", 1024, "markdown");
      
      expect(key1).toBe(key2);
      expect(key1).toBe("123-etag-abc-1024-markdown");
    });

    it("should handle missing etag and content length", () => {
      const key = generateCacheKey("123");
      
      expect(key).toBe("123-no-etag-0-markdown");
    });

    it("should include result format in key", () => {
      const markdownKey = generateCacheKey("123", "etag", 1024, "markdown");
      const textKey = generateCacheKey("123", "etag", 1024, "text");
      
      expect(markdownKey).not.toBe(textKey);
      expect(markdownKey).toContain("markdown");
      expect(textKey).toContain("text");
    });
  });

  describe("compressToPreview", () => {
    it("should return original content if under max chars", () => {
      const shortContent = "This is short content.";
      const preview = compressToPreview(shortContent, 100);
      
      expect(preview).toBe(shortContent);
    });

    it("should remove excessive newlines when content exceeds maxChars", () => {
      // Make content long enough to trigger compression
      const content = "Line 1\n\n\n\nLine 2\n\n\n\n\nLine 3" + "x".repeat(50);
      const preview = compressToPreview(content, 30); // Small maxChars to trigger compression
      
      // Should compress newlines and then truncate
      expect(preview).toContain("Line 1\n\nLine 2");
      expect(preview).toContain("...[Content truncated for preview");
    });

    it("should remove excessive whitespace when content exceeds maxChars", () => {
      // Make content long enough to trigger compression
      const content = "Word1    \t\t   Word2     Word3" + "x".repeat(50);
      const preview = compressToPreview(content, 30); // Small maxChars to trigger compression
      
      // Should compress whitespace and then truncate
      expect(preview).toContain("Word1 Word2");
      expect(preview).toContain("...[Content truncated for preview");
    });

    it("should truncate at paragraph boundaries when possible", () => {
      const content = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
      const preview = compressToPreview(content, 30);
      
      expect(preview).toContain("First paragraph.");
      expect(preview).toContain("...[Content truncated for preview");
    });

    it("should truncate at sentence boundaries as fallback", () => {
      const content = "First sentence. Second sentence. Third sentence.";
      const preview = compressToPreview(content, 25);
      
      expect(preview).toContain("First sentence.");
      expect(preview).toContain("...[Content truncated for preview");
    });

    it("should use default max chars from config", () => {
      const longContent = "x".repeat(2000);
      const preview = compressToPreview(longContent);
      
      expect(preview.length).toBeLessThanOrEqual(DEFAULT_FILE_CACHE_CONFIG.previewMaxChars + 100);
      expect(preview).toContain("...[Content truncated for preview");
    });
  });

  describe("setCachedFileContent and getCachedFileContent", () => {
    it("should store and retrieve cached content", () => {
      const cacheKey = "test-key";
      const content = "Test file content";
      const metadata = {
        etag: "test-etag",
        contentLength: 100,
        processingTime: 1000,
        resultFormat: "markdown",
      };

      setCachedFileContent(cacheKey, content, metadata);
      const cached = getCachedFileContent(cacheKey);

      expect(cached).not.toBeNull();
      expect(cached!.content).toBe(content);
      expect(cached!.etag).toBe(metadata.etag);
      expect(cached!.contentLength).toBe(metadata.contentLength);
      expect(cached!.processingTime).toBe(metadata.processingTime);
      expect(cached!.resultFormat).toBe(metadata.resultFormat);
    });

    it("should generate preview when storing content", () => {
      const cacheKey = "test-key";
      const content = "x".repeat(2000);
      const metadata = {
        processingTime: 1000,
        resultFormat: "markdown",
      };

      setCachedFileContent(cacheKey, content, metadata);
      const cached = getCachedFileContent(cacheKey);

      expect(cached!.preview.length).toBeLessThan(content.length);
      expect(cached!.preview).toContain("...[Content truncated for preview");
    });

    it("should return null for non-existent cache key", () => {
      const cached = getCachedFileContent("non-existent-key");
      
      expect(cached).toBeNull();
    });

    it("should return null when cache is disabled", () => {
      const cacheKey = "test-key";
      const content = "Test content";
      const metadata = { processingTime: 1000, resultFormat: "markdown" };
      const disabledConfig: FileCacheConfig = {
        ...DEFAULT_FILE_CACHE_CONFIG,
        enabled: false,
      };

      setCachedFileContent(cacheKey, content, metadata, disabledConfig);
      const cached = getCachedFileContent(cacheKey, disabledConfig);

      expect(cached).toBeNull();
    });

    it("should not store content exceeding size limit", () => {
      const cacheKey = "test-key";
      const largeContent = "x".repeat(20 * 1024 * 1024); // 20MB
      const metadata = { processingTime: 1000, resultFormat: "markdown" };
      const config: FileCacheConfig = {
        ...DEFAULT_FILE_CACHE_CONFIG,
        maxContentSize: 10 * 1024 * 1024, // 10MB limit
      };

      setCachedFileContent(cacheKey, largeContent, metadata, config);
      const cached = getCachedFileContent(cacheKey, config);

      expect(cached).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Content too large to cache")
      );
    });

    it("should update access time on cache hit", () => {
      const cacheKey = "test-key";
      const content = "Test content";
      const metadata = { processingTime: 1000, resultFormat: "markdown" };

      setCachedFileContent(cacheKey, content, metadata);
      
      // Get initial access time
      const cached1 = getCachedFileContent(cacheKey);
      const firstAccessTime = cached1!.lastAccessed.getTime();
      
      // Wait a bit and access again
      vi.advanceTimersByTime(100);
      const cached2 = getCachedFileContent(cacheKey);
      const secondAccessTime = cached2!.lastAccessed.getTime();

      expect(secondAccessTime).toBeGreaterThanOrEqual(firstAccessTime);
    });
  });

  describe("shouldRevalidateCache", () => {
    it("should return true when cache is older than revalidation threshold", () => {
      const oldCacheEntry: FileCacheEntry = {
        content: "test",
        preview: "test",
        lastModified: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        lastAccessed: new Date(),
        processingTime: 1000,
        resultFormat: "markdown",
      };

      const shouldRevalidate = shouldRevalidateCache(oldCacheEntry);
      
      expect(shouldRevalidate).toBe(true);
    });

    it("should return false when cache is fresh", () => {
      const freshCacheEntry: FileCacheEntry = {
        content: "test",
        preview: "test",
        lastModified: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        lastAccessed: new Date(),
        processingTime: 1000,
        resultFormat: "markdown",
      };

      const shouldRevalidate = shouldRevalidateCache(freshCacheEntry);
      
      expect(shouldRevalidate).toBe(false);
    });
  });

  describe("clearFileCache", () => {
    beforeEach(() => {
      // Add some test entries
      setCachedFileContent("file1-key", "content1", { processingTime: 1000, resultFormat: "markdown" });
      setCachedFileContent("file2-key", "content2", { processingTime: 1000, resultFormat: "markdown" });
      setCachedFileContent("file1-text-key", "content1-text", { processingTime: 1000, resultFormat: "text" });
    });

    it("should clear all cache entries when no fileId provided", () => {
      const result = clearFileCache();
      
      expect(result.cleared).toBe(3);
      expect(result.message).toContain("Cleared all 3 file cache entries");
      
      // Verify cache is empty
      expect(getCachedFileContent("file1-key")).toBeNull();
      expect(getCachedFileContent("file2-key")).toBeNull();
      expect(getCachedFileContent("file1-text-key")).toBeNull();
    });

    it("should clear entries for specific file ID", () => {
      const result = clearFileCache("file1");
      
      expect(result.cleared).toBe(2); // file1-key and file1-text-key
      expect(result.message).toContain("Cleared 2 cache entries for file file1");
      
      // Verify specific entries are cleared
      expect(getCachedFileContent("file1-key")).toBeNull();
      expect(getCachedFileContent("file1-text-key")).toBeNull();
      
      // Verify other entries remain
      expect(getCachedFileContent("file2-key")).not.toBeNull();
    });
  });

  describe("getFileCacheStats", () => {
    it("should return accurate cache statistics", () => {
      const content1 = "x".repeat(1000);
      const content2 = "y".repeat(2000);
      
      setCachedFileContent("key1", content1, { processingTime: 1000, resultFormat: "markdown" });
      setCachedFileContent("key2", content2, { processingTime: 2000, resultFormat: "text" });

      const stats = getFileCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.maxEntries).toBe(DEFAULT_FILE_CACHE_CONFIG.maxEntries);
      expect(stats.totalContentSize).toBeGreaterThan(3000); // content + previews
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });

    it("should return empty stats for empty cache", () => {
      const stats = getFileCacheStats();

      expect(stats.size).toBe(0);
      expect(stats.totalContentSize).toBe(0);
      expect(stats.oldestEntry).toBeUndefined();
      expect(stats.newestEntry).toBeUndefined();
    });
  });

  describe("cleanupExpiredEntries", () => {
    it("should remove expired entries", () => {
      const config: FileCacheConfig = {
        ...DEFAULT_FILE_CACHE_CONFIG,
        ttl: 1000, // 1 second TTL for testing
      };

      // Add entries
      setCachedFileContent("key1", "content1", { processingTime: 1000, resultFormat: "markdown" }, config);
      setCachedFileContent("key2", "content2", { processingTime: 1000, resultFormat: "markdown" }, config);

      // Advance time to expire entries
      vi.advanceTimersByTime(2000);

      const cleanedCount = cleanupExpiredEntries(config);

      expect(cleanedCount).toBe(2);
      expect(getCachedFileContent("key1", config)).toBeNull();
      expect(getCachedFileContent("key2", config)).toBeNull();
    });

    it("should not remove fresh entries", () => {
      const config: FileCacheConfig = {
        ...DEFAULT_FILE_CACHE_CONFIG,
        ttl: 10000, // 10 seconds TTL
      };

      setCachedFileContent("key1", "content1", { processingTime: 1000, resultFormat: "markdown" }, config);
      
      // Advance time but not enough to expire
      vi.advanceTimersByTime(5000);

      const cleanedCount = cleanupExpiredEntries(config);

      expect(cleanedCount).toBe(0);
      expect(getCachedFileContent("key1", config)).not.toBeNull();
    });
  });
});