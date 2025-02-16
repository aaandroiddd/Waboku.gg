import Filter from 'bad-words';

const filter = new Filter();

// Basic search term validation rules
export function validateSearchTerm(term: string): boolean {
  // Remove extra spaces and trim
  const cleanTerm = term.trim().replace(/\s+/g, ' ');

  // Check minimum length (2 characters)
  if (cleanTerm.length < 2) return false;

  // Check maximum length (50 characters)
  if (cleanTerm.length > 50) return false;

  // Only allow letters, numbers, spaces, and basic punctuation
  const validCharacters = /^[a-zA-Z0-9\s\-',.]+$/;
  if (!validCharacters.test(cleanTerm)) return false;

  // Check for profanity
  try {
    if (filter.isProfane(cleanTerm)) {
      console.warn(`Profanity detected in search term: ${cleanTerm}`);
      return false;
    }
  } catch (error) {
    console.error('Error checking profanity:', error);
    // If profanity check fails, continue with other validations
  }

  // Blacklist common spam patterns
  const spamPatterns = [
    /^[0-9]+$/,  // only numbers
    /(http|www|\.com|\.net|\.org)/i,  // URLs
    /[!@#$%^&*()_+=<>?/\\|{}[\]~`]+/,  // special characters
  ];

  for (const pattern of spamPatterns) {
    if (pattern.test(cleanTerm)) return false;
  }

  return true;
}

// Clean and normalize search term
export function normalizeSearchTerm(term: string): string {
  return term.trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .toLowerCase();  // Convert to lowercase for consistency
}