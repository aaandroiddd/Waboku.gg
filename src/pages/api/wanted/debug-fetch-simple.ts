import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting debug fetch for wanted posts...');
    
    // Get Firebase Admin instance
    const { database } = getFirebaseAdmin();
    
    if (!database) {
      console.error('Database not initialized');
      return res.status(500).json({ 
        error: 'Database not initialized',
        databaseExists: !!database
      });
    }

    console.log('Database initialized successfully');

    // Try to fetch from wantedPosts path (where data should be)
    console.log('Fetching from wantedPosts path...');
    const wantedPostsRef = database.ref('wantedPosts');
    const wantedPostsSnapshot = await wantedPostsRef.once('value');
    
    console.log('wantedPosts snapshot exists:', wantedPostsSnapshot.exists());
    
    if (wantedPostsSnapshot.exists()) {
      const data = wantedPostsSnapshot.val();
      const postCount = Object.keys(data).length;
      console.log(`Found ${postCount} posts in wantedPosts`);
      
      // Get first few posts for inspection
      const posts = Object.entries(data).slice(0, 3).map(([id, post]: [string, any]) => ({
        id,
        title: post.title,
        game: post.game,
        userId: post.userId,
        createdAt: post.createdAt
      }));
      
      return res.status(200).json({
        success: true,
        path: 'wantedPosts',
        totalPosts: postCount,
        samplePosts: posts,
        message: `Successfully fetched ${postCount} posts from wantedPosts`
      });
    }

    // Try wanted/posts path
    console.log('Trying wanted/posts path...');
    const wantedPostsAltRef = database.ref('wanted/posts');
    const wantedPostsAltSnapshot = await wantedPostsAltRef.once('value');
    
    console.log('wanted/posts snapshot exists:', wantedPostsAltSnapshot.exists());
    
    if (wantedPostsAltSnapshot.exists()) {
      const data = wantedPostsAltSnapshot.val();
      const postCount = Object.keys(data).length;
      console.log(`Found ${postCount} posts in wanted/posts`);
      
      return res.status(200).json({
        success: true,
        path: 'wanted/posts',
        totalPosts: postCount,
        message: `Successfully fetched ${postCount} posts from wanted/posts`
      });
    }

    // Try wanted path
    console.log('Trying wanted path...');
    const wantedRef = database.ref('wanted');
    const wantedSnapshot = await wantedRef.once('value');
    
    console.log('wanted snapshot exists:', wantedSnapshot.exists());
    
    if (wantedSnapshot.exists()) {
      const data = wantedSnapshot.val();
      console.log('wanted data structure:', Object.keys(data));
      
      return res.status(200).json({
        success: true,
        path: 'wanted',
        dataStructure: Object.keys(data),
        message: 'Found data in wanted path'
      });
    }

    return res.status(404).json({
      error: 'No wanted posts found in any path',
      pathsChecked: ['wantedPosts', 'wanted/posts', 'wanted']
    });

  } catch (error) {
    console.error('Error in debug fetch:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    });
  }
}