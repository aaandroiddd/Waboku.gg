import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminServices } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { postId } = req.body;

  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  try {
    const { database } = getFirebaseAdminServices();
    
    if (!database) {
      console.error('Firebase Admin database not initialized');
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Generate the short ID for this post
    const shortId = generateNumericShortId(postId);
    
    // Store the mapping
    const mappingRef = database.ref(`wantedPostMappings/${shortId}`);
    await mappingRef.set(postId);
    
    console.log(`Created mapping: ${shortId} -> ${postId}`);
    
    return res.status(200).json({ 
      success: true, 
      shortId,
      fullId: postId
    });

  } catch (error) {
    console.error('Error creating short ID mapping:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Generates a 6-digit numeric ID from a Firebase document ID
 * This must match the algorithm in wanted-posts-slug.ts
 */
function generateNumericShortId(postId: string): string {
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