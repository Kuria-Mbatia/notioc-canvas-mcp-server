// MCP Tool: Canvas Planner
// Expose Canvas's built-in planner/TODO system for unified task management

import { logger } from '../lib/logger.js';

// Planner Item Types
export type PlannableType = 
  | 'assignment' 
  | 'quiz' 
  | 'discussion_topic' 
  | 'wiki_page' 
  | 'planner_note'
  | 'calendar_event'
  | 'assessment_request';

export interface PlannerItem {
  plannable_id: number;
  plannable_type: PlannableType;
  plannable: {
    id: number;
    title: string;
    created_at?: string;
    updated_at?: string;
    due_at?: string;
    points_possible?: number;
    assignment_id?: number;
    todo_date?: string; // For planner notes
    details?: string; // For planner notes
  };
  plannable_date: string;
  submissions?: {
    submitted: boolean;
    excused: boolean;
    graded: boolean;
    late: boolean;
    missing: boolean;
    needs_grading: boolean;
    has_feedback: boolean;
  };
  html_url?: string;
  context_type?: string;
  context_name?: string;
  course_id?: number;
  group_id?: number;
  new_activity?: boolean;
  planner_override?: {
    id: number;
    plannable_type: string;
    plannable_id: number;
    user_id: number;
    workflow_state: 'active' | 'deleted';
    marked_complete: boolean;
    dismissed: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
  };
}

export interface PlannerNote {
  id: number;
  title: string;
  description?: string;
  user_id: number;
  workflow_state: string;
  course_id?: number;
  todo_date: string;
  linked_object_type?: string;
  linked_object_id?: number;
  linked_object_html_url?: string;
  created_at: string;
  updated_at: string;
}

export interface PlannerOverride {
  id: number;
  plannable_type: string;
  plannable_id: number;
  user_id: number;
  assignment_id?: number;
  workflow_state: string;
  marked_complete: boolean;
  dismissed: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface GetPlannerItemsParams {
  canvasBaseUrl: string;
  accessToken: string;
  startDate?: string; // ISO 8601 format
  endDate?: string; // ISO 8601 format
  contextCodes?: string[]; // e.g., ['course_123', 'course_456']
  filter?: 'new_activity';
}

export interface CreatePlannerNoteParams {
  canvasBaseUrl: string;
  accessToken: string;
  title: string;
  details?: string;
  todoDate: string; // ISO 8601 format
  courseId?: string;
}

export interface UpdatePlannerNoteParams {
  canvasBaseUrl: string;
  accessToken: string;
  noteId: string;
  title?: string;
  details?: string;
  todoDate?: string;
  courseId?: string;
}

export interface MarkPlannerCompleteParams {
  canvasBaseUrl: string;
  accessToken: string;
  plannableType: PlannableType;
  plannableId: string;
  markedComplete: boolean;
}

/**
 * Get planner items (unified TODO view across all courses)
 * This is Canvas's native planning system
 */
export async function getPlannerItems(params: GetPlannerItemsParams): Promise<PlannerItem[]> {
  const { canvasBaseUrl, accessToken, startDate, endDate, contextCodes, filter } = params;

  try {
    logger.info('[Planner] Fetching planner items');

    const url = new URL(`${canvasBaseUrl}/api/v1/planner/items`);
    
    // Add query parameters
    if (startDate) url.searchParams.append('start_date', startDate);
    if (endDate) url.searchParams.append('end_date', endDate);
    if (contextCodes && contextCodes.length > 0) {
      contextCodes.forEach(code => url.searchParams.append('context_codes[]', code));
    }
    if (filter) url.searchParams.append('filter', filter);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch planner items: ${response.statusText}`);
    }

    const items: PlannerItem[] = await response.json();

    logger.info(`[Planner] Retrieved ${items.length} planner items`);

    return items;

  } catch (error) {
    logger.error('[Planner] Error fetching planner items:', error);
    throw error;
  }
}

/**
 * Get all planner notes (student's personal notes/reminders)
 */
export async function getPlannerNotes(params: {
  canvasBaseUrl: string;
  accessToken: string;
  startDate?: string;
  endDate?: string;
  contextCodes?: string[];
}): Promise<PlannerNote[]> {
  const { canvasBaseUrl, accessToken, startDate, endDate, contextCodes } = params;

  try {
    logger.info('[Planner] Fetching planner notes');

    const url = new URL(`${canvasBaseUrl}/api/v1/planner_notes`);
    
    if (startDate) url.searchParams.append('start_date', startDate);
    if (endDate) url.searchParams.append('end_date', endDate);
    if (contextCodes && contextCodes.length > 0) {
      contextCodes.forEach(code => url.searchParams.append('context_codes[]', code));
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch planner notes: ${response.statusText}`);
    }

    const notes: PlannerNote[] = await response.json();

    logger.info(`[Planner] Retrieved ${notes.length} planner notes`);

    return notes;

  } catch (error) {
    logger.error('[Planner] Error fetching planner notes:', error);
    throw error;
  }
}

/**
 * Create a personal planner note
 */
export async function createPlannerNote(params: CreatePlannerNoteParams): Promise<PlannerNote> {
  const { canvasBaseUrl, accessToken, title, details, todoDate, courseId } = params;

  try {
    logger.info(`[Planner] Creating planner note: ${title}`);

    const body: any = {
      title,
      todo_date: todoDate
    };

    if (details) body.details = details;
    if (courseId) body.course_id = courseId;

    const response = await fetch(`${canvasBaseUrl}/api/v1/planner_notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Failed to create planner note: ${response.statusText}`);
    }

    const note: PlannerNote = await response.json();

    logger.info(`[Planner] Created planner note with ID: ${note.id}`);

    return note;

  } catch (error) {
    logger.error('[Planner] Error creating planner note:', error);
    throw error;
  }
}

/**
 * Update a planner note
 */
export async function updatePlannerNote(params: UpdatePlannerNoteParams): Promise<PlannerNote> {
  const { canvasBaseUrl, accessToken, noteId, title, details, todoDate, courseId } = params;

  try {
    logger.info(`[Planner] Updating planner note: ${noteId}`);

    const body: any = {};
    if (title) body.title = title;
    if (details !== undefined) body.details = details;
    if (todoDate) body.todo_date = todoDate;
    if (courseId) body.course_id = courseId;

    const response = await fetch(`${canvasBaseUrl}/api/v1/planner_notes/${noteId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Failed to update planner note: ${response.statusText}`);
    }

    const note: PlannerNote = await response.json();

    logger.info(`[Planner] Updated planner note: ${noteId}`);

    return note;

  } catch (error) {
    logger.error('[Planner] Error updating planner note:', error);
    throw error;
  }
}

/**
 * Delete a planner note
 */
export async function deletePlannerNote(params: {
  canvasBaseUrl: string;
  accessToken: string;
  noteId: string;
}): Promise<void> {
  const { canvasBaseUrl, accessToken, noteId } = params;

  try {
    logger.info(`[Planner] Deleting planner note: ${noteId}`);

    const response = await fetch(`${canvasBaseUrl}/api/v1/planner_notes/${noteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete planner note: ${response.statusText}`);
    }

    logger.info(`[Planner] Deleted planner note: ${noteId}`);

  } catch (error) {
    logger.error('[Planner] Error deleting planner note:', error);
    throw error;
  }
}

/**
 * Mark a planner item as complete or incomplete
 */
export async function markPlannerItemComplete(params: MarkPlannerCompleteParams): Promise<PlannerOverride> {
  const { canvasBaseUrl, accessToken, plannableType, plannableId, markedComplete } = params;

  try {
    logger.info(`[Planner] Marking ${plannableType} ${plannableId} as ${markedComplete ? 'complete' : 'incomplete'}`);

    const body = {
      marked_complete: markedComplete
    };

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/planner/overrides/${plannableType}/${plannableId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update planner override: ${response.statusText}`);
    }

    const override: PlannerOverride = await response.json();

    logger.info(`[Planner] Updated planner override: ${override.id}`);

    return override;

  } catch (error) {
    logger.error('[Planner] Error updating planner override:', error);
    throw error;
  }
}

/**
 * Format planner items for display
 */
export function formatPlannerItems(items: PlannerItem[]): string {
  if (items.length === 0) {
    return '✅ No upcoming items in your planner! You\'re all caught up.';
  }

  // Group items by date
  const itemsByDate = new Map<string, PlannerItem[]>();
  
  for (const item of items) {
    const date = new Date(item.plannable_date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    
    if (!itemsByDate.has(date)) {
      itemsByDate.set(date, []);
    }
    itemsByDate.get(date)!.push(item);
  }

  let output = `📅 Your Planner (${items.length} items):\n\n`;

  // Sort dates chronologically
  const sortedDates = Array.from(itemsByDate.keys()).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime();
  });

  for (const date of sortedDates) {
    const dateItems = itemsByDate.get(date)!;
    output += `\n**${date}**\n`;

    for (const item of dateItems) {
      const icon = getPlannableIcon(item.plannable_type);
      const isComplete = item.planner_override?.marked_complete;
      const checkmark = isComplete ? '✅' : '⬜';
      
      let statusInfo = '';
      if (item.submissions) {
        if (item.submissions.submitted) statusInfo = '✓ Submitted';
        else if (item.submissions.missing) statusInfo = '⚠️ Missing';
        else if (item.submissions.late) statusInfo = '⏰ Late';
      }

      const points = item.plannable.points_possible ? ` (${item.plannable.points_possible} pts)` : '';
      const context = item.context_name ? ` - ${item.context_name}` : '';
      const newActivity = item.new_activity ? ' 🔔' : '';

      output += `  ${checkmark} ${icon} ${item.plannable.title}${points}${context}${newActivity}\n`;
      
      if (statusInfo) {
        output += `     ${statusInfo}\n`;
      }

      // Show planner note details
      if (item.plannable_type === 'planner_note' && item.plannable.details) {
        output += `     Note: ${item.plannable.details}\n`;
      }
    }
  }

  output += `\n💡 Tip: Use mark_planner_item_complete to check off items, or create_planner_note to add personal reminders.`;

  return output;
}

function getPlannableIcon(type: PlannableType): string {
  switch (type) {
    case 'assignment': return '📝';
    case 'quiz': return '📊';
    case 'discussion_topic': return '💬';
    case 'wiki_page': return '📄';
    case 'planner_note': return '📌';
    case 'calendar_event': return '📅';
    case 'assessment_request': return '✍️';
    default: return '📋';
  }
}
