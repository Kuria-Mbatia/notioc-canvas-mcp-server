import { expect, test } from "vitest";
import * as urlProcessor from "../../src/lib/url-processor.js";

// Import all functions and types from the url-processor module
const {
  CanvasURLInfo,
  URLProcessingResult,
  parseCanvasURL,
  webUrlToApiUrl,
  extractFileIdsFromHTML,
  extractLinksFromHTML,
  validateCanvasURL,
  // Add other exports as needed
} = urlProcessor;
