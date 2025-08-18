import { expect, test, describe } from "vitest";
import {
  parseCanvasURL,
  webUrlToApiUrl,
  extractFileIdsFromHTML,
  extractLinksFromHTML,
  validateCanvasURL,
} from "@/lib/url-processor";
