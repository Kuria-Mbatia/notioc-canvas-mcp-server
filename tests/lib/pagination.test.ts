import { expect, test } from "vitest";
import * as pagination from "../../src/lib/pagination.js";

// Import all functions and types from the pagination module
const {
  fetchAllPaginated,
  fetchPaginatedData,
  parseLinkHeader,
  // Add other exports as needed
} = pagination;
