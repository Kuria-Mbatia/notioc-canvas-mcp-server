import { expect, test } from "vitest";
import * as pagesDiscussions from "../../src/tools/pages-discussions.js";

// Import all functions and types from the pages-discussions module
const {
  PagesListParams,
  PageContentParams,
  DiscussionsListParams,
  DiscussionContentParams,
  PageInfo,
  DiscussionInfo,
  listPages,
  getPageContent,
  listDiscussions,
  getDiscussionContent,
  // Add other exports as needed
} = pagesDiscussions;
