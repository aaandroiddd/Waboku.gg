import { NextApiRequest, NextApiResponse } from 'next';
import { ref, get, set, push } from 'firebase/database';
import { firebaseDatabase } from '@/lib/firebase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check if database is initialized
    if (!firebaseDatabase) {
      return res.status(500).json({ 
        error: 'Database not initialized',
        databaseExists: !!firebaseDatabase,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
    }

    // Create reference to wanted/posts collection
    const postsRef = ref(firebaseDatabase, 'wanted/posts');
    
    // Get current posts
    const snapshot = await get(postsRef);
    
    // Check if posts exist
    const postsExist = snapshot.exists();
    const postsCount = postsExist ? Object.keys(snapshot.val()).length : 0;
    
    // If no posts exist, create a test post
    if (!postsExist || postsCount === 0) {
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
      await set(newPostRef, testPost);
      
      return res.status(200).json({ 
        message: 'No posts found, created test post',
        postId: newPostRef.key,
        postsExisted: postsExist,
        previousCount: postsCount
      });
    }
    
    // Return the posts data
    return res.status(200).json({ 
      message: 'Posts found in database',
      postsExist,
      postsCount,
      firstPostKey: postsExist ? Object.keys(snapshot.val())[0] : null,
      samplePost: postsExist ? snapshot.val()[Object.keys(snapshot.val())[0]] : null
    });
  } catch (error) {
    console.error('Error checking wanted posts:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    });
  }
}