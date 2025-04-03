import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { ref, get, update, increment } from 'firebase/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { postId, userId } = req.body;

    if (!postId) {
      return res.status(400).json({ error: 'Missing postId parameter' });
    }

    // Initialize Firebase services
    const { firebaseDatabase } = getFirebaseServices();
    if (!firebaseDatabase) {
      console.error('Firebase database not initialized');
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Try to find the post in different possible paths
    const paths = [
      `wanted/posts/${postId}`,
      `wantedPosts/${postId}`,
      `wanted/${postId}`
    ];

    let postRef = null;
    let postData = null;
    let postPath = '';

    for (const path of paths) {
      const currentRef = ref(firebaseDatabase, path);
      const snapshot = await get(currentRef);
      
      if (snapshot.exists()) {
        postRef = currentRef;
        postData = snapshot.val();
        postPath = path;
        break;
      }
    }

    if (!postRef || !postData) {
      return res.status(404).json({ error: 'Wanted post not found' });
    }

    // Don't count views from the post owner
    if (userId && userId === postData.userId) {
      return res.status(200).json({ 
        success: true, 
        message: 'View not counted - owner view',
        viewCount: postData.viewCount || 0
      });
    }

    // Increment the view count
    const currentViewCount = postData.viewCount || 0;
    const newViewCount = currentViewCount + 1;

    await update(postRef, {
      viewCount: newViewCount
    });

    return res.status(200).json({ 
      success: true, 
      viewCount: newViewCount,
      path: postPath
    });
  } catch (error) {
    console.error('Error tracking view for wanted post:', error);
    return res.status(500).json({ error: 'Failed to track view' });
  }
}