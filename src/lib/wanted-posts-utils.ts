import { adminDb } from '@/lib/firebase-admin';

/**
 * Generate a unique WANT ID in the format WANT + 6 digits
 * @returns Promise<string> - A unique WANT ID like "WANT123456"
 */
export async function generateUniqueWantedPostId(): Promise<string> {
  const maxAttempts = 100; // Prevent infinite loops
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Generate a random 6-digit number (100000 to 999999)
    const randomNumber = Math.floor(Math.random() * 900000) + 100000;
    const wantId = `WANT${randomNumber}`;

    try {
      // Check if this ID already exists in the database
      const postRef = adminDb.ref(`wantedPosts/${wantId}`);
      const snapshot = await postRef.once('value');

      if (!snapshot.exists()) {
        // ID is unique, return it
        console.log(`Generated unique WANT ID: ${wantId}`);
        return wantId;
      }

      console.log(`WANT ID ${wantId} already exists, trying another...`);
      attempts++;
    } catch (error) {
      console.error(`Error checking WANT ID ${wantId}:`, error);
      attempts++;
    }
  }

  // If we couldn't generate a unique ID after maxAttempts, throw an error
  throw new Error(`Failed to generate unique WANT ID after ${maxAttempts} attempts`);
}

/**
 * Generate a numeric short ID for wanted posts (6 digits)
 * This is used for the URL slug generation
 * @returns string - A 6-digit number as string
 */
export function generateNumericShortId(): string {
  return Math.floor(Math.random() * 900000 + 100000).toString();
}