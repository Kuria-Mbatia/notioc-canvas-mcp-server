import { expect, test } from "vitest";
import * as urlParser from "../../src/lib/url-parser.js";

// Import all functions and types from the url-parser module
const {
  CanvasUrlInfo,
  parseCanvasUrl,
  isCanvasUrl,
  extractPageSlug,
  // Add other exports as needed
} = urlParser;
