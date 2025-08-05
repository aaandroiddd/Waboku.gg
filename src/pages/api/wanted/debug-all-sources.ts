import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Debugging all wanted posts sources...');
    
    // Get Firebase Admin instance
    const { database } = getFirebaseAdmin();
    
    if (!database) {
      return res.status(500).json({ 
        error: 'Database not initialized',
        databaseExists: !!database
      });
    }

    const databasePaths = [];
    const pathsToCheck = [
      'wantedPosts',
      'wanted/posts', 
      'wanted',
      'posts/wanted',
      'userPosts/wanted'
    ];

    let totalPosts = 0;

    // Check each database path
    for (const path of pathsToCheck) {
      try {
        console.log(`Checking path: ${path}`);
        const ref = database.ref(path);
        const snapshot = await ref.once('value');
        
        const pathInfo: any = {
          path,
          count: 0,
          posts: []
        };

        if (snapshot.exists()) {
          const data = snapshot.val();
          
          if (typeof data === 'object' && data !== null) {
            const posts = Object.entries(data).map(([id, postData]) => ({
              id,
              ...postData as any
            }));
            
            pathInfo.count = posts.length;
            pathInfo.posts = posts.slice(0, 5); // Only return first 5 for preview
            totalPosts += posts.length;
            
            console.log(`Found ${posts.length} posts at path: ${path}`);
          }
        } else {
          console.log(`No data found at path: ${path}`);
        }

        databasePaths.push(pathInfo);
      } catch (pathError) {
        console.error(`Error checking path ${path}:`, pathError);
        databasePaths.push({
          path,
          count: 0,
          posts: [],
          error: pathError instanceof Error ? pathError.message : 'Unknown error'
        });
      }
    }

    // Check cache information (this would be client-side, so we'll return instructions)
    const cacheInfo = {
      sessionStorageKeys: [], // This will be populated client-side
      apiCacheStatus: 'Check client-side sessionStorage for wantedPosts_* keys'
    };

    return res.status(200).json({
      success: true,
      databasePaths,
      cacheInfo,
      totalPosts,
      message: `Found ${totalPosts} total posts across all database paths`
    });

  } catch (error) {
    console.error('Error in debug all sources:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}