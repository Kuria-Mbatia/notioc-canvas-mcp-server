import { expect, test } from "vitest";
import * as mcp from "../../src/lib/mcp.js";

// Import all functions and types from the mcp module
const {
  createMCPServer,
  handleToolCall,
  registerTool,
  // Add other exports as needed
} = mcp;
