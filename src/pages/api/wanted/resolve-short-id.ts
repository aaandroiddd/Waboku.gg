import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { generateNumericShortId } from '@/lib/wanted-posts-slug';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shortId } = req.query;

  if (!shortId || typeof shortId !== 'string') {
    return res.status(400).json({ error: 'Short ID is required' });
  }

  // Validate that shortId is a numeric ID (flexible length for legacy support)
  if (!/^\d+$/.test(shortId)) {
    return res.status(400).json({ error: 'Invalid short ID format' });
  }

  try {
    const { database } = getFirebaseAdmin();
    
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

    // If no 6-digit match found and shortId is shorter, try legacy matching
    if (shortId.length < 6) {
      console.log(`Trying legacy matching for short ID: ${shortId}`);
      
      // For legacy posts, try matching against the end of Firebase document IDs
      // or other patterns that might have been used
      for (const [postId, postData] of Object.entries(posts)) {
        if (!postData || typeof postData !== 'object') continue;
        
        // Check if the shortId appears at the end of the Firebase document ID
        if (postId.endsWith(shortId)) {
          console.log(`Found legacy match: ${postId} ends with ${shortId}`);
          
          // Store this mapping for future use
          try {
            await mappingRef.set(postId);
            console.log(`Stored legacy mapping: ${shortId} -> ${postId}`);
          } catch (mappingError) {
            console.error('Error storing legacy mapping:', mappingError);
          }
          
          return res.status(200).json({ success: true, fullId: postId });
        }
        
        // Check if the shortId matches any numeric part of the Firebase ID
        const numericParts = postId.match(/\d+/g);
        if (numericParts && numericParts.includes(shortId)) {
          console.log(`Found legacy numeric match: ${postId} contains ${shortId}`);
          
          // Store this mapping for future use
          try {
            await mappingRef.set(postId);
            console.log(`Stored legacy numeric mapping: ${shortId} -> ${postId}`);
          } catch (mappingError) {
            console.error('Error storing legacy numeric mapping:', mappingError);
          }
          
          return res.status(200).json({ success: true, fullId: postId });
        }
      }
    }

    console.log(`No post found with short ID: ${shortId}`);
    return res.status(404).json({ error: 'Post not found' });

  } catch (error) {
    console.error('Error resolving short ID:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

