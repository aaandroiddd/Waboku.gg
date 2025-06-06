import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Fetching all wanted posts via API...');
    
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
      const posts = [];
      
      // Process each post
      for (const [id, postData] of Object.entries(data)) {
        try {
          const post = postData as any;
          
          // Validate post data has required fields
          if (!post || typeof post !== 'object' || !post.title || !post.game) {
            console.warn('Skipping invalid post data:', id, post);
            continue;
          }
          
          // Create properly formatted post object
          const formattedPost = {
            id,
            title: post.title,
            description: post.description || '',
            game: post.game,
            condition: post.condition || 'any',
            isPriceNegotiable: post.isPriceNegotiable !== false,
            location: post.location || 'Unknown',
            createdAt: post.createdAt || Date.now(),
            userId: post.userId || 'unknown',
            userName: post.userName || 'Anonymous User',
            userAvatar: post.userAvatar,
            cardName: post.cardName,
            priceRange: post.priceRange,
            detailedDescription: post.detailedDescription,
            viewCount: post.viewCount || 0
          };
          
          posts.push(formattedPost);
        } catch (postError) {
          console.error('Error processing post:', id, postError);
        }
      }
      
      console.log(`Successfully processed ${posts.length} posts`);
      
      // Sort by createdAt (newest first)
      posts.sort((a, b) => b.createdAt - a.createdAt);
      
      return res.status(200).json({
        success: true,
        posts,
        totalPosts: posts.length,
        path: 'wantedPosts',
        message: `Successfully fetched ${posts.length} wanted posts`
      });
    }

    // Try wanted/posts path as fallback
    console.log('Trying wanted/posts path...');
    const wantedPostsAltRef = database.ref('wanted/posts');
    const wantedPostsAltSnapshot = await wantedPostsAltRef.once('value');
    
    console.log('wanted/posts snapshot exists:', wantedPostsAltSnapshot.exists());
    
    if (wantedPostsAltSnapshot.exists()) {
      const data = wantedPostsAltSnapshot.val();
      const posts = [];
      
      // Process each post
      for (const [id, postData] of Object.entries(data)) {
        try {
          const post = postData as any;
          
          // Validate post data has required fields
          if (!post || typeof post !== 'object' || !post.title || !post.game) {
            console.warn('Skipping invalid post data:', id, post);
            continue;
          }
          
          // Create properly formatted post object
          const formattedPost = {
            id,
            title: post.title,
            description: post.description || '',
            game: post.game,
            condition: post.condition || 'any',
            isPriceNegotiable: post.isPriceNegotiable !== false,
            location: post.location || 'Unknown',
            createdAt: post.createdAt || Date.now(),
            userId: post.userId || 'unknown',
            userName: post.userName || 'Anonymous User',
            userAvatar: post.userAvatar,
            cardName: post.cardName,
            priceRange: post.priceRange,
            detailedDescription: post.detailedDescription,
            viewCount: post.viewCount || 0
          };
          
          posts.push(formattedPost);
        } catch (postError) {
          console.error('Error processing post:', id, postError);
        }
      }
      
      console.log(`Successfully processed ${posts.length} posts from wanted/posts`);
      
      // Sort by createdAt (newest first)
      posts.sort((a, b) => b.createdAt - a.createdAt);
      
      return res.status(200).json({
        success: true,
        posts,
        totalPosts: posts.length,
        path: 'wanted/posts',
        message: `Successfully fetched ${posts.length} wanted posts`
      });
    }

    return res.status(404).json({
      error: 'No wanted posts found in any path',
      pathsChecked: ['wantedPosts', 'wanted/posts']
    });

  } catch (error) {
    console.error('Error in fetch all wanted posts:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    });
  }
}