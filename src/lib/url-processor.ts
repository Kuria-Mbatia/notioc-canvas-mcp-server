/**
 * Canvas URL Processor
 * Handles direct Canvas URLs and extracts useful information
 */

export interface CanvasURLInfo {
  type:
    | "file"
    | "page"
    | "assignment"
    | "discussion"
    | "module"
    | "course"
    | "unknown";
  courseId: string;
  resourceId?: string;
  resourceName?: string;
  url: string;
  baseUrl: string;
  queryParams?: Record<string, string>;
  isValid: boolean;
}

export interface URLProcessingResult {
  urlInfo: CanvasURLInfo;
  content?: any;
  error?: string;
  processingTime: number;
}

/**
 * Parse a Canvas URL and extract useful information
 */
export function parseCanvasURL(url: string): CanvasURLInfo {
  try {
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    const pathname = urlObj.pathname;
    const searchParams = new URLSearchParams(urlObj.search);

    // Extract query parameters
    const queryParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    // Parse Canvas URL patterns
    const courseMatch = pathname.match(/\/courses\/(\d+)/);
    if (!courseMatch) {
      return {
        type: "unknown",
        courseId: "",
        url,
        baseUrl,
        queryParams,
        isValid: false,
      };
    }

    const courseId = courseMatch[1];

    // File URLs: /courses/123/files/456 or /files/456
    const fileMatch = pathname.match(/\/files\/(\d+)/);
    if (fileMatch) {
      return {
        type: "file",
        courseId,
        resourceId: fileMatch[1],
        url,
        baseUrl,
        queryParams,
        isValid: true,
      };
    }

    // Page URLs: /courses/123/pages/page-name
    const pageMatch = pathname.match(/\/courses\/\d+\/pages\/([^/?]+)/);
    if (pageMatch) {
      return {
        type: "page",
        courseId,
        resourceId: pageMatch[1],
        resourceName: decodeURIComponent(pageMatch[1]).replace(/-/g, " "),
        url,
        baseUrl,
        queryParams,
        isValid: true,
      };
    }

    // Assignment URLs: /courses/123/assignments/456
    const assignmentMatch = pathname.match(
      /\/courses\/\d+\/assignments\/(\d+)/,
    );
    if (assignmentMatch) {
      return {
        type: "assignment",
        courseId,
        resourceId: assignmentMatch[1],
        url,
        baseUrl,
        queryParams,
        isValid: true,
      };
    }

    // Discussion URLs: /courses/123/discussion_topics/456
    const discussionMatch = pathname.match(
      /\/courses\/\d+\/discussion_topics\/(\d+)/,
    );
    if (discussionMatch) {
      return {
        type: "discussion",
        courseId,
        resourceId: discussionMatch[1],
        url,
        baseUrl,
        queryParams,
        isValid: true,
      };
    }

    // Module URLs: /courses/123/modules/456
    const moduleMatch = pathname.match(/\/courses\/\d+\/modules\/(\d+)/);
    if (moduleMatch) {
      return {
        type: "module",
        courseId,
        resourceId: moduleMatch[1],
        url,
        baseUrl,
        queryParams,
        isValid: true,
      };
    }

    // Course home: /courses/123
    if (pathname.match(/\/courses\/\d+\/?$/)) {
      return {
        type: "course",
        courseId,
        url,
        baseUrl,
        queryParams,
        isValid: true,
      };
    }

    // Default to course context for other URLs
    return {
      type: "unknown",
      courseId,
      url,
      baseUrl,
      queryParams,
      isValid: true,
    };
  } catch (error) {
    return {
      type: "unknown",
      courseId: "",
      url,
      baseUrl: "",
      isValid: false,
    };
  }
}

/**
 * Convert Canvas web URLs to API endpoints
 */
export function webUrlToApiUrl(urlInfo: CanvasURLInfo): string | null {
  if (!urlInfo.isValid || !urlInfo.courseId) return null;

  const { baseUrl, courseId, resourceId, type } = urlInfo;

  switch (type) {
    case "file":
      return `${baseUrl}/api/v1/files/${resourceId}`;

    case "page":
      return `${baseUrl}/api/v1/courses/${courseId}/pages/${resourceId}`;

    case "assignment":
      return `${baseUrl}/api/v1/courses/${courseId}/assignments/${resourceId}`;

    case "discussion":
      return `${baseUrl}/api/v1/courses/${courseId}/discussion_topics/${resourceId}`;

    case "module":
      return `${baseUrl}/api/v1/courses/${courseId}/modules/${resourceId}`;

    case "course":
      return `${baseUrl}/api/v1/courses/${courseId}`;

    default:
      return null;
  }
}

/**
 * Extract file IDs from Canvas HTML content
 */
export function extractFileIdsFromHTML(
  html: string,
  baseUrl: string,
): Array<{ fileId: string; fileName: string; url: string }> {
  const files: Array<{ fileId: string; fileName: string; url: string }> = [];

  // Pattern 1: Direct file links
  const fileRegex = /href="[^"]*\/files\/(\d+)[^"]*"[^>]*>([^<]+)<\/a>/g;
  let match;

  while ((match = fileRegex.exec(html)) !== null) {
    const fileId = match[1];
    const fileName = match[2].trim();
    files.push({
      fileId,
      fileName,
      url: `${baseUrl}/files/${fileId}`,
    });
  }

  // Pattern 2: Canvas file links with data attributes
  const canvasFileRegex =
    /class="instructure_file_link"[^>]*href="[^"]*\/files\/(\d+)[^"]*"[^>]*title="([^"]*)"[^>]*>/g;
  while ((match = canvasFileRegex.exec(html)) !== null) {
    const fileId = match[1];
    const fileName = match[2].trim();

    // Avoid duplicates
    if (!files.some((f) => f.fileId === fileId)) {
      files.push({
        fileId,
        fileName,
        url: `${baseUrl}/files/${fileId}`,
      });
    }
  }

  // Pattern 3: API endpoint references
  const apiRegex = /data-api-endpoint="[^"]*\/files\/(\d+)"/g;
  while ((match = apiRegex.exec(html)) !== null) {
    const fileId = match[1];

    // Try to find associated filename in nearby HTML
    const contextStart = Math.max(0, match.index - 200);
    const contextEnd = Math.min(html.length, match.index + 200);
    const context = html.slice(contextStart, contextEnd);

    const nameMatch = context.match(/title="([^"]+)"|>([^<]+)<\/a>/);
    const fileName = nameMatch
      ? (nameMatch[1] || nameMatch[2] || `File ${fileId}`).trim()
      : `File ${fileId}`;

    // Avoid duplicates
    if (!files.some((f) => f.fileId === fileId)) {
      files.push({
        fileId,
        fileName,
        url: `${baseUrl}/files/${fileId}`,
      });
    }
  }

  return files;
}

/**
 * Extract links from Canvas HTML content
 */
export function extractLinksFromHTML(
  html: string,
): Array<{ title: string; url: string; type: string }> {
  const links: Array<{ title: string; url: string; type: string }> = [];

  // External links
  const externalRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
  let match;

  while ((match = externalRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();

    // Determine link type
    let type = "external";
    if (
      url.includes("youtube.com") ||
      url.includes("vimeo.com") ||
      url.includes("mediaspace")
    ) {
      type = "video";
    } else if (
      url.includes(".pdf") ||
      url.includes(".doc") ||
      url.includes(".ppt")
    ) {
      type = "document";
    }

    links.push({ title, url, type });
  }

  return links;
}

/**
 * Validate if a Canvas URL is accessible
 */
export async function validateCanvasURL(
  url: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}
