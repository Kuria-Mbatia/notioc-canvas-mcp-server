# Canvas Groups Feature

## Overview

The Canvas MCP Server now supports full Canvas Groups functionality! Groups are used for collaboration, group projects, group discussions, and team coordination within Canvas courses.

## Why Groups Matter

In Canvas, groups are often used for:
- **Group Projects**: Collaborate on assignments with team members
- **Group Discussions**: Separate discussion boards just for your group
- **Group Announcements**: Communication within the group
- **Shared Files**: Files uploaded to the group space
- **Group Submissions**: Submit assignments as a group

Many courses store important content and discussions **only within groups**, which aren't accessible through regular course tools. This feature ensures Claude can access all your course materials!

## Available Tools

### 1. `list_groups`
List all groups you're a member of, or groups within a specific course.

**Parameters:**
- `courseId` (optional): Filter by specific course ID
- `courseName` (optional): Filter by course name (e.g., "Data Structures")

**Example Usage:**
```
"What groups am I in?"
"Show me the groups in my Biology course"
```

**Returns:**
- Group ID, name, member count, course ID, and your role

### 2. `get_group_details`
Get detailed information about a specific group.

**Parameters:**
- `groupId` (required): The Canvas group ID

**Example Usage:**
```
"Tell me about group 12345"
"What are the details of my project group?"
```

**Returns:**
- Full description, permissions, join settings, member count, and whether group is public

### 3. `list_group_members`
List all members of a specific group.

**Parameters:**
- `groupId` (required): The Canvas group ID

**Example Usage:**
```
"Who's in my project group?"
"Show me the members of group 12345"
```

**Returns:**
- Member names, login IDs, pronouns, and avatar URLs

### 4. `list_group_discussions`
List discussion topics in a group's discussion board.

**Parameters:**
- `groupId` (required): The Canvas group ID
- `orderBy` (optional): Sort by 'position', 'recent_activity', or 'title'

**Example Usage:**
```
"What discussions are in my group?"
"Show me recent group discussions"
```

**Returns:**
- Discussion topics with reply counts, unread counts, and timestamps

### 5. `get_group_discussion`
Get a specific discussion topic from a group.

**Parameters:**
- `groupId` (required): The Canvas group ID
- `topicId` (required): The discussion topic ID

**Example Usage:**
```
"Show me discussion 98765 from my group"
"Read the latest group announcement"
```

**Returns:**
- Full discussion content, author, timestamps, and reply information

### 6. `post_group_discussion`
Create a new discussion topic in a group.

**Parameters:**
- `groupId` (required): The Canvas group ID
- `title` (required): Discussion title
- `message` (required): Discussion message/content
- `discussionType` (optional): 'threaded' (default) or 'side_comment'

**Example Usage:**
```
"Post a discussion to my group about meeting times"
"Create a group announcement about the project deadline"
```

**Returns:**
- Confirmation with discussion ID and title

## Common Workflows

### Finding Your Groups
```
User: "What groups am I in?"
→ list_groups (no course specified)
→ Shows all groups across all courses
```

### Accessing Group Discussions
```
User: "What's being discussed in my project group?"
→ list_groups (to find group ID)
→ list_group_discussions (to see topics)
→ get_group_discussion (to read specific posts)
```

### Coordinating with Group Members
```
User: "Who else is in my group for the final project?"
→ list_groups (find the group)
→ list_group_members (see all members)
→ get_user_profile (optional: get contact info)
```

### Posting to Group
```
User: "Post to my group that I finished my part"
→ list_groups (find group ID)
→ get_group_details (verify posting permissions)
→ post_group_discussion (create the post)
```

## Integration with Existing Features

Groups work seamlessly with other Canvas MCP tools:

- **With `send_message`**: Message group members directly
- **With `find_people`**: Find specific group members' contact info
- **With `get_courses`**: Discover which courses have groups
- **With `smart_search`**: Search for files uploaded to group spaces

## Tips for Users

1. **Start with `list_groups`** - Always discover your groups first
2. **Check Permissions** - Use `get_group_details` to see if you can post discussions
3. **Stay Updated** - Use `list_group_discussions` to catch up on group communication
4. **Coordinate Efficiently** - Post announcements to group discussion board instead of messaging individually

## Technical Notes

- Groups API follows standard Canvas REST API patterns
- All tools use the same authentication as other Canvas MCP tools
- Group discussions are separate from course discussions
- Some groups may be private (not visible to all course members)
- Groups can span multiple courses or be course-specific

## Example Claude Interactions

**User**: "I need to see what my group has been discussing for our project"

**Claude**: "I'll help you find your group discussions. First, let me see what groups you're in..."
- Calls `list_groups` to find groups
- Shows available groups
- Asks which group (if multiple)
- Calls `list_group_discussions` for that group
- Displays discussion topics with dates and reply counts

**User**: "Who are my group members for Biology Lab?"

**Claude**: "Let me find your Biology Lab group and show you the members..."
- Calls `list_groups` with courseName="Biology Lab"
- Identifies the group
- Calls `list_group_members` 
- Displays member list with names and contact info

## Future Enhancements

Potential future additions:
- Group file management (upload/download group files)
- Group calendar events
- Group pages
- Group assignments
- Reply to group discussions (similar to course discussions)

## Testing

To test the groups feature:

1. Verify you have Canvas groups in your account
2. Try: "What groups am I in?"
3. Try: "Show me discussions in my project group"
4. Try: "Who are the members of my group?"

The tools will gracefully handle cases where you have no groups or limited permissions.

---

**Note**: This feature was added on October 1, 2025, alongside the current courses smart filtering feature. Both features work together to give Claude a complete understanding of your Canvas environment!
