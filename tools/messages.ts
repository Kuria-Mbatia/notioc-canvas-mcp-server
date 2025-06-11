// MCP Tool: Canvas Messages and Conversations
// Implementation of Canvas messaging functionality

import { callCanvasAPI } from '../lib/canvas-api.js';
import { fetchAllPaginated } from '../lib/pagination.js';
import { listCourses } from './courses.js';
import { findBestMatch } from '../lib/search.js';
import { logger } from '../lib/logger.js';

export interface SendMessageParams {
  canvasBaseUrl: string;
  accessToken: string;
  recipientIds: string[];
  subject: string;
  body: string;
  contextCode?: string; // e.g., "course_123" to associate with a course
  attachmentIds?: string[];
  mediaCommentId?: string;
  mediaCommentType?: 'audio' | 'video';
}

export interface ReplyToConversationParams {
  canvasBaseUrl: string;
  accessToken: string;
  conversationId: string;
  body: string;
  attachmentIds?: string[];
  mediaCommentId?: string;
  mediaCommentType?: 'audio' | 'video';
  includedMessages?: string[];
}

export interface ListConversationsParams {
  canvasBaseUrl: string;
  accessToken: string;
  scope?: 'inbox' | 'sent' | 'archived' | 'unread';
  filter?: string[];
  filterMode?: 'and' | 'or';
  perPage?: number;
}

export interface ConversationInfo {
  id: string;
  subject: string;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  subscribed: boolean;
  private: boolean;
  starred: boolean;
  participants: Array<{
    id: string;
    name: string;
    pronouns?: string;
    avatarUrl?: string;
  }>;
  contextName?: string;
  workflowState: string;
}

export interface MessageResult {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    contentType: string;
  }>;
}

/**
 * Create a new conversation and send the initial message
 */
export async function createConversation(params: SendMessageParams): Promise<MessageResult> {
  const { canvasBaseUrl, accessToken, recipientIds, subject, body, contextCode, attachmentIds, mediaCommentId, mediaCommentType } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!recipientIds || recipientIds.length === 0) {
    throw new Error('At least one recipient ID is required');
  }

  if (!subject || !body) {
    throw new Error('Both subject and body are required');
  }

  try {
    logger.info(`Creating new conversation with ${recipientIds.length} recipients`);

    // Prepare the request body
    const requestBody: Record<string, any> = {
      recipients: recipientIds,
      subject: subject,
      body: body
    };

    if (contextCode) {
      requestBody.context_code = contextCode;
    }

    if (attachmentIds && attachmentIds.length > 0) {
      requestBody.attachment_ids = attachmentIds;
    }

    if (mediaCommentId && mediaCommentType) {
      requestBody.media_comment_id = mediaCommentId;
      requestBody.media_comment_type = mediaCommentType;
    }

    // Make the POST request to create the conversation
    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'POST',
      apiPath: '/api/v1/conversations',
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create conversation: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const conversations = await response.json();
    const conversation = Array.isArray(conversations) ? conversations[0] : conversations;

    // Return the first message in the conversation
    const firstMessage = conversation.messages?.[0];
    
    return {
      id: firstMessage?.id || conversation.id,
      conversationId: conversation.id,
      body: firstMessage?.body || body,
      createdAt: firstMessage?.created_at || new Date().toISOString(),
      authorId: firstMessage?.author_id || '',
      authorName: firstMessage?.author?.name || '',
      attachments: firstMessage?.attachments?.map((att: any) => ({
        id: String(att.id),
        filename: att.filename,
        url: att.url,
        contentType: att['content-type'] || att.content_type || 'unknown'
      })) || []
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    } else {
      throw new Error('Failed to create conversation: Unknown error');
    }
  }
}

/**
 * Reply to an existing conversation
 */
export async function replyToConversation(params: ReplyToConversationParams): Promise<MessageResult> {
  const { canvasBaseUrl, accessToken, conversationId, body, attachmentIds, mediaCommentId, mediaCommentType, includedMessages } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!conversationId || !body) {
    throw new Error('Both conversationId and body are required');
  }

  try {
    logger.info(`Replying to conversation ${conversationId}`);

    // Prepare the request body
    const requestBody: Record<string, any> = {
      body: body
    };

    if (attachmentIds && attachmentIds.length > 0) {
      requestBody.attachment_ids = attachmentIds;
    }

    if (mediaCommentId && mediaCommentType) {
      requestBody.media_comment_id = mediaCommentId;
      requestBody.media_comment_type = mediaCommentType;
    }

    if (includedMessages && includedMessages.length > 0) {
      requestBody.included_messages = includedMessages;
    }

    // Make the POST request to add a message to the conversation
    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'POST',
      apiPath: `/api/v1/conversations/${conversationId}/add_message`,
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to reply to conversation: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const conversation = await response.json();
    const latestMessage = conversation.messages?.[0]; // Messages are returned in reverse chronological order

    return {
      id: latestMessage?.id || '',
      conversationId: conversation.id,
      body: latestMessage?.body || body,
      createdAt: latestMessage?.created_at || new Date().toISOString(),
      authorId: latestMessage?.author_id || '',
      authorName: latestMessage?.author?.name || '',
      attachments: latestMessage?.attachments?.map((att: any) => ({
        id: String(att.id),
        filename: att.filename,
        url: att.url,
        contentType: att['content-type'] || att.content_type || 'unknown'
      })) || []
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to reply to conversation: ${error.message}`);
    } else {
      throw new Error('Failed to reply to conversation: Unknown error');
    }
  }
}

/**
 * List conversations for the current user
 */
export async function listConversations(params: ListConversationsParams): Promise<ConversationInfo[]> {
  const { canvasBaseUrl, accessToken, scope = 'inbox', filter, filterMode = 'and', perPage = 100 } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  try {
    logger.info(`Listing conversations with scope: ${scope}`);

    const queryParams: Record<string, any> = {
      scope: scope,
      per_page: perPage,
      include: ['participant_avatars']
    };

    if (filter && filter.length > 0) {
      queryParams.filter = filter;
      queryParams.filter_mode = filterMode;
    }

    const conversationsData = await fetchAllPaginated<any>(
      canvasBaseUrl,
      accessToken,
      '/api/v1/conversations',
      queryParams
    );

    const conversations: ConversationInfo[] = conversationsData.map(conv => ({
      id: conv.id,
      subject: conv.subject || 'No Subject',
      lastMessage: conv.last_message || '',
      lastMessageAt: conv.last_message_at || conv.last_authored_message_at || '',
      messageCount: conv.message_count || 0,
      subscribed: conv.subscribed || false,
      private: conv.private || false,
      starred: conv.starred || false,
      participants: conv.participants?.map((p: any) => ({
        id: p.id,
        name: p.name,
        pronouns: p.pronouns,
        avatarUrl: p.avatar_url
      })) || [],
      contextName: conv.context_name,
      workflowState: conv.workflow_state || 'read'
    }));

    return conversations;

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to list conversations: ${error.message}`);
    } else {
      throw new Error('Failed to list conversations: Unknown error');
    }
  }
}

/**
 * Get details of a specific conversation including all messages
 */
export async function getConversationDetails(params: {
  canvasBaseUrl: string;
  accessToken: string;
  conversationId: string;
  autoMarkAsRead?: boolean;
  filter?: string[];
}): Promise<ConversationInfo & { messages: MessageResult[] }> {
  const { canvasBaseUrl, accessToken, conversationId, autoMarkAsRead = true, filter } = params;

  if (!canvasBaseUrl || !accessToken) {
    throw new Error('Missing Canvas URL or Access Token');
  }

  if (!conversationId) {
    throw new Error('conversationId is required');
  }

  try {
    logger.info(`Getting details for conversation ${conversationId}`);

    const queryParams: Record<string, any> = {
      auto_mark_as_read: autoMarkAsRead,
      include: ['participant_avatars']
    };

    if (filter && filter.length > 0) {
      queryParams.filter = filter;
    }

    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: `/api/v1/conversations/${conversationId}`,
      params: queryParams
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get conversation details: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const conv = await response.json();

    const messages: MessageResult[] = conv.messages?.map((msg: any) => ({
      id: msg.id,
      conversationId: conv.id,
      body: msg.body || '',
      createdAt: msg.created_at || '',
      authorId: msg.author_id || '',
      authorName: msg.author?.name || '',
      attachments: msg.attachments?.map((att: any) => ({
        id: String(att.id),
        filename: att.filename,
        url: att.url,
        contentType: att['content-type'] || att.content_type || 'unknown'
      })) || []
    })) || [];

    return {
      id: conv.id,
      subject: conv.subject || 'No Subject',
      lastMessage: conv.last_message || '',
      lastMessageAt: conv.last_message_at || conv.last_authored_message_at || '',
      messageCount: conv.message_count || 0,
      subscribed: conv.subscribed || false,
      private: conv.private || false,
      starred: conv.starred || false,
      participants: conv.participants?.map((p: any) => ({
        id: p.id,
        name: p.name,
        pronouns: p.pronouns,
        avatarUrl: p.avatar_url
      })) || [],
      contextName: conv.context_name,
      workflowState: conv.workflow_state || 'read',
      messages: messages
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get conversation details: ${error.message}`);
    } else {
      throw new Error('Failed to get conversation details: Unknown error');
    }
  }
} 