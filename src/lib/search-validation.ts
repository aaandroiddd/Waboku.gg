import Filter from 'bad-words';

const filter = new Filter();

// Basic search term validation rules
export function validateSearchTerm(term: string): boolean {
  if (!term) return false;

  // Remove extra spaces and trim
  const cleanTerm = term.trim().replace(/\s+/g, ' ');

  // Check minimum length (2 characters)
  if (cleanTerm.length < 2) return false;

  // Check maximum length (100 characters)
  if (cleanTerm.length > 100) return false;

  // Allow letters, numbers, spaces, and common TCG-related characters
  const validCharacters = /^[a-zA-Z0-9\s\-',.:"()&\s.]+$/;
  if (!validCharacters.test(cleanTerm)) {
    console.log(`Invalid characters in search term: ${cleanTerm}`);
    return false;
  }

  // Additional check for valid character name format (e.g., "D.")
  const characterNameFormat = /^[a-zA-Z0-9\s\-',"()&]+(\s+[A-Z]\.)?\s*[a-zA-Z0-9\s\-',"()&]*$/;
  if (!characterNameFormat.test(cleanTerm)) {
    console.log(`Invalid character name format in search term: ${cleanTerm}`);
    return false;
  }

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
    /script|iframe|alert|onclick/i,  // potential XSS patterns
  ];

  for (const pattern of spamPatterns) {
    if (pattern.test(cleanTerm)) {
      console.log(`Spam pattern detected in search term: ${cleanTerm}`);
      return false;
    }
  }

  return true;
}

// Clean and normalize search term
export function normalizeSearchTerm(term: string): string {
  if (!term) return '';
  
  return term.trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/[""]/g, '"')  // Normalize quotes
    .replace(/['']/g, "'"); // Normalize apostrophes
}