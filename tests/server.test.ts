import { expect, test, describe, vi } from "vitest";

// Mock the server dependencies to prevent actual server startup during tests
vi.mock("@modelcontextprotocol/sdk/server/stdio", () => ({
  StdioServerTransport: vi.fn(),
}));

vi.mock("@/lib/mcp", () => ({
  createMCPServer: vi.fn(() => ({
    connect: vi.fn(),
    close: vi.fn(),
  })),
}));

describe.skip("Server", () => {
  test("server module can be imported without errors", async () => {
    // This test ensures the server module can be imported without throwing
    // Since server.ts is an entry point that starts the MCP server,
    // we mock its dependencies to prevent actual server startup
    expect(() => {
      // The server module is imported but we don't actually start it
      const path = require("path");
      const serverPath = path.resolve(__dirname, "../src/server.ts");
      require(serverPath);
    }).not.toThrow();
  });

  test("server module exists", () => {
    // Basic test to verify the server file exists and is accessible
    const fs = require("fs");
    const path = require("path");
    const serverPath = path.resolve(__dirname, "../src/server.ts");
    expect(fs.existsSync(serverPath)).toBe(true);
  });
});
