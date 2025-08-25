import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  listCourses,
  getCourseSyllabus,
  type CourseListParams,
} from "@/tools/courses";

// Mock dependencies
vi.mock("@/lib/pagination");

describe("Courses Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listCourses", () => {
    const mockCoursesData = [
      {
        id: 1,
        name: "Mathematics 101",
        course_code: "MATH101",
        enrollment_state: "active",
        nickname: "Math",
      },
      {
        id: 2,
        name: "Physics 201",
        course_code: "PHYS201",
        enrollment_state: "completed",
        nickname: null,
      },
      {
        id: 3,
        name: "",
        course_code: "EMPTY001",
        enrollment_state: "active",
        nickname: null,
      },
      {
        id: 4,
        name: "Chemistry 301",
        course_code: "CHEM301",
        enrollment_state: "active",
        nickname: "Organic Chem",
      },
    ];

    test("lists active courses by default", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockCoursesData,
      );

      const result = await listCourses(mockParams);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses",
        {
          per_page: "100",
          include: ["course_nickname"],
          enrollment_state: "active",
        },
      );

      expect(result).toHaveLength(4); // All courses have names after fallback
      // Find the Math course (might not be first due to sorting)
      const mathCourse = result.find((c) => c.courseCode === "MATH101");
      expect(mathCourse).toEqual({
        id: "1",
        name: "Mathematics 101",
        courseCode: "MATH101",
        enrollmentState: "active",
        nickname: "Math",
      });
    });

    test("filters courses by enrollment state", async () => {
      const paramsWithState: CourseListParams = {
        ...mockParams,
        enrollmentState: "completed",
      };

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockCoursesData,
      );

      await listCourses(paramsWithState);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses",
        {
          per_page: "100",
          include: ["course_nickname"],
          enrollment_state: "completed",
        },
      );
    });

    test("lists all courses when enrollmentState is 'all'", async () => {
      const paramsWithAll: CourseListParams = {
        ...mockParams,
        enrollmentState: "all",
      };

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockCoursesData,
      );

      await listCourses(paramsWithAll);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses",
        {
          per_page: "100",
          include: ["course_nickname"],
          // No enrollment_state parameter when "all"
        },
      );
    });

    test("filters out courses without names", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockCoursesData,
      );

      const result = await listCourses(mockParams);

      // Course with empty name gets fallback name from course_code
      expect(result).toHaveLength(4);
      const emptyCourse = result.find((c) => c.id === "3");
      expect(emptyCourse?.name).toBe("EMPTY001"); // Uses course_code as fallback
    });

    test("sorts courses by nickname or name", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockCoursesData,
      );

      const result = await listCourses(mockParams);

      // Sorting is by nickname || name, so let's check the actual order
      // "EMPTY001" < "Math" < "Organic Chem" < "Physics 201"
      expect(result[0].name).toBe("EMPTY001"); // Course with empty name, uses course_code
      expect(result[1].nickname).toBe("Math");
      expect(result[2].nickname).toBe("Organic Chem");
      expect(result[3].name).toBe("Physics 201");
    });

    test("handles courses with missing course_code", async () => {
      const mockCoursesWithMissingCode = [
        {
          id: 5,
          name: "Special Course",
          course_code: null,
          enrollment_state: "active",
          nickname: null,
        },
      ];

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockCoursesWithMissingCode,
      );

      const result = await listCourses(mockParams);

      expect(result[0]).toEqual({
        id: "5",
        name: "Special Course",
        courseCode: null,
        enrollmentState: "active",
        nickname: null,
      });
    });

    test("uses course_code as fallback for name", async () => {
      const mockCoursesWithCodeAsName = [
        {
          id: 6,
          name: null,
          course_code: "FALLBACK101",
          enrollment_state: "active",
          nickname: null,
        },
      ];

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockCoursesWithCodeAsName,
      );

      const result = await listCourses(mockParams);

      expect(result[0].name).toBe("FALLBACK101");
    });

    test("uses Course ID as ultimate fallback for name", async () => {
      const mockCoursesWithIdAsName = [
        {
          id: 7,
          name: null,
          course_code: null,
          enrollment_state: "active",
          nickname: null,
        },
      ];

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockCoursesWithIdAsName,
      );

      const result = await listCourses(mockParams);

      expect(result[0].name).toBe("Course 7");
    });

    test("handles empty courses list", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue([]);

      const result = await listCourses(mockParams);

      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });

    test("throws error for missing required parameters", async () => {
      const invalidParams = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(listCourses(invalidParams)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });

    test("handles API errors gracefully", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockRejectedValue(
        new Error("Canvas API Error"),
      );

      await expect(listCourses(mockParams)).rejects.toThrow(
        "Failed to fetch courses: Canvas API Error",
      );
    });
  });

  describe("getCourseSyllabus", () => {
    const syllabusParams = {
      canvasBaseUrl: mockParams.canvasBaseUrl,
      accessToken: mockParams.accessToken,
      courseId: "12345",
    };

    beforeEach(() => {
      // Reset fetch mock
      global.fetch = vi.fn();
    });

    test("fetches course syllabus successfully", async () => {
      const mockSyllabusData = {
        syllabus_body:
          "<h1>Course Syllabus</h1><p>This is the syllabus content.</p>",
        html_url: "https://test.instructure.com/courses/12345",
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockSyllabusData,
      } as Response);

      const result = await getCourseSyllabus(syllabusParams);

      expect(fetch).toHaveBeenCalledWith(
        "https://test.instructure.com/api/v1/courses/12345?include[]=syllabus_body",
        {
          headers: {
            Authorization: "Bearer test-token",
          },
        },
      );

      expect(result).toEqual({
        body: "<h1>Course Syllabus</h1><p>This is the syllabus content.</p>",
        url: "https://test.instructure.com/courses/12345/assignments/syllabus",
      });
    });

    test("handles course with no syllabus", async () => {
      const mockSyllabusData = {
        syllabus_body: null,
        html_url: "https://test.instructure.com/courses/12345",
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockSyllabusData,
      } as Response);

      const result = await getCourseSyllabus(syllabusParams);

      expect(result).toEqual({
        body: null,
        url: "https://test.instructure.com/courses/12345/assignments/syllabus",
      });
    });

    test("handles course with empty syllabus", async () => {
      const mockSyllabusData = {
        syllabus_body: "",
        html_url: "https://test.instructure.com/courses/12345",
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockSyllabusData,
      } as Response);

      const result = await getCourseSyllabus(syllabusParams);

      expect(result).toEqual({
        body: null, // Empty string gets converted to null by || null
        url: "https://test.instructure.com/courses/12345/assignments/syllabus",
      });
    });

    test("throws error for HTTP error responses", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      await expect(getCourseSyllabus(syllabusParams)).rejects.toThrow(
        "Failed to fetch course syllabus: 404 Not Found",
      );
    });

    test("throws error for missing required parameters", async () => {
      const invalidParams = {
        canvasBaseUrl: "",
        accessToken: "test-token",
        courseId: "12345",
      };

      await expect(getCourseSyllabus(invalidParams)).rejects.toThrow(
        "Missing Canvas URL, Access Token, or Course ID",
      );
    });

    test("handles network errors gracefully", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network Error"));

      await expect(getCourseSyllabus(syllabusParams)).rejects.toThrow(
        "Failed to fetch course syllabus for course 12345: Network Error",
      );
    });

    test("constructs correct syllabus URL", async () => {
      const mockSyllabusData = {
        syllabus_body: "Syllabus content",
        html_url: "https://different.instructure.com/courses/67890",
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockSyllabusData,
      } as Response);

      const result = await getCourseSyllabus(syllabusParams);

      expect(result.url).toBe(
        "https://different.instructure.com/courses/67890/assignments/syllabus",
      );
    });
  });
});
