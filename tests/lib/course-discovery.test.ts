import { expect, test } from "vitest";
import * as courseDiscovery from "../../src/lib/course-discovery.js";

// Import all functions and types from the course-discovery module
const {
  CourseAPIAvailability,
  APIEndpointStatus,
  CANVAS_API_ENDPOINTS,
  getCachedDiscovery,
  setCachedDiscovery,
  // Add other exports as needed
} = courseDiscovery;
