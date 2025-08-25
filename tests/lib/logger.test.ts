import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { logger } from "@/lib/logger";

// Mock console.error to capture logger output
const mockConsoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock process.env.DEBUG for debug tests
    delete process.env.DEBUG;
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.DEBUG;
  });

  describe("log method", () => {
    test("should output to stderr with MCP INFO prefix", () => {
      logger.log("Test message", { data: "value" });

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP INFO]",
        "Test message",
        { data: "value" },
      );
    });

    test("should handle multiple arguments", () => {
      logger.log("Message", 123, true, null);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP INFO]",
        "Message",
        123,
        true,
        null,
      );
    });

    test("should handle no arguments", () => {
      logger.log();

      expect(mockConsoleError).toHaveBeenCalledWith("[MCP INFO]");
    });
  });

  describe("info method", () => {
    test("should output to stderr with MCP INFO prefix", () => {
      logger.info("Information message");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP INFO]",
        "Information message",
      );
    });

    test("should handle objects and arrays", () => {
      const testObj = { id: 123, name: "test" };
      const testArr = [1, 2, 3];

      logger.info("Data:", testObj, testArr);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP INFO]",
        "Data:",
        testObj,
        testArr,
      );
    });
  });

  describe("warn method", () => {
    test("should output to stderr with MCP WARN prefix", () => {
      logger.warn("Warning message");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP WARN]",
        "Warning message",
      );
    });

    test("should handle error objects", () => {
      const error = new Error("Test error");
      logger.warn("Warning:", error);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP WARN]",
        "Warning:",
        error,
      );
    });
  });

  describe("error method", () => {
    test("should output to stderr with MCP ERROR prefix", () => {
      logger.error("Error message");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP ERROR]",
        "Error message",
      );
    });

    test("should handle stack traces", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";

      logger.error("Fatal error:", error);

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP ERROR]",
        "Fatal error:",
        error,
      );
    });
  });

  describe("debug method", () => {
    test("should not output when DEBUG environment variable is not set", () => {
      delete process.env.DEBUG;

      logger.debug("Debug message");

      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test("should output to stderr with MCP DEBUG prefix when DEBUG is set", () => {
      process.env.DEBUG = "1";

      logger.debug("Debug message", { debugData: true });

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP DEBUG]",
        "Debug message",
        { debugData: true },
      );
    });

    test("should output when DEBUG is set to any truthy value", () => {
      process.env.DEBUG = "true";

      logger.debug("Another debug message");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP DEBUG]",
        "Another debug message",
      );
    });

    test("should not output when DEBUG is set to empty string", () => {
      process.env.DEBUG = "";

      logger.debug("Should not appear");

      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test("should output when DEBUG is set to '0' (truthy string)", () => {
      process.env.DEBUG = "0";

      logger.debug("Should appear because '0' is truthy");

      expect(mockConsoleError).toHaveBeenCalledWith(
        "[MCP DEBUG]",
        "Should appear because '0' is truthy",
      );
    });
  });

  describe("logger object structure", () => {
    test("should have all required methods", () => {
      expect(typeof logger.log).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    test("should be callable without context", () => {
      const { log, info, warn, error, debug } = logger;

      expect(() => log("test")).not.toThrow();
      expect(() => info("test")).not.toThrow();
      expect(() => warn("test")).not.toThrow();
      expect(() => error("test")).not.toThrow();
      expect(() => debug("test")).not.toThrow();
    });
  });

  describe("JSON-RPC compliance", () => {
    test("should never output to stdout to avoid interfering with JSON-RPC", () => {
      const mockConsoleLog = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      logger.log("test");
      logger.info("test");
      logger.warn("test");
      logger.error("test");

      process.env.DEBUG = "1";
      logger.debug("test");

      expect(mockConsoleLog).not.toHaveBeenCalled();

      mockConsoleLog.mockRestore();
    });

    test("should always use stderr for all log levels", () => {
      process.env.DEBUG = "1";

      logger.log("log test");
      logger.info("info test");
      logger.warn("warn test");
      logger.error("error test");
      logger.debug("debug test");

      expect(mockConsoleError).toHaveBeenCalledTimes(5);
      expect(mockConsoleError).toHaveBeenNthCalledWith(
        1,
        "[MCP INFO]",
        "log test",
      );
      expect(mockConsoleError).toHaveBeenNthCalledWith(
        2,
        "[MCP INFO]",
        "info test",
      );
      expect(mockConsoleError).toHaveBeenNthCalledWith(
        3,
        "[MCP WARN]",
        "warn test",
      );
      expect(mockConsoleError).toHaveBeenNthCalledWith(
        4,
        "[MCP ERROR]",
        "error test",
      );
      expect(mockConsoleError).toHaveBeenNthCalledWith(
        5,
        "[MCP DEBUG]",
        "debug test",
      );
    });
  });
});
