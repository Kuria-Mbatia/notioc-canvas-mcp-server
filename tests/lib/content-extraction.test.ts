import { expect, test } from "vitest";
import * as contentExtraction from "../../src/lib/content-extraction.js";

// Import all functions and types from the content-extraction module
const {
  extractContentFromHTML,
  extractTextFromHTML,
  extractLinksFromContent,
  parseCanvasContent,
  // Add other exports as needed
} = contentExtraction;
