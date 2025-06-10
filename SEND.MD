# Canvas Messaging and Posting Plan

This document outlines how to extend the MCP server so an LLM can create discussion replies, send inbox messages and search for course users. The goal is to expose POST capabilities that are allowed with a student API token.

## 1. Post to Discussion Topics

* **Endpoint:** `POST /api/v1/courses/:course_id/discussion_topics/:topic_id/entries`
* **Tool:** `post_discussion_reply`
* **Implementation Steps:**
  1. Add a function in `tools/discussions.ts` that accepts `courseId`, `topicId` and `message`.
  2. Use `callCanvasAPI` with method `POST` and the endpoint above. The body must include `message` and optional `attachment_ids`.
  3. Return the created `CanvasDiscussionEntry`.
  4. Register the tool in `src/server.ts` so agents can invoke it.

## 2. Send and Reply to Messages

* **Endpoints:**
  * `POST /api/v1/conversations` – start a new conversation
  * `POST /api/v1/conversations/:id/add_message` – reply in an existing conversation
* **Tool:** `send_message`
* **Implementation Steps:**
  1. Create `tools/messages.ts` with functions `createConversation` and `replyToConversation`.
  2. The creation function should accept recipient user IDs and the initial `body` text. Pass those fields in the POST body.
  3. The reply function needs the `conversationId` and `body` text.
  4. Both functions use `callCanvasAPI` with the appropriate endpoint.
  5. Expose these as MCP tools in `src/server.ts`.

## 3. Search for People

To send a message you need the recipient's Canvas user ID.

* **Endpoint:** `GET /api/v1/courses/:course_id/users` (or `/api/v1/search/recipients` if enabled)
* **Tool:** `find_people`
* **Implementation Steps:**
  1. Implement a function that lists users matching a name query within a course.
  2. Use query parameter `search_term` to filter results.
  3. Return user IDs and display names so callers can choose the correct recipient.
  4. Register this tool as well.

## Permissions

Student tokens can only send messages to and view conversations they are part of. Some institutions may restrict the recipient search endpoint. Posting in discussions is allowed when the topic is open and the student is enrolled. Always handle permission errors gracefully.

This plan will allow the MCP server to perform basic POST operations for discussions and messaging, enabling future agents to communicate through Canvas on behalf of the user.
