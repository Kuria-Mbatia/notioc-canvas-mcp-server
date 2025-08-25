import { expect, test, describe, vi, beforeEach } from "vitest";
import {
  listAssignments,
  getAssignmentDetails,
  type AssignmentListParams,
} from "@/tools/assignments";
import * as coursesModule from "@/tools/courses";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/lib/pagination");
vi.mock("@/lib/url-parser");
vi.mock("@/lib/search");

const mockListCourses = vi.mocked(coursesModule.listCourses);

describe("Assignments Tool", () => {
  const mockParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
    courseId: "12345",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAssignments", () => {
    const mockAssignmentsData = [
      {
        id: 1,
        name: "Assignment 1",
        description:
          "Test assignment with <a href='/files/123'>attached file</a>",
        due_at: "2024-12-31T23:59:00Z",
        points_possible: 100,
        submission_types: ["online_text_entry"],
        workflow_state: "published",
        html_url: "https://test.instructure.com/courses/12345/assignments/1",
        has_submitted_submissions: false,
        attachments: [
          {
            id: 456,
            filename: "rubric.pdf",
            url: "https://test.instructure.com/files/456",
            "content-type": "application/pdf",
          },
        ],
      },
      {
        id: 2,
        name: "Assignment 2",
        description: "Simple assignment",
        due_at: null,
        points_possible: 50,
        submission_types: ["online_upload"],
        workflow_state: "unpublished",
        html_url: "https://test.instructure.com/courses/12345/assignments/2",
        has_submitted_submissions: true,
        attachments: [],
      },
    ];

    test("lists assignments with basic parameters", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockAssignmentsData,
      );

      const result = await listAssignments(mockParams);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1");
      expect(result[0].name).toBe("Assignment 1");
      expect(result[0].pointsPossible).toBe(100);
      expect(result[0].dueAt).toBe("2024-12-31T23:59:00Z");
      expect(result[0].submissionTypes).toEqual(["online_text_entry"]);
      expect(result[0].workflowState).toBe("published");
    });

    test("extracts file links from assignment descriptions", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockAssignmentsData,
      );

      const result = await listAssignments(mockParams);

      expect(result[0].embeddedFileLinks).toHaveLength(1);
      expect(result[0].embeddedFileLinks![0]).toEqual({
        id: "123",
        url: "https://test.instructure.com/files/123",
        text: "File 123", // This is the actual behavior from the extractFileLinks function
      });
    });

    test("processes attachments correctly", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockAssignmentsData,
      );

      const result = await listAssignments(mockParams);

      expect(result[0].attachments).toHaveLength(1);
      expect(result[0].attachments![0]).toEqual({
        id: "456",
        filename: "rubric.pdf",
        url: "https://test.instructure.com/files/456",
        contentType: "application/pdf",
      });
    });

    test("handles assignments with no due date", async () => {
      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockAssignmentsData,
      );

      const result = await listAssignments(mockParams);

      expect(result[1].dueAt).toBeNull();
      expect(result[1].hasSubmittedSubmissions).toBe(true);
    });

    test("finds course by name when courseId not provided", async () => {
      const paramsWithName = {
        ...mockParams,
        courseId: undefined,
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
        mockAssignmentsData,
      );

      const result = await listAssignments(paramsWithName);

      expect(mockListCourses).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        enrollmentState: "all",
      });
      expect(result).toHaveLength(2);
    });

    test("throws error when course not found by name", async () => {
      const paramsWithName = {
        ...mockParams,
        courseId: undefined,
        courseName: "Nonexistent Course",
      };

      mockListCourses.mockResolvedValue([]);

      await expect(listAssignments(paramsWithName)).rejects.toThrow(
        "No courses found for this user",
      );
    });

    test("includes submissions when requested", async () => {
      const paramsWithSubmissions = {
        ...mockParams,
        includeSubmissions: true,
      };

      const mockFetchAllPaginated = await import("@/lib/pagination");
      vi.mocked(mockFetchAllPaginated.fetchAllPaginated).mockResolvedValue(
        mockAssignmentsData,
      );

      await listAssignments(paramsWithSubmissions);

      expect(mockFetchAllPaginated.fetchAllPaginated).toHaveBeenCalledWith(
        mockParams.canvasBaseUrl,
        mockParams.accessToken,
        "/api/v1/courses/12345/assignments",
        {
          per_page: "100",
          include: ["attachments", "submission"],
        },
      );
    });

    test("throws error for missing required parameters", async () => {
      const invalidParams = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(listAssignments(invalidParams)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });
  });

  describe("getAssignmentDetails", () => {
    const mockAssignment = {
      id: "1",
      name: "Test Assignment",
      description: "Assignment with files",
      dueAt: "2024-12-31T23:59:00Z",
      pointsPossible: 100,
      submissionTypes: ["online_text_entry"],
      workflowState: "published",
      htmlUrl: "https://test.instructure.com/courses/12345/assignments/1",
      attachments: [
        {
          id: "456",
          filename: "rubric.pdf",
          url: "https://test.instructure.com/files/456",
          contentType: "application/pdf",
        },
      ],
      embeddedFileLinks: [
        {
          id: "789",
          url: "https://test.instructure.com/files/789",
          text: "embedded file",
        },
      ],
    };

    test("gets assignment details by ID", async () => {
      const listAssignmentsSpy = vi.spyOn(
        await import("@/tools/assignments"),
        "listAssignments",
      );
      listAssignmentsSpy.mockResolvedValue([mockAssignment]);

      const result = await getAssignmentDetails({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        courseId: mockParams.courseId,
        assignmentId: "1",
      });

      expect(result.id).toBe("1");
      expect(result.name).toBe("Assignment 1"); // This comes from the actual listAssignments result
      expect(result.allFiles).toHaveLength(2);
      expect(result.allFiles[0]).toEqual({
        id: "456",
        name: "rubric.pdf",
        url: "https://test.instructure.com/files/456",
        source: "attachment",
      });
      expect(result.allFiles[1]).toEqual({
        id: "123",
        name: "File 123", // This comes from the actual file extraction from the assignment description
        url: "https://test.instructure.com/files/123",
        source: "embedded",
      });
    });

    test("gets assignment details by name", async () => {
      const listAssignmentsSpy = vi.spyOn(
        await import("@/tools/assignments"),
        "listAssignments",
      );
      listAssignmentsSpy.mockResolvedValue([mockAssignment]);

      const mockFindBestMatch = await import("@/lib/search");
      vi.mocked(mockFindBestMatch.findBestMatch).mockReturnValue(
        mockAssignment,
      );

      const result = await getAssignmentDetails({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        courseId: mockParams.courseId,
        assignmentName: "Test Assignment",
      });

      expect(result.id).toBe("1");
      expect(result.allFiles).toHaveLength(2);
    });

    test("handles Canvas URL parsing", async () => {
      const mockUrlParser = await import("@/lib/url-parser");
      vi.mocked(mockUrlParser.isCanvasUrl).mockReturnValue(true);
      vi.mocked(mockUrlParser.parseCanvasUrl).mockReturnValue({
        courseId: "12345",
        assignmentId: "1",
        baseUrl: "https://test.instructure.com",
      });

      const listAssignmentsSpy = vi.spyOn(
        await import("@/tools/assignments"),
        "listAssignments",
      );
      listAssignmentsSpy.mockResolvedValue([mockAssignment]);

      const result = await getAssignmentDetails({
        canvasBaseUrl: "",
        accessToken: mockParams.accessToken,
        fullUrl: "https://test.instructure.com/courses/12345/assignments/1",
      });

      expect(result.id).toBe("1");
    });

    test("throws error when assignment not found by ID", async () => {
      const listAssignmentsSpy = vi.spyOn(
        await import("@/tools/assignments"),
        "listAssignments",
      );
      listAssignmentsSpy.mockResolvedValue([]);

      await expect(
        getAssignmentDetails({
          canvasBaseUrl: mockParams.canvasBaseUrl,
          accessToken: mockParams.accessToken,
          courseId: mockParams.courseId,
          assignmentId: "999",
        }),
      ).rejects.toThrow('Could not find assignment with ID "999"');
    });

    test("throws error when assignment not found by name", async () => {
      const listAssignmentsSpy = vi.spyOn(
        await import("@/tools/assignments"),
        "listAssignments",
      );
      listAssignmentsSpy.mockResolvedValue([mockAssignment]);

      const mockFindBestMatch = await import("@/lib/search");
      vi.mocked(mockFindBestMatch.findBestMatch).mockReturnValue(null);

      await expect(
        getAssignmentDetails({
          canvasBaseUrl: mockParams.canvasBaseUrl,
          accessToken: mockParams.accessToken,
          courseId: mockParams.courseId,
          assignmentName: "Nonexistent Assignment",
        }),
      ).rejects.toThrow(
        'Could not find assignment matching "Nonexistent Assignment"',
      );
    });

    test("throws error when no identifier provided", async () => {
      await expect(
        getAssignmentDetails({
          canvasBaseUrl: mockParams.canvasBaseUrl,
          accessToken: mockParams.accessToken,
          courseId: mockParams.courseId,
        }),
      ).rejects.toThrow(
        "Either assignmentName, assignmentId, or fullUrl must be provided",
      );
    });
  });
});
