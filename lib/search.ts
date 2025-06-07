import Fuse from 'fuse.js';

interface Searchable {
  name?: string;
  [key: string]: any;
}

/**
 * Finds the best match for a query within a list of items using fuzzy search.
 *
 * @param query - The search string.
 * @param items - A list of objects to search through.
 * @param keys - A list of keys to consider in the search.
 * @returns The best matching item, or null if no good match is found.
 */
export function findBestMatch<T extends Searchable>(
  query: string,
  items: T[],
  keys: string[]
): T | null {
  const fuse = new Fuse(items, {
    includeScore: true,
    keys: keys,
    threshold: 0.4, // Adjust this threshold to control fuzziness (0=perfect match, 1=match anything)
  });

  const results = fuse.search(query);

  if (results.length > 0) {
    // Fuse.js returns results sorted by score, so the first one is the best.
    return results[0].item;
  }

  return null;
} 