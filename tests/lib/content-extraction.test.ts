import { expect, test, describe } from "vitest";
import {
  extractContentFromHTML,
  extractTextFromHTML,
  extractLinksFromContent,
  parseCanvasContent,
} from "@/lib/content-extraction";
