/**
 * Canvas URL Processor Tool
 * Processes direct Canvas URLs when normal discovery fails
 */

import {
  parseCanvasURL,
  extractFileIdsFromHTML,
  extractLinksFromHTML,
  validateCanvasURL,
} from "../lib/url-processor.js";
import { getFileContent } from "./files.js";
import { getPageContent } from "./pages-discussions.js";
import { logger } from "../lib/logger.js";

export interface ProcessCanvasURLParams {
  canvasBaseUrl: string;
  accessToken: string;
  url: string;
  extractEmbedded?: boolean;
  processFiles?: boolean;
}

export interface ProcessedURLResult {
  type: string;
  courseId: string;
  resourceId?: string;
  resourceName?: string;
  content?: string;
  embeddedFiles?: Array<{ fileId: string; fileName: string; url: string }>;
  embeddedLinks?: Array<{ title: string; url: string; type: string }>;
  processed: boolean;
  error?: string;
  metadata: {
    processingTime: number;
    method: "direct" | "web_interface" | "api";
    accessible: boolean;
  };
}

/**
 * Process any Canvas URL and extract content/information
 */
export async function processCanvasURL(
  params: ProcessCanvasURLParams,
): Promise<ProcessedURLResult> {
  const startTime = Date.now();

  try {
    logger.info(`[URL Processor] Processing Canvas URL: ${params.url}`);

    // Parse the URL to understand what we're dealing with
    const urlInfo = parseCanvasURL(params.url);

    if (!urlInfo.isValid) {
      return {
        type: "unknown",
        courseId: "",
        processed: false,
        error: "Invalid Canvas URL format",
        metadata: {
          processingTime: Date.now() - startTime,
          method: "direct",
          accessible: false,
        },
      };
    }

    logger.debug(
      `[URL Processor] Parsed URL: ${urlInfo.type} in course ${urlInfo.courseId}`,
    );

    // Validate URL is accessible
    const accessible = await validateCanvasURL(params.url, params.accessToken);
    if (!accessible) {
      return {
        type: urlInfo.type,
        courseId: urlInfo.courseId,
        resourceId: urlInfo.resourceId,
        resourceName: urlInfo.resourceName,
        processed: false,
        error: "URL not accessible with current permissions",
        metadata: {
          processingTime: Date.now() - startTime,
          method: "direct",
          accessible: false,
        },
      };
    }

    let content: string | undefined;
    let embeddedFiles: Array<{
      fileId: string;
      fileName: string;
      url: string;
    }> = [];
    let embeddedLinks: Array<{ title: string; url: string; type: string }> = [];
    let method: "direct" | "web_interface" | "api" = "direct";

    // Process based on URL type
    switch (urlInfo.type) {
      case "file":
        if (urlInfo.resourceId && params.processFiles) {
          try {
            const fileResult = await getFileContent({
              canvasBaseUrl: params.canvasBaseUrl,
              accessToken: params.accessToken,
              fileId: urlInfo.resourceId,
            });
            content = fileResult.content;
            method = "api";
            logger.info(
              `[URL Processor] Processed file ${urlInfo.resourceId} via API`,
            );
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            logger.warn(
              `[URL Processor] File API failed, trying direct download: ${errorMsg}`,
            );
            content = `File ${urlInfo.resourceId} - Direct download available at: ${params.url}`;
            method = "direct";
          }
        } else {
          content = `File ${urlInfo.resourceId} - Available at: ${params.url}`;
        }
        break;

      case "page":
        if (urlInfo.resourceId) {
          try {
            const pageResult = await getPageContent({
              canvasBaseUrl: params.canvasBaseUrl,
              accessToken: params.accessToken,
              courseId: urlInfo.courseId,
              pageUrl: urlInfo.resourceId,
            });
            content = pageResult.body;
            method = "api";
            logger.info(
              `[URL Processor] Processed page ${urlInfo.resourceId} via API`,
            );
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            logger.warn(
              `[URL Processor] Page API failed, trying web interface: ${errorMsg}`,
            );

            // Try web interface fallback
            try {
              const response = await fetch(params.url, {
                headers: {
                  Authorization: `Bearer ${params.accessToken}`,
                  Accept: "text/html",
                },
              });

              if (response.ok) {
                const html = await response.text();
                content = html;
                method = "web_interface";
                logger.info(
                  `[URL Processor] Processed page ${urlInfo.resourceId} via web interface`,
                );
              } else {
                throw new Error(`Web interface failed: ${response.status}`);
              }
            } catch (webError) {
              const webErrorMsg =
                webError instanceof Error ? webError.message : String(webError);
              content = `Page ${urlInfo.resourceName || urlInfo.resourceId} - Error accessing content: ${webErrorMsg}`;
            }
          }
        }
        break;

      default:
        // For other types, try to fetch as HTML and extract content
        try {
          const response = await fetch(params.url, {
            headers: {
              Authorization: `Bearer ${params.accessToken}`,
              Accept: "text/html",
            },
          });

          if (response.ok) {
            const html = await response.text();
            content = html;
            method = "web_interface";
            logger.info(
              `[URL Processor] Processed ${urlInfo.type} via web interface`,
            );
          } else {
            content = `Resource accessible at: ${params.url}`;
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          content = `Resource ${urlInfo.type} - Error accessing content: ${errorMsg}`;
        }
    }

    // Extract embedded content if requested
    if (params.extractEmbedded && content && method === "web_interface") {
      try {
        embeddedFiles = extractFileIdsFromHTML(content, urlInfo.baseUrl);
        embeddedLinks = extractLinksFromHTML(content);

        logger.info(
          `[URL Processor] Extracted ${embeddedFiles.length} files and ${embeddedLinks.length} links`,
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn(
          `[URL Processor] Failed to extract embedded content: ${errorMsg}`,
        );
      }
    }

    return {
      type: urlInfo.type,
      courseId: urlInfo.courseId,
      resourceId: urlInfo.resourceId,
      resourceName: urlInfo.resourceName,
      content,
      embeddedFiles: embeddedFiles.length > 0 ? embeddedFiles : undefined,
      embeddedLinks: embeddedLinks.length > 0 ? embeddedLinks : undefined,
      processed: true,
      metadata: {
        processingTime: Date.now() - startTime,
        method,
        accessible: true,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[URL Processor] Error processing URL: ${errorMsg}`);

    return {
      type: "unknown",
      courseId: "",
      processed: false,
      error: `Processing failed: ${errorMsg}`,
      metadata: {
        processingTime: Date.now() - startTime,
        method: "direct",
        accessible: false,
      },
    };
  }
}

/**
 * Extract file information from a Canvas URL without processing content
 */
export async function extractFileInfoFromURL(
  params: ProcessCanvasURLParams,
): Promise<{ fileId: string; fileName?: string; accessible: boolean }[]> {
  try {
    const urlInfo = parseCanvasURL(params.url);

    if (urlInfo.type === "file" && urlInfo.resourceId) {
      // Direct file URL
      const accessible = await validateCanvasURL(
        params.url,
        params.accessToken,
      );
      return [
        {
          fileId: urlInfo.resourceId,
          fileName: urlInfo.resourceName,
          accessible,
        },
      ];
    } else {
      // Try to extract embedded files from page content
      const result = await processCanvasURL({
        ...params,
        extractEmbedded: true,
        processFiles: false,
      });

      if (result.embeddedFiles) {
        return result.embeddedFiles.map((file) => ({
          fileId: file.fileId,
          fileName: file.fileName,
          accessible: true,
        }));
      }
    }

    return [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`[URL Processor] Error extracting file info: ${errorMsg}`);
    return [];
  }
}
