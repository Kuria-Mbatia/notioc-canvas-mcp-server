import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import { createMCP } from "@/lib/mcp";

// Mock the dependencies
vi.mock("../../src/tools/courses", () => ({
  listCourses: vi.fn(),
}));

vi.mock("@/lib/search", () => ({
  findBestMatch: vi.fn(),
}));

import { listCourses } from "../../src/tools/courses";
import { findBestMatch } from "@/lib/search";

const mockListCourses = listCourses as any;
const mockFindBestMatch = findBestMatch as any;

describe("mcp", () => {
  const testOptions = { testOption: "value" };
  const testCanvasBaseUrl = "https://test.instructure.com";
  const testAccessToken = "test-token-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createMCP", () => {
    test("should create MCP instance with correct structure", () => {
      const mcp = createMCP(testOptions);

      expect(mcp).toHaveProperty("context");
      expect(mcp.context).toHaveProperty("findCourseId");
      expect(typeof mcp.context.findCourseId).toBe("function");
    });

    test("should accept any options parameter", () => {
      const options1 = { setting1: "value1" };
      const options2 = { setting2: "value2", nested: { prop: "test" } };
      const options3 = null;
      const options4 = undefined;

      expect(() => createMCP(options1)).not.toThrow();
      expect(() => createMCP(options2)).not.toThrow();
      expect(() => createMCP(options3)).not.toThrow();
      expect(() => createMCP(options4)).not.toThrow();

      // All should create valid MCP instances
      expect(createMCP(options1).context.findCourseId).toBeInstanceOf(Function);
      expect(createMCP(options2).context.findCourseId).toBeInstanceOf(Function);
      expect(createMCP(options3).context.findCourseId).toBeInstanceOf(Function);
      expect(createMCP(options4).context.findCourseId).toBeInstanceOf(Function);
    });
  });

  describe("findCourseId", () => {
    let mcp: ReturnType<typeof createMCP>;

    beforeEach(() => {
      mcp = createMCP(testOptions);
    });

    test("should find course ID for exact name match", async () => {
      const mockCourses = [
        { id: "123", name: "Introduction to Computer Science", courseCode: "CS101" },
        { id: "456", name: "Advanced Programming", courseCode: "CS201" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);
      mockFindBestMatch.mockReturnValue({ id: "123", name: "Introduction to Computer Science" });

      const result = await mcp.context.findCourseId(
        "Introduction to Computer Science",
        testCanvasBaseUrl,
        testAccessToken
      );

      expect(result).toBe("123");
      expect(mockListCourses).toHaveBeenCalledWith({
        canvasBaseUrl: testCanvasBaseUrl,
        accessToken: testAccessToken,
        enrollmentState: "all",
      });
      expect(mockFindBestMatch).toHaveBeenCalledWith(
        "Introduction to Computer Science",
        mockCourses,
        ["name", "courseCode", "nickname"]
      );
    });

    test("should find course ID for partial name match", async () => {
      const mockCourses = [
        { id: "123", name: "Introduction to Computer Science", courseCode: "CS101" },
        { id: "456", name: "Advanced Programming", courseCode: "CS201" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);
      mockFindBestMatch.mockReturnValue({ id: "456", name: "Advanced Programming" });

      const result = await mcp.context.findCourseId(
        "programming",
        testCanvasBaseUrl,
        testAccessToken
      );

      expect(result).toBe("456");
      expect(mockFindBestMatch).toHaveBeenCalledWith(
        "programming",
        mockCourses,
        ["name", "courseCode", "nickname"]
      );
    });

    test("should find course ID by course code", async () => {
      const mockCourses = [
        { id: "123", name: "Introduction to Computer Science", courseCode: "CS101" },
        { id: "456", name: "Advanced Programming", courseCode: "CS201" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);
      mockFindBestMatch.mockReturnValue({ id: "456", courseCode: "CS201" });

      const result = await mcp.context.findCourseId(
        "CS201",
        testCanvasBaseUrl,
        testAccessToken
      );

      expect(result).toBe("456");
      expect(mockFindBestMatch).toHaveBeenCalledWith(
        "CS201",
        mockCourses,
        ["name", "courseCode", "nickname"]
      );
    });

    test("should find course ID by nickname", async () => {
      const mockCourses = [
        { id: "123", name: "Introduction to Computer Science", courseCode: "CS101", nickname: "Intro CS" },
        { id: "456", name: "Advanced Programming", courseCode: "CS201", nickname: "Advanced Prog" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);
      mockFindBestMatch.mockReturnValue({ id: "123", nickname: "Intro CS" });

      const result = await mcp.context.findCourseId(
        "Intro CS",
        testCanvasBaseUrl,
        testAccessToken
      );

      expect(result).toBe("123");
      expect(mockFindBestMatch).toHaveBeenCalledWith(
        "Intro CS",
        mockCourses,
        ["name", "courseCode", "nickname"]
      );
    });

    test("should return undefined when no courses are available", async () => {
      mockListCourses.mockResolvedValue([]);

      const result = await mcp.context.findCourseId(
        "Any Course",
        testCanvasBaseUrl,
        testAccessToken
      );

      expect(result).toBeUndefined();
      expect(mockListCourses).toHaveBeenCalledWith({
        canvasBaseUrl: testCanvasBaseUrl,
        accessToken: testAccessToken,
        enrollmentState: "all",
      });
      expect(mockFindBestMatch).not.toHaveBeenCalled();
    });

    test("should return undefined when no matching course is found", async () => {
      const mockCourses = [
        { id: "123", name: "Introduction to Computer Science", courseCode: "CS101" },
        { id: "456", name: "Advanced Programming", courseCode: "CS201" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);
      mockFindBestMatch.mockReturnValue(null); // No match found

      const result = await mcp.context.findCourseId(
        "Quantum Physics",
        testCanvasBaseUrl,
        testAccessToken
      );

      expect(result).toBeUndefined();
      expect(mockFindBestMatch).toHaveBeenCalledWith(
        "Quantum Physics",
        mockCourses,
        ["name", "courseCode", "nickname"]
      );
    });

    test("should handle listCourses API errors", async () => {
      mockListCourses.mockRejectedValue(new Error("API Error"));

      await expect(
        mcp.context.findCourseId("Any Course", testCanvasBaseUrl, testAccessToken)
      ).rejects.toThrow("API Error");

      expect(mockListCourses).toHaveBeenCalledWith({
        canvasBaseUrl: testCanvasBaseUrl,
        accessToken: testAccessToken,
        enrollmentState: "all",
      });
      expect(mockFindBestMatch).not.toHaveBeenCalled();
    });

    test("should handle findBestMatch errors", async () => {
      const mockCourses = [
        { id: "123", name: "Introduction to Computer Science", courseCode: "CS101" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);
      mockFindBestMatch.mockImplementation(() => {
        throw new Error("Search Error");
      });

      await expect(
        mcp.context.findCourseId("CS101", testCanvasBaseUrl, testAccessToken)
      ).rejects.toThrow("Search Error");

      expect(mockListCourses).toHaveBeenCalled();
      expect(mockFindBestMatch).toHaveBeenCalled();
    });

    test("should handle empty strings and special characters", async () => {
      const mockCourses = [
        { id: "123", name: "Test Course", courseCode: "TEST" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);
      mockFindBestMatch.mockReturnValue(null);

      // Empty string
      let result = await mcp.context.findCourseId("", testCanvasBaseUrl, testAccessToken);
      expect(result).toBeUndefined();

      // Special characters
      result = await mcp.context.findCourseId("@#$%", testCanvasBaseUrl, testAccessToken);
      expect(result).toBeUndefined();

      // Whitespace
      result = await mcp.context.findCourseId("   ", testCanvasBaseUrl, testAccessToken);
      expect(result).toBeUndefined();

      expect(mockListCourses).toHaveBeenCalledTimes(3);
      expect(mockFindBestMatch).toHaveBeenCalledTimes(3);
    });

    test("should work with courses that have minimal data", async () => {
      const mockCourses = [
        { id: "123" }, // Only ID
        { id: "456", name: "Course with Name" },
        { id: "789", courseCode: "CODE123" },
      ];

      mockListCourses.mockResolvedValue(mockCourses);
      mockFindBestMatch.mockReturnValue({ id: "456" });

      const result = await mcp.context.findCourseId(
        "Course with Name",
        testCanvasBaseUrl,
        testAccessToken
      );

      expect(result).toBe("456");
      expect(mockFindBestMatch).toHaveBeenCalledWith(
        "Course with Name",
        mockCourses,
        ["name", "courseCode", "nickname"]
      );
    });

    test("should handle large number of courses", async () => {
      const mockCourses = Array.from({ length: 100 }, (_, i) => ({
        id: `${i + 1}`,
        name: `Course ${i + 1}`,
        courseCode: `CS${(i + 1).toString().padStart(3, "0")}`,
      }));

      mockListCourses.mockResolvedValue(mockCourses);
      mockFindBestMatch.mockReturnValue({ id: "50", name: "Course 50" });

      const result = await mcp.context.findCourseId(
        "Course 50",
        testCanvasBaseUrl,
        testAccessToken
      );

      expect(result).toBe("50");
      expect(mockListCourses).toHaveBeenCalledWith({
        canvasBaseUrl: testCanvasBaseUrl,
        accessToken: testAccessToken,
        enrollmentState: "all",
      });
      expect(mockFindBestMatch).toHaveBeenCalledWith(
        "Course 50",
        mockCourses,
        ["name", "courseCode", "nickname"]
      );
    });
  });

  describe("multiple MCP instances", () => {
    test("should create independent MCP instances", () => {
      const mcp1 = createMCP({ option: "value1" });
      const mcp2 = createMCP({ option: "value2" });

      expect(mcp1).not.toBe(mcp2);
      expect(mcp1.context).not.toBe(mcp2.context);
      expect(mcp1.context.findCourseId).not.toBe(mcp2.context.findCourseId);
    });

    test("should allow concurrent course searches", async () => {
      const mcp1 = createMCP({});
      const mcp2 = createMCP({});

      const mockCourses1 = [{ id: "123", name: "Course 1" }];
      const mockCourses2 = [{ id: "456", name: "Course 2" }];

      mockListCourses
        .mockResolvedValueOnce(mockCourses1)
        .mockResolvedValueOnce(mockCourses2);
      
      mockFindBestMatch
        .mockReturnValueOnce({ id: "123" })
        .mockReturnValueOnce({ id: "456" });

      const [result1, result2] = await Promise.all([
        mcp1.context.findCourseId("Course 1", testCanvasBaseUrl, testAccessToken),
        mcp2.context.findCourseId("Course 2", testCanvasBaseUrl, testAccessToken),
      ]);

      expect(result1).toBe("123");
      expect(result2).toBe("456");
      expect(mockListCourses).toHaveBeenCalledTimes(2);
      expect(mockFindBestMatch).toHaveBeenCalledTimes(2);
    });
  });
});
