/**
 * Canvas API Availability Detector
 * Tests which Canvas API endpoints are available vs restricted
 */

import { logger } from "./logger.js";
import {
  CourseAPIAvailability,
  APIEndpointStatus,
  CANVAS_API_ENDPOINTS,
  getCachedDiscovery,
  setCachedDiscovery,
} from "./course-discovery.js";

export interface APITestResult {
  courseId: string;
  availability: CourseAPIAvailability;
  summary: {
    totalEndpoints: number;
    availableEndpoints: number;
    restrictedEndpoints: number;
    hasWorkingAPIs: boolean;
    hasRestrictedAPIs: boolean;
    recommendWebDiscovery: boolean;
  };
  timing: {
    totalTime: number;
    averageResponseTime: number;
  };
}

/**
 * Test all Canvas API endpoints for a course
 */
export async function testCourseAPIAvailability(
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
  useCache: boolean = true,
): Promise<APITestResult> {
  const startTime = Date.now();

  // Check cache first
  if (useCache) {
    const cached = getCachedDiscovery(courseId);
    if (cached && cached.apiAvailability) {
      logger.debug(
        `[API Detector] Using cached API availability for course ${courseId}`,
      );
      return buildTestResult(cached.apiAvailability, Date.now() - startTime);
    }
  }

  logger.info(`[API Detector] Testing API availability for course ${courseId}`);

  const availability: CourseAPIAvailability = {
    courseId,
    tested: new Date(),
    endpoints: {} as any,
  };

  const testPromises = CANVAS_API_ENDPOINTS.map((endpoint) =>
    testSingleEndpoint(courseId, canvasBaseUrl, accessToken, endpoint),
  );

  try {
    const results = await Promise.allSettled(testPromises);

    results.forEach((result, index) => {
      const endpointName = CANVAS_API_ENDPOINTS[index]
        .name as keyof typeof availability.endpoints;

      if (result.status === "fulfilled") {
        availability.endpoints[endpointName] = result.value;
      } else {
        availability.endpoints[endpointName] = {
          name: CANVAS_API_ENDPOINTS[index].name,
          path: CANVAS_API_ENDPOINTS[index].path,
          available: false,
          status: 0,
          error: "Test failed",
          message: result.reason?.message || "Unknown error",
        };
      }
    });

    // Cache the results
    if (useCache) {
      const existingCache = getCachedDiscovery(courseId);
      const updatedCache = {
        ...existingCache,
        courseId,
        lastScanned: new Date(),
        apiAvailability: availability,
        discoveredPages: existingCache?.discoveredPages || [],
        discoveredFiles: existingCache?.discoveredFiles || [],
        discoveredLinks: existingCache?.discoveredLinks || [],
        searchableContent: existingCache?.searchableContent || "",
        metadata: {
          ...existingCache?.metadata,
          hasRestrictedAPIs: Object.values(availability.endpoints).some(
            (e) => !e.available,
          ),
          totalFiles: existingCache?.metadata?.totalFiles || 0,
          totalPages: existingCache?.metadata?.totalPages || 0,
          discoveryMethod: "api" as const,
        },
      };
      setCachedDiscovery(courseId, updatedCache);
    }

    const totalTime = Date.now() - startTime;
    logger.info(
      `[API Detector] API testing completed for course ${courseId} in ${totalTime}ms`,
    );

    return buildTestResult(availability, totalTime);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      `[API Detector] Failed to test APIs for course ${courseId}: ${errorMsg}`,
    );
    throw error;
  }
}

/**
 * Test a single Canvas API endpoint
 */
async function testSingleEndpoint(
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
  endpoint: { name: string; path: string },
): Promise<APIEndpointStatus> {
  const url = `${canvasBaseUrl}/api/v1/courses/${courseId}${endpoint.path}`;
  const startTime = Date.now();

  try {
    logger.debug(`[API Detector] Testing ${endpoint.name}: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      logger.debug(
        `[API Detector] ✅ ${endpoint.name}: Available (${response.status}, ${responseTime}ms)`,
      );
      return {
        name: endpoint.name,
        path: endpoint.path,
        available: true,
        status: response.status,
      };
    } else {
      // Try to get error message from response
      let errorMessage = response.statusText;
      try {
        const errorBody = await response.text();
        if (errorBody) {
          const parsed = JSON.parse(errorBody);
          errorMessage = parsed.message || parsed.error || errorBody;
        }
      } catch {
        // Use status text if can't parse response
      }

      logger.debug(
        `[API Detector] ❌ ${endpoint.name}: Restricted (${response.status}, ${responseTime}ms) - ${errorMessage}`,
      );
      return {
        name: endpoint.name,
        path: endpoint.path,
        available: false,
        status: response.status,
        error: response.statusText,
        message: errorMessage,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.debug(`[API Detector] 💥 ${endpoint.name}: Failed - ${errorMsg}`);

    return {
      name: endpoint.name,
      path: endpoint.path,
      available: false,
      status: 0,
      error: "Request failed",
      message: errorMsg,
    };
  }
}

/**
 * Build test result summary
 */
function buildTestResult(
  availability: CourseAPIAvailability,
  totalTime: number,
): APITestResult {
  const endpoints = Object.values(availability.endpoints);
  const availableCount = endpoints.filter((e) => e.available).length;
  const restrictedCount = endpoints.length - availableCount;

  return {
    courseId: availability.courseId,
    availability,
    summary: {
      totalEndpoints: endpoints.length,
      availableEndpoints: availableCount,
      restrictedEndpoints: restrictedCount,
      hasWorkingAPIs: availableCount > 0,
      hasRestrictedAPIs: restrictedCount > 0,
      recommendWebDiscovery: availableCount < endpoints.length / 2, // If more than half are restricted
    },
    timing: {
      totalTime,
      averageResponseTime: totalTime / endpoints.length,
    },
  };
}

/**
 * Get a human-readable summary of API restrictions
 */
export function getAPIRestrictionSummary(testResult: APITestResult): string {
  const { summary, availability } = testResult;

  if (summary.availableEndpoints === summary.totalEndpoints) {
    return `All APIs available (${summary.totalEndpoints}/${summary.totalEndpoints})`;
  }

  if (summary.availableEndpoints === 0) {
    return `All APIs restricted (0/${summary.totalEndpoints}) - Web discovery recommended`;
  }

  const restrictedAPIs = Object.values(availability.endpoints)
    .filter((e) => !e.available)
    .map((e) => e.name);

  return `Partial API access (${summary.availableEndpoints}/${summary.totalEndpoints} available). Restricted: ${restrictedAPIs.join(", ")}`;
}

/**
 * Check if a specific API type is available
 */
export function isAPIAvailable(
  testResult: APITestResult,
  apiType: string,
): boolean {
  const endpoint =
    testResult.availability.endpoints[
      apiType as keyof typeof testResult.availability.endpoints
    ];
  return endpoint?.available || false;
}

/**
 * Get suggested fallback methods for restricted APIs
 */
export function getSuggestedFallbacks(
  testResult: APITestResult,
): Array<{ api: string; fallback: string; reason: string }> {
  const suggestions: Array<{ api: string; fallback: string; reason: string }> =
    [];

  Object.values(testResult.availability.endpoints).forEach((endpoint) => {
    if (!endpoint.available) {
      switch (endpoint.name) {
        case "pages":
          suggestions.push({
            api: "pages",
            fallback: "Web interface discovery",
            reason: `Pages API ${endpoint.status === 404 ? "disabled" : "restricted"} - try direct page URLs`,
          });
          break;
        case "files":
          suggestions.push({
            api: "files",
            fallback: "Extract from page content",
            reason: `Files API ${endpoint.status === 403 ? "unauthorized" : "restricted"} - search for embedded file links`,
          });
          break;
        case "modules":
          suggestions.push({
            api: "modules",
            fallback: "Course navigation parsing",
            reason: "Modules API restricted - check course tabs/navigation",
          });
          break;
        default:
          suggestions.push({
            api: endpoint.name,
            fallback: "Web interface",
            reason: `${endpoint.name} API restricted - try web discovery`,
          });
      }
    }
  });

  return suggestions;
}
