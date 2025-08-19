import { expect, test, describe, vi, beforeEach } from "vitest";
import { getDashboardSummary, type DashboardParams } from "@/tools/dashboard";
import * as coursesModule from "@/tools/courses";
import * as assignmentsModule from "@/tools/assignments";
import * as discussionsModule from "@/tools/pages-discussions";

// Mock dependencies
vi.mock("@/tools/courses");
vi.mock("@/tools/assignments");
vi.mock("@/tools/pages-discussions");

const mockListCourses = vi.mocked(coursesModule.listCourses);
const mockListAssignments = vi.mocked(assignmentsModule.listAssignments);
const mockListDiscussions = vi.mocked(discussionsModule.listDiscussions);

describe("Dashboard Tool", () => {
  const mockParams: DashboardParams = {
    canvasBaseUrl: "https://test.instructure.com",
    accessToken: "test-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDashboardSummary", () => {
    const mockCourses = [
      { id: "1", name: "Math 101", courseCode: "MATH101" },
      { id: "2", name: "Physics 201", courseCode: "PHYS201" },
    ];

    const mockAssignments1 = [
      {
        id: "1",
        name: "Math Homework 1",
        description: "Algebra problems",
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        pointsPossible: 100,
        submissionTypes: ["online_text_entry"],
        workflowState: "published",
        htmlUrl: "https://test.instructure.com/courses/1/assignments/1",
        hasSubmittedSubmissions: false,
      },
      {
        id: "2",
        name: "Math Quiz 1",
        description: "Basic concepts",
        dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago (past due)
        pointsPossible: 50,
        submissionTypes: ["online_quiz"],
        workflowState: "published",
        htmlUrl: "https://test.instructure.com/courses/1/assignments/2",
        hasSubmittedSubmissions: false,
      },
      {
        id: "3",
        name: "Math Project",
        description: "Final project",
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
        pointsPossible: 200,
        submissionTypes: ["online_upload"],
        workflowState: "published",
        htmlUrl: "https://test.instructure.com/courses/1/assignments/3",
        hasSubmittedSubmissions: true, // Already submitted
      },
    ];

    const mockAssignments2 = [
      {
        id: "4",
        name: "Physics Lab 1",
        description: "Motion experiments",
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
        pointsPossible: 75,
        submissionTypes: ["online_upload"],
        workflowState: "published",
        htmlUrl: "https://test.instructure.com/courses/2/assignments/4",
        hasSubmittedSubmissions: false,
      },
    ];

    const mockAnnouncements1 = [
      {
        id: "1",
        title: "Math Class Update",
        message: "Important announcement about the upcoming exam",
        postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        author: "Prof. Smith",
        htmlUrl: "https://test.instructure.com/courses/1/discussion_topics/1",
        isAnnouncement: true,
      },
      {
        id: "2",
        title: "Office Hours",
        message: "Changed office hours for this week",
        postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        author: "Prof. Smith",
        htmlUrl: "https://test.instructure.com/courses/1/discussion_topics/2",
        isAnnouncement: true,
      },
    ];

    const mockAnnouncements2 = [
      {
        id: "3",
        title: "Physics Lab Safety",
        message: "Safety guidelines for lab work",
        postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        author: "Prof. Johnson",
        htmlUrl: "https://test.instructure.com/courses/2/discussion_topics/3",
        isAnnouncement: true,
      },
    ];

    test("aggregates dashboard summary from multiple courses", async () => {
      mockListCourses.mockResolvedValue(mockCourses);
      mockListAssignments
        .mockResolvedValueOnce(mockAssignments1)
        .mockResolvedValueOnce(mockAssignments2);
      mockListDiscussions
        .mockResolvedValueOnce(mockAnnouncements1)
        .mockResolvedValueOnce(mockAnnouncements2);

      const result = await getDashboardSummary(mockParams);

      expect(mockListCourses).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        enrollmentState: "active",
      });

      expect(mockListAssignments).toHaveBeenCalledTimes(2);
      expect(mockListDiscussions).toHaveBeenCalledTimes(2);

      // Should have 2 upcoming assignments (Math Homework 1 and Physics Lab 1)
      expect(result.upcomingAssignments).toHaveLength(2);
      expect(result.unreadAnnouncements).toHaveLength(3);
    });

    test("filters upcoming assignments correctly", async () => {
      mockListCourses.mockResolvedValue(mockCourses);
      mockListAssignments
        .mockResolvedValueOnce(mockAssignments1)
        .mockResolvedValueOnce(mockAssignments2);
      mockListDiscussions
        .mockResolvedValueOnce(mockAnnouncements1)
        .mockResolvedValueOnce(mockAnnouncements2);

      const result = await getDashboardSummary(mockParams);

      // Should exclude past due assignments and submitted assignments
      expect(result.upcomingAssignments).toHaveLength(2);
      expect(result.upcomingAssignments[0].name).toBe("Physics Lab 1"); // Closer due date
      expect(result.upcomingAssignments[1].name).toBe("Math Homework 1");
      
      // Should include course names
      expect(result.upcomingAssignments[0].courseName).toBe("Physics 201");
      expect(result.upcomingAssignments[1].courseName).toBe("Math 101");
    });

    test("sorts upcoming assignments by due date", async () => {
      mockListCourses.mockResolvedValue(mockCourses);
      mockListAssignments
        .mockResolvedValueOnce(mockAssignments1)
        .mockResolvedValueOnce(mockAssignments2);
      mockListDiscussions
        .mockResolvedValueOnce(mockAnnouncements1)
        .mockResolvedValueOnce(mockAnnouncements2);

      const result = await getDashboardSummary(mockParams);

      // Physics Lab 1 is due in 3 days, Math Homework 1 in 7 days
      expect(result.upcomingAssignments[0].name).toBe("Physics Lab 1");
      expect(result.upcomingAssignments[1].name).toBe("Math Homework 1");
    });

    test("sorts announcements by posted date (most recent first)", async () => {
      mockListCourses.mockResolvedValue(mockCourses);
      mockListAssignments
        .mockResolvedValueOnce(mockAssignments1)
        .mockResolvedValueOnce(mockAssignments2);
      mockListDiscussions
        .mockResolvedValueOnce(mockAnnouncements1)
        .mockResolvedValueOnce(mockAnnouncements2);

      const result = await getDashboardSummary(mockParams);

      // Should be sorted by most recent first
      expect(result.unreadAnnouncements[0].title).toBe("Math Class Update"); // 1 day ago
      expect(result.unreadAnnouncements[1].title).toBe("Physics Lab Safety"); // 2 days ago
      expect(result.unreadAnnouncements[2].title).toBe("Office Hours"); // 3 days ago
    });

    test("includes course names in results", async () => {
      mockListCourses.mockResolvedValue(mockCourses);
      mockListAssignments
        .mockResolvedValueOnce(mockAssignments1)
        .mockResolvedValueOnce(mockAssignments2);
      mockListDiscussions
        .mockResolvedValueOnce(mockAnnouncements1)
        .mockResolvedValueOnce(mockAnnouncements2);

      const result = await getDashboardSummary(mockParams);

      expect(result.upcomingAssignments[0]).toHaveProperty("courseName");
      expect(result.unreadAnnouncements[0]).toHaveProperty("courseName");
      
      const mathAssignment = result.upcomingAssignments.find(a => a.name === "Math Homework 1");
      expect(mathAssignment?.courseName).toBe("Math 101");
      
      const mathAnnouncement = result.unreadAnnouncements.find(a => a.title === "Math Class Update");
      expect(mathAnnouncement?.courseName).toBe("Math 101");
    });

    test("handles courses with no assignments or announcements", async () => {
      mockListCourses.mockResolvedValue(mockCourses);
      mockListAssignments
        .mockResolvedValueOnce([]) // No assignments for first course
        .mockResolvedValueOnce(mockAssignments2);
      mockListDiscussions
        .mockResolvedValueOnce([]) // No announcements for first course
        .mockResolvedValueOnce(mockAnnouncements2);

      const result = await getDashboardSummary(mockParams);

      expect(result.upcomingAssignments).toHaveLength(1);
      expect(result.unreadAnnouncements).toHaveLength(1);
      expect(result.upcomingAssignments[0].courseName).toBe("Physics 201");
    });

    test("handles API errors for individual courses gracefully", async () => {
      mockListCourses.mockResolvedValue(mockCourses);
      mockListAssignments
        .mockRejectedValueOnce(new Error("Assignment API Error"))
        .mockResolvedValueOnce(mockAssignments2);
      mockListDiscussions
        .mockRejectedValueOnce(new Error("Discussion API Error"))
        .mockResolvedValueOnce(mockAnnouncements2);

      const result = await getDashboardSummary(mockParams);

      // Should still work with data from second course
      expect(result.upcomingAssignments).toHaveLength(1);
      expect(result.unreadAnnouncements).toHaveLength(1);
      expect(result.upcomingAssignments[0].courseName).toBe("Physics 201");
    });

    test("handles empty courses list", async () => {
      mockListCourses.mockResolvedValue([]);

      const result = await getDashboardSummary(mockParams);

      expect(result.upcomingAssignments).toHaveLength(0);
      expect(result.unreadAnnouncements).toHaveLength(0);
      expect(mockListAssignments).not.toHaveBeenCalled();
      expect(mockListDiscussions).not.toHaveBeenCalled();
    });

    test("limits announcements to 10 most recent", async () => {
      const manyAnnouncements = Array.from({ length: 15 }, (_, i) => ({
        id: String(i + 1),
        title: `Announcement ${i + 1}`,
        message: `Message ${i + 1}`,
        postedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        author: "Prof. Test",
        htmlUrl: `https://test.instructure.com/courses/1/discussion_topics/${i + 1}`,
        isAnnouncement: true,
      }));

      mockListCourses.mockResolvedValue([mockCourses[0]]);
      mockListAssignments.mockResolvedValueOnce([]);
      mockListDiscussions.mockResolvedValueOnce(manyAnnouncements);

      const result = await getDashboardSummary(mockParams);

      expect(result.unreadAnnouncements).toHaveLength(10);
      expect(result.unreadAnnouncements[0].title).toBe("Announcement 1"); // Most recent
    });

    test("throws error for missing required parameters", async () => {
      const invalidParams = {
        canvasBaseUrl: "",
        accessToken: "test-token",
      };

      await expect(getDashboardSummary(invalidParams)).rejects.toThrow(
        "Missing Canvas URL or Access Token",
      );
    });

    test("handles course listing errors", async () => {
      mockListCourses.mockRejectedValue(new Error("Courses API Error"));

      await expect(getDashboardSummary(mockParams)).rejects.toThrow(
        "Failed to get dashboard summary: Courses API Error",
      );
    });

    test("calls APIs with correct parameters", async () => {
      mockListCourses.mockResolvedValue(mockCourses);
      mockListAssignments
        .mockResolvedValueOnce(mockAssignments1)
        .mockResolvedValueOnce(mockAssignments2);
      mockListDiscussions
        .mockResolvedValueOnce(mockAnnouncements1)
        .mockResolvedValueOnce(mockAnnouncements2);

      await getDashboardSummary(mockParams);

      expect(mockListAssignments).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        courseId: "1",
        includeSubmissions: true,
      });

      expect(mockListDiscussions).toHaveBeenCalledWith({
        canvasBaseUrl: mockParams.canvasBaseUrl,
        accessToken: mockParams.accessToken,
        courseId: "1",
        onlyAnnouncements: true,
      });
    });
  });
});