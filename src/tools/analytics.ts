// MCP Tool: Advanced Canvas Grade Analytics & What-If Calculations
// Phase 2: Native scoring calculations and grade projections for Claude

import { callCanvasAPI } from "../lib/canvas-api.js";
import { fetchAllPaginated } from "../lib/pagination.js";
import { listCourses } from "./courses.js";
import { getGrades, getGradebookCategories } from "./grades.js";
import { findBestMatch } from "../lib/search.js";
import { logger } from "../lib/logger.js";

export interface CourseAnalyticsParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  userId?: string; // Defaults to 'self'
}

export interface WhatIfScenarioParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  targetGrade?: number; // Desired final grade percentage
  targetLetterGrade?: string; // Desired letter grade (A, B, C, etc.)
  userId?: string; // Defaults to 'self'
}

export interface GradeTrendsParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  userId?: string; // Defaults to 'self'
  daysBack?: number; // How many days back to analyze (default: 90)
}

export interface CourseAnalyticsInfo {
  courseId: string;
  courseName: string;
  currentGrade: {
    percentage: number | null;
    letterGrade: string | null;
    pointsEarned: number;
    pointsPossible: number;
  };
  projectedGrade: {
    percentage: number | null;
    letterGrade: string | null;
    pointsEarned: number;
    pointsPossible: number;
  };
  categoryBreakdown: Array<{
    categoryName: string;
    weight: number;
    currentScore: number | null;
    pointsEarned: number;
    pointsPossible: number;
    assignmentsCompleted: number;
    assignmentsTotal: number;
    dropLowest: number;
    dropHighest: number;
  }>;
  upcomingAssignments: Array<{
    name: string;
    dueDate: string | null;
    points: number;
    category: string;
    daysUntilDue: number | null;
  }>;
  statistics: {
    assignmentsCompleted: number;
    assignmentsTotal: number;
    completionRate: number;
    averageScore: number | null;
    gradeImprovement: number | null; // Trend over time
  };
}

export interface WhatIfScenarioInfo {
  courseId: string;
  courseName: string;
  currentGrade: number | null;
  targetGrade: number;
  targetLetterGrade: string;
  isAchievable: boolean;
  requiredAverage: number | null; // What average is needed on remaining work
  remainingPoints: number;
  remainingAssignments: number;
  scenarios: Array<{
    description: string;
    requiredScore: number;
    difficulty: "Easy" | "Moderate" | "Challenging" | "Nearly Impossible";
    explanation: string;
  }>;
  recommendations: string[];
}

export interface GradeTrendsInfo {
  courseId: string;
  courseName: string;
  trendAnalysis: {
    overallTrend: "Improving" | "Declining" | "Stable" | "Insufficient Data";
    trendPercentage: number | null;
    confidence: "High" | "Medium" | "Low";
  };
  performanceByCategory: Array<{
    categoryName: string;
    averageScore: number;
    trend: "Improving" | "Declining" | "Stable";
    recentAssignments: number;
  }>;
  timelineData: Array<{
    date: string;
    assignmentName: string;
    score: number;
    pointsPossible: number;
    percentage: number;
    category: string;
  }>;
  insights: string[];
}

/**
 * Calculate comprehensive course analytics including current grades, projections, and breakdowns
 */
export async function calculateCourseAnalytics(
  params: CourseAnalyticsParams,
): Promise<CourseAnalyticsInfo> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    userId = "self",
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  if (!courseId && !courseName) {
    throw new Error("Either courseId or courseName must be provided");
  }

  try {
    // Find course if needed
    if (courseName && !courseId) {
      const courses = await listCourses({
        canvasBaseUrl,
        accessToken,
        enrollmentState: "all",
      });
      const matchedCourse = findBestMatch(courseName, courses, [
        "name",
        "courseCode",
        "nickname",
      ]);
      if (!matchedCourse) {
        throw new Error(`Could not find course matching "${courseName}"`);
      }
      courseId = matchedCourse.id;
    }

    logger.info(`Calculating analytics for course ${courseId}`);

    // Get current grades and assignments
    const [gradeData, categories, assignments] = await Promise.all([
      getGrades({ canvasBaseUrl, accessToken, courseId, userId }),
      getGradebookCategories({ canvasBaseUrl, accessToken, courseId }),
      fetchAllPaginated<any>(
        canvasBaseUrl,
        accessToken,
        `/api/v1/courses/${courseId}/assignments`,
        { per_page: "100" },
      ),
    ]);

    const courseGrades = gradeData[0]; // First course in results
    if (!courseGrades) {
      throw new Error("No grade data found for course");
    }

    // Calculate category breakdowns
    const categoryBreakdown = categories.map((category) => {
      const categoryAssignments = assignments.filter(
        (a: any) =>
          a.assignment_group_id &&
          String(a.assignment_group_id) === String(category.name), // This needs fixing
      );

      const completedAssignments =
        courseGrades.assignments?.filter(
          (a: any) =>
            categoryAssignments.some(
              (ca: any) => String(ca.id) === a.assignmentId,
            ) && a.score !== null,
        ) || [];

      const pointsEarned = completedAssignments.reduce(
        (sum: number, a: any) => sum + (a.score || 0),
        0,
      );
      const pointsPossible = completedAssignments.reduce(
        (sum: number, a: any) => sum + a.pointsPossible,
        0,
      );

      return {
        categoryName: category.name,
        weight: category.weight,
        currentScore:
          pointsPossible > 0 ? (pointsEarned / pointsPossible) * 100 : null,
        pointsEarned,
        pointsPossible,
        assignmentsCompleted: completedAssignments.length,
        assignmentsTotal: categoryAssignments.length,
        dropLowest: category.dropLowest,
        dropHighest: category.dropHighest,
      };
    });

    // Get upcoming assignments
    const now = new Date();
    const upcomingAssignments = assignments
      .filter((a: any) => a.due_at && new Date(a.due_at) > now)
      .sort(
        (a: any, b: any) =>
          new Date(a.due_at).getTime() - new Date(b.due_at).getTime(),
      )
      .slice(0, 10) // Next 10 assignments
      .map((a: any) => {
        const dueDate = new Date(a.due_at);
        const daysUntilDue = Math.ceil(
          (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          name: a.name,
          dueDate: a.due_at,
          points: a.points_possible || 0,
          category: a.assignment_group?.name || "Unknown",
          daysUntilDue,
        };
      });

    // Calculate statistics
    const completedAssignments =
      courseGrades.assignments?.filter((a: any) => a.score !== null) || [];
    const totalAssignments = assignments.length;
    const completionRate =
      totalAssignments > 0
        ? (completedAssignments.length / totalAssignments) * 100
        : 0;

    const averageScore =
      completedAssignments.length > 0
        ? completedAssignments.reduce((sum: number, a: any) => {
            const percentage =
              a.pointsPossible > 0 ? (a.score / a.pointsPossible) * 100 : 0;
            return sum + percentage;
          }, 0) / completedAssignments.length
        : null;

    // Calculate projected grade (assuming current performance continues)
    const totalPointsPossible = assignments.reduce(
      (sum: any, a: any) => sum + (a.points_possible || 0),
      0,
    );
    const currentPointsEarned = completedAssignments.reduce(
      (sum: number, a: any) => sum + (a.score || 0),
      0,
    );
    const remainingPoints =
      totalPointsPossible -
      completedAssignments.reduce(
        (sum: number, a: any) => sum + a.pointsPossible,
        0,
      );

    let projectedPointsEarned = currentPointsEarned;
    if (averageScore !== null && remainingPoints > 0) {
      projectedPointsEarned += (remainingPoints * averageScore) / 100;
    }

    const projectedPercentage =
      totalPointsPossible > 0
        ? (projectedPointsEarned / totalPointsPossible) * 100
        : null;

    const result: CourseAnalyticsInfo = {
      courseId: String(courseId),
      courseName: courseGrades.courseName,
      currentGrade: {
        percentage: courseGrades.currentScore ?? null,
        letterGrade: courseGrades.finalGrade ?? null,
        pointsEarned: currentPointsEarned,
        pointsPossible: completedAssignments.reduce(
          (sum: number, a: any) => sum + a.pointsPossible,
          0,
        ),
      },
      projectedGrade: {
        percentage: projectedPercentage,
        letterGrade: projectedPercentage
          ? convertToLetterGrade(projectedPercentage)
          : null,
        pointsEarned: projectedPointsEarned,
        pointsPossible: totalPointsPossible,
      },
      categoryBreakdown,
      upcomingAssignments,
      statistics: {
        assignmentsCompleted: completedAssignments.length,
        assignmentsTotal: totalAssignments,
        completionRate,
        averageScore,
        gradeImprovement: null, // Would need historical data
      },
    };

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to calculate course analytics: ${error.message}`);
    } else {
      throw new Error("Failed to calculate course analytics: Unknown error");
    }
  }
}

/**
 * Generate what-if scenarios for achieving target grades
 */
export async function generateWhatIfScenarios(
  params: WhatIfScenarioParams,
): Promise<WhatIfScenarioInfo> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    targetGrade,
    targetLetterGrade,
    userId = "self",
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  if (!courseId && !courseName) {
    throw new Error("Either courseId or courseName must be provided");
  }

  // Convert letter grade to percentage if needed
  if (targetLetterGrade && !targetGrade) {
    targetGrade = convertLetterGradeToPercentage(targetLetterGrade);
  }

  if (!targetGrade) {
    throw new Error(
      "Either targetGrade (percentage) or targetLetterGrade must be provided",
    );
  }

  try {
    // Get current analytics
    const analytics = await calculateCourseAnalytics({
      canvasBaseUrl,
      accessToken,
      courseId,
      courseName,
      userId,
    });

    const currentPercentage = analytics.currentGrade.percentage;
    const totalPointsPossible = analytics.projectedGrade.pointsPossible;
    const currentPointsEarned = analytics.currentGrade.pointsEarned;
    const remainingPointsPossible =
      totalPointsPossible - analytics.currentGrade.pointsPossible;

    // Calculate what's needed
    const targetPoints = (targetGrade / 100) * totalPointsPossible;
    const pointsNeeded = targetPoints - currentPointsEarned;
    const requiredAverage =
      remainingPointsPossible > 0
        ? (pointsNeeded / remainingPointsPossible) * 100
        : null;

    const isAchievable = requiredAverage !== null && requiredAverage <= 100;

    // Generate scenarios
    const scenarios = [];

    if (requiredAverage !== null) {
      if (requiredAverage <= 85) {
        scenarios.push({
          description: `Maintain current performance and score ${requiredAverage.toFixed(1)}% average on remaining work`,
          requiredScore: requiredAverage,
          difficulty: "Easy" as const,
          explanation: `This is very achievable with consistent effort.`,
        });
      } else if (requiredAverage <= 95) {
        scenarios.push({
          description: `Score ${requiredAverage.toFixed(1)}% average on all remaining assignments`,
          requiredScore: requiredAverage,
          difficulty: "Moderate" as const,
          explanation: `This requires strong performance but is definitely doable.`,
        });
      } else if (requiredAverage <= 100) {
        scenarios.push({
          description: `Score ${requiredAverage.toFixed(1)}% average on all remaining assignments`,
          requiredScore: requiredAverage,
          difficulty: "Challenging" as const,
          explanation: `This requires near-perfect performance on all remaining work.`,
        });
      } else {
        scenarios.push({
          description: `Would need ${requiredAverage.toFixed(1)}% average on remaining work`,
          requiredScore: requiredAverage,
          difficulty: "Nearly Impossible" as const,
          explanation: `This target may not be mathematically achievable given current standing.`,
        });
      }

      // Alternative scenarios
      if (requiredAverage > 90) {
        const lowerTarget = targetGrade - 5;
        const lowerTargetPoints = (lowerTarget / 100) * totalPointsPossible;
        const lowerPointsNeeded = lowerTargetPoints - currentPointsEarned;
        const lowerRequiredAverage =
          (lowerPointsNeeded / remainingPointsPossible) * 100;

        scenarios.push({
          description: `Alternative: Target ${lowerTarget}% grade instead`,
          requiredScore: lowerRequiredAverage,
          difficulty:
            lowerRequiredAverage <= 90
              ? ("Moderate" as const)
              : ("Challenging" as const),
          explanation: `A slightly lower target might be more realistic.`,
        });
      }
    }

    // Generate recommendations
    const recommendations = [];
    if (isAchievable) {
      if (requiredAverage! <= 85) {
        recommendations.push(
          "Your target grade is very achievable with consistent effort.",
        );
        recommendations.push(
          "Focus on understanding concepts rather than just completing assignments.",
        );
      } else if (requiredAverage! <= 95) {
        recommendations.push(
          "Your target grade is achievable with strong performance.",
        );
        recommendations.push(
          "Consider forming study groups or attending office hours.",
        );
        recommendations.push(
          "Review assignment rubrics carefully to maximize points.",
        );
      } else {
        recommendations.push(
          "Your target grade requires near-perfect performance.",
        );
        recommendations.push("Prioritize high-point value assignments.");
        recommendations.push(
          "Seek help from instructors and tutors immediately.",
        );
        recommendations.push(
          "Consider extra credit opportunities if available.",
        );
      }
    } else {
      recommendations.push(
        "Unfortunately, this target grade may not be mathematically achievable.",
      );
      recommendations.push(
        "Consider adjusting your target or discussing options with your instructor.",
      );
      recommendations.push(
        "Focus on learning and doing your best on remaining assignments.",
      );
    }

    // Add upcoming assignment insights
    const highValueAssignments = analytics.upcomingAssignments
      .filter((a) => a.points >= 50)
      .slice(0, 3);

    if (highValueAssignments.length > 0) {
      recommendations.push(
        `Focus especially on these high-value upcoming assignments: ${highValueAssignments.map((a) => a.name).join(", ")}`,
      );
    }

    const result: WhatIfScenarioInfo = {
      courseId: analytics.courseId,
      courseName: analytics.courseName,
      currentGrade: currentPercentage,
      targetGrade,
      targetLetterGrade: targetLetterGrade || convertToLetterGrade(targetGrade),
      isAchievable,
      requiredAverage,
      remainingPoints: remainingPointsPossible,
      remainingAssignments: analytics.upcomingAssignments.length,
      scenarios,
      recommendations,
    };

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate what-if scenarios: ${error.message}`);
    } else {
      throw new Error("Failed to generate what-if scenarios: Unknown error");
    }
  }
}

/**
 * Analyze grade trends over time
 */
export async function getGradeTrends(
  params: GradeTrendsParams,
): Promise<GradeTrendsInfo> {
  let {
    canvasBaseUrl,
    accessToken,
    courseId,
    courseName,
    userId = "self",
    daysBack = 90,
  } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error("Missing Canvas URL or Access Token");
  }

  if (!courseId && !courseName) {
    throw new Error("Either courseId or courseName must be provided");
  }

  try {
    // Get detailed grade data
    const gradeData = await getGrades({
      canvasBaseUrl,
      accessToken,
      courseId,
      courseName,
      userId,
      includeSubmissions: true,
    });

    const courseGrades = gradeData[0];
    if (!courseGrades || !courseGrades.assignments) {
      throw new Error("No detailed assignment data found");
    }

    // Filter to assignments with grades from the specified time period
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const recentAssignments = courseGrades.assignments
      .filter(
        (a: any) =>
          a.gradedAt && new Date(a.gradedAt) > cutoffDate && a.score !== null,
      )
      .sort(
        (a: any, b: any) =>
          new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime(),
      );

    // Calculate timeline data
    const timelineData = recentAssignments.map((a: any) => ({
      date: a.gradedAt,
      assignmentName: a.assignmentName,
      score: a.score,
      pointsPossible: a.pointsPossible,
      percentage: a.pointsPossible > 0 ? (a.score / a.pointsPossible) * 100 : 0,
      category: "General", // Would need to map assignment groups
    }));

    // Calculate trend
    let overallTrend:
      | "Improving"
      | "Declining"
      | "Stable"
      | "Insufficient Data" = "Insufficient Data";
    let trendPercentage: number | null = null;
    let confidence: "High" | "Medium" | "Low" = "Low";

    if (timelineData.length >= 3) {
      const firstHalf = timelineData.slice(
        0,
        Math.floor(timelineData.length / 2),
      );
      const secondHalf = timelineData.slice(
        Math.floor(timelineData.length / 2),
      );

      const firstHalfAvg =
        firstHalf.reduce((sum, a) => sum + a.percentage, 0) / firstHalf.length;
      const secondHalfAvg =
        secondHalf.reduce((sum, a) => sum + a.percentage, 0) /
        secondHalf.length;

      trendPercentage = secondHalfAvg - firstHalfAvg;

      if (Math.abs(trendPercentage) < 2) {
        overallTrend = "Stable";
      } else if (trendPercentage > 0) {
        overallTrend = "Improving";
      } else {
        overallTrend = "Declining";
      }

      confidence =
        timelineData.length >= 6
          ? "High"
          : timelineData.length >= 4
            ? "Medium"
            : "Low";
    }

    // Generate insights
    const insights = [];
    if (overallTrend === "Improving") {
      insights.push(
        `Your grades are trending upward by ${trendPercentage!.toFixed(1)} percentage points.`,
      );
      insights.push(
        "Keep up the good work and maintain your current study habits.",
      );
    } else if (overallTrend === "Declining") {
      insights.push(
        `Your grades are trending downward by ${Math.abs(trendPercentage!).toFixed(1)} percentage points.`,
      );
      insights.push(
        "Consider reviewing your study strategies and seeking help if needed.",
      );
    } else if (overallTrend === "Stable") {
      insights.push(
        "Your grades are consistent, which shows reliable performance.",
      );
    }

    if (timelineData.length > 0) {
      const avgScore =
        timelineData.reduce((sum, a) => sum + a.percentage, 0) /
        timelineData.length;
      insights.push(
        `Your average score over the last ${daysBack} days is ${avgScore.toFixed(1)}%.`,
      );
    }

    const result: GradeTrendsInfo = {
      courseId: String(courseId),
      courseName: courseGrades.courseName,
      trendAnalysis: {
        overallTrend,
        trendPercentage,
        confidence,
      },
      performanceByCategory: [], // Would need category mapping
      timelineData,
      insights,
    };

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get grade trends: ${error.message}`);
    } else {
      throw new Error("Failed to get grade trends: Unknown error");
    }
  }
}

// Helper functions
function convertToLetterGrade(percentage: number): string {
  if (percentage >= 97) return "A+";
  if (percentage >= 93) return "A";
  if (percentage >= 90) return "A-";
  if (percentage >= 87) return "B+";
  if (percentage >= 83) return "B";
  if (percentage >= 80) return "B-";
  if (percentage >= 77) return "C+";
  if (percentage >= 73) return "C";
  if (percentage >= 70) return "C-";
  if (percentage >= 67) return "D+";
  if (percentage >= 63) return "D";
  if (percentage >= 60) return "D-";
  return "F";
}

function convertLetterGradeToPercentage(letterGrade: string): number {
  const grade = letterGrade.toUpperCase();
  switch (grade) {
    case "A+":
      return 98;
    case "A":
      return 95;
    case "A-":
      return 92;
    case "B+":
      return 88;
    case "B":
      return 85;
    case "B-":
      return 82;
    case "C+":
      return 78;
    case "C":
      return 75;
    case "C-":
      return 72;
    case "D+":
      return 68;
    case "D":
      return 65;
    case "D-":
      return 62;
    case "F":
      return 50;
    default:
      return 85; // Default to B
  }
}
