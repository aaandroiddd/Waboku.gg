import { NextApiRequest, NextApiResponse } from 'next';
import { ref, get, set, push } from 'firebase/database';
import { database } from '@/lib/firebase';

// Helper function to log detailed information
const logDetails = (message: string, data: any = {}) => {
  console.log(`[check-posts] ${message}`, data);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    logDetails('Starting check-posts API handler');
    
    // Check if database is initialized
    if (!database) {
      logDetails('Database not initialized in check-posts API', {
        databaseExists: !!database,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
      
      return res.status(500).json({ 
        error: 'Database not initialized',
        databaseExists: !!database,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
    }
    
    // Log Firebase configuration status
    logDetails('Firebase configuration status', {
      databaseInitialized: !!database,
      databaseURLExists: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      apiKeyExists: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectIdExists: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });

    // First check the new path structure
    logDetails('Checking wanted/posts path');
    const postsRef = ref(database, 'wanted/posts');
    
    try {
      let snapshot = await get(postsRef);
      let postsExist = snapshot.exists();
      let postsCount = postsExist ? Object.keys(snapshot.val()).length : 0;
      
      logDetails('New path check results', { 
        path: 'wanted/posts',
        exists: postsExist, 
        count: postsCount,
        firstKey: postsExist && postsCount > 0 ? Object.keys(snapshot.val())[0] : null
      });
      
      // If no posts exist in the new path, check the old path
      if (!postsExist || postsCount === 0) {
        logDetails('No posts found in wanted/posts, checking wantedPosts path');
        
        const oldPostsRef = ref(database, 'wantedPosts');
        const oldSnapshot = await get(oldPostsRef);
        const oldPostsExist = oldSnapshot.exists();
        const oldPostsCount = oldPostsExist ? Object.keys(oldSnapshot.val()).length : 0;
        
        logDetails('Old path check results', {
          path: 'wantedPosts',
          exists: oldPostsExist, 
          count: oldPostsCount,
          firstKey: oldPostsExist && oldPostsCount > 0 ? Object.keys(oldSnapshot.val())[0] : null
        });
        
        // If posts exist in the old path, use that instead
        if (oldPostsExist && oldPostsCount > 0) {
          postsExist = oldPostsExist;
          postsCount = oldPostsCount;
          snapshot = oldSnapshot;
          logDetails('Using old path for posts', { 
            path: 'wantedPosts',
            count: postsCount 
          });
        }
      }
      
      // Also check the direct path as a last resort
      if (!postsExist || postsCount === 0) {
        logDetails('No posts found in either standard path, checking direct wanted path');
        
        const directRef = ref(database, 'wanted');
        const directSnapshot = await get(directRef);
        
        if (directSnapshot.exists()) {
          const directData = directSnapshot.val();
          
          // Check if this is a collection of posts or a single post
          if (typeof directData === 'object' && directData !== null) {
            // Check if any of the keys look like post IDs (not standard fields)
            const possiblePostKeys = Object.keys(directData).filter(key => 
              key !== 'posts' && key !== 'wantedPosts' && 
              typeof directData[key] === 'object' && 
              directData[key] !== null &&
              directData[key].title && 
              directData[key].description
            );
            
            if (possiblePostKeys.length > 0) {
              logDetails('Found possible posts in direct wanted path', {
                count: possiblePostKeys.length,
                firstKey: possiblePostKeys[0]
              });
              
              postsExist = true;
              postsCount = possiblePostKeys.length;
              // We don't update snapshot here as we'll create a new post anyway
            }
          }
        }
      }
    } catch (pathCheckError) {
      logDetails('Error checking paths', {
        error: pathCheckError instanceof Error ? pathCheckError.message : 'Unknown error',
        stack: pathCheckError instanceof Error ? pathCheckError.stack : null
      });
      
      // Continue with post creation even if path check fails
      postsExist = false;
      postsCount = 0;
    }
    
    // If no posts exist in either path, create a test post in the new path
    if (!postsExist || postsCount === 0) {
      logDetails('No posts found in any path, creating test post');
      
      try {
        // Create a new post reference
        const newPostRef = push(postsRef);
        
        if (!newPostRef || !newPostRef.key) {
          logDetails('Failed to create post reference', {
            refExists: !!newPostRef,
            keyExists: !!(newPostRef && newPostRef.key)
          });
          
          return res.status(500).json({
            error: 'Failed to create post reference',
            databaseInitialized: !!database
          });
        }
        
        logDetails('Created post reference', { postId: newPostRef.key });
        
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
        
        logDetails('Attempting to save test post', { 
          postId: newPostRef.key,
          path: `wanted/posts/${newPostRef.key}`
        });
        
        // Save the test post
        try {
          await set(newPostRef, testPost);
          logDetails('Test post created successfully', { 
            postId: newPostRef.key,
            path: `wanted/posts/${newPostRef.key}`
          });
          
          // Verify the post was actually saved
          try {
            const verifyRef = ref(database, `wanted/posts/${newPostRef.key}`);
            const verifySnapshot = await get(verifyRef);
            
            if (verifySnapshot.exists()) {
              logDetails('Verified post was saved correctly', { 
                postId: newPostRef.key,
                hasTitle: !!verifySnapshot.val().title
              });
            } else {
              logDetails('WARNING: Post was not found after saving', { 
                postId: newPostRef.key 
              });
            }
          } catch (verifyError) {
            logDetails('Error verifying post was saved', {
              error: verifyError instanceof Error ? verifyError.message : 'Unknown error'
            });
          }
          
          return res.status(200).json({ 
            message: 'No posts found, created test post',
            postId: newPostRef.key,
            postsExisted: postsExist,
            previousCount: postsCount,
            path: 'wanted/posts'
          });
        } catch (saveError) {
          logDetails('Error saving test post', {
            error: saveError instanceof Error ? saveError.message : 'Unknown error',
            stack: saveError instanceof Error ? saveError.stack : null,
            postId: newPostRef.key
          });
          
          return res.status(500).json({
            error: 'Failed to create test post',
            message: saveError instanceof Error ? saveError.message : 'Unknown error',
            path: 'wanted/posts'
          });
        }
      } catch (refError) {
        logDetails('Error creating post reference', {
          error: refError instanceof Error ? refError.message : 'Unknown error',
          stack: refError instanceof Error ? refError.stack : null
        });
        
        return res.status(500).json({
          error: 'Failed to create post reference',
          message: refError instanceof Error ? refError.message : 'Unknown error'
        });
      }
    }
    
    // Return the posts data
    logDetails('Returning posts data', { 
      exists: postsExist, 
      count: postsCount,
      firstPostKey: postsExist ? Object.keys(snapshot.val())[0] : null
    });
    
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