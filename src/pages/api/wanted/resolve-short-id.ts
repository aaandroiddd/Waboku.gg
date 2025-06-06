import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminServices } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shortId } = req.query;

  if (!shortId || typeof shortId !== 'string') {
    return res.status(400).json({ error: 'Short ID is required' });
  }

  // Validate that shortId is a 6-digit number
  if (!/^\d{6}$/.test(shortId)) {
    return res.status(400).json({ error: 'Invalid short ID format' });
  }

  try {
    const { database } = getFirebaseAdminServices();
    
    if (!database) {
      console.error('Firebase Admin database not initialized');
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Check if we have a mapping stored for this short ID
    const mappingRef = database.ref(`wantedPostMappings/${shortId}`);
    const mappingSnapshot = await mappingRef.once('value');
    
    if (mappingSnapshot.exists()) {
      const fullId = mappingSnapshot.val();
      console.log(`Found mapping for short ID ${shortId}: ${fullId}`);
      return res.status(200).json({ success: true, fullId });
    }

    // If no mapping exists, we need to search through all wanted posts
    // This is less efficient but necessary for posts created before the mapping system
    console.log(`No mapping found for short ID ${shortId}, searching through posts...`);
    
    const postsRef = database.ref('wantedPosts');
    const postsSnapshot = await postsRef.once('value');
    
    if (!postsSnapshot.exists()) {
      console.log('No wanted posts found in database');
      return res.status(404).json({ error: 'Post not found' });
    }

    const posts = postsSnapshot.val();
    
    // Generate short IDs for all posts and find a match
    for (const [postId, postData] of Object.entries(posts)) {
      if (!postData || typeof postData !== 'object') continue;
      
      // Generate the short ID for this post using the same algorithm
      const generatedShortId = generateNumericShortId(postId);
      
      if (generatedShortId === shortId) {
        console.log(`Found matching post: ${postId} -> ${shortId}`);
        
        // Store this mapping for future use
        try {
          await mappingRef.set(postId);
          console.log(`Stored mapping: ${shortId} -> ${postId}`);
        } catch (mappingError) {
          console.error('Error storing mapping:', mappingError);
          // Continue even if mapping storage fails
        }
        
        return res.status(200).json({ success: true, fullId: postId });
      }
    }

    console.log(`No post found with short ID: ${shortId}`);
    return res.status(404).json({ error: 'Post not found' });

  } catch (error) {
    console.error('Error resolving short ID:', error);
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