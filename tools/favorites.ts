// MCP Tool: Canvas Favorites
// Manage starred/favorite courses for quick filtering

import { logger } from '../lib/logger.js';

export interface FavoriteCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  workflow_state: string;
  account_id: number;
  start_at?: string | null;
  end_at?: string | null;
  enrollments?: Array<{
    type: string;
    role: string;
    enrollment_state: string;
  }>;
}

export interface GetFavoritesParams {
  canvasBaseUrl: string;
  accessToken: string;
}

export interface AddFavoriteParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
}

export interface RemoveFavoriteParams {
  canvasBaseUrl: string;
  accessToken: string;
  courseId: string;
}

/**
 * Get user's favorite/starred courses
 */
export async function getFavoriteCourses(params: GetFavoritesParams): Promise<FavoriteCourse[]> {
  const { canvasBaseUrl, accessToken } = params;

  try {
    logger.info('[Favorites] Fetching favorite courses');

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/users/self/favorites/courses`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch favorites: ${response.statusText}`);
    }

    const favorites: FavoriteCourse[] = await response.json();

    logger.info(`[Favorites] Retrieved ${favorites.length} favorite courses`);

    return favorites;

  } catch (error) {
    logger.error('[Favorites] Error fetching favorites:', error);
    throw error;
  }
}

/**
 * Add a course to favorites
 */
export async function addFavoriteCourse(params: AddFavoriteParams): Promise<FavoriteCourse> {
  const { canvasBaseUrl, accessToken, courseId } = params;

  try {
    logger.info(`[Favorites] Adding course ${courseId} to favorites`);

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/users/self/favorites/courses/${courseId}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to add favorite: ${response.statusText}`);
    }

    const favorite: FavoriteCourse = await response.json();

    logger.info(`[Favorites] Added course ${courseId} to favorites`);

    return favorite;

  } catch (error) {
    logger.error('[Favorites] Error adding favorite:', error);
    throw error;
  }
}

/**
 * Remove a course from favorites
 */
export async function removeFavoriteCourse(params: RemoveFavoriteParams): Promise<void> {
  const { canvasBaseUrl, accessToken, courseId } = params;

  try {
    logger.info(`[Favorites] Removing course ${courseId} from favorites`);

    const response = await fetch(
      `${canvasBaseUrl}/api/v1/users/self/favorites/courses/${courseId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to remove favorite: ${response.statusText}`);
    }

    logger.info(`[Favorites] Removed course ${courseId} from favorites`);

  } catch (error) {
    logger.error('[Favorites] Error removing favorite:', error);
    throw error;
  }
}

/**
 * Format favorites for display
 */
export function formatFavorites(courses: FavoriteCourse[]): string {
  if (courses.length === 0) {
    return '⭐ No favorite courses yet!\n\n💡 **Tip:** Use add_favorite_course to star important courses for quick access.';
  }

  let output = `⭐ Your Favorite Courses (${courses.length})\n\n`;

  for (const course of courses) {
    const enrollment = course.enrollments?.[0];
    const role = enrollment?.role || 'Student';
    const state = enrollment?.enrollment_state || 'active';
    const stateEmoji = state === 'active' ? '🟢' : state === 'completed' ? '✅' : '⚪';

    output += `${stateEmoji} **${course.name}**\n`;
    output += `   📚 Code: ${course.course_code}\n`;
    output += `   👤 Role: ${role}\n`;
    output += `   🆔 Course ID: ${course.id}\n`;

    if (course.start_at || course.end_at) {
      if (course.start_at) {
        output += `   📅 Started: ${new Date(course.start_at).toLocaleDateString()}\n`;
      }
      if (course.end_at) {
        output += `   📅 Ends: ${new Date(course.end_at).toLocaleDateString()}\n`;
      }
    }

    output += '\n';
  }

  output += `💡 **Tip:** Favorite courses appear first in your dashboard and are great for quick context filtering.`;

  return output;
}
