# Missing Canvas Features

This file outlines Canvas LMS functionality that the Notioc Canvas MCP Server does not yet implement. Each section lists core API endpoints and notes about what student-level access allows. These references should help prioritize future additions.

## Quizzes
- **Status:** Not yet supported.
- **Relevant APIs:**
  - `GET /api/v1/courses/:course_id/quizzes`
  - `GET /api/v1/courses/:course_id/quizzes/:quiz_id`
- **Permissions:** Students can view published quizzes and their own quiz submissions. Creating or managing quizzes requires instructor privileges.

## Gradebook
- **Status:** Gradebook data and score retrieval are not available.
- **Relevant APIs:**
  - `GET /api/v1/courses/:course_id/gradebook_history` (teacher/admin only)
  - `GET /api/v1/courses/:course_id/students/submissions` (student view of own grades)
- **Permissions:** Students may only access their own grades. Full gradebook history and analytics generally require instructor tokens.

## Modules
- **Status:** Course modules and items are not exposed by the server.
- **Relevant APIs:**
  - `GET /api/v1/courses/:course_id/modules`
  - `GET /api/v1/courses/:course_id/modules/:module_id/items`
- **Permissions:** Students can view published modules but cannot modify them.

## Inbox Messages (Conversations)
- **Status:** Canvas inbox messages are not integrated.
- **Relevant APIs:**
  - `GET /api/v1/conversations`
  - `POST /api/v1/conversations`
- **Permissions:** Students may read and send messages only in conversations where they are participants. Additional scopes may be required for some actions.

## Other Areas for Expansion
Additional features that could be implemented include calendar events, analytics, groups and peer reviews, each with their respective API endpoints. Many of these require instructor-level or higher permissions to access data beyond a student's own records.
