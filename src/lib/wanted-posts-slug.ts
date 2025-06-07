import { GAME_MAPPING, OTHER_GAME_MAPPING } from './game-mappings';

// Combine all game mappings for lookup
const ALL_GAME_MAPPINGS = { ...GAME_MAPPING, ...OTHER_GAME_MAPPING };

// Reverse mapping for game categories to slugs
const GAME_TO_SLUG: Record<string, string> = {};
Object.entries(ALL_GAME_MAPPINGS).forEach(([key, value]) => {
  GAME_TO_SLUG[value] = value;
  GAME_TO_SLUG[key] = value;
});

// Common filler words to remove from slugs
const FILLER_WORDS = new Set([
  'first', 'edition', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'up', 'about', 'into', 'over', 'after', 'beneath', 'under', 'above', 'below', 'between', 'among',
  'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'looking', 'want', 'need',
  'seeking', 'buying', 'purchase', 'find', 'search', 'iso', 'lf', 'wtb'
]);

// High-value keywords to preserve
const PRESERVE_KEYWORDS = new Set([
  'alpha', 'beta', 'unlimited', 'first', 'base', 'set', 'holo', 'foil', 'cold', 'rainbow', 'secret', 'rare',
  'ultra', 'super', 'promo', 'shadowless', 'error', 'misprint', 'psa', 'bgs', 'cgc', 'sgc', 'gem', 'mint',
  'near', 'played', 'excellent', 'good', 'poor', 'damaged', 'heavy', 'light', 'graded', 'raw', 'sealed',
  'booster', 'pack', 'box', 'case', 'display', 'japanese', 'english', 'korean', 'chinese', 'german', 'french',
  'italian', 'spanish', 'portuguese', 'russian', 'vintage', 'modern', 'standard', 'legacy', 'commander',
  'draft', 'constructed', 'tournament', 'championship', 'worlds', 'regional', 'national', 'local', 'store',
  'exclusive', 'limited', 'special', 'anniversary', 'celebration', 'collection', 'series', 'expansion',
  'welcome', 'rathe', 'arcane', 'rising', 'crucible', 'war', 'tales', 'aria', 'everfest', 'uprising',
  'dynasty', 'history', 'pack', 'bright', 'lights', 'outsiders', 'part', 'heavy', 'hitters', 'classic',
  'battles', 'commoner', 'blitz', 'deck', 'hero', 'weapon', 'equipment', 'action', 'attack', 'defense',
  'resource', 'generic', 'talent', 'young', 'adult', 'majestic', 'legendary', 'fabled', 'common', 'token',
  'marvel', 'extended', 'art', 'full', 'borderless', 'textless', 'alternate', 'variant', 'showcase', 'retro',
  'timeshifted', 'masterpiece', 'expedition', 'invention', 'invocation', 'amonkhet', 'kaladesh', 'zendikar',
  'innistrad', 'ravnica', 'dominaria', 'theros', 'tarkir', 'mirrodin', 'phyrexia', 'new', 'capenna', 'kamigawa',
  'neon', 'crimson', 'vow', 'midnight', 'hunt', 'forgotten', 'realms', 'adventures', 'throne', 'eldraine',
  'war', 'spark', 'guilds', 'allegiance', 'ultimate', 'masters', 'horizons', 'battlebond', 'conspiracy',
  'unstable', 'unhinged', 'unglued', 'silver', 'border', 'black', 'white', 'blue', 'red', 'green', 'colorless',
  'artifact', 'creature', 'enchantment', 'instant', 'sorcery', 'planeswalker', 'land', 'basic', 'nonbasic'
]);

/**
 * Converts a game category to its URL slug
 */
export function getGameSlug(game: string): string {
  const normalizedGame = game.toLowerCase();
  return GAME_TO_SLUG[normalizedGame] || GAME_TO_SLUG[game] || 'other';
}

/**
 * Converts a game slug back to its display name
 */
export function getGameDisplayName(slug: string): string {
  // Find the display name for this slug
  for (const [displayName, gameSlug] of Object.entries(ALL_GAME_MAPPINGS)) {
    if (gameSlug === slug) {
      return displayName;
    }
  }
  return 'Other';
}

/**
 * Generates a URL-friendly slug from a wanted post title
 */
export function generateWantedPostSlug(title: string): string {
  if (!title || typeof title !== 'string') {
    return 'untitled';
  }

  // Step 1: Lowercase and basic cleanup
  let slug = title.toLowerCase().trim();

  // Step 2: Handle special characters and numbers
  slug = slug
    // Convert dots in numbers (like 9.5) to dashes
    .replace(/(\d+)\.(\d+)/g, '$1-$2')
    // Remove quotes, commas, and other punctuation
    .replace(/['"`,]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace spaces and other separators with dashes
    .replace(/[\s\-_]+/g, '-')
    // Remove other special characters except dashes
    .replace(/[^a-z0-9\-]/g, '')
    // Remove multiple consecutive dashes
    .replace(/-+/g, '-')
    // Remove leading/trailing dashes
    .replace(/^-+|-+$/g, '');

  // Step 3: Split into tokens for processing
  const tokens = slug.split('-').filter(token => token.length > 0);

  // Step 4: Filter and prioritize tokens
  const processedTokens: string[] = [];
  const seenTokens = new Set<string>();

  for (const token of tokens) {
    // Skip if we've already seen this token
    if (seenTokens.has(token)) {
      continue;
    }

    // Always preserve high-value keywords
    if (PRESERVE_KEYWORDS.has(token)) {
      processedTokens.push(token);
      seenTokens.add(token);
      continue;
    }

    // Skip common filler words unless they're at the beginning
    if (FILLER_WORDS.has(token) && processedTokens.length > 0) {
      continue;
    }

    // Skip very short tokens unless they're numbers or important abbreviations
    if (token.length < 2 && !/^\d+$/.test(token) && !['ex', 'gx', 'v', 'vmax', 'vstar'].includes(token)) {
      continue;
    }

    processedTokens.push(token);
    seenTokens.add(token);
  }

  // Step 5: Limit length and ensure we have content
  const maxTokens = 12; // Reasonable limit for URL length
  const finalTokens = processedTokens.slice(0, maxTokens);

  // Step 6: Create final slug
  const finalSlug = finalTokens.join('-');

  // Ensure we have a valid slug
  return finalSlug || 'untitled';
}

/**
 * Generates a 6-digit numeric ID from a Firebase document ID
 */
export function generateNumericShortId(postId: string): string {
  // Create a hash from the post ID and convert to numeric
  let hash = 0;
  for (let i = 0; i < postId.length; i++) {
    const char = postId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to positive number and ensure it's 6 digits
  const positiveHash = Math.abs(hash);
  const shortId = (positiveHash % 900000) + 100000; // Ensures 6-digit number between 100000-999999
  
  return shortId.toString();
}

/**
 * Generates the complete wanted post URL path
 */
export function generateWantedPostUrl(title: string, game: string, postId: string): string {
  const gameSlug = getGameSlug(game);
  const titleSlug = generateWantedPostSlug(title);
  
  // Generate 6-digit numeric ID from the post ID
  const shortId = generateNumericShortId(postId);
  
  return `/wanted/${gameSlug}/${titleSlug}-${shortId}`;
}

/**
 * Parses a wanted post URL to extract the post ID
 */
export function parseWantedPostUrl(url: string): { gameSlug: string; titleSlug: string; postId: string } | null {
  // Match pattern: /wanted/{game-category}/{slug}-{6-digit-id}
  const match = url.match(/^\/wanted\/([^\/]+)\/(.+)-(\d{6})$/);
  
  if (!match) {
    return null;
  }

  const [, gameSlug, titleSlug, shortId] = match;
  
  return {
    gameSlug,
    titleSlug,
    postId: shortId
  };
}

/**
 * Validates if a URL matches the expected wanted post URL format
 */
export function isValidWantedPostUrl(url: string): boolean {
  return parseWantedPostUrl(url) !== null;
}

/**
 * Generates a wanted post URL from a wanted post object
 */
export function getWantedPostUrl(post: { id: string; title: string; game: string }): string {
  return generateWantedPostUrl(post.title, post.game, post.id);
}

/**
 * Creates a mapping from short ID to full post ID for database lookups
 * This would typically be stored in a separate collection for fast lookups
 */
export function createShortIdMapping(postId: string): { shortId: string; fullId: string } {
  return {
    shortId: generateNumericShortId(postId),
    fullId: postId
  };
}

/**
 * Extract post ID from a slug
 * Expects format: "slug-text-123456"
 */
export function extractWantedPostIdFromSlug(slug: string): string | null {
  if (!slug) return null;
  
  // Split by hyphens and look for the last part that looks like a 6-digit numeric ID
  const parts = slug.split('-');
  const lastPart = parts[parts.length - 1];
  
  // Check if the last part is a 6-digit number
  if (lastPart && /^\d{6}$/.test(lastPart)) {
    return lastPart;
  }
  
  return null;
}