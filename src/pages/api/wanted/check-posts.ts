import { NextApiRequest, NextApiResponse } from 'next';
import { ref, get, set, push } from 'firebase/database';
import { firebaseDatabase } from '@/lib/firebase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('Starting check-posts API handler');
    
    // Check if database is initialized
    if (!firebaseDatabase) {
      console.error('Database not initialized in check-posts API');
      return res.status(500).json({ 
        error: 'Database not initialized',
        databaseExists: !!firebaseDatabase,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
    }

    // First check the new path structure
    console.log('Checking wanted/posts path');
    const postsRef = ref(firebaseDatabase, 'wanted/posts');
    let snapshot = await get(postsRef);
    let postsExist = snapshot.exists();
    let postsCount = postsExist ? Object.keys(snapshot.val()).length : 0;
    
    // If no posts exist in the new path, check the old path
    if (!postsExist || postsCount === 0) {
      console.log('No posts found in wanted/posts, checking wantedPosts path');
      const oldPostsRef = ref(firebaseDatabase, 'wantedPosts');
      const oldSnapshot = await get(oldPostsRef);
      const oldPostsExist = oldSnapshot.exists();
      const oldPostsCount = oldPostsExist ? Object.keys(oldSnapshot.val()).length : 0;
      
      console.log(`Old path check results: exists=${oldPostsExist}, count=${oldPostsCount}`);
      
      // If posts exist in the old path, use that instead
      if (oldPostsExist && oldPostsCount > 0) {
        postsExist = oldPostsExist;
        postsCount = oldPostsCount;
        snapshot = oldSnapshot;
        console.log(`Using old path with ${postsCount} posts`);
      }
    }
    
    // If no posts exist in either path, create a test post in the new path
    if (!postsExist || postsCount === 0) {
      console.log('No posts found in either path, creating test post');
      
      // Create a new post reference
      const newPostRef = push(postsRef);
      
      // Create test post data
      const testPost = {
        title: "Test Wanted Post",
        description: "This is a test wanted post created by the system",
        game: "pokemon",
        condition: "near_mint",
        isPriceNegotiable: true,
        priceRange: {
          min: 10,
          max: 50
        },
        location: "California, USA",
        createdAt: Date.now(),
        userId: "system",
        userName: "System Test User",
        userAvatar: "/images/default-avatar.svg"
      };
      
      // Save the test post
      try {
        await set(newPostRef, testPost);
        console.log('Test post created successfully with ID:', newPostRef.key);
        
        return res.status(200).json({ 
          message: 'No posts found, created test post',
          postId: newPostRef.key,
          postsExisted: postsExist,
          previousCount: postsCount,
          path: 'wanted/posts'
        });
      } catch (saveError) {
        console.error('Error saving test post:', saveError);
        return res.status(500).json({
          error: 'Failed to create test post',
          message: saveError instanceof Error ? saveError.message : 'Unknown error',
          path: 'wanted/posts'
        });
      }
    }
    
    // Return the posts data
    console.log(`Returning posts data: exists=${postsExist}, count=${postsCount}`);
    return res.status(200).json({ 
      message: 'Posts found in database',
      postsExist,
      postsCount,
      firstPostKey: postsExist ? Object.keys(snapshot.val())[0] : null,
      samplePost: postsExist ? snapshot.val()[Object.keys(snapshot.val())[0]] : null
    });
  } catch (error) {
    console.error('Error checking wanted posts:', error);
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    });
  }
}