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

  try {
    const { database } = getFirebaseAdmin();
    
    if (!database) {
      console.error('Firebase Admin database not initialized');
      return res.status(500).json({ error: 'Database not initialized' });
    }

    console.log(`=== DEBUG SHORT ID RESOLUTION ===`);
    console.log(`Looking for short ID: ${shortId}`);

    // Get all wanted posts to debug
    const postsRef = database.ref('wantedPosts');
    const postsSnapshot = await postsRef.once('value');
    
    if (!postsSnapshot.exists()) {
      console.log('No wanted posts found in database');
      return res.status(404).json({ 
        error: 'No posts found',
        debug: {
          shortId,
          postsExist: false,
          pathChecked: 'wantedPosts'
        }
      });
    }

    const posts = postsSnapshot.val();
    const postIds = Object.keys(posts);
    
    console.log(`Found ${postIds.length} total posts`);
    console.log(`First few post IDs:`, postIds.slice(0, 5));

    // Generate short IDs for all posts and find matches
    const shortIdMappings: Array<{postId: string, generatedShortId: string, title: string}> = [];
    let exactMatch: string | null = null;

    for (const [postId, postData] of Object.entries(posts)) {
      if (!postData || typeof postData !== 'object') continue;
      
      const generatedShortId = generateNumericShortId(postId);
      const title = (postData as any).title || 'Untitled';
      
      shortIdMappings.push({
        postId,
        generatedShortId,
        title
      });
      
      if (generatedShortId === shortId) {
        exactMatch = postId;
        console.log(`EXACT MATCH FOUND: ${postId} -> ${shortId} (${title})`);
      }
    }

    // Check stored mappings
    const mappingRef = database.ref(`wantedPostMappings/${shortId}`);
    const mappingSnapshot = await mappingRef.once('value');
    const storedMapping = mappingSnapshot.exists() ? mappingSnapshot.val() : null;

    // Look for partial matches
    const partialMatches = shortIdMappings.filter(mapping => 
      mapping.generatedShortId.includes(shortId) || 
      mapping.postId.includes(shortId)
    );

    console.log(`=== RESULTS ===`);
    console.log(`Exact match: ${exactMatch}`);
    console.log(`Stored mapping: ${storedMapping}`);
    console.log(`Partial matches: ${partialMatches.length}`);

    return res.status(200).json({
      debug: {
        shortId,
        totalPosts: postIds.length,
        exactMatch,
        storedMapping,
        partialMatches: partialMatches.slice(0, 10), // Limit to first 10
        sampleMappings: shortIdMappings.slice(0, 10), // Show first 10 for debugging
        pathChecked: 'wantedPosts'
      }
    });

  } catch (error) {
    console.error('Error debugging short ID:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      debug: {
        shortId,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}