import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  findPeopleInCourse,
  searchRecipients,
  getUserProfile,
  getMyProfile,
  type FindPeopleParams,
  type SearchRecipientsParams,
} from "@/tools/users";
import * as coursesModule from "@/tools/courses";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/lib/pagination");
vi.mock("@/lib/canvas-api");
vi.mock("@/lib/search");

const mockListCourses = vi.mocked(coursesModule.listCourses);

describe("Users Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findPeopleInCourse", () => {
    const mockUsersData = [
      {
        id: 1,
        name: "John Doe",
        display_name: "Johnny",
        sortable_name: "Doe, John",
        short_name: "John",
        sis_user_id: "john123",
        login_id: "john@example.com",
        avatar_url: "https://example.com/avatar1.jpg",
        enrollments: [
          {
            type: "StudentEnrollment",
            enrollment_state: "active",
            course_section_id: 101,
            course_id: 12345,
          },
        ],
      },
      {
        id: 2,
        name: "Jane Smith",
        display_name: "Jane",
        sortable_name: "Smith, Jane",
        short_name: "Jane",
        sis_user_id: "jane456",
        login_id: "jane@example.com",
        avatar_url: "https://example.com/avatar2.jpg",
        enrollments: [
          {
            type: "TeacherEnrollment",
            enrollment_state: "active",
            course_section_id: 101,
            course_id: 12345,
          },
        ],
      },
    ];

    test("finds people in course by course ID", async () => {
      const params: FindPeopleParams = {
        ...mockParams,
        courseId: "12345",
      };

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockUsersData,
      );

      const result = await findPeopleInCourse(params);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/users",
        { per_page: "100", enrollment_state: "active", include: ["enrollments", "avatar_url"] },
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        name: "John Doe",
        displayName: "Johnny",
        sortableName: "Doe, John",
        shortName: "John",
        sisUserId: "john123",
        loginId: "john@example.com",
        avatarUrl: "https://example.com/avatar1.jpg",
        enrollments: [
          {
            type: "StudentEnrollment",
            state: "active",
            courseSectionId: 101,
            courseId: 12345,
          },
        ],
      });
    });

    test("finds people in course by course name", async () => {
      const params: FindPeopleParams = {
        ...mockParams,
        courseName: "Test Course",
      };

      mockListCourses.mockResolvedValue([
        { id: "12345", name: "Test Course", courseCode: "TEST101" },
      ]);

      const mockFindBestMatch = await import("@/lib/search");
      vi.mocked(mockFindBestMatch.findBestMatch).mockReturnValue({
        id: "12345",
        name: "Test Course",
        courseCode: "TEST101",
      });

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockUsersData,
      );

      const result = await findPeopleInCourse(params);

      expect(mockListCourses).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        enrollmentState: "all",
      });

      expect(result).toHaveLength(2);
    });

    test("filters people by enrollment type", async () => {
      const params: FindPeopleParams = {
        ...mockParams,
        courseId: "12345",
        enrollmentType: "student",
      };

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockUsersData,
      );

      await findPeopleInCourse(params);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/users",
        {
          per_page: "100",
          enrollment_state: "active",
          enrollment_type: "student",
          include: ["enrollments", "avatar_url"],
        },
      );
    });

    test("filters people by enrollment state", async () => {
      const params: FindPeopleParams = {
        ...mockParams,
        courseId: "12345",
        enrollmentState: "active",
      };

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockUsersData,
      );

      await findPeopleInCourse(params);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/users",
        {
          per_page: "100",
          enrollment_state: "active",
          include: ["enrollments", "avatar_url"],
        },
      );
    });

    test("includes additional user information", async () => {
      const params: FindPeopleParams = {
        ...mockParams,
        courseId: "12345",
        include: ["avatar_url", "bio"],
      };

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockUsersData,
      );

      await findPeopleInCourse(params);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/users",
        {
          per_page: "100",
          enrollment_state: "active",
          include: ["avatar_url", "bio"],
        },
      );
    });

    test("throws error when course not found by name", async () => {
      const params: FindPeopleParams = {
        ...mockParams,
        courseName: "Nonexistent Course",
      };

      mockListCourses.mockResolvedValue([]);

      const mockFindBestMatch = await import("@/lib/search");
      vi.mocked(mockFindBestMatch.findBestMatch).mockReturnValue(null);

      await expect(findPeopleInCourse(params)).rejects.toThrow(
        "Could not find a course with the name",
      );
    });

    test("throws error when neither courseId nor courseName provided", async () => {
      const params: FindPeopleParams = {
        ...mockParams,
      };

      await expect(findPeopleInCourse(params)).rejects.toThrow(
        "Either courseId or courseName must be provided",
      );
    });
  });

  describe("searchRecipients", () => {
    const mockRecipientsData = [
      {
        id: "user_1",
        name: "John Doe",
        full_name: "John Michael Doe",
        avatar_url: "https://example.com/avatar1.jpg",
        pronouns: "he/him",
        common_courses: {
          "12345": ["StudentEnrollment"],
        },
      },
      {
        id: "course_12345",
        name: "Test Course",
        user_count: 25,
        type: "context",
      },
    ];

    test("searches for message recipients", async () => {
      const params: SearchRecipientsParams = {
        ...mockParams,
        search: "John",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockRecipientsData,
      } as any);

      const result = await searchRecipients(params);

      expect(mockCallCanvasAPI.callCanvasAPI).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        method: "GET",
        apiPath: "/api/v1/search/recipients",
        params: {
          search: "John",
          per_page: "100",
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "user_1",
        name: "John Doe",
        fullName: "John Michael Doe",
        avatarUrl: "https://example.com/avatar1.jpg",
        pronouns: "he/him",
        commonCourses: {
          "12345": ["StudentEnrollment"],
        },
      });
    });

    test("searches recipients with context filter", async () => {
      const params: SearchRecipientsParams = {
        ...mockParams,
        search: "test",
        context: "course_12345",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockRecipientsData,
      } as any);

      await searchRecipients(params);

      expect(mockCallCanvasAPI.callCanvasAPI).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        method: "GET",
        apiPath: "/api/v1/search/recipients",
        params: {
          search: "test",
          context: "course_12345",
          per_page: "100",
        },
      });
    });

    test("handles API errors gracefully", async () => {
      const params: SearchRecipientsParams = {
        ...mockParams,
        search: "test",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any);

      await expect(searchRecipients(params)).rejects.toThrow(
        "Failed to search recipients:",
      );
    });
  });

  describe("getUserProfile", () => {
    const mockUserProfileData = {
      id: 1,
      name: "John Doe",
      short_name: "John",
      sortable_name: "Doe, John",
      avatar_url: "https://example.com/avatar1.jpg",
      bio: "Student at Test University",
      pronouns: "he/him",
      locale: "en",
      calendar: {
        ics: "https://example.com/calendar.ics",
      },
    };

    test("gets user profile by ID", async () => {
      const params = {
        ...mockParams,
        userId: "123",
      };

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockUserProfileData,
      } as any);

      const result = await getUserProfile(params);

      expect(mockCallCanvasAPI.callCanvasAPI).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        method: "GET",
        apiPath: "/api/v1/users/123/profile",
        params: {
          include: ["avatar_url", "email", "bio", "pronouns"],
        },
      });

      expect(result).toMatchObject({
        id: 1,
        name: "John Doe",
        shortName: "John",
        sortableName: "Doe, John",
        avatarUrl: "https://example.com/avatar1.jpg",
        bio: "Student at Test University",
        pronouns: "he/him",
        locale: "en",
      });
    });

    test("throws error for missing user ID", async () => {
      const params = {
        ...mockParams,
        userId: "",
      };

      await expect(getUserProfile(params)).rejects.toThrow(
        "userId is required",
      );
    });
  });

  describe("getMyProfile", () => {
    const mockMyProfileData = {
      id: 1,
      name: "Current User",
      short_name: "Current",
      primary_email: "current@example.com",
      login_id: "current@example.com",
      avatar_url: "https://example.com/current-avatar.jpg",
      bio: "Current user bio",
      pronouns: "they/them",
      locale: "en-US",
      effective_locale: "en-US",
      calendar: {
        ics: "https://example.com/my-calendar.ics",
      },
    };

    test("gets current user profile", async () => {
      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockMyProfileData,
      } as any);

      const result = await getMyProfile(mockParams);

      expect(mockCallCanvasAPI.callCanvasAPI).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        method: "GET",
        apiPath: "/api/v1/users/self/profile",
        params: {
          include: ["avatar_url", "email", "bio", "pronouns"],
        },
      });

      expect(result).toMatchObject({
        id: 1,
        name: "Current User",
        shortName: "Current",
        email: "current@example.com",
        loginId: "current@example.com",
        avatarUrl: "https://example.com/current-avatar.jpg",
        bio: "Current user bio",
        pronouns: "they/them",
        locale: "en-US",
      });
    });

    test("throws error for missing required parameters", async () => {
      const invalidParams = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(getMyProfile(invalidParams)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });
  });
});