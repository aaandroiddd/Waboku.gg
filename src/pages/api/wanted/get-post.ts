import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { postId } = req.query;

  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  try {
    const { database } = getFirebaseAdmin();
    
    if (!database) {
      console.error('Firebase Admin database not initialized');
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Try all possible paths where the post might be stored
    const paths = [
      `wantedPosts/${postId}`,
      `wanted/posts/${postId}`,
      `wanted/${postId}`
    ];
    
    let postData = null;
    let usedPath = '';
    
    // Try each path until we find the post
    for (const path of paths) {
      try {
        const postRef = database.ref(path);
        const snapshot = await postRef.once('value');
        
        if (snapshot.exists()) {
          const rawData = snapshot.val();
          
          // Ensure the post data has all required fields
          postData = {
            id: postId,
            title: rawData.title || "Untitled Post",
            description: rawData.description || "No description provided",
            game: rawData.game || "Unknown Game",
            condition: rawData.condition || "any",
            isPriceNegotiable: rawData.isPriceNegotiable || true,
            location: rawData.location || "Unknown Location",
            createdAt: rawData.createdAt || Date.now(),
            userId: rawData.userId || "unknown",
            userName: rawData.userName || "Anonymous User",
            ...rawData
          };
          
          usedPath = path;
          break;
        }
      } catch (pathError) {
        console.error(`Error checking path ${path}:`, pathError);
        // Continue to the next path
      }
    }
    
    if (!postData) {
      return res.status(404).json({ 
        error: 'Post not found',
        postId
      });
    }

    return res.status(200).json({
      success: true,
      post: postData
    });

  } catch (error) {
    console.error('Error fetching post:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}