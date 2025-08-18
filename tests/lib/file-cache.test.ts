import { expect, test } from "vitest";
import * as fileCache from "../../src/lib/file-cache.js";

// Import all functions and types from the file-cache module
const {
  getCachedFile,
  setCachedFile,
  clearFileCache,
  getCacheStats,
  // Add other exports as needed
} = fileCache;
