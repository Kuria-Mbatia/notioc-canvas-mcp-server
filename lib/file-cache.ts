/**
 * File Content Cache
 * Caches LlamaParse results with preview generation and smart revalidation
 */

import { logger } from "./logger.js";

export interface FileCacheEntry {
  content: string; // Full parsed content
  preview: string; // Compressed preview version
  etag?: string; // For revalidation
  contentLength?: number; // For revalidation
  lastModified: Date; // When cached
  lastAccessed: Date; // For LRU eviction
  processingTime: number; // Original parse time
  resultFormat: string; // markdown, text, etc.
}

export interface FileCacheConfig {
  enabled: boolean;
  maxEntries: number; // LRU limit (default: 100 files)
  ttl: number; // Time to live in ms (default: 24 hours)
  maxContentSize: number; // Max cached content size per entry (default: 10MB)
  revalidateAfter: number; // Check for updates after ms (default: 6 hours)
  previewMaxChars: number; // Max chars in preview (default: 1500)
}

export const DEFAULT_FILE_CACHE_CONFIG: FileCacheConfig = {
  enabled: true,
  maxEntries: 100,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  maxContentSize: 10 * 1024 * 1024, // 10MB
  revalidateAfter: 6 * 60 * 60 * 1000, // 6 hours
  previewMaxChars: 1500,
};

// In-memory cache store
const fileCache = new Map<string, FileCacheEntry>();

/**
 * Generate cache key from file metadata
 */
export function generateCacheKey(
  fileId: string,
  etag?: string,
  contentLength?: number,
  resultFormat: string = "markdown",
): string {
  const etagPart = etag || "no-etag";
  const sizePart = contentLength || 0;
  return `${fileId}-${etagPart}-${sizePart}-${resultFormat}`;
}

/**
 * Compress content into a preview version
 */
export function compressToPreview(
  content: string,
  maxChars: number = DEFAULT_FILE_CACHE_CONFIG.previewMaxChars,
): string {
  if (content.length <= maxChars) {
    return content;
  }

  // Smart compression for markdown content
  let compressed = content;

  // Remove repeated newlines
  compressed = compressed.replace(/\n{3,}/g, "\n\n");

  // Remove excessive whitespace
  compressed = compressed.replace(/[ \t]{2,}/g, " ");

  // If still too long, truncate intelligently
  if (compressed.length > maxChars) {
    // Try to break at paragraph boundaries
    const truncated = compressed.slice(0, maxChars - 50);
    const lastParagraph = truncated.lastIndexOf("\n\n");
    const lastSentence = truncated.lastIndexOf(". ");

    let cutPoint = truncated.length;
    if (lastParagraph > maxChars * 0.7) {
      cutPoint = lastParagraph;
    } else if (lastSentence > maxChars * 0.8) {
      cutPoint = lastSentence + 1;
    }

    compressed =
      truncated.slice(0, cutPoint) +
      '\n\n...[Content truncated for preview. Use mode="full" to see complete content]';
  }

  return compressed;
}

/**
 * Get cached file content if available and valid
 */
export function getCachedFileContent(
  cacheKey: string,
  config: FileCacheConfig = DEFAULT_FILE_CACHE_CONFIG,
): FileCacheEntry | null {
  if (!config.enabled) return null;

  const cached = fileCache.get(cacheKey);
  if (!cached) return null;

  const now = Date.now();
  const age = now - cached.lastModified.getTime();

  // Check TTL
  if (age > config.ttl) {
    fileCache.delete(cacheKey);
    logger.debug(
      `[File Cache] Expired cache entry removed: ${cacheKey} (age: ${Math.round(age / 1000 / 60)} minutes)`,
    );
    return null;
  }

  // Update access time for LRU
  cached.lastAccessed = new Date();
  fileCache.set(cacheKey, cached);

  logger.debug(
    `[File Cache] Cache hit: ${cacheKey} (age: ${Math.round(age / 1000 / 60)} minutes)`,
  );
  return cached;
}

/**
 * Store file content in cache
 */
export function setCachedFileContent(
  cacheKey: string,
  content: string,
  metadata: {
    etag?: string;
    contentLength?: number;
    processingTime: number;
    resultFormat: string;
  },
  config: FileCacheConfig = DEFAULT_FILE_CACHE_CONFIG,
): void {
  if (!config.enabled) return;

  // Check content size limit
  if (content.length > config.maxContentSize) {
    logger.warn(
      `[File Cache] Content too large to cache: ${cacheKey} (${Math.round(content.length / 1024 / 1024)}MB > ${Math.round(config.maxContentSize / 1024 / 1024)}MB)`,
    );
    return;
  }

  // Generate preview
  const preview = compressToPreview(content, config.previewMaxChars);

  const entry: FileCacheEntry = {
    content,
    preview,
    etag: metadata.etag,
    contentLength: metadata.contentLength,
    lastModified: new Date(),
    lastAccessed: new Date(),
    processingTime: metadata.processingTime,
    resultFormat: metadata.resultFormat,
  };

  // LRU eviction if needed
  if (fileCache.size >= config.maxEntries) {
    evictLRUEntry();
  }

  fileCache.set(cacheKey, entry);
  logger.debug(
    `[File Cache] Cached content: ${cacheKey} (${Math.round(content.length / 1024)}KB, preview: ${Math.round(preview.length / 1024)}KB)`,
  );
}

/**
 * Check if cached content needs revalidation
 */
export function shouldRevalidateCache(
  cached: FileCacheEntry,
  config: FileCacheConfig = DEFAULT_FILE_CACHE_CONFIG,
): boolean {
  const age = Date.now() - cached.lastModified.getTime();
  return age > config.revalidateAfter;
}

/**
 * Evict least recently used cache entry
 */
function evictLRUEntry(): void {
  let oldestKey: string | null = null;
  let oldestTime = Date.now();

  for (const [key, entry] of fileCache.entries()) {
    if (entry.lastAccessed.getTime() < oldestTime) {
      oldestTime = entry.lastAccessed.getTime();
      oldestKey = key;
    }
  }

  if (oldestKey) {
    fileCache.delete(oldestKey);
    logger.debug(`[File Cache] LRU evicted: ${oldestKey}`);
  }
}

/**
 * Clear file cache
 */
export function clearFileCache(fileId?: string): {
  cleared: number;
  message: string;
} {
  let cleared = 0;

  if (fileId) {
    // Clear all entries for a specific file (different formats/versions)
    const keysToDelete: string[] = [];
    for (const key of fileCache.keys()) {
      if (key.startsWith(`${fileId}-`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      fileCache.delete(key);
      cleared++;
    });

    const message = `Cleared ${cleared} cache entries for file ${fileId}`;
    logger.info(`[File Cache] ${message}`);
    return { cleared, message };
  } else {
    // Clear all entries
    cleared = fileCache.size;
    fileCache.clear();

    const message = `Cleared all ${cleared} file cache entries`;
    logger.info(`[File Cache] ${message}`);
    return { cleared, message };
  }
}

/**
 * Get cache statistics
 */
export function getFileCacheStats(): {
  size: number;
  maxEntries: number;
  totalContentSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  hitRate?: number;
} {
  const size = fileCache.size;
  let totalContentSize = 0;
  let oldest: Date | undefined;
  let newest: Date | undefined;

  for (const entry of fileCache.values()) {
    totalContentSize += entry.content.length + entry.preview.length;

    if (!oldest || entry.lastModified < oldest) {
      oldest = entry.lastModified;
    }
    if (!newest || entry.lastModified > newest) {
      newest = entry.lastModified;
    }
  }

  return {
    size,
    maxEntries: DEFAULT_FILE_CACHE_CONFIG.maxEntries,
    totalContentSize,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}

/**
 * Periodic cleanup of expired entries
 */
export function cleanupExpiredEntries(
  config: FileCacheConfig = DEFAULT_FILE_CACHE_CONFIG,
): number {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of fileCache.entries()) {
    const age = now - entry.lastModified.getTime();
    if (age > config.ttl) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => fileCache.delete(key));

  if (keysToDelete.length > 0) {
    logger.info(
      `[File Cache] Cleaned up ${keysToDelete.length} expired entries`,
    );
  }

  return keysToDelete.length;
}

// Automatic cleanup every hour (disabled in test mode)
if (process.env.NODE_ENV !== "test") {
  setInterval(
    () => {
      cleanupExpiredEntries();
    },
    60 * 60 * 1000,
  );
}
