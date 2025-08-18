import { expect, test } from "vitest";
import * as users from "../../src/tools/users.js";

// Import all functions and types from the users module
const {
  FindPeopleParams,
  SearchRecipientsParams,
  UserInfo,
  RecipientInfo,
  findPeopleInCourse,
  searchRecipients,
  getUserProfile,
  getMyProfile,
  // Add other exports as needed
} = users;
