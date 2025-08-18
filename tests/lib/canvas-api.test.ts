import { expect, test, describe } from "vitest";
import {
  callCanvasAPI,
  makeCanvasRequest,
  handleCanvasError,
  validateCanvasCredentials,
  testCanvasConnection,
} from "@/lib/canvas-api";
