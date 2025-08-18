import { expect, test } from "vitest";
import * as files from "../../src/tools/files.js";

// Import all functions and types from the files module
const {
  FileSearchParams,
  FileContentParams,
  FileInfo,
  searchFiles,
  getFileContent,
  readFileById,
  // Add other exports as needed
} = files;
