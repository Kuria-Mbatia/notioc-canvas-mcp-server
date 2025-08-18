import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";
import {
  callCanvasAPI,
  type CanvasCourse,
  type CanvasFile,
  type CanvasAssignment,
  type CanvasModule,
  type CanvasModuleItem,
  type CanvasPage,
  type CanvasDiscussionTopic,
  type CanvasDiscussionEntry,
} from "@/lib/canvas-api";

// Mock node-cache
vi.mock("node-cache", () => {
  const mockCache = {
    get: vi.fn(),
    set: vi.fn(),
  };
  return {
    default: vi.fn(() => mockCache),
  };
});

// Mock fetch globally
global.fetch = vi.fn();

const mockFetch = global.fetch as any;

describe("canvas-api", () => {
  const testParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token-123",
    method: "GET" as const,
    apiPath: "/api/v1/courses",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("callCanvasAPI", () => {
    test("should throw error when missing required parameters", async () => {
      await expect(
        callCanvasAPI({
          canvasBaseUrl: "",
          accessToken: "token",
          method: "GET",
          apiPath: "/api/v1/courses",
        })
      ).rejects.toThrow("Missing required Canvas API parameters");

      await expect(
        callCanvasAPI({
          canvasBaseUrl: "https://test.instructure.com",
          accessToken: "",
          method: "GET",
          apiPath: "/api/v1/courses",
        })
      ).rejects.toThrow("Missing required Canvas API parameters");

      await expect(
        callCanvasAPI({
          canvasBaseUrl: "https://test.instructure.com",
          accessToken: "token",
          method: "GET",
          apiPath: "",
        })
      ).rejects.toThrow("Missing required Canvas API parameters");
    });

    test("should construct proper URL and headers for GET requests", async () => {
      const mockResponse = new Response(JSON.stringify({ data: "test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      mockFetch.mockResolvedValue(mockResponse);

      await callCanvasAPI(testParams);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.instructure.com/api/v1/courses",
        {
          method: "GET",
          headers: {
            Authorization: "Bearer test-token-123",
            Accept: "application/json+canvas-string-ids",
            "User-Agent": "Notioc-MCP-Server/1.0.0",
          },
          body: null,
        }
      );
    });

    test("should handle query parameters for GET requests", async () => {
      const mockResponse = new Response(JSON.stringify({ data: "test" }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      await callCanvasAPI({
        ...testParams,
        params: {
          per_page: 50,
          include: "enrollments",
          state: ["available", "completed"],
          published: true,
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.instructure.com/api/v1/courses?per_page=50&include=enrollments&state%5B%5D=available&state%5B%5D=completed&published=true",
        expect.any(Object)
      );
    });

    test("should handle POST requests with JSON body", async () => {
      const mockResponse = new Response(JSON.stringify({ id: "123" }), {
        status: 201,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const postBody = { name: "Test Course", course_code: "TEST101" };

      await callCanvasAPI({
        ...testParams,
        method: "POST",
        apiPath: "/api/v1/accounts/1/courses",
        body: postBody,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.instructure.com/api/v1/accounts/1/courses",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-token-123",
            Accept: "application/json+canvas-string-ids",
            "User-Agent": "Notioc-MCP-Server/1.0.0",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(postBody),
        }
      );
    });

    test("should handle PUT requests with JSON body", async () => {
      const mockResponse = new Response(JSON.stringify({ id: "123" }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const putBody = { name: "Updated Course Name" };

      await callCanvasAPI({
        ...testParams,
        method: "PUT",
        apiPath: "/api/v1/courses/123",
        body: putBody,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.instructure.com/api/v1/courses/123",
        {
          method: "PUT",
          headers: {
            Authorization: "Bearer test-token-123",
            Accept: "application/json+canvas-string-ids",
            "User-Agent": "Notioc-MCP-Server/1.0.0",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(putBody),
        }
      );
    });

    test("should clean base URL properly", async () => {
      const mockResponse = new Response(JSON.stringify({ data: "test" }), {
        status: 200,
      });
      mockFetch.mockResolvedValue(mockResponse);

      // Test with trailing slash
      await callCanvasAPI({
        ...testParams,
        canvasBaseUrl: "https://test.instructure.com/",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.instructure.com/api/v1/courses",
        expect.any(Object)
      );

      // Test with protocol in base URL
      await callCanvasAPI({
        ...testParams,
        canvasBaseUrl: "http://test.instructure.com",
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        "https://test.instructure.com/api/v1/courses",
        expect.any(Object)
      );
    });

    test("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      const response = await callCanvasAPI(testParams);

      expect(response.status).toBe(502);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      
      const errorData = await response.json();
      expect(errorData.error).toContain("Canvas API network error: Network connection failed");
    });

    test("should return successful response for valid requests", async () => {
      const mockData = { id: "123", name: "Test Course" };
      const mockResponse = new Response(JSON.stringify(mockData), {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
      });
      mockFetch.mockResolvedValue(mockResponse);

      const response = await callCanvasAPI(testParams);

      expect(response.status).toBe(200);
      expect(response.statusText).toBe("OK");
      
      const responseData = await response.json();
      expect(responseData).toEqual(mockData);
    });

    test("should handle non-200 responses", async () => {
      const mockResponse = new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          statusText: "Unauthorized",
        }
      );
      mockFetch.mockResolvedValue(mockResponse);

      const response = await callCanvasAPI(testParams);

      expect(response.status).toBe(401);
      expect(response.statusText).toBe("Unauthorized");
    });

    test("should handle DELETE requests", async () => {
      const mockResponse = new Response(null, {
        status: 204,
        statusText: "No Content",
      });
      mockFetch.mockResolvedValue(mockResponse);

      await callCanvasAPI({
        ...testParams,
        method: "DELETE",
        apiPath: "/api/v1/courses/123",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.instructure.com/api/v1/courses/123",
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer test-token-123",
            Accept: "application/json+canvas-string-ids",
            "User-Agent": "Notioc-MCP-Server/1.0.0",
          },
          body: null,
        }
      );
    });
  });

  describe("Interface Type Validations", () => {
    test("CanvasCourse interface should accept valid course data", () => {
      const course: CanvasCourse = {
        id: "123",
        name: "Introduction to Computer Science",
        course_code: "CS101",
        workflow_state: "available",
        enrollment_state: "active",
        nickname: "Intro CS",
      };

      expect(course.id).toBe("123");
      expect(course.name).toBe("Introduction to Computer Science");
      expect(course.course_code).toBe("CS101");
    });

    test("CanvasFile interface should accept valid file data", () => {
      const file: CanvasFile = {
        id: "456",
        display_name: "Lecture Notes.pdf",
        filename: "lecture_notes.pdf",
        content_type: "application/pdf",
        size: 1024576,
        url: "https://example.com/files/456",
        html_url: "https://example.com/courses/123/files/456",
        created_at: "2023-01-15T10:00:00Z",
        updated_at: "2023-01-15T10:00:00Z",
        folder_id: "789",
      };

      expect(file.id).toBe("456");
      expect(file.display_name).toBe("Lecture Notes.pdf");
      expect(file.content_type).toBe("application/pdf");
    });

    test("CanvasAssignment interface should accept valid assignment data", () => {
      const assignment: CanvasAssignment = {
        id: "789",
        name: "Homework 1",
        description: "Complete the exercises in Chapter 1",
        due_at: "2023-02-01T23:59:59Z",
        points_possible: 100,
        submission_types: ["online_text_entry", "online_upload"],
        workflow_state: "published",
        html_url: "https://example.com/courses/123/assignments/789",
        has_submitted_submissions: false,
      };

      expect(assignment.id).toBe("789");
      expect(assignment.name).toBe("Homework 1");
      expect(assignment.points_possible).toBe(100);
    });

    test("CanvasModule interface should accept valid module data", () => {
      const module: CanvasModule = {
        id: "101",
        name: "Week 1: Introduction",
        position: 1,
        workflow_state: "active",
        items_count: 5,
        items_url: "https://example.com/api/v1/courses/123/modules/101/items",
        unlock_at: "2023-01-01T00:00:00Z",
        require_sequential_progress: true,
        prerequisite_module_ids: [],
        state: "unlocked",
        published: true,
      };

      expect(module.id).toBe("101");
      expect(module.name).toBe("Week 1: Introduction");
      expect(module.position).toBe(1);
    });

    test("CanvasModuleItem interface should accept valid module item data", () => {
      const moduleItem: CanvasModuleItem = {
        id: "202",
        title: "Introduction Video",
        type: "ExternalUrl",
        content_id: "303",
        html_url: "https://example.com/courses/123/modules/items/202",
        external_url: "https://youtube.com/watch?v=123",
        new_tab: true,
        position: 1,
        indent: 0,
        completion_requirement: {
          type: "must_view",
          completed: false,
        },
        published: true,
      };

      expect(moduleItem.id).toBe("202");
      expect(moduleItem.title).toBe("Introduction Video");
      expect(moduleItem.type).toBe("ExternalUrl");
    });

    test("CanvasPage interface should accept valid page data", () => {
      const page: CanvasPage = {
        page_id: "404",
        url: "introduction",
        title: "Course Introduction",
        body: "<p>Welcome to the course!</p>",
        created_at: "2023-01-01T10:00:00Z",
        updated_at: "2023-01-02T15:30:00Z",
        published: true,
        front_page: true,
        locked_for_user: false,
        html_url: "https://example.com/courses/123/pages/introduction",
        editing_roles: "teachers",
      };

      expect(page.page_id).toBe("404");
      expect(page.title).toBe("Course Introduction");
      expect(page.front_page).toBe(true);
    });

    test("CanvasDiscussionTopic interface should accept valid discussion data", () => {
      const discussion: CanvasDiscussionTopic = {
        id: "505",
        title: "Week 1 Discussion",
        message: "Please introduce yourself to the class",
        html_url: "https://example.com/courses/123/discussion_topics/505",
        posted_at: "2023-01-01T09:00:00Z",
        last_reply_at: "2023-01-05T14:30:00Z",
        require_initial_post: true,
        user_can_see_posts: true,
        discussion_subentry_count: 25,
        read_state: "read",
        unread_count: 0,
        subscribed: true,
        published: true,
        locked: false,
        pinned: false,
        locked_for_user: false,
        discussion_type: "threaded",
      };

      expect(discussion.id).toBe("505");
      expect(discussion.title).toBe("Week 1 Discussion");
      expect(discussion.require_initial_post).toBe(true);
    });

    test("CanvasDiscussionEntry interface should accept valid entry data", () => {
      const entry: CanvasDiscussionEntry = {
        id: "606",
        user_id: "707",
        parent_id: "505",
        created_at: "2023-01-02T10:15:00Z",
        updated_at: "2023-01-02T10:15:00Z",
        rating_count: 3,
        rating_sum: 15,
        user_name: "John Doe",
        message: "Hello everyone! I'm excited to be in this class.",
        forced_read_state: false,
        read_state: "read",
        recent_replies: [],
        has_more_replies: false,
      };

      expect(entry.id).toBe("606");
      expect(entry.user_id).toBe("707");
      expect(entry.message).toBe("Hello everyone! I'm excited to be in this class.");
    });
  });
});
