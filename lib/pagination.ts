import { callCanvasAPI } from './canvas-api.js';
import parseLinkHeader from 'parse-link-header';

/**
 * Fetches all pages of a paginated Canvas API endpoint.
 *
 * @param canvasBaseUrl - The base URL of the Canvas instance.
 * @param accessToken - The API access token.
 * @param apiPath - The API endpoint path (e.g., '/api/v1/courses').
 * @param params - Optional query parameters for the request.
 * @returns A promise that resolves to an array containing all items from all pages.
 */
export async function fetchAllPaginated<T>(
  canvasBaseUrl: string,
  accessToken: string,
  apiPath: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  let results: T[] = [];
  let nextUrl: string | null = apiPath;

  // Add initial params to the first URL
  const initialParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    initialParams.append(key, String(value));
  });

  if (initialParams.toString()) {
    nextUrl += `?${initialParams.toString()}`;
  }


  while (nextUrl) {
    const response = await callCanvasAPI({
      canvasBaseUrl,
      accessToken,
      method: 'GET',
      apiPath: nextUrl, // Use the full path for subsequent requests
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle common Canvas API errors with user-friendly messages
      if (response.status === 404) {
        if (errorText.includes('تم تعطيل') || errorText.includes('disabled')) {
          throw new Error(`Canvas API Error (${response.status}): The requested resource has been disabled for this course`);
        }
        throw new Error(`Canvas API Error (${response.status}): The requested resource was not found or is not accessible`);
      }
      
      if (response.status === 401) {
        throw new Error(`Canvas API Error (${response.status}): Invalid or expired access token`);
      }
      
      if (response.status === 403) {
        throw new Error(`Canvas API Error (${response.status}): Access denied - insufficient permissions`);
      }
      
      // For other errors, include the raw response but make it clearer
      throw new Error(`Canvas API Error (${response.status}): ${errorText}`);
    }

    const data: T[] = await response.json();
    results = results.concat(data);

    const linkHeader = response.headers.get('Link');
    if (linkHeader) {
      const parsedLinks = parseLinkHeader(linkHeader);
      nextUrl = parsedLinks?.next ? new URL(parsedLinks.next.url).pathname + new URL(parsedLinks.next.url).search : null;
    } else {
      nextUrl = null;
    }
  }

  return results;
}

// Type definitions for Canvas API objects
// These are not exhaustive but cover the fields we use.

export interface CanvasCourse {
  id: number;
  name?: string;
  course_code?: string;
  enrollment_state?: string;
  nickname?: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  points_possible: number;
  submission_types: string[];
  workflow_state: string;
  html_url: string;
  has_submitted_submissions?: boolean;
  attachments?: Array<{
    id: number;
    filename: string;
    url: string;
    'content-type'?: string;
    content_type?: string;
  }>;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  url: string;
  content_type: string;
  size: number;
  created_at: string;
  updated_at: string;
  html_url?: string;
  thumbnail_url?: string;
  folder_id?: number;
}

export interface CanvasPage {
    page_id?: number;
    url?: string;
    title: string;
    html_url: string;
    created_at: string;
    updated_at: string | null;
    body?: string;
    published?: boolean;
    front_page?: boolean;
    editing_roles?: string;
    locked_for_user?: boolean;
    lock_explanation?: string;
    lock_info?: any;
}

export interface CanvasDiscussion {
    id: number;
    title: string;
    html_url: string;
    posted_at: string | null;
    last_reply_at: string | null;
    discussion_type: 'side_comment' | 'threaded';
} 