import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { generateNumericShortId } from '@/lib/wanted-posts-slug';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shortId } = req.query;

  try {
    const { database } = getFirebaseAdmin();
    
    if (!database) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const results: any = {
      shortId,
      searchResults: {},
      mappingCheck: null,
      allPosts: {}
    };

    // Check if we have a mapping stored for this short ID
    if (shortId) {
      const mappingRef = database.ref(`wantedPostMappings/${shortId}`);
      const mappingSnapshot = await mappingRef.once('value');
      
      results.mappingCheck = {
        exists: mappingSnapshot.exists(),
        value: mappingSnapshot.exists() ? mappingSnapshot.val() : null
      };
    }

    // Check all possible paths for wanted posts
    const pathsToCheck = [
      'wanted/posts',
      'wantedPosts', 
      'wanted'
    ];

    for (const path of pathsToCheck) {
      try {
        const snapshot = await database.ref(path).once('value');
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          const keys = Object.keys(data);
          
          results.allPosts[path] = {
            count: keys.length,
            posts: {}
          };

          // For each post, generate its short ID and check if it matches
          for (const [postId, postData] of Object.entries(data)) {
            if (!postData || typeof postData !== 'object') continue;
            
            const generatedShortId = generateNumericShortId(postId);
            
            results.allPosts[path].posts[postId] = {
              title: (postData as any).title || 'No title',
              game: (postData as any).game || 'No game',
              generatedShortId,
              matchesQuery: shortId ? generatedShortId === shortId : false
            };

            // If we're looking for a specific short ID and found a match
            if (shortId && generatedShortId === shortId) {
              results.searchResults[path] = {
                found: true,
                postId,
                postData: postData as any,
                generatedShortId
              };
            }
          }
        } else {
          results.allPosts[path] = {
            count: 0,
            posts: {}
          };
        }
      } catch (pathError) {
        results.allPosts[path] = {
          error: pathError instanceof Error ? pathError.message : 'Unknown error'
        };
      }
    }

    return res.status(200).json(results);

  } catch (error) {
    console.error('Error in test resolve:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}