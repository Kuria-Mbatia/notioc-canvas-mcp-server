# Notioc Intelligent Layer Plan
## Complete Canvas Visibility + Intelligent Orchestration for Students

**Core Goal**: Give Claude complete access to everything a student can see on Canvas, enabling hypercontextualized responses by combining all available course data.

**Philosophy**: 
1. **Complete Visibility**: If a student can see it in Canvas → Claude can access it
2. **No Gaps**: Expose hidden/underutilized Canvas features (Analytics, Planner, Notifications)
3. **Intelligent Orchestration**: Combine multiple Canvas APIs to answer complex questions
4. **Natural Language**: Students ask questions naturally, Claude navigates Canvas's API complex**Impact**: +1% Canvas parity (direct shares unlock)

---

### 2.6 CommMessages ⭐ - ❌ REMOVED (Admin-Only API)
**Status**: Removed October 2, 2025
**Reason**: Requires admin permissions

**Issue Discovered:**
The Canvas CommMessages API (`GET /api/v1/comm_messages`) requires:
1. Admin-level permissions (not available to students)
2. Explicit `user_id` parameter (cannot use `self`)
3. Elevated scope beyond student access tokens

**Why It Doesn't Work for Students:**
- API is designed for administrators to view messages sent to specific users
- Students cannot access their own comm messages via this endpoint
- Requires institutional admin rights to query

**Alternative Solutions:**
Students already have access to notifications via:
- ✅ `get_account_notifications` - Campus-wide alerts and announcements
- ✅ Canvas web UI notifications center (not currently exposed via student APIs)
- ✅ Email notifications (external to Canvas API)

**Decision:** Removed from Phase 2 scope. Focus on student-accessible features only.

---

## Phase 2 Achievement Summary 🎉

**Status:** ✅ 100% COMPLETE (October 2, 2025)

**Implementation Results:**
- 5 features implemented (100% of student-accessible Phase 2 scope)
- 12 tools added to MCP server
- All builds clean, no TypeScript errors
- Canvas Parity: 65% → 71% (+6%)

**Tools Added:**
1. Favorites API: 3 tools (get_favorite_courses, add_favorite_course, remove_favorite_course)
2. Course Nicknames: 3 tools (get_all_course_nicknames, set_course_nickname, remove_course_nickname)
3. Bookmarks: 5 tools (get_bookmarks, get_bookmark, create_bookmark, update_bookmark, delete_bookmark)
4. History: 1 tool (get_recent_history)
5. Content Shares: 1 tool (get_content_shares)

**Student Capabilities Unlocked:**
- ✅ Quick navigation with favorites and nicknames
- ✅ Natural language course references ("Biology" vs "BIO-301-F25")
- ✅ Save and rediscover important Canvas resources
- ✅ Find "that page I looked at yesterday"
- ✅ View content instructors shared directly

**Impact on User Experience:**
Phase 2 transformed Canvas navigation to match codebase navigation patterns:
- **Favorites = Quick Access** (like frequently accessed files)
- **Nicknames = Natural Language** (like semantic_search vs file paths)
- **Bookmarks = Saved Resources** (like editor bookmarks)
- **History = Recent Items** (like recently opened files)
- **Content Shares = Direct Sharing** (like shared documents)

---

## Phase 3: Intelligent Orchestration Tools (Week 3) - ⏳ 0/4 COMPLETE (0%)t Coverage Audit (What Students Can Access)

### ✅ Already Implemented (44 tools)
- **Courses**: List, details, navigation, syllabus, modules, structure
- **Assignments**: List, details, rubrics, previous submissions, submission history
- **Grades**: Current grades, analytics, what-if scenarios, trends, categories
- **Files**: Enhanced browser, search, content extraction, LlamaParse processing
- **Discussions**: Read, post, reply, threads
- **Groups**: List, details, members, discussions
- **Quizzes**: List, details, submissions, review past quizzes
- **Calendar**: Events, due dates
- **Messages**: Send, receive conversations
- **Pages**: Course pages, content
- **Dashboard**: Basic overview
- **Users**: Profiles, search

### ❌ Missing (Student Can See But Notioc Can't Access)
- **Account Notifications** - Global alerts, campus announcements ⚠️ CRITICAL GAP
- **Canvas Analytics Dashboard** - Participation metrics, engagement scores ⚠️ CRITICAL GAP
- **Planner/TODO List** - Canvas's unified planning view ⚠️ CRITICAL GAP
- **Peer Reviews** - Assigned peer reviews, received feedback ⚠️ CRITICAL GAP
- **CommMessages** - System notifications (grade posted, feedback available)
- **Content Shares** - Items shared directly by instructors
- **Course Nicknames** - Student's renamed courses
- **Favorites** - Starred courses/groups
- **Bookmarks** - Saved Canvas pages
- **Recent History** - Recently viewed pages
- **Module Progress States** - Mark items complete/incomplete
- **Submission Read States** - Track unread feedback
- **Assignment TODO Status** - Canvas's assignment tracking
- **Course Activity Stream** - Recent activity feed
- **Announcement Read States** - Unread announcements
- **Discussion Summaries** - Canvas's AI-generated summaries

### ⚠️ Incomplete (Partial Access)
- **Submissions**: Can read but can't track read/unread feedback states
- **Modules**: Can list but can't mark items complete or track progress
- **Discussions**: Can read/post but missing: upvote, Canvas AI summaries, better read tracking
- **Files**: Can read/search but can't update/delete student's own uploads

---

---

## Revised Goal: Complete Canvas Parity

**Target**: Claude has 100% read access to everything visible to a student in Canvas web UI

**Why This Matters**:
- **Hypercontextualized Responses**: Claude can see full course state (not just isolated data)
- **No Blind Spots**: Students won't ask "why can't you see X?" when they can see it in Canvas
- **Intelligent Recommendations**: With complete visibility, Claude can suggest priorities, identify patterns, predict problems

**Example - Current Gap**:
```
Student: "What do I need to work on today?"
Claude (without complete visibility): "You have 3 assignments due this week"
Claude (with complete visibility): "URGENT: You have a peer review due in 4 hours, 
  2 unread instructor feedback comments from last week, a campus notification about 
  library closures affecting your research, and your Biology participation is in 
  the bottom 25% of class (18 page views vs class avg 47)"
```

---

## Phase 1: Critical Student Workflow Gaps (Week 1) - ✅ 5/5 COMPLETE (100%) 🎉

**PHASE 1 MILESTONE ACHIEVED!**
- Started: 45% Canvas parity (44 tools)
- Completed: 62% Canvas parity (55 tools)
- Added: 11 new tools
- Status: All critical student workflow gaps filled!
**Goal**: Fill the gaps that make students miss important shit

### 1.1 Account Notifications ⭐⭐⭐ CRITICAL ✅ COMPLETE
**Status**: Implemented October 1, 2025
**Why**: Students are blind to system-wide alerts (campus closures, policy changes, emergencies)

**API Endpoints**: ✅ Implemented
- `GET /api/v1/accounts/{account_id}/account_notifications` - List active notifications
- `DELETE /api/v1/accounts/{account_id}/account_notifications/{id}` - Close/dismiss notification

**New Tool**: ✅ `get_account_notifications`
**Implementation Files**:
- `tools/notifications.ts` - Core implementation (170 lines)
- `mcp.ts` - Tool registration and handler

**Features Implemented**:
- ✅ Fetches active account-level notifications
- ✅ Auto-resolves user's account ID
- ✅ Filters by active date range
- ✅ Priority-based sorting (error > warning > info)
- ✅ Icon formatting (🚨 error, ⚠️ warning, ℹ️ info, 📅 calendar, ❓ question)
- ✅ Dismiss notification capability (implemented but not yet exposed as tool)
- ✅ Graceful handling when notifications unavailable

**Example Output**:
```
📢 Active Account Notifications (2):

🚨 Campus Closure - Hurricane Warning
   All classes cancelled Oct 15-17 due to severe weather. 
   Campus facilities will be closed.
   Active: 10/14/2025 - 10/18/2025
   ID: 12345

ℹ️ Library Hours Extended for Finals Week
   The main library will be open 24/7 starting Dec 10.
   Active: 12/1/2025 - Ongoing
   ID: 12346
```

**Student Value**: "Are there any important announcements I need to know about?"

**Build Status**: ✅ Clean compilation, no TypeScript errors

---

### 1.2 Canvas Analytics API ⭐⭐⭐ CRITICAL - ✅ COMPLETE
**Status**: Implemented October 1, 2025

**Implementation Files**:
- `tools/analytics-dashboard.ts` - Core implementation (~430 lines)
- `mcp.ts` - Tool registration and handlers (2 tools)

**Tools Implemented**:
1. ✅ `get_canvas_analytics` - Native Canvas analytics dashboard
2. ✅ `get_student_performance_summary` - Combined analytics + grades

**Features Implemented**:
- ✅ Page views and participation levels (low/medium/high compared to class avg)
- ✅ Assignment submission patterns (on-time, late, missing, floating)
- ✅ Tardiness breakdown with percentages
- ✅ Recent activity trends (last 7 days average)
- ✅ Assignment performance averages
- ✅ Optional detailed activity data (page views/participations by day)
- ✅ Optional assignment-level analytics
- ✅ Communication analytics (messages sent/received)
- ✅ Automated risk factor detection (low engagement, missing assignments)
- ✅ Strengths identification (high participation, on-time submissions)
- ✅ Grade integration for complete performance picture

**API Endpoints Used**:
- `GET /api/v1/courses/{course_id}/analytics/users/{user_id}/student_summary` - Summary metrics
- `GET /api/v1/courses/{course_id}/analytics/users/{user_id}/activity` - Activity over time
- `GET /api/v1/courses/{course_id}/analytics/users/{user_id}/assignments` - Assignment analytics
- `GET /api/v1/courses/{course_id}/analytics/users/{user_id}/communication` - Messaging activity

**Example Formatted Output**:
```
📊 Canvas Analytics Dashboard

**Engagement Metrics:**
📄 Page Views: 245 views (🟢 High)
💬 Participations: 42 activities (🟡 Medium)
   (Participations = discussions, submissions, quizzes, etc.)

**Assignment Submission Patterns:**
✅ On Time: 15 (75%)
⏰ Late: 3 (15%)
❌ Missing: 2 (10%)
📊 Total: 20 assignments

**Recent Activity (Last 7 Days):**
📈 Avg Page Views/Day: 18
💬 Avg Participations/Day: 3

**Assignment Performance:**
📝 Submitted: 18/20
📊 Average Score: 84.2%

⚠️ **Areas for Improvement:**
  • 2 missing assignments
  • Multiple late submissions - plan ahead for deadlines

✨ **Strengths:**
  • High engagement with course materials

💡 **Note:** Analytics are calculated by Canvas based on your course activity and compared to class averages.
```

**Build Status**: ✅ Clean compilation, no TypeScript errors

**Student Queries Enabled**:
- "How am I doing in Biology?"
- "Am I participating enough in this course?"
- "Show me my engagement metrics"
- "What are my strengths and weaknesses?"
- "How active am I compared to the class?"
- "Do I have any missing assignments?"

**Impact**: +4% Canvas parity (engagement visibility unlock)

---

### 1.3 Peer Reviews ⭐⭐⭐ CRITICAL - ✅ COMPLETE
**Status**: Implemented October 1, 2025

**Implementation Files**:
- `tools/peer-reviews.ts` - Core implementation (~550 lines)
- `mcp.ts` - Tool registration and handlers (3 tools)

**Tools Implemented**:
1. ✅ `get_all_peer_reviews` - Discover all peer reviews across all courses
2. ✅ `list_peer_reviews_for_assignment` - Detailed peer review info for specific assignment
3. ✅ `get_peer_review_submission` - Get submission content to review

**Features Implemented**:
- ✅ Cross-course peer review discovery (scan all active courses)
- ✅ Split reviews into "TO complete" (where you're assessor) vs "OF your work" (feedback received)
- ✅ Anonymous reviewer/assessee support
- ✅ Completion status tracking (completed_at timestamps)
- ✅ Due date integration
- ✅ Submission content access (body, attachments, existing comments)
- ✅ Urgency indicators (⚠️ for incomplete reviews)
- ✅ Sorted by due date (soonest first)
- ✅ Feedback counting (how many comments received)

**API Endpoints Used**:
- `GET /api/v1/courses/{course_id}/assignments/{assignment_id}/peer_reviews` - List peer reviews
- `GET /api/v1/courses/{course_id}/assignments/{assignment_id}/submissions/{submission_id}` - Submission content
- `GET /api/v1/courses?enrollment_state=active` - Active courses for cross-course scan
- `GET /api/v1/courses/{course_id}/assignments` - Assignments with peer_reviews enabled

**Example Formatted Output**:
```
📝 All Peer Reviews (3 assignments)

⚠️ **English 101** - Essay 2: Rhetorical Analysis
   📅 Due: 10/15/2025
   ⏳ 2 reviews to complete
   📬 1 review received
   🆔 Course: 12345, Assignment: 67890

✅ **Biology 201** - Lab Report 3
   📅 Due: 10/18/2025
   📬 3 reviews received
   🆔 Course: 23456, Assignment: 78901

⚠️ **History 301** - Primary Source Analysis
   📅 Due: 10/20/2025
   ⏳ 1 review to complete
   🆔 Course: 34567, Assignment: 89012

⚠️ **Action Required:** 3 peer reviews to complete!

💡 **Tip:** Use list_peer_reviews_for_assignment to see details for a specific assignment.
```

**Build Status**: ✅ Clean compilation, no TypeScript errors

**Student Queries Enabled**:
- "Do I have any peer reviews to complete?"
- "What peer reviews are pending?"
- "Show me the peer review submissions I need to review"
- "What feedback did I get from peers?"
- "Are there any urgent peer reviews?"

**Impact**: +3% Canvas parity (critical gap filled - students no longer miss peer review deadlines!)

---

### 1.4 What-If Grade Calculator ⭐⭐⭐ CRITICAL - ✅ COMPLETE
**Status**: Already implemented, enhanced October 1, 2025

**Implementation Files**:
- `tools/analytics.ts` - Core implementation (already existed)
- `mcp.ts` - Tool registration enhanced

**Tool Implemented**:
✅ `generate_what_if_scenarios` - Calculate required scores for target grades

**Features Implemented**:
- ✅ Target grade by percentage (e.g., 90) or letter grade (e.g., "A")
- ✅ Current grade analysis
- ✅ Required average calculation on remaining work
- ✅ Achievability determination (mathematically possible?)
- ✅ Difficulty rating (Easy/Moderate/Challenging/Nearly Impossible)
- ✅ Multiple scenario generation
- ✅ Alternative target suggestions (if primary target too difficult)
- ✅ Remaining points and assignments tracking
- ✅ Detailed recommendations based on difficulty level
- ✅ High-value assignment identification
- ✅ Uses actual course assignment groups and weights

**API Endpoints Used**:
- `GET /api/v1/courses/{course_id}/assignment_groups` - Category weights
- `GET /api/v1/courses/{course_id}/assignments` - All assignments with points
- `GET /api/v1/courses/{course_id}/enrollments` - Current grades
- Leverages existing grade and analytics infrastructure

**Example Formatted Output**:
```
🎯 What-If Scenarios: Biology 101

## 🏆 Target Grade Analysis

**Current Grade:** 82.5%
**Target Grade:** 90% (A-)
**Is Achievable:** ✅ Yes

**Required Average on Remaining Work:** 94.2%
**Remaining Points Available:** 350
**Remaining Assignments:** 5

## 📋 Scenarios

### 🟡 Moderate: Score 94.2% average on all remaining assignments

**Required Score:** 94.2%
**Explanation:** This requires strong performance but is definitely doable.

### 🟢 Alternative: Target 85% grade instead

**Required Score:** 87.5%
**Explanation:** A slightly lower target might be more realistic.

## 💡 Recommendations

- Your target grade is achievable with strong performance.
- Consider forming study groups or attending office hours.
- Review assignment rubrics carefully to maximize points.
- Focus especially on these high-value upcoming assignments: Final Exam, Research Paper, Lab Practical
```

**Build Status**: ✅ Clean compilation, no TypeScript errors

**Student Queries Enabled**:
- "What grade do I need on the final to get an A?"
- "Can I still pass this class?"
- "What score do I need on remaining assignments?"
- "Is an A still possible?"
- "If I bomb this quiz, can I still get a B?"

**Impact**: +3% Canvas parity (THE killer feature students constantly ask for!)

---

### 1.5 Planner API ⭐⭐⭐ CRITICAL - ✅ COMPLETE
**Status**: Implemented October 1, 2025

**Implementation Files**:
- `tools/planner.ts` - Core implementation (~450 lines)
- `mcp.ts` - Tool registration and handlers (5 tools)

**Tools Implemented**:
1. ✅ `get_planner_items` - Unified TODO view across all courses
2. ✅ `create_planner_note` - Create personal reminders/notes
3. ✅ `update_planner_note` - Edit existing notes
4. ✅ `delete_planner_note` - Remove notes
5. ✅ `mark_planner_item_complete` - Check off items as done

**Features Implemented**:
- ✅ Unified planner view combining assignments, quizzes, discussions, calendar events, and personal notes
- ✅ Date filtering (startDate, endDate)
- ✅ Context filtering (specific courses)
- ✅ New activity filtering (items with recent updates)
- ✅ Submission status tracking (submitted, missing, late, graded)
- ✅ Planner overrides (marked complete, dismissed)
- ✅ Personal note management (CRUD operations)
- ✅ Chronological grouping by date
- ✅ Status icons (✅ complete, ⬜ incomplete, 🔔 new activity)
- ✅ Item type icons (📝 assignment, 📊 quiz, 💬 discussion, 📌 note, etc.)

**API Endpoints Used**:
- `GET /api/v1/planner/items` - Unified planner items
- `GET /api/v1/planner_notes` - Personal notes
- `POST /api/v1/planner_notes` - Create note
- `PUT /api/v1/planner_notes/{id}` - Update note
- `DELETE /api/v1/planner_notes/{id}` - Delete note
- `PUT /api/v1/planner/overrides/{plannable_type}/{plannable_id}` - Mark complete

**Example Formatted Output**:
```
📅 Your Planner (8 items):

**Mon, Oct 14**
  ⬜ 📝 Essay 2 (100 pts) - English 101 🔔
     ⚠️ Missing
  ✅ 📊 Quiz 3 (50 pts) - Biology 201
     ✓ Submitted
  ⬜ 📌 Study for midterm
     Note: Review chapters 1-5

**Wed, Oct 16**
  ⬜ 💬 Discussion: Climate Change - Environmental Science
  ⬜ 📄 Read Chapter 7 - History 101

💡 Tip: Use mark_planner_item_complete to check off items, or create_planner_note to add personal reminders.
```

**Build Status**: ✅ Clean compilation, no TypeScript errors

**Student Queries Enabled**:
- "What do I need to do today?"
- "What's due this week?"
- "Show me my upcoming assignments"
- "Remind me to study for bio exam on Friday"
- "Mark that essay as complete"
- "What are my incomplete tasks?"

**Impact**: +5% Canvas parity (major visibility unlock for student planning workflow)

---

## Phase 2: Smart Discovery & Navigation (Week 2) - ✅ 5/5 COMPLETE (100%) 🎉
**Goal**: Make Claude navigate Canvas like I navigate your codebase

**Note:** CommMessages removed from scope - discovered to be admin-only API requiring elevated permissions.

### 2.1 Favorites API ⭐⭐ - ✅ COMPLETE
**Status**: Implemented October 2, 2025
**Implementation Files**: `tools/favorites.ts`, `mcp.ts`

**Why**: Quick context filtering - "my important courses"

**API Endpoints**:
- `GET /api/v1/users/self/favorites/courses` - Starred courses
- `POST /api/v1/users/self/favorites/courses/{id}` - Add to favorites
- `DELETE /api/v1/users/self/favorites/courses/{id}` - Remove from favorites

**Tools Implemented**:
- `get_favorite_courses` - List all starred courses
- `add_favorite_course` - Star a course for quick access
- `remove_favorite_course` - Unstar a course

**Features**:
- Role display (student/teacher/ta)
- Enrollment state indicators (active/completed/invited)
- Date ranges for term identification
- Quick filtering to important courses

**Example Output**:
```
⭐ Your Favorite Courses

📚 Introduction to Psychology (active) - student
   ID: 123456 | Start: 2025-01-15 | End: 2025-05-15

📚 Data Structures (active) - student
   ID: 123457 | Start: 2025-01-15 | End: 2025-05-15
```

**Student Queries Enabled**:
- "Show me my important courses"
- "What are my starred classes?"
- "Star my Biology course for quick access"
- "Unstar that course I finished"

**Impact**: +2% Canvas parity (quick navigation unlock)

---

### 2.2 Course Nicknames ⭐⭐ - ✅ COMPLETE
**Status**: Implemented October 2, 2025
**Implementation Files**: `tools/nicknames.ts`, `mcp.ts`

**Why**: Natural language understanding - "Biology" vs "BIO-301-F25-SEC02"

**API Endpoints**:
- `GET /api/v1/users/self/course_nicknames` - All nicknames
- `GET /api/v1/users/self/course_nicknames/{course_id}` - Specific nickname
- `PUT /api/v1/users/self/course_nicknames/{course_id}` - Set nickname
- `DELETE /api/v1/users/self/course_nicknames/{course_id}` - Remove nickname

**Tools Implemented**:
- `get_all_course_nicknames` - List all course nicknames
- `set_course_nickname` - Set friendly course name
- `remove_course_nickname` - Clear nickname

**Features**:
- Natural language course references
- Original name → nickname mapping display
- Enables conversational queries without course codes
- Full CRUD operations for nicknames

**Example Output**:
```
📚 Your Course Nicknames

Course: BIO-301-F25-SEC02-SPRING-2025
Nickname: Biology

Course: CSCI-401-F25-001-SENIOR-PROJECT
Nickname: Capstone
```

**Student Queries Enabled**:
- "Help me with Biology" (resolves nickname automatically)
- "What's the nickname for CSCI-401?"
- "Call my Capstone course 'Senior Project'"
- "Show me all my course nicknames"
- "Remove the nickname for that course"

**Impact**: +2% Canvas parity (natural language unlock)

---

### 2.3 Bookmarks API ⭐⭐ - ✅ COMPLETE
**Status**: Implemented October 2, 2025
**Implementation Files**: `tools/bookmarks.ts`, `mcp.ts`

**Why**: Students save important Canvas URLs - specific discussion threads, study resources

**API Endpoints**:
- `GET /api/v1/users/self/bookmarks` - List bookmarks
- `POST /api/v1/users/self/bookmarks` - Create bookmark
- `GET /api/v1/users/self/bookmarks/{id}` - Get bookmark
- `PUT /api/v1/users/self/bookmarks/{id}` - Update bookmark
- `DELETE /api/v1/users/self/bookmarks/{id}` - Delete bookmark

**Tools Implemented**:
- `get_bookmarks` - List all saved bookmarks
- `get_bookmark` - Get specific bookmark details
- `create_bookmark` - Save Canvas URL (name + url required)
- `update_bookmark` - Edit bookmark (rename, change URL, reorder)
- `delete_bookmark` - Remove bookmark

**Features**:
- Save important Canvas resources (discussions, study guides, assignments)
- Full CRUD operations
- Position-based ordering for organizing bookmarks
- Quick rediscovery of saved resources
- Works with any Canvas page URL

**Example Output**:
```
📑 Your Canvas Bookmarks

1. Midterm Study Guide
   🔗 https://canvas.institution.edu/courses/12345/pages/midterm-study-guide
   ID: 98765 | Position: 1

2. Week 3 Discussion - Peer Review
   🔗 https://canvas.institution.edu/courses/12345/discussion_topics/67890
   ID: 98766 | Position: 2
```

**Student Queries Enabled**:
- "Show me that study guide I bookmarked"
- "Bookmark this discussion thread"
- "What resources have I saved?"
- "Find the midterm prep materials I saved"
- "Delete that old bookmark"

**Impact**: +3% Canvas parity (saved resources unlock)

---

### 2.4 History API ⭐ - ✅ COMPLETE
**Status**: Implemented October 2, 2025
**Implementation Files**: `tools/history.ts`, `mcp.ts`

**Why**: "What was that page I looked at yesterday?"

**API Endpoints**:
- `GET /api/v1/users/self/history` - Recent pages viewed

**Tools Implemented**:
- `get_recent_history` - Returns recently viewed Canvas pages

**Features**:
- Recently viewed pages across all courses
- Timestamps showing when each page was visited
- Time spent tracking (interaction seconds)
- Asset type identification with icons (📝 assignments, 💬 discussions, 📋 quizzes, 📄 pages, 📁 files, 📢 announcements)
- Course context for each page visit
- Optional date grouping (Today, Yesterday, specific dates)
- Full URL tracking for direct access

**Example Output**:
```
📜 Your Recent Canvas History

📅 Today
──────────────────────────────────────────────────
📝 Assignment: Midterm Essay (10:30 AM)
  Course: English Literature 201

💬 Discussion: Week 5 Topic (09:15 AM)
  Course: History 301

📅 Yesterday
──────────────────────────────────────────────────
📋 Quiz: Chapter 3 Review (04:20 PM)
  Course: Biology 101
```

**Student Queries Enabled**:
- "What was that assignment I looked at yesterday?"
- "Find the page I visited this morning"
- "Show me my recent Canvas activity"
- "What have I been working on lately?"
- "What pages did I view in the last few days?"

**Impact**: +1% Canvas parity (page rediscovery unlock)

---

### 2.5 Content Shares ⭐⭐ - ✅ COMPLETE
**Status**: Implemented October 2, 2025
**Implementation Files**: `tools/content-shares.ts`, `mcp.ts`

**Why**: Instructors share content directly with students

**API Endpoints**:
- `GET /api/v1/users/self/content_shares/received` - Shared content
- `GET /api/v1/users/self/content_shares/unread_count` - Unread count

**Tools Implemented**:
- `get_content_shares` - Returns content shared directly with the user

**Features**:
- Content shared directly by instructors or peers (separate from course materials)
- Sender information (who shared it with you)
- Read/unread status with visual indicators (🆕 for unread)
- Content type identification (📝 assignments, 💬 discussions, 📄 pages, 📎 files)
- Optional unread count summary
- Shared date timestamps
- Personal messages from senders included
- Separates unread vs. previously read shares

**Example Output**:
```
📤 Content Shared With You

🆕 You have 2 unread shares

🆕 Unread Shares
──────────────────────────────────────────────────
1. Extra Study Resources for Midterm 🆕
   👤 From: Professor Smith
   📋 Type: 📄 Page
   💬 Message: Here are some additional resources
   📅 Shared: 10/1/2025, 2:30 PM
   🔑 ID: 12345
```

**Student Queries Enabled**:
- "Did my professor share anything with me?"
- "Show me resources my instructor sent me"
- "What content has been shared with me?"
- "Do I have any unread shares?"

**Impact**: +1% Canvas parity (direct shares unlock)

---

### 2.6 CommMessages ⭐ - ⏳ NOT STARTED
**Why**: System-generated notifications (grade posted, submission feedback)

**API Endpoints**:
- `GET /api/v1/comm_messages` - List system messages

**New Tool**: `get_system_messages`
```typescript
// Returns: Canvas-generated notifications
// Use case: "What notifications do I have?"
```

---

## Phase 3: Intelligent Orchestration Tools (Week 3)
**Goal**: Combine multiple Canvas APIs intelligently

### 3.1 Student Dashboard (Composite Tool) ⭐⭐⭐
**Why**: One query, complete context

**New Tool**: `get_student_dashboard`
```typescript
// Combines:
// - Account notifications (global alerts)
// - Planner items (next 7 days)
// - Unread content shares
// - Unread CommMessages  
// - Unread submission comments
// - Missing peer reviews
// - Recent grades posted

// Returns: Everything needing attention RIGHT NOW
```

**Student Value**: "What do I need to know today?"

---

### 3.2 Course Deep Dive (Composite Tool) ⭐⭐⭐
**Why**: Complete picture of one course

**New Tool**: `analyze_course`
```typescript
// Input: { courseId: "12345" }
// Combines:
// - Course analytics (Canvas API - participation, engagement)
// - Current grades and trends
// - Missing assignments
// - Upcoming deadlines
// - Unread discussions
// - Recent announcements

// Returns: Comprehensive course health report
```

**Student Value**: "How am I doing in Biology? What do I need to focus on?"

---

### 3.3 Assignment Context Builder (Composite Tool) ⭐⭐⭐
**Why**: Everything you need to complete an assignment

**New Tool**: `get_assignment_context`
```typescript
// Input: { assignmentId: "67890" }
// Combines:
// - Assignment details + rubric
// - Required readings (from module prerequisites)
// - Related files
// - Related discussions
// - Previous submission + feedback (if exists)
// - Peer reviews to complete (if applicable)

// Returns: Complete assignment context in one call
```

**Student Value**: "Help me understand this assignment" → gets everything in context

---

### 3.4 Smart Attention Filter (Composite Tool) ⭐⭐⭐
**Why**: Prioritize what actually matters

**New Tool**: `get_priority_items`
```typescript
// Combines multiple sources, applies urgency rules:
// CRITICAL:
// - Due in <24 hours, not started
// - Peer reviews due soon
// - Account notifications with "urgent" flag

// HIGH:
// - Due in 24-72 hours
// - Unread instructor feedback (>48 hours old)
// - Grade posted significantly below average

// MEDIUM:
// - Upcoming deadlines (3-7 days)
// - New content shared
// - Discussion replies needed

// Returns: Intelligent priority queue
```

**Student Value**: "What should I work on first?"

---

## Phase 4: Enhanced Existing Features (Week 4)
**Goal**: Complete the features we already started

### 4.1 Enhanced Module Progress ⭐⭐⭐
**API Endpoints** (MISSING):
- `POST /api/v1/courses/{course_id}/modules/{module_id}/items/{id}/done` - Mark item complete
- `DELETE /api/v1/courses/{course_id}/modules/{module_id}/items/{id}/done` - Mark incomplete
- `GET /api/v1/courses/{course_id}/modules/{module_id}/items/{id}/mark_read` - Mark as read
- `GET /api/v1/courses/{course_id}/modules/{module_id}/items/{id}/sequence` - Get next/prev items

**New Features**:
- Mark module items complete
- Track read/unread status
- Navigate module sequences (next/previous)
- See completion progress

---

### 4.2 Enhanced Submissions ⭐⭐
**API Endpoints** (MISSING):
- `PUT /api/v1/courses/{course_id}/assignments/{assignment_id}/submissions/{user_id}/read` - Mark submission as read
- `DELETE /api/v1/courses/{course_id}/assignments/{assignment_id}/submissions/{user_id}/read` - Mark unread
- `GET /api/v1/courses/{course_id}/assignments/{assignment_id}/submissions/{submission_id}/summary` - Submission summary

**New Features**:
- Mark feedback as read/unread
- Track which submissions have unread feedback
- Get submission summaries

---

### 4.3 Enhanced Discussions ⭐⭐
**API Endpoints** (ALREADY AVAILABLE):
- `POST /api/v1/courses/{course_id}/discussion_topics/{topic_id}/entries/{entry_id}/rating` - Rate/upvote entry
- `GET /api/v1/courses/{course_id}/discussion_topics/{topic_id}/summaries/last` - Get Canvas's AI summary
- `POST /api/v1/courses/{course_id}/discussion_topics/{topic_id}/summaries` - Generate new summary
- `POST /api/v1/courses/{course_id}/discussion_topics/{topic_id}/summaries/feedback` - Provide feedback on summary

**New Features**:
- Upvote/downvote discussion posts
- Get Canvas's own AI-generated discussion summaries (don't rebuild this!)
- Provide feedback on summaries

---

## Implementation Strategy

### Week 1: Foundation (Critical APIs)
**Day 1-2**: Account Notifications, Planner Items
**Day 3-4**: Canvas Analytics, Peer Reviews  
**Day 5-7**: What-If Grade Calculator, Testing

### Week 2: Discovery (Navigation APIs)
**Day 1-2**: Favorites, Course Nicknames, Bookmarks
**Day 3-4**: History, Content Shares, CommMessages
**Day 5-7**: Integration testing, documentation

### Week 3: Intelligence (Composite Tools)
**Day 1-2**: Student Dashboard
**Day 3-4**: Course Deep Dive
**Day 5-7**: Assignment Context Builder, Smart Attention Filter

### Week 4: Enhancement (Complete Existing)
**Day 1-2**: Module progress tracking
**Day 3-4**: Submission read states
**Day 5-7**: Discussion enhancements, final testing

---

## Success Metrics

**Phase 1 Complete = 70% Canvas Parity**
- All critical student workflows covered
- Students can ask: "What do I need to know?" "How am I doing?" "What grade do I need?"

**Phase 2 Complete = 85% Canvas Parity**
- All discovery/navigation features covered
- Students can customize their experience (favorites, nicknames, bookmarks)

**Phase 3 Complete = 95% Canvas Parity**
- Intelligent orchestration adds value beyond raw Canvas access
- Complex questions get complete, contextualized answers

**Phase 4 Complete = 100% Canvas Parity + Enhanced Intelligence**
- Every visible Canvas feature accessible via Claude
- Intelligent prioritization, prediction, pattern recognition
- Claude becomes better at navigating Canvas than the student

**Student Queries That Prove Complete Visibility**:
- "What do I need to know today?" → Account notifications + planner
- "How am I doing in Biology?" → Analytics + grades
- "Do I have peer reviews to complete?" → Peer reviews API
- "What grade do I need on the final?" → What-if calculator
- "What's due this week?" → Planner items

**Student Queries That Work After Phase 2**:
- "Show me my important courses" → Favorites
- "Help me with biology" → Course nicknames resolve
- "Show me that resource I saved" → Bookmarks
- "Did my professor share anything?" → Content shares

**Student Queries That Work After Phase 3**:
- "What should I work on first?" → Smart priority filter
- "Give me the full picture of this course" → Course deep dive
- "Everything I need to complete this assignment" → Assignment context

**Student Queries That Work After Phase 4**:
- "Mark this module item as done" → Module progress
- "Do I have unread feedback?" → Submission read states
- "Summarize this 100-comment discussion" → Canvas AI summaries

---

## Key Principles

1. **Don't Rebuild Canvas**: Use Canvas's native features (Analytics, Planner, AI Summaries)
2. **Intelligent Orchestration**: Combine 2-3 APIs to answer complex questions
3. **Student-First**: Every tool solves a real student pain point
4. **Natural Language**: Support how students actually ask questions
5. **Priority-Aware**: Help students focus on what matters most

---

## Tools Breakdown by Priority

**CRITICAL (Build First)**:
1. Account Notifications
2. Canvas Analytics
3. Peer Reviews
4. What-If Grades
5. Planner Items

**HIGH (Build Next)**:
6. Student Dashboard (composite)
7. Course Analytics (composite)
8. Favorites
9. Course Nicknames
10. Module Progress

**MEDIUM (Polish)**:
11. Bookmarks
12. Content Shares
13. History
14. Assignment Context Builder
15. Smart Attention Filter

**LOW (Nice-to-Have)**:
16. CommMessages
17. Discussion enhancements
18. Submission read states

---

## Let's Fucking Do This! 🚀

Target: 20-25 new/enhanced tools that make Notioc the **intelligent layer** between students and Canvas.

Next Step: Pick a starting point and start building!
