import { expect, test, describe } from "vitest";
import {
  getCachedFile,
  setCachedFile,
  clearFileCache,
  getCacheStats,
} from "@/lib/file-cache";
