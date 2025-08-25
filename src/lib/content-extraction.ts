/**
 * Content Extraction Engine
 * Orchestrates API detection, web discovery, and content retrieval
 */

import { logger } from "./logger.js";
import {
  testCourseAPIAvailability,
  getAPIRestrictionSummary,
  getSuggestedFallbacks,
} from "./api-detector.js";
import {
  discoverCourseContentViaWeb,
  searchDiscoveredContent,
} from "./web-discovery.js";
import { processCanvasURL } from "../tools/url-processor.js";
import {
  CourseContentIndex,
  DiscoveryResult,
  getCachedDiscovery,
  setCachedDiscovery,
  clearDiscoveryCache,
  DEFAULT_DISCOVERY_CONFIG,
} from "./course-discovery.js";

export interface ExtractionOptions {
  forceRefresh?: boolean;
  useWebDiscovery?: boolean;
  maxRetries?: number;
  timeout?: number;
}

export interface ExtractionResult {
  success: boolean;
  method: "api" | "web" | "hybrid" | "cached";
  courseIndex: CourseContentIndex;
  timing: {
    apiTest: number;
    webDiscovery: number;
    contentExtraction: number;
    total: number;
  };
  apiRestrictions?: {
    summary: string;
    fallbacks: Array<{ api: string; fallback: string; reason: string }>;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Main content extraction function - the smart brain of the system
 */
export async function extractCourseContent(
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
  options: ExtractionOptions = {},
): Promise<ExtractionResult> {
  const startTime = Date.now();

  logger.info(
    `[Content Extraction] Starting smart extraction for course ${courseId}`,
  );

  const result: ExtractionResult = {
    success: false,
    method: "cached",
    courseIndex: {
      courseId,
      lastScanned: new Date(),
      apiAvailability: {} as any,
      discoveredPages: [],
      discoveredFiles: [],
      discoveredLinks: [],
      searchableContent: "",
      metadata: {
        totalFiles: 0,
        totalPages: 0,
        hasRestrictedAPIs: false,
        discoveryMethod: "api",
      },
    },
    timing: {
      apiTest: 0,
      webDiscovery: 0,
      contentExtraction: 0,
      total: 0,
    },
    errors: [],
    warnings: [],
  };

  try {
    // Step 1: Check cache first (unless forced refresh)
    if (!options.forceRefresh) {
      const cached = getCachedDiscovery(courseId);
      if (cached) {
        logger.info(
          `[Content Extraction] Using cached content for course ${courseId}`,
        );
        result.success = true;
        result.method = "cached";
        result.courseIndex = cached;
        result.timing.total = Date.now() - startTime;
        return result;
      }
    }

    // Step 2: Test API availability
    const apiTestStart = Date.now();
    logger.info(
      `[Content Extraction] Testing API availability for course ${courseId}`,
    );

    const apiTest = await testCourseAPIAvailability(
      courseId,
      canvasBaseUrl,
      accessToken,
      false, // Don't use cache for fresh test
    );

    result.timing.apiTest = Date.now() - apiTestStart;
    result.courseIndex.apiAvailability = apiTest.availability;
    result.courseIndex.metadata.hasRestrictedAPIs =
      apiTest.summary.hasRestrictedAPIs;

    // Store API restriction info
    result.apiRestrictions = {
      summary: getAPIRestrictionSummary(apiTest),
      fallbacks: getSuggestedFallbacks(apiTest),
    };

    logger.info(
      `[Content Extraction] API Test: ${result.apiRestrictions.summary}`,
    );

    // Step 3: Decide on extraction strategy
    const useWebDiscovery =
      options.useWebDiscovery !== false &&
      (apiTest.summary.recommendWebDiscovery ||
        options.useWebDiscovery === true);

    if (useWebDiscovery) {
      // Step 4: Web discovery when APIs are limited
      const webDiscoveryStart = Date.now();
      logger.info(
        `[Content Extraction] Starting web discovery for course ${courseId}`,
      );

      const webResult = await discoverCourseContentViaWeb(
        courseId,
        canvasBaseUrl,
        accessToken,
        {
          maxPages: 20,
          extractEmbeddedContent: true,
          respectRateLimit: true,
        },
      );

      result.timing.webDiscovery = Date.now() - webDiscoveryStart;

      if (webResult.success) {
        result.courseIndex.discoveredPages = webResult.discoveredPages;
        result.courseIndex.discoveredFiles = webResult.discoveredFiles;
        result.courseIndex.discoveredLinks = webResult.discoveredLinks;
        result.courseIndex.searchableContent = webResult.searchableContent;
        result.courseIndex.metadata.totalFiles =
          webResult.discoveredFiles.length;
        result.courseIndex.metadata.totalPages =
          webResult.discoveredPages.length;
        result.courseIndex.metadata.discoveryMethod = "web";

        result.method = apiTest.summary.hasWorkingAPIs ? "hybrid" : "web";
        result.success = true;

        logger.info(
          `[Content Extraction] Web discovery successful: ${webResult.discoveredFiles.length} files, ${webResult.discoveredPages.length} pages`,
        );
      } else {
        result.errors.push("Web discovery failed");
        result.warnings.push(...webResult.warnings);
        logger.warn(
          `[Content Extraction] Web discovery failed for course ${courseId}`,
        );
      }

      // Merge any web discovery errors/warnings
      result.errors.push(...webResult.errors);
      result.warnings.push(...webResult.warnings);
    } else {
      // Step 5: API-only approach
      logger.info(
        `[Content Extraction] Using API-only approach for course ${courseId}`,
      );
      result.method = "api";
      result.courseIndex.metadata.discoveryMethod = "api";

      // TODO: Implement API-only content extraction here
      // For now, mark as successful if we have working APIs
      result.success = apiTest.summary.hasWorkingAPIs;

      if (!result.success) {
        result.errors.push("All APIs restricted and web discovery disabled");
      }
    }

    // Step 6: Cache results if successful
    if (result.success) {
      result.courseIndex.lastScanned = new Date();
      setCachedDiscovery(courseId, result.courseIndex);
      logger.info(`[Content Extraction] Cached results for course ${courseId}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Content extraction failed: ${errorMsg}`);
    logger.error(
      `[Content Extraction] Failed for course ${courseId}: ${errorMsg}`,
    );
  }

  // Final timing
  result.timing.total = Date.now() - startTime;

  logger.info(
    `[Content Extraction] Completed for course ${courseId}: ${result.success ? "SUCCESS" : "FAILED"} in ${result.timing.total}ms`,
  );

  return result;
}

/**
 * Smart search function that uses extracted content
 */
export async function smartSearch(
  query: string,
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
  options: ExtractionOptions = {},
): Promise<{
  files: Array<{
    fileId: string;
    fileName: string;
    url: string;
    source: string;
    relevance: number;
  }>;
  pages: Array<{ name: string; url: string; path: string; relevance: number }>;
  links: Array<{
    title: string;
    url: string;
    type: string;
    source: string;
    relevance: number;
  }>;
  totalResults: number;
  searchTime: number;
  extractionUsed: boolean;
}> {
  const startTime = Date.now();

  logger.info(`[Smart Search] Searching for "${query}" in course ${courseId}`);

  // Get or extract course content
  const extraction = await extractCourseContent(
    courseId,
    canvasBaseUrl,
    accessToken,
    options,
  );

  if (!extraction.success) {
    logger.warn(
      `[Smart Search] Content extraction failed, returning empty results`,
    );
    return {
      files: [],
      pages: [],
      links: [],
      totalResults: 0,
      searchTime: Date.now() - startTime,
      extractionUsed: extraction.method !== "cached",
    };
  }

  // Use web discovery search if available
  if (
    extraction.courseIndex.discoveredFiles.length > 0 ||
    extraction.courseIndex.discoveredPages.length > 0
  ) {
    const webDiscoveryResult = {
      courseId: extraction.courseIndex.courseId,
      success: true,
      discoveredPages: extraction.courseIndex.discoveredPages,
      discoveredFiles: extraction.courseIndex.discoveredFiles,
      discoveredLinks: extraction.courseIndex.discoveredLinks,
      searchableContent: extraction.courseIndex.searchableContent,
      errors: [],
      warnings: [],
      timing: {
        totalTime: 0,
        pagesDiscovered: 0,
        filesExtracted: 0,
        linksExtracted: 0,
      },
    };

    const searchResult = searchDiscoveredContent(webDiscoveryResult, query);

    // Add relevance scores
    const files = searchResult.files.map((file) => ({
      ...file,
      relevance: calculateRelevance(query, `${file.fileName} ${file.source}`),
    }));

    const pages = searchResult.pages.map((page) => ({
      ...page,
      relevance: calculateRelevance(query, `${page.name} ${page.path}`),
    }));

    const links = searchResult.links.map((link) => ({
      ...link,
      relevance: calculateRelevance(query, `${link.title} ${link.source}`),
    }));

    const totalResults = files.length + pages.length + links.length;

    logger.info(
      `[Smart Search] Found ${totalResults} results for "${query}" in ${Date.now() - startTime}ms`,
    );

    return {
      files: files.sort((a, b) => b.relevance - a.relevance),
      pages: pages.sort((a, b) => b.relevance - a.relevance),
      links: links.sort((a, b) => b.relevance - a.relevance),
      totalResults,
      searchTime: Date.now() - startTime,
      extractionUsed: extraction.method !== "cached",
    };
  }

  // Fallback to empty results
  logger.warn(
    `[Smart Search] No content available for search in course ${courseId}`,
  );
  return {
    files: [],
    pages: [],
    links: [],
    totalResults: 0,
    searchTime: Date.now() - startTime,
    extractionUsed: extraction.method !== "cached",
  };
}

/**
 * Get content by direct file ID with smart fallback
 */
export async function getContentByFileId(
  fileId: string,
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
  options: ExtractionOptions = {},
): Promise<{
  found: boolean;
  fileName?: string;
  url?: string;
  source?: string;
  method: "direct" | "discovery";
  error?: string;
}> {
  logger.info(
    `[Content Extraction] Looking for file ${fileId} in course ${courseId}`,
  );

  // Try direct API first
  try {
    const directUrl = `${canvasBaseUrl}/api/v1/files/${fileId}`;
    const response = await fetch(directUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const fileData = await response.json();
      logger.info(`[Content Extraction] Found file ${fileId} via direct API`);
      return {
        found: true,
        fileName: fileData.filename || fileData.display_name,
        url: fileData.url,
        method: "direct",
      };
    }
  } catch (error) {
    logger.debug(`[Content Extraction] Direct API failed for file ${fileId}`);
  }

  // Fallback to discovery
  const extraction = await extractCourseContent(
    courseId,
    canvasBaseUrl,
    accessToken,
    options,
  );

  if (extraction.success) {
    const foundFile = extraction.courseIndex.discoveredFiles.find(
      (f) => f.fileId === fileId,
    );

    if (foundFile) {
      logger.info(
        `[Content Extraction] Found file ${fileId} via discovery from ${foundFile.source}`,
      );
      return {
        found: true,
        fileName: foundFile.fileName,
        url: foundFile.url,
        source: foundFile.source,
        method: "discovery",
      };
    }
  }

  logger.warn(`[Content Extraction] File ${fileId} not found via any method`);
  return {
    found: false,
    method: "discovery",
    error: "File not found via API or discovery",
  };
}

/**
 * Calculate relevance score for search results
 */
function calculateRelevance(query: string, text: string): number {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const queryTerms = queryLower.split(/\s+/);

  let score = 0;

  // Exact match bonus
  if (textLower.includes(queryLower)) {
    score += 1.0;
  }

  // Term frequency
  queryTerms.forEach((term) => {
    const regex = new RegExp(term, "gi");
    const matches = text.match(regex);
    if (matches) {
      score += matches.length * 0.3;
    }
  });

  // Length penalty (shorter texts with matches score higher)
  if (score > 0) {
    score = score / Math.log(text.length + 1);
  }

  return score;
}

/**
 * Clear cache for a course (useful for testing)
 */
export function clearCourseCache(courseId?: string): void {
  clearDiscoveryCache(courseId);
  logger.info(
    `[Content Extraction] Cleared cache${courseId ? ` for course ${courseId}` : " for all courses"}`,
  );
}

/**
 * Get extraction statistics
 */
export async function getExtractionStats(
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
): Promise<{
  hasCache: boolean;
  cacheAge?: number;
  apiStatus: string;
  contentCounts: {
    pages: number;
    files: number;
    links: number;
  };
  lastUpdate?: Date;
}> {
  const cached = getCachedDiscovery(courseId);

  if (cached) {
    return {
      hasCache: true,
      cacheAge: Date.now() - cached.lastScanned.getTime(),
      apiStatus: cached.metadata.hasRestrictedAPIs ? "restricted" : "available",
      contentCounts: {
        pages: cached.discoveredPages.length,
        files: cached.discoveredFiles.length,
        links: cached.discoveredLinks.length,
      },
      lastUpdate: cached.lastScanned,
    };
  }

  // Quick API test without full extraction
  try {
    const apiTest = await testCourseAPIAvailability(
      courseId,
      canvasBaseUrl,
      accessToken,
    );
    return {
      hasCache: false,
      apiStatus: apiTest.summary.hasRestrictedAPIs ? "restricted" : "available",
      contentCounts: {
        pages: 0,
        files: 0,
        links: 0,
      },
    };
  } catch (error) {
    return {
      hasCache: false,
      apiStatus: "unknown",
      contentCounts: {
        pages: 0,
        files: 0,
        links: 0,
      },
    };
  }
}
