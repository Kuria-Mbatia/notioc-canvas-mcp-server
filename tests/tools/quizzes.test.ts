import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  listQuizzes,
  getQuizDetails,
  getQuizSubmissions,
  type ListQuizzesParams,
  type QuizDetailsParams,
  type QuizSubmissionsParams,
} from "@/tools/quizzes";
import * as coursesModule from "@/tools/courses";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/lib/pagination");
vi.mock("@/lib/canvas-api");
vi.mock("@/lib/search");

const mockListCourses = vi.mocked(coursesModule.listCourses);

describe("Quizzes Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listQuizzes", () => {
    const mockQuizzesData = [
      {
        id: 1,
        title: "Chapter 1 Quiz",
        description: "Quiz on chapter 1 material",
        html_url: "https://test.instructure.com/courses/12345/quizzes/1",
        mobile_url: "https://test.instructure.com/courses/12345/quizzes/1?force_user=1",
        preview_url: "https://test.instructure.com/courses/12345/quizzes/1/preview",
        quiz_type: "assignment",
        assignment_group_id: 101,
        time_limit: 60,
        shuffle_answers: true,
        hide_results: "always",
        show_correct_answers: false,
        allowed_attempts: 2,
        scoring_policy: "keep_highest",
        one_question_at_a_time: true,
        cant_go_back: false,
        due_at: "2024-02-15T23:59:00Z",
        lock_at: "2024-02-16T00:00:00Z",
        unlock_at: "2024-02-10T00:00:00Z",
        published: true,
        unpublishable: false,
        locked_for_user: false,
        points_possible: 50,
        question_count: 10,
        question_types: ["multiple_choice_question", "true_false_question"],
        has_access_code: false,
        post_to_sis: true,
      },
      {
        id: 2,
        title: "Final Exam",
        description: "Comprehensive final exam",
        html_url: "https://test.instructure.com/courses/12345/quizzes/2",
        quiz_type: "assignment",
        time_limit: 120,
        allowed_attempts: 1,
        scoring_policy: "keep_highest",
        published: true,
        unpublishable: false,
        locked_for_user: true,
        lock_explanation: "This quiz is locked until the due date",
        points_possible: 100,
        question_count: 25,
        question_types: ["multiple_choice_question", "essay_question", "short_answer_question"],
        has_access_code: true,
        post_to_sis: true,
      },
    ];

    const mockCourses = [
      { id: "12345", name: "Test Course", courseCode: "TEST101" },
    ];

    test("lists quizzes for course by ID", async () => {
      const params: ListQuizzesParams = {
        ...mockParams,
        courseId: "12345",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockQuizzesData,
      );

      const result = await listQuizzes(params);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/quizzes",
        { per_page: "100" },
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        title: "Chapter 1 Quiz",
        quizType: "assignment",
        timeLimit: 60,
        allowedAttempts: 2,
        pointsPossible: 50,
        questionCount: 10,
        published: true,
        lockedForUser: false,
      });
    });

    test("filters quizzes by search term", async () => {
      const params: ListQuizzesParams = {
        ...mockParams,
        courseId: "12345",
        searchTerm: "final",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockQuizzesData,
      );

      const result = await listQuizzes(params);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Final Exam");
    });

    test("handles course not found error", async () => {
      const params: ListQuizzesParams = {
        ...mockParams,
        courseName: "Nonexistent Course",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFindBestMatch = await import("@/lib/search");
      vi.mocked(mockFindBestMatch.findBestMatch).mockReturnValue(null);

      await expect(listQuizzes(params)).rejects.toThrow(
        "Could not find a course with the name",
      );
    });

    test("handles missing required parameters", async () => {
      const params = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(listQuizzes(params)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });
  });

  describe("getQuizDetails", () => {
    const mockQuizData = {
      id: 1,
      title: "Chapter 1 Quiz",
      description: "Quiz on chapter 1 material",
      html_url: "https://test.instructure.com/courses/12345/quizzes/1",
      quiz_type: "assignment",
      time_limit: 60,
      allowed_attempts: 2,
      points_possible: 50,
      question_count: 10,
      published: true,
      locked_for_user: false,
      assignment: {
        id: 201,
        name: "Chapter 1 Quiz",
        points_possible: 50,
        due_at: "2024-02-15T23:59:00Z",
      },
    };

    const mockCourses = [
      { id: "12345", name: "Test Course", courseCode: "TEST101" },
    ];

    test("gets quiz details by ID", async () => {
      const params: QuizDetailsParams = {
        ...mockParams,
        courseId: "12345",
        quizId: "1",
        include: ["assignment"],
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockCallCanvasAPI = await import("@/lib/canvas-api");
      vi.mocked(mockCallCanvasAPI.callCanvasAPI).mockResolvedValue({
        ok: true,
        json: async () => mockQuizData,
      } as any);

      const result = await getQuizDetails(params);

      expect(mockCallCanvasAPI.callCanvasAPI).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        method: "GET",
        apiPath: "/api/v1/courses/12345/quizzes/1",
        params: { include: ["assignment"] },
      });

      expect(result).toMatchObject({
        id: 1,
        title: "Chapter 1 Quiz",
        timeLimit: 60,
        allowedAttempts: 2,
        pointsPossible: 50,
        questionCount: 10,
      });
    });

    test("handles missing quiz ID", async () => {
      const params: QuizDetailsParams = {
        ...mockParams,
        courseId: "12345",
        quizId: "",
      };

      await expect(getQuizDetails(params)).rejects.toThrow(
        "quizId is required",
      );
    });
  });

  describe("getQuizSubmissions", () => {
    const mockSubmissionsData = [
      {
        id: 1,
        quiz_id: 1,
        user_id: 123,
        submission_id: 456,
        started_at: "2024-02-12T10:00:00Z",
        finished_at: "2024-02-12T10:45:00Z",
        end_at: "2024-02-12T11:00:00Z",
        attempt: 1,
        extra_attempts: 0,
        extra_time: 0,
        manually_unlocked: false,
        time_spent: 2700,
        score: 45,
        score_before_regrade: null,
        kept_score: 45,
        fudge_points: 0,
        has_seen_results: true,
        workflow_state: "complete",
        overdue_and_needs_submission: false,
      },
      {
        id: 2,
        quiz_id: 1,
        user_id: 124,
        submission_id: 457,
        started_at: "2024-02-12T14:00:00Z",
        finished_at: null,
        end_at: null,
        attempt: 1,
        time_spent: 1800,
        score: null,
        kept_score: null,
        workflow_state: "untaken",
        overdue_and_needs_submission: false,
      },
    ];

    const mockCourses = [
      { id: "12345", name: "Test Course", courseCode: "TEST101" },
    ];

    test("gets quiz submissions", async () => {
      const params: QuizSubmissionsParams = {
        ...mockParams,
        courseId: "12345",
        quizId: "1",
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockSubmissionsData,
      );

      const result = await getQuizSubmissions(params);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/quizzes/1/submissions",
        { per_page: "100", include: ["submission", "user"] },
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        quizId: 1,
        userId: 123,
        attempt: 1,
        score: 45,
        workflowState: "complete",
        timeSpent: 2700,
      });
    });

    test("includes additional data when requested", async () => {
      const params: QuizSubmissionsParams = {
        ...mockParams,
        courseId: "12345",
        quizId: "1",
        include: ["submission", "user"],
      };

      mockListCourses.mockResolvedValue(mockCourses);

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockSubmissionsData,
      );

      await getQuizSubmissions(params);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/quizzes/1/submissions",
        { per_page: "100", include: ["submission", "user"] },
      );
    });

    test("handles missing quiz ID", async () => {
      const params: QuizSubmissionsParams = {
        ...mockParams,
        courseId: "12345",
        quizId: "",
      };

      await expect(getQuizSubmissions(params)).rejects.toThrow(
        "quizId is required",
      );
    });
  });
});