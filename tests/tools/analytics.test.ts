import { expect, test } from "vitest";
import * as analytics from "../../src/tools/analytics.js";

// Import all functions and types from the analytics module
const {
  CourseAnalyticsParams,
  WhatIfScenarioParams,
  GradeTrendsParams,
  CourseAnalyticsInfo,
  WhatIfScenarioInfo,
  GradeTrendsInfo,
  calculateCourseAnalytics,
  generateWhatIfScenarios,
  getGradeTrends,
  // Add other exports as needed
} = analytics;
