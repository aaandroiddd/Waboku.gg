import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Starting wanted posts duplicate cleanup...');
    
    const { database } = getFirebaseAdmin();
    
    if (!database) {
      throw new Error('Admin database not initialized');
    }

    // Get all posts from both paths
    const wantedPostsRef = database.ref('wantedPosts');
    const wantedPostsSnapshot = await wantedPostsRef.once('value');
    
    const wantedPostsAltRef = database.ref('wanted/posts');
    const wantedPostsAltSnapshot = await wantedPostsAltRef.once('value');
    
    const wantedPostsData = wantedPostsSnapshot.exists() ? wantedPostsSnapshot.val() : {};
    const wantedPostsAltData = wantedPostsAltSnapshot.exists() ? wantedPostsAltSnapshot.val() : {};
    
    console.log(`Found ${Object.keys(wantedPostsData).length} posts in wantedPosts`);
    console.log(`Found ${Object.keys(wantedPostsAltData).length} posts in wanted/posts`);
    
    const duplicates = [];
    const toDelete = [];
    
    // Check for duplicates by comparing title, userId, and createdAt
    for (const [wantId, wantPost] of Object.entries(wantedPostsData)) {
      const wantPostData = wantPost as any;
      
      for (const [altId, altPost] of Object.entries(wantedPostsAltData)) {
        const altPostData = altPost as any;
        
        // Check if these are the same post (same title, user, and similar creation time)
        const titleMatch = wantPostData.title === altPostData.title;
        const userMatch = wantPostData.userId === altPostData.userId;
        const timeMatch = Math.abs((wantPostData.createdAt || 0) - (altPostData.createdAt || 0)) < 60000; // Within 1 minute
        
        if (titleMatch && userMatch && timeMatch) {
          duplicates.push({
            wantId,
            altId,
            title: wantPostData.title,
            userId: wantPostData.userId
          });
          
          // Mark the old post for deletion (prefer WANT format)
          toDelete.push({
            path: `wanted/posts/${altId}`,
            id: altId,
            title: altPostData.title
          });
        }
      }
    }
    
    console.log(`Found ${duplicates.length} duplicate pairs`);
    console.log(`Will delete ${toDelete.length} old posts`);
    
    // Delete the old posts
    const deletionResults = [];
    for (const deleteItem of toDelete) {
      try {
        const deleteRef = database.ref(deleteItem.path);
        await deleteRef.remove();
        console.log(`Deleted duplicate post: ${deleteItem.path}`);
        deletionResults.push({
          success: true,
          path: deleteItem.path,
          title: deleteItem.title
        });
      } catch (error) {
        console.error(`Error deleting ${deleteItem.path}:`, error);
        deletionResults.push({
          success: false,
          path: deleteItem.path,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Also check for any posts in the old 'wanted' root path
    const wantedRootRef = database.ref('wanted');
    const wantedRootSnapshot = await wantedRootRef.once('value');
    
    let rootCleanupCount = 0;
    if (wantedRootSnapshot.exists()) {
      const rootData = wantedRootSnapshot.val();
      
      // Check if there are direct posts under 'wanted' (not in 'wanted/posts')
      for (const [key, value] of Object.entries(rootData)) {
        if (key !== 'posts' && typeof value === 'object' && value !== null) {
          const postData = value as any;
          if (postData.title && postData.userId) {
            // This looks like a post directly under 'wanted', remove it
            try {
              const rootPostRef = database.ref(`wanted/${key}`);
              await rootPostRef.remove();
              console.log(`Removed old root post: wanted/${key}`);
              rootCleanupCount++;
            } catch (error) {
              console.error(`Error removing root post wanted/${key}:`, error);
            }
          }
        }
      }
    }
    
    return res.status(200).json({
      success: true,
      duplicatesFound: duplicates.length,
      postsDeleted: deletionResults.filter(r => r.success).length,
      rootPostsDeleted: rootCleanupCount,
      errors: deletionResults.filter(r => !r.success),
      duplicates: duplicates.map(d => ({
        kept: `wantedPosts/${d.wantId}`,
        removed: `wanted/posts/${d.altId}`,
        title: d.title
      })),
      message: `Cleanup completed. Removed ${deletionResults.filter(r => r.success).length} duplicate posts and ${rootCleanupCount} root posts.`
    });

  } catch (error) {
    console.error('Error during wanted posts cleanup:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Cleanup failed'
    });
  }
}