// Canvas API proxy for MCP server - adapted from Notioc's canvas-proxy.ts
import NodeCache from "node-cache";

// Initialize cache with a 5-minute TTL for each entry
const canvasCache = new NodeCache({ stdTTL: 300 });

interface ProxyRequestParams {
  canvasBaseUrl: string;
  accessToken: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  apiPath: string; // e.g., '/api/v1/courses'
  params?: Record<string, string | number | boolean | string[]>; // For GET query parameters
  body?: Record<string, any>; // For POST/PUT request body
  returnRawBuffer?: boolean; // Flag to get raw file content
}

export async function callCanvasAPI({
  canvasBaseUrl,
  accessToken,
  method,
  apiPath,
  params,
  body,
  returnRawBuffer = false,
}: ProxyRequestParams): Promise<Response> {
  if (!canvasBaseUrl || !accessToken || !method || !apiPath) {
    throw new Error("Missing required Canvas API parameters");
  }

  // Construct the target URL
  const cleanBaseUrl = canvasBaseUrl
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  let targetUrl = `https://${cleanBaseUrl}${apiPath}`;

  // Add query parameters for GET requests
  if (method === "GET" && params) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => query.append(`${key}[]`, String(v)));
      } else {
        query.append(key, String(value));
      }
    });
    if (query.toString()) {
      targetUrl += `?${query.toString()}`;
    }
  }

  // Prepare headers
  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    // IMPORTANT: Request IDs as strings to avoid JS precision issues
    Accept: "application/json+canvas-string-ids",
    "User-Agent": "Notioc-MCP-Server/1.0.0",
  };

  // Prepare body for POST/PUT
  let requestBody: BodyInit | null = null;
  if ((method === "POST" || method === "PUT") && body) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  // Caching for GET requests
  if (method === "GET") {
    const cacheKey = targetUrl;
    const cachedResponse = canvasCache.get<Buffer>(cacheKey);

    if (cachedResponse) {
      // Create a new Response object from the cached buffer
      return new Response(cachedResponse.toString(), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Cache-Hit": "true",
        },
      });
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: method,
      headers: headers,
      body: requestBody,
    });

    if (method === "GET" && response.ok) {
      const cacheKey = targetUrl;
      const responseBuffer = await response.arrayBuffer();
      canvasCache.set(cacheKey, Buffer.from(responseBuffer));

      // Return a new response from the buffer so the original can be cached
      return new Response(responseBuffer, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  } catch (error: any) {
    // Return a generic error response that mimics a fetch failure
    return new Response(
      JSON.stringify({ error: `Canvas API network error: ${error.message}` }),
      {
        status: 502, // Bad Gateway
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

// Canvas data interfaces
export interface CanvasCourse {
  id: string;
  name?: string;
  course_code?: string;
  workflow_state?: string;
  enrollment_state?: string;
  nickname?: string;
}

export interface CanvasFile {
  id: string;
  display_name?: string;
  filename?: string;
  content_type?: string;
  size?: number;
  url?: string;
  html_url?: string;
  created_at?: string;
  updated_at?: string;
  thumbnail_url?: string;
  folder_id?: string;
}

export interface CanvasAssignment {
  id: string;
  name?: string;
  description?: string;
  due_at?: string;
  points_possible?: number;
  submission_types?: string[];
  workflow_state?: string;
  html_url?: string;
  has_submitted_submissions?: boolean;
}

export interface CanvasModule {
  id: string;
  name?: string;
  position?: number;
  workflow_state?: string;
  items_count?: number;
  items_url?: string;
  items?: CanvasModuleItem[];
  unlock_at?: string;
  require_sequential_progress?: boolean;
  prerequisite_module_ids?: string[];
  state?: string;
  completed_at?: string;
  publish_final_grade?: boolean;
  published?: boolean;
}

export interface CanvasModuleItem {
  id: string;
  title?: string;
  type?: string;
  content_id?: string;
  html_url?: string;
  url?: string;
  page_url?: string;
  external_url?: string;
  new_tab?: boolean;
  completion_requirement?: {
    type: string;
    min_score?: number;
    completed?: boolean;
  };
  position?: number;
  indent?: number;
  content_details?: {
    points_possible?: number;
    due_at?: string;
    unlock_at?: string;
    lock_at?: string;
    locked_for_user?: boolean;
    lock_explanation?: string;
    lock_info?: any;
  };
  mastery_paths?: any;
  published?: boolean;
}

export interface CanvasPage {
  page_id?: string;
  url?: string;
  title?: string;
  body?: string;
  created_at?: string;
  updated_at?: string;
  published?: boolean;
  front_page?: boolean;
  locked_for_user?: boolean;
  html_url?: string;
  editing_roles?: string;
  last_edited_by?: any;
}

export interface CanvasDiscussionTopic {
  id: string;
  title?: string;
  message?: string;
  html_url?: string;
  posted_at?: string;
  last_reply_at?: string;
  require_initial_post?: boolean;
  user_can_see_posts?: boolean;
  discussion_subentry_count?: number;
  read_state?: string;
  unread_count?: number;
  subscribed?: boolean;
  subscription_hold?: string;
  assignment_id?: string;
  delayed_post_at?: string;
  published?: boolean;
  lock_at?: string;
  locked?: boolean;
  pinned?: boolean;
  locked_for_user?: boolean;
  lock_info?: any;
  lock_explanation?: string;
  user_name?: string;
  topic_children?: string[];
  group_topic_children?: any[];
  root_topic_id?: string;
  podcast_url?: string;
  discussion_type?: string;
  group_category_id?: string;
  attachments?: any[];
  permissions?: any;
  allow_rating?: boolean;
  only_graders_can_rate?: boolean;
  sort_by_rating?: boolean;
}

export interface CanvasDiscussionEntry {
  id: string;
  user_id?: string;
  parent_id?: string;
  created_at?: string;
  updated_at?: string;
  rating_count?: number;
  rating_sum?: number;
  user?: any;
  user_name?: string;
  message?: string;
  forced_read_state?: boolean;
  read_state?: string;
  recent_replies?: CanvasDiscussionEntry[];
  has_more_replies?: boolean;
}
