import { callCanvasAPI } from "../lib/canvas-api.js";
import { logger } from "../lib/logger.js";

export interface CanvasFileDownloadParams {
  canvasBaseUrl: string;
  accessToken: string;
  submissionUrl?: string; // Like: https://psu.instructure.com/courses/2387011/assignments/17056790/submissions/7145151?download=179725016
  fileId?: string; // Direct file ID
  courseId?: string;
  assignmentId?: string;
  submissionId?: string;
}

export async function downloadSubmissionFile(
  params: CanvasFileDownloadParams,
): Promise<{
  filename: string;
  content: string;
  contentType: string;
  size: number;
}> {
  const {
    canvasBaseUrl,
    accessToken,
    submissionUrl,
    fileId,
    courseId,
    assignmentId,
    submissionId,
  } = params;

  try {
    let downloadFileId = fileId;

    // If we have a submission URL, extract the file ID
    if (submissionUrl && !downloadFileId) {
      const urlParams = new URL(submissionUrl);
      const extractedFileId = urlParams.searchParams.get("download");

      if (!extractedFileId) {
        throw new Error("Could not extract file ID from submission URL");
      }

      downloadFileId = extractedFileId;
      logger.info(`Extracted file ID ${downloadFileId} from submission URL`);
    }

    if (!downloadFileId) {
      throw new Error("No file ID provided or could be extracted");
    }

    // Method 1: Try Canvas file API with the extracted file ID
    logger.info(`Attempting to download file ID: ${downloadFileId}`);

    const fileInfoResponse = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: "GET",
      apiPath: `/api/v1/files/${downloadFileId}`,
    });

    if (!fileInfoResponse.ok) {
      throw new Error(
        `Failed to get file info: ${fileInfoResponse.status} ${fileInfoResponse.statusText}`,
      );
    }

    const fileInfo = await fileInfoResponse.json();
    logger.info(
      `File info: ${fileInfo.display_name}, size: ${fileInfo.size}, type: ${fileInfo["content-type"]}`,
    );

    // Method 2: Try different download strategies
    const downloadStrategies = [
      // Strategy 1: Canvas API download endpoint
      `${canvasBaseUrl}/api/v1/files/${downloadFileId}/download`,
      // Strategy 2: Direct file URL
      fileInfo.url,
      // Strategy 3: If we have course/assignment context, try submission-specific endpoint
      ...(courseId && assignmentId && submissionId
        ? [
            `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/attachments/${downloadFileId}`,
          ]
        : []),
    ];

    let fileResponse;
    let successfulUrl;

    for (const url of downloadStrategies) {
      try {
        logger.info(`Trying download URL: ${url}`);

        fileResponse = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "*/*",
            "User-Agent": "Canvas-MCP-Client/1.0",
          },
          redirect: "follow",
        });

        if (fileResponse.ok) {
          successfulUrl = url;
          logger.info(`Successfully downloaded from: ${url}`);
          break;
        } else {
          logger.warn(
            `Download failed from ${url}: ${fileResponse.status} ${fileResponse.statusText}`,
          );
        }
      } catch (error) {
        logger.warn(`Error downloading from ${url}: ${error}`);
      }
    }

    if (!fileResponse || !fileResponse.ok) {
      throw new Error("All download strategies failed");
    }

    // Process the file content
    const contentType =
      fileResponse.headers.get("content-type") ||
      fileInfo["content-type"] ||
      "application/octet-stream";
    const contentLength =
      parseInt(fileResponse.headers.get("content-length") || "0") ||
      fileInfo.size ||
      0;

    let content: string;

    if (
      contentType.includes("text") ||
      contentType.includes("json") ||
      contentType.includes("xml")
    ) {
      content = await fileResponse.text();
    } else if (contentType.includes("pdf")) {
      // For PDFs, we'll provide a placeholder since we can't extract text easily
      const buffer = await fileResponse.arrayBuffer();
      content = `[PDF File: ${fileInfo.display_name}, ${buffer.byteLength} bytes]\n\nThis is a PDF file. To view the actual content, you would need to download and open it in a PDF viewer.\n\nDownload from: ${successfulUrl}`;
    } else {
      // For other binary files
      const buffer = await fileResponse.arrayBuffer();
      content = `[Binary File: ${fileInfo.display_name}, ${buffer.byteLength} bytes, type: ${contentType}]\n\nThis is a binary file that cannot be displayed as text.\n\nDownload from: ${successfulUrl}`;
    }

    return {
      filename: fileInfo.display_name,
      content,
      contentType,
      size: contentLength,
    };
  } catch (error) {
    logger.error(`Failed to download submission file: ${error}`);
    throw new Error(
      `Failed to download submission file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
