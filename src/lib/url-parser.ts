// URL Parser for Canvas URLs
// Extracts course IDs, page URLs, discussion IDs, etc. from full Canvas URLs

export interface CanvasUrlInfo {
  courseId?: string;
  pageUrl?: string;
  discussionId?: string;
  assignmentId?: string;
  moduleId?: string;
  moduleItemId?: string;
  baseUrl?: string;
}

/**
 * Parse a Canvas URL to extract useful components
 * Examples:
 * - https://psu.instructure.com/courses/2422265/pages/l12-overview?module_item_id=44950494
 * - https://psu.instructure.com/courses/2422265/assignments/15234567
 * - https://psu.instructure.com/courses/2422265/discussion_topics/8765432
 */
export function parseCanvasUrl(url: string): CanvasUrlInfo {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter((part) => part);

    const result: CanvasUrlInfo = {
      baseUrl: `${urlObj.protocol}//${urlObj.host}`,
    };

    // Find course ID
    const coursesIndex = pathParts.indexOf("courses");
    if (coursesIndex !== -1 && coursesIndex + 1 < pathParts.length) {
      result.courseId = pathParts[coursesIndex + 1];
    }

    // Find page URL
    const pagesIndex = pathParts.indexOf("pages");
    if (pagesIndex !== -1 && pagesIndex + 1 < pathParts.length) {
      result.pageUrl = pathParts[pagesIndex + 1];
    }

    // Find discussion ID
    const discussionIndex = pathParts.indexOf("discussion_topics");
    if (discussionIndex !== -1 && discussionIndex + 1 < pathParts.length) {
      result.discussionId = pathParts[discussionIndex + 1];
    }

    // Find assignment ID
    const assignmentIndex = pathParts.indexOf("assignments");
    if (assignmentIndex !== -1 && assignmentIndex + 1 < pathParts.length) {
      result.assignmentId = pathParts[assignmentIndex + 1];
    }

    // Find module ID
    const modulesIndex = pathParts.indexOf("modules");
    if (modulesIndex !== -1 && modulesIndex + 1 < pathParts.length) {
      result.moduleId = pathParts[modulesIndex + 1];
    }

    // Find module item ID from query params
    const params = new URLSearchParams(urlObj.search);
    if (params.has("module_item_id")) {
      result.moduleItemId = params.get("module_item_id") || undefined;
    }

    return result;
  } catch (error) {
    // If URL parsing fails, return empty object
    return {};
  }
}

/**
 * Check if a string looks like a Canvas URL
 */
export function isCanvasUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return (
      url.hostname.includes("instructure.com") ||
      url.pathname.includes("/courses/")
    );
  } catch {
    return false;
  }
}

/**
 * Extract just the page slug from a page URL or full Canvas URL
 */
export function extractPageSlug(input: string): string {
  if (isCanvasUrl(input)) {
    const parsed = parseCanvasUrl(input);
    return parsed.pageUrl || "";
  }

  // If it's not a full URL, assume it's already a page slug
  return input;
}
