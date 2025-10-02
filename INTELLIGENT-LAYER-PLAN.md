# Notioc Intelligent Layer Plan
## Complete Canvas Visibility + Intelligent Orchestration for Students

**Core Goal**: Give Claude complete access to everything a student can see on Canvas, enabling hypercontextualized responses by combining all available course data.

**Philosophy**: 
1. **Complete Visibility**: If a student can see it in Canvas → Claude can access it
2. **No Gaps**: Expose hidden/underutilized Canvas features (Analytics, Planner, Notifications)
3. **Intelligent Orchestration**: Combine multiple Canvas APIs to answer complex questions
4. **Natural Language**: Students ask questions naturally, Claude navigates Canvas's API complexity

---

## Current Coverage Audit (What Students Can Access)

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

## Phase 1: Critical Student Workflow Gaps (Week 1) - ✅ 2/5 COMPLETE (40%)
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

### 1.2 Canvas Analytics API ⭐⭐⭐ CRITICAL - ⏳ NEXT
**Why**: Canvas already calculates participation, assignment patterns, engagement metrics - we're just not exposing it!

**API Endpoints**:
- `GET /api/v1/courses/{course_id}/analytics/student_summaries` - All students summary (filtered to current user)
- `GET /api/v1/courses/{course_id}/analytics/users/{user_id}/activity` - Participation data
- `GET /api/v1/courses/{course_id}/analytics/users/{user_id}/assignments` - Assignment performance trends
- `GET /api/v1/courses/{course_id}/analytics/users/{user_id}/communication` - Messaging activity

**New Tools**:

**`get_course_analytics`**
```typescript
// Input: { courseId: "12345" }
// Returns Canvas's own calculated metrics:
{
  participation: {
    pageViews: 245,
    participations: 42, // discussions, submissions, etc.
    pageViewsLevel: "high" | "medium" | "low",
    participationsLevel: "high" | "medium" | "low"
  },
  assignments: [
    {
      title: "Essay 1",
      dueAt: "...",
      submitted: true,
      onTime: true,
      score: 85,
      pointsPossible: 100
    }
  ],
  tardiness: {
    missing: 2,
    late: 3,
    onTime: 15,
    total: 20
  }
}
```

**`get_student_performance_summary`**
```typescript
// Input: { courseId: "12345" }
// Combines analytics + grades for complete picture
{
  currentGrade: "82%",
  engagement: "medium", // from Canvas Analytics
  riskFactors: [
    "2 missing assignments",
    "Low participation (15 page views this week vs avg 45)"
  ],
  strengths: [
    "100% on-time submission rate for completed work",
    "Above average discussion participation"
  ]
}
```

**Student Value**: "How am I doing in Biology?" → Get real engagement metrics, not just grades

---

### 1.3 Peer Reviews ⭐⭐⭐ CRITICAL
**Why**: Students miss peer review deadlines because they don't know they exist

**API Endpoints**:
- `GET /api/v1/courses/{course_id}/assignments/{assignment_id}/peer_reviews` - List peer review assignments
- `GET /api/v1/courses/{course_id}/assignments/{assignment_id}/submissions/{submission_id}/peer_reviews` - Reviews for a submission
- `POST /api/v1/courses/{course_id}/assignments/{assignment_id}/submissions/{submission_id}/peer_reviews` - Create peer review
- `DELETE /api/v1/courses/{course_id}/assignments/{assignment_id}/submissions/{submission_id}/peer_reviews/{user_id}` - Delete peer review

**New Tools**:

**`list_peer_reviews`**
```typescript
// Input: { courseId: "12345", assignmentId: "67890" }
// Returns:
{
  myReviewsToComplete: [
    {
      assesseeId: "anonymous_student_1",
      assesseeName: "Anonymous Student", // if anonymous
      submissionUrl: "...",
      dueDate: "2025-10-15T23:59:00Z",
      completed: false
    }
  ],
  reviewsOfMyWork: [
    {
      assessorName: "Jane Smith",
      completedAt: "2025-10-10T14:30:00Z",
      comments: "Great analysis of the topic..."
    }
  ]
}
```

**`get_peer_review_submission`**
```typescript
// Input: { courseId, assignmentId, submissionId }
// Returns the submission content to review
```

**Student Value**: "Do I have any peer reviews to complete?" "What feedback did I get from peers?"

---

### 1.4 What-If Grade Calculator ⭐⭐⭐ CRITICAL
**Why**: This is THE killer feature students want - "what grade do I need on the final?"

**API Endpoints**:
- Canvas doesn't have a direct API for this, but we can calculate it using:
- `GET /api/v1/courses/{course_id}/assignment_groups` - Get weighted categories
- `GET /api/v1/courses/{course_id}/assignments` - All assignments with points
- `GET /api/v1/courses/{course_id}/enrollments` - Current grades

**New Tool**: `calculate_what_if_grade`
```typescript
// Input: 
{
  courseId: "12345",
  scenarios: [
    { assignmentId: "111", hypotheticalScore: 95 },
    { assignmentId: "222", hypotheticalScore: 88 }
  ]
}

// Returns:
{
  currentGrade: 82.5,
  projectedGrade: 87.3,
  breakdown: {
    "Exams (40%)": { current: 85, projected: 92 },
    "Assignments (30%)": { current: 78, projected: 82 },
    "Participation (30%)": { current: 85, projected: 85 }
  },
  recommendations: [
    "Score 92% on Final Exam to achieve A (90%)",
    "Even with 100% on Final, max possible grade is 94.2%"
  ]
}
```

**Student Value**: "What do I need on the final to get an A?" "If I bomb this quiz, can I still pass?"

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

## Phase 2: Smart Discovery & Navigation (Week 2)
**Goal**: Make Claude navigate Canvas like I navigate your codebase

### 2.1 Favorites API ⭐⭐
**Why**: Quick context filtering - "my important courses"

**API Endpoints**:
- `GET /api/v1/users/self/favorites/courses` - Starred courses
- `POST /api/v1/users/self/favorites/courses/{id}` - Add to favorites
- `DELETE /api/v1/users/self/favorites/courses/{id}` - Remove from favorites

**New Tool**: `manage_favorites`
```typescript
// Get starred courses, add/remove
// Returns: list of favorite courses for quick filtering
```

**Student Value**: "Show me my important courses" → instant context

---

### 2.2 Course Nicknames ⭐⭐
**Why**: Natural language understanding - "the hard one" vs "BIO-301-F25-SEC02"

**API Endpoints**:
- `GET /api/v1/users/self/course_nicknames` - All nicknames
- `GET /api/v1/users/self/course_nicknames/{course_id}` - Specific nickname
- `PUT /api/v1/users/self/course_nicknames/{course_id}` - Set nickname
- `DELETE /api/v1/users/self/course_nicknames/{course_id}` - Remove nickname

**New Tool**: `manage_course_nicknames`
```typescript
// Set: "BIO 101" → "Biology" or "The hard class"
// Get: Resolve "help me with biology" → course ID
```

**Student Value**: Natural queries work better - "help me with biology" vs "help me with BIO-301-F25-001"

---

### 2.3 Bookmarks API ⭐⭐
**Why**: Students save important Canvas URLs - specific discussion threads, study resources

**API Endpoints**:
- `GET /api/v1/users/self/bookmarks` - List bookmarks
- `POST /api/v1/users/self/bookmarks` - Create bookmark
- `GET /api/v1/users/self/bookmarks/{id}` - Get bookmark
- `PUT /api/v1/users/self/bookmarks/{id}` - Update bookmark
- `DELETE /api/v1/users/self/bookmarks/{id}` - Delete bookmark

**New Tool**: `manage_bookmarks`
```typescript
// Input: { action: "list" | "add" | "remove", url?, name? }
// Returns: saved Canvas resources
```

**Student Value**: "Show me that study guide I saved" "Bookmark this discussion thread"

---

### 2.4 History API ⭐
**Why**: "What was that page I looked at yesterday?"

**API Endpoints**:
- `GET /api/v1/users/self/history` - Recent pages viewed

**New Tool**: `get_recent_history`
```typescript
// Returns: recently viewed Canvas pages
// Use case: "Find that assignment I was looking at earlier"
```

---

### 2.5 Content Shares ⭐⭐
**Why**: Instructors share content directly with students

**API Endpoints**:
- `GET /api/v1/users/self/content_shares/received` - Shared content
- `GET /api/v1/users/self/content_shares/received/{id}/unread_count` - Unread count

**New Tool**: `get_content_shares`
```typescript
// Returns: content professors shared directly with you
// Use case: "Did my professor share anything with me?"
```

---

### 2.6 CommMessages ⭐
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
