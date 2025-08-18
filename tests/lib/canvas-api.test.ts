import { expect, test } from "vitest";
import * as canvasApi from "../../src/lib/canvas-api.js";

// Import all functions and types from the canvas-api module
const {
  callCanvasAPI,
  makeCanvasRequest,
  handleCanvasError,
  validateCanvasCredentials,
  testCanvasConnection,
  // Add other exports as needed
} = canvasApi;
