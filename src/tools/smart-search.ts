/**
 * Smart Search Tool
 * Intelligent content discovery that handles API restrictions gracefully
 */

import {
  smartSearch,
  extractCourseContent,
  getExtractionStats,
  clearCourseCache,
} from "../lib/content-extraction.js";
import { logger } from "../lib/logger.js";
import {
  classifyIntent,
  rerankCandidates,
  IntentClassification,
  RerankCandidate,
  RerankResult,
  DEFAULT_SMALL_MODEL_CONFIG,
} from "../lib/small-model.js";

export interface SmartSearchParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId?: string;
  courseName?: string;
  query: string;
  forceRefresh?: boolean;
  includeContent?: boolean;
  maxResults?: number; // NEW: limit number of results (default 5)
  returnMode?: "refs" | "answer" | "full"; // NEW: control output verbosity (default 'refs')
  useSmallModel?: boolean; // NEW: enable intent classification and reranking (default true)
}

export interface SmartSearchResult {
  success: boolean;
  query: string;
  courseInfo: {
    courseId?: string;
    courseName?: string;
  };
  results: {
    files: Array<{
      fileId: string;
      fileName: string;
      url: string;
      source: string;
      relevance: number;
      canProcess: boolean;
    }>;
    pages: Array<{
      name: string;
      url: string;
      path: string;
      relevance: number;
    }>;
    links: Array<{
      title: string;
      url: string;
      type: string;
      source: string;
      relevance: number;
    }>;
  };
  metadata: {
    totalResults: number;
    searchTime: number;
    extractionUsed: boolean;
    discoveryMethod: string;
    apiRestrictions?: string;
    truncated?: boolean; // NEW: indicates if results were capped
    mode?: string; // NEW: indicates return mode used
  };
  suggestions?: string[];
  error?: string;
}

// NEW: Compact citation format for 'refs' mode
export interface CompactCitation {
  id: string;
  type: "file" | "page" | "link";
  title: string;
  source: string;
  relevance: number;
  canProcess?: boolean; // only for files
}

export interface CompactSearchResult {
  success: boolean;
  query: string;
  courseInfo: {
    courseId?: string;
    courseName?: string;
  };
  citations: CompactCitation[];
  metadata: {
    totalResults: number;
    searchTime: number;
    extractionUsed: boolean;
    discoveryMethod: string;
    apiRestrictions?: string;
    truncated: boolean;
    mode: string;
    intent?: IntentClassification; // NEW: detected intent
    reranked?: boolean; // NEW: whether results were reranked
  };
  suggestions?: string[];
  error?: string;
}

// NEW: Text budget helper to enforce token limits
function enforceTextBudget(text: string, maxChars: number = 2000): string {
  if (text.length <= maxChars) return text;

  const truncated = text.slice(0, maxChars - 10);
  const lastSpace = truncated.lastIndexOf(" ");
  const cutPoint = lastSpace > maxChars * 0.8 ? lastSpace : truncated.length;

  return truncated.slice(0, cutPoint) + "...[truncated]";
}

/**
 * Smart search across course content with automatic discovery
 */
export async function performSmartSearch(
  params: SmartSearchParams,
): Promise<SmartSearchResult | CompactSearchResult> {
  const startTime = Date.now();

  // NEW: Extract efficiency parameters with defaults
  const maxResults = params.maxResults ?? 5;
  const returnMode = params.returnMode ?? "refs";
  const useSmallModel =
    params.useSmallModel ?? DEFAULT_SMALL_MODEL_CONFIG.enabled;

  // Declare intent variable in the outer scope so it's available everywhere
  let intent: IntentClassification | undefined;

  try {
    logger.info(
      `[Smart Search Tool] Searching for "${params.query}" in course ${params.courseId || "unknown"} (mode: ${returnMode}, maxResults: ${maxResults}, smallModel: ${useSmallModel})`,
    );

    // Step 1: Intent classification (if using small model)
    if (useSmallModel) {
      try {
        intent = await classifyIntent(params.query, params.courseId);
        logger.debug(
          `[Smart Search Tool] Intent: ${Object.entries(intent)
            .filter(([k, v]) => k !== "confidence" && k !== "reasoning" && v)
            .map(([k]) => k)
            .join(", ")}`,
        );
      } catch (error) {
        logger.warn(
          `[Smart Search Tool] Intent classification failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!params.courseId) {
      const errorResult = {
        success: false,
        query: params.query,
        courseInfo: { courseName: params.courseName },
        metadata: {
          totalResults: 0,
          searchTime: Date.now() - startTime,
          extractionUsed: false,
          discoveryMethod: "none",
          truncated: false,
          mode: returnMode,
          intent: intent,
          reranked: false,
        },
        error: "Course ID is required for smart search",
      };

      return returnMode === "refs"
        ? ({
            ...errorResult,
            citations: [],
          } as CompactSearchResult)
        : ({
            ...errorResult,
            results: { files: [], pages: [], links: [] },
          } as SmartSearchResult);
    }

    // Perform smart search using content extraction engine
    const searchResult = await smartSearch(
      params.query,
      params.courseId,
      params.canvasBaseUrl,
      params.accessToken,
      {
        forceRefresh: params.forceRefresh,
        useWebDiscovery: true,
      },
    );

    // Get extraction stats for metadata
    const stats = await getExtractionStats(
      params.courseId,
      params.canvasBaseUrl,
      params.accessToken,
    );

    // Enhance file results with processing capability info
    const enhancedFiles = searchResult.files.map((file) => ({
      ...file,
      canProcess: canProcessFile(file.fileName),
    }));

    // Step 2: Smart reranking (if using small model and have enough results)
    let rerankedFiles = enhancedFiles;
    let rerankedPages = searchResult.pages;
    let rerankedLinks = searchResult.links;
    let wasReranked = false;

    if (
      useSmallModel &&
      intent &&
      enhancedFiles.length +
        searchResult.pages.length +
        searchResult.links.length >
        maxResults
    ) {
      try {
        // Create candidates for reranking
        const candidates: RerankCandidate[] = [
          ...enhancedFiles.map((f) => ({
            id: `file_${f.fileId}`,
            title: f.fileName,
            source: f.source,
            type: "file" as const,
            snippet: undefined, // Could add file content preview in future
          })),
          ...searchResult.pages.map((p) => ({
            id: `page_${p.path}`,
            title: p.name,
            source: p.path,
            type: "page" as const,
          })),
          ...searchResult.links.map((l) => ({
            id: `link_${Buffer.from(l.url).toString("base64").slice(0, 8)}`,
            title: l.title,
            source: l.source,
            type: "link" as const,
          })),
        ];

        // Rerank all candidates together
        const rerankResults = await rerankCandidates(
          params.query,
          candidates,
          maxResults,
        );

        if (rerankResults.length > 0) {
          // Apply rerank results
          rerankedFiles = [];
          rerankedPages = [];
          rerankedLinks = [];

          for (const result of rerankResults) {
            if (result.id.startsWith("file_")) {
              const fileId = result.id.replace("file_", "");
              const file = enhancedFiles.find((f) => f.fileId === fileId);
              if (file) {
                rerankedFiles.push({ ...file, relevance: result.score });
              }
            } else if (result.id.startsWith("page_")) {
              const path = result.id.replace("page_", "");
              const page = searchResult.pages.find((p) => p.path === path);
              if (page) {
                rerankedPages.push({ ...page, relevance: result.score });
              }
            } else if (result.id.startsWith("link_")) {
              const linkHash = result.id.replace("link_", "");
              const link = searchResult.links.find(
                (l) =>
                  Buffer.from(l.url).toString("base64").slice(0, 8) ===
                  linkHash,
              );
              if (link) {
                rerankedLinks.push({ ...link, relevance: result.score });
              }
            }
          }

          wasReranked = true;
          logger.info(
            `[Smart Search Tool] Reranked ${candidates.length} candidates to ${rerankResults.length} top results`,
          );
        }
      } catch (error) {
        logger.warn(
          `[Smart Search Tool] Reranking failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // NEW: Apply maxResults limit after reranking (or use original if no reranking)
    const limitedFiles = rerankedFiles.slice(0, maxResults);
    const limitedPages = rerankedPages.slice(0, maxResults);
    const limitedLinks = rerankedLinks.slice(0, maxResults);

    const originalTotal = searchResult.totalResults;
    const limitedTotal =
      limitedFiles.length + limitedPages.length + limitedLinks.length;
    const wasTruncated = limitedTotal < originalTotal;

    // Generate suggestions based on results
    const suggestions = generateSearchSuggestions(params.query, {
      ...searchResult,
      files: limitedFiles,
      pages: limitedPages,
      links: limitedLinks,
      totalResults: limitedTotal,
    });

    const baseMetadata = {
      totalResults: limitedTotal,
      searchTime: searchResult.searchTime,
      extractionUsed: searchResult.extractionUsed,
      discoveryMethod: stats.hasCache ? "cached" : "discovery",
      apiRestrictions:
        stats.apiStatus === "restricted"
          ? "Some APIs restricted, using smart discovery"
          : undefined,
      truncated: wasTruncated,
      mode: returnMode,
      intent: intent,
      reranked: wasReranked,
    };

    // NEW: Return compact format for 'refs' mode
    if (returnMode === "refs") {
      const citations: CompactCitation[] = [
        ...limitedFiles.map((file) => ({
          id: `file_${file.fileId}`,
          type: "file" as const,
          title: file.fileName,
          source: file.source,
          relevance: file.relevance,
          canProcess: file.canProcess,
        })),
        ...limitedPages.map((page) => ({
          id: `page_${page.path}`,
          type: "page" as const,
          title: page.name,
          source: page.path,
          relevance: page.relevance,
        })),
        ...limitedLinks.map((link) => ({
          id: `link_${Buffer.from(link.url).toString("base64").slice(0, 8)}`,
          type: "link" as const,
          title: link.title,
          source: link.source,
          relevance: link.relevance,
        })),
      ];

      const result: CompactSearchResult = {
        success: true,
        query: params.query,
        courseInfo: {
          courseId: params.courseId,
          courseName: params.courseName,
        },
        citations: citations.sort((a, b) => b.relevance - a.relevance),
        metadata: baseMetadata,
        suggestions:
          suggestions.length > 0
            ? suggestions.map((s) => enforceTextBudget(s, 200))
            : undefined,
      };

      logger.info(
        `[Smart Search Tool] Found ${result.citations.length} citations for "${params.query}" in ${result.metadata.searchTime}ms (compact mode)`,
      );
      return result;
    }

    // Return full format for 'full' mode
    const result: SmartSearchResult = {
      success: true,
      query: params.query,
      courseInfo: {
        courseId: params.courseId,
        courseName: params.courseName,
      },
      results: {
        files: limitedFiles,
        pages: limitedPages,
        links: limitedLinks,
      },
      metadata: baseMetadata,
      suggestions:
        suggestions.length > 0
          ? suggestions.map((s) => enforceTextBudget(s, 200))
          : undefined,
    };

    logger.info(
      `[Smart Search Tool] Found ${result.metadata.totalResults} results for "${params.query}" in ${result.metadata.searchTime}ms (full mode)`,
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[Smart Search Tool] Search failed: ${errorMsg}`);

    const errorResult = {
      success: false,
      query: params.query,
      courseInfo: {
        courseId: params.courseId,
        courseName: params.courseName,
      },
      metadata: {
        totalResults: 0,
        searchTime: Date.now() - startTime,
        extractionUsed: false,
        discoveryMethod: "failed",
        truncated: false,
        mode: returnMode,
        intent: intent,
        reranked: false,
      },
      error: `Search failed: ${enforceTextBudget(errorMsg, 500)}`,
    };

    return returnMode === "refs"
      ? ({
          ...errorResult,
          citations: [],
        } as CompactSearchResult)
      : ({
          ...errorResult,
          results: { files: [], pages: [], links: [] },
        } as SmartSearchResult);
  }
}

/**
 * Get course content overview
 */
export async function getCourseContentOverview(
  courseId: string,
  canvasBaseUrl: string,
  accessToken: string,
  forceRefresh = false,
): Promise<{
  success: boolean;
  courseId: string;
  contentSummary: {
    totalFiles: number;
    totalPages: number;
    totalLinks: number;
    lastScanned?: Date;
    cacheAge?: string;
  };
  apiStatus: {
    status: string;
    restrictions?: string;
    recommendsDiscovery: boolean;
  };
  topFiles: Array<{
    fileId: string;
    fileName: string;
    source: string;
  }>;
  availablePages: Array<{
    name: string;
    path: string;
    accessible: boolean;
  }>;
  error?: string;
}> {
  try {
    logger.info(
      `[Smart Search Tool] Getting content overview for course ${courseId}`,
    );

    // Get current stats
    const stats = await getExtractionStats(
      courseId,
      canvasBaseUrl,
      accessToken,
    );

    // If no cache or forced refresh, trigger extraction
    if (!stats.hasCache || forceRefresh) {
      const extraction = await extractCourseContent(
        courseId,
        canvasBaseUrl,
        accessToken,
        { forceRefresh, useWebDiscovery: true },
      );

      if (!extraction.success) {
        return {
          success: false,
          courseId,
          contentSummary: { totalFiles: 0, totalPages: 0, totalLinks: 0 },
          apiStatus: { status: "unknown", recommendsDiscovery: false },
          topFiles: [],
          availablePages: [],
          error: extraction.errors.join(", "),
        };
      }

      return {
        success: true,
        courseId,
        contentSummary: {
          totalFiles: extraction.courseIndex.metadata.totalFiles,
          totalPages: extraction.courseIndex.metadata.totalPages,
          totalLinks: extraction.courseIndex.discoveredLinks.length,
          lastScanned: extraction.courseIndex.lastScanned,
        },
        apiStatus: {
          status: extraction.courseIndex.metadata.hasRestrictedAPIs
            ? "restricted"
            : "available",
          restrictions: extraction.apiRestrictions?.summary,
          recommendsDiscovery:
            extraction.method === "web" || extraction.method === "hybrid",
        },
        topFiles: extraction.courseIndex.discoveredFiles
          .slice(0, 10)
          .map((f) => ({
            fileId: f.fileId,
            fileName: f.fileName,
            source: f.source,
          })),
        availablePages: extraction.courseIndex.discoveredPages
          .slice(0, 10)
          .map((p) => ({
            name: p.name,
            path: p.path,
            accessible: p.accessible,
          })),
      };
    }

    // Use cached data
    const cacheAgeMs = stats.cacheAge || 0;
    const cacheAgeStr = formatDuration(cacheAgeMs);

    return {
      success: true,
      courseId,
      contentSummary: {
        totalFiles: stats.contentCounts.files,
        totalPages: stats.contentCounts.pages,
        totalLinks: stats.contentCounts.links,
        lastScanned: stats.lastUpdate,
        cacheAge: cacheAgeStr,
      },
      apiStatus: {
        status: stats.apiStatus,
        recommendsDiscovery: stats.apiStatus === "restricted",
      },
      topFiles: [],
      availablePages: [],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[Smart Search Tool] Overview failed: ${errorMsg}`);

    return {
      success: false,
      courseId,
      contentSummary: { totalFiles: 0, totalPages: 0, totalLinks: 0 },
      apiStatus: { status: "error", recommendsDiscovery: false },
      topFiles: [],
      availablePages: [],
      error: `Overview failed: ${errorMsg}`,
    };
  }
}

/**
 * Clear content cache for a course
 */
export function clearContentCache(courseId?: string): {
  success: boolean;
  message: string;
} {
  try {
    clearCourseCache(courseId);
    const message = courseId
      ? `Cleared content cache for course ${courseId}`
      : "Cleared content cache for all courses";

    logger.info(`[Smart Search Tool] ${message}`);
    return { success: true, message };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[Smart Search Tool] Cache clear failed: ${errorMsg}`);
    return { success: false, message: `Failed to clear cache: ${errorMsg}` };
  }
}

/**
 * Check if a file can be processed by LlamaParse
 */
function canProcessFile(fileName: string): boolean {
  const supportedExtensions = [
    // Documents
    "pdf",
    "doc",
    "docx",
    "docm",
    "dot",
    "dotm",
    "rtf",
    "txt",
    // Presentations
    "ppt",
    "pptx",
    "pptm",
    "pot",
    "potm",
    "potx",
    // Spreadsheets
    "xls",
    "xlsx",
    "xlsm",
    "xlsb",
    "csv",
    // Images
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "svg",
    "tiff",
    "webp",
    // Audio
    "mp3",
    "mp4",
    "mpeg",
    "mpga",
    "m4a",
    "wav",
    "webm",
  ];

  const extension = fileName.toLowerCase().split(".").pop() || "";
  return supportedExtensions.includes(extension);
}

/**
 * Generate search suggestions based on results
 */
function generateSearchSuggestions(query: string, searchResult: any): string[] {
  const suggestions: string[] = [];

  // If no results, suggest broader terms
  if (searchResult.totalResults === 0) {
    suggestions.push(
      'Try broader search terms like "lecture", "notes", or "slides"',
    );
    suggestions.push(
      "Check if the course has restricted APIs by viewing course overview",
    );
  }

  // If many files found, suggest refinement
  if (searchResult.files.length > 10) {
    suggestions.push(
      "Many files found - try more specific terms to narrow results",
    );
  }

  // Suggest common academic terms if current query is very short
  if (query.length < 4) {
    suggestions.push(
      'Try specific topics like "uncertainty", "quantum", "optics"',
    );
  }

  return suggestions;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return `${seconds} second${seconds > 1 ? "s" : ""} ago`;
}
