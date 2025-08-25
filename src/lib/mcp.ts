// This file provides a simplified MCP setup helper for the test script.

import { listCourses } from "../tools/courses.js";
import { findBestMatch } from "./search.js";

interface McpContext {
  findCourseId: (
    courseName: string,
    canvasBaseUrl: string,
    accessToken: string,
  ) => Promise<string | undefined>;
}

interface McpInstance {
  context: McpContext;
}

export function createMCP(options: any): McpInstance {
  const findCourseId = async (
    courseName: string,
    canvasBaseUrl: string,
    accessToken: string,
  ): Promise<string | undefined> => {
    const courses = await listCourses({
      canvasBaseUrl,
      accessToken,
      enrollmentState: "all",
    });
    if (courses.length === 0) {
      return undefined;
    }
    const matchedCourse = findBestMatch(courseName, courses, [
      "name",
      "courseCode",
      "nickname",
    ]);
    return matchedCourse?.id;
  };

  return {
    context: {
      findCourseId,
    },
  };
}
