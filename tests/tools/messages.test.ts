import { expect, test } from "vitest";
import * as messages from "../../src/tools/messages.js";

// Import all functions and types from the messages module
const {
  SendMessageParams,
  MessageInfo,
  createConversation,
  replyToConversation,
  listConversations,
  getConversationDetails,
  // Add other exports as needed
} = messages;
