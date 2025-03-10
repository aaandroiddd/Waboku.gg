import { NextApiRequest, NextApiResponse } from 'next';
import { ref, get, set, push } from 'firebase/database';
import { firebaseDatabase } from '@/lib/firebase';

// Helper function to log detailed information
const logDetails = (message: string, data: any = {}) => {
  console.log(`[fix-paths] ${message}`, data);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    logDetails('Starting fix-paths API handler');
    
    // Check if database is initialized
    if (!firebaseDatabase) {
      logDetails('Database not initialized', {
        databaseExists: !!firebaseDatabase,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
      
      return res.status(500).json({ 
        error: 'Database not initialized',
        databaseExists: !!firebaseDatabase,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
    }
    
    // Log Firebase configuration status
    logDetails('Firebase configuration status', {
      databaseInitialized: !!firebaseDatabase,
      databaseURLExists: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      apiKeyExists: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectIdExists: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });

    // Check all possible paths where posts might be stored
    const paths = [
      'wanted/posts',
      'wantedPosts',
      'wanted'
    ];
    
    let pathResults = {} as Record<string, any>;
    let postsFound = false;
    let totalPostsCount = 0;
    
    // Check each path for posts
    for (const path of paths) {
      logDetails(`Checking path: ${path}`);
      const pathRef = ref(firebaseDatabase, path);
      
      try {
        const snapshot = await get(pathRef);
        const exists = snapshot.exists();
        
        if (exists) {
          const data = snapshot.val();
          
          // Check if this is a collection of posts
          if (typeof data === 'object' && data !== null) {
            // Count valid posts (objects with title and description)
            const validPosts = Object.entries(data).filter(([key, value]) => {
              return typeof value === 'object' && 
                     value !== null && 
                     (value as any).title && 
                     (value as any).description;
            });
            
            const count = validPosts.length;
            
            logDetails(`Found ${count} valid posts at path: ${path}`, {
              path,
              count,
              firstKey: count > 0 ? validPosts[0][0] : null
            });
            
            pathResults[path] = {
              exists,
              count,
              firstKey: count > 0 ? validPosts[0][0] : null,
              isCollection: true
            };
            
            if (count > 0) {
              postsFound = true;
              totalPostsCount += count;
            }
          } else {
            // This might be a direct post or something else
            pathResults[path] = {
              exists,
              isCollection: false,
              dataType: typeof data
            };
          }
        } else {
          logDetails(`No data found at path: ${path}`);
          pathResults[path] = {
            exists: false
          };
        }
      } catch (pathError) {
        logDetails(`Error checking path: ${path}`, {
          error: pathError instanceof Error ? pathError.message : 'Unknown error'
        });
        
        pathResults[path] = {
          error: pathError instanceof Error ? pathError.message : 'Unknown error'
        };
      }
    }
    
    // If no posts found in any path, create a test post
    if (!postsFound) {
      logDetails('No posts found in any path, creating test post');
      
      try {
        // Create a new post reference in the primary path
        const postsRef = ref(firebaseDatabase, 'wanted/posts');
        const newPostRef = push(postsRef);
        
        if (!newPostRef || !newPostRef.key) {
          logDetails('Failed to create post reference', {
            refExists: !!newPostRef,
            keyExists: !!(newPostRef && newPostRef.key)
          });
          
          return res.status(500).json({
            error: 'Failed to create post reference',
            databaseInitialized: !!firebaseDatabase
          });
        }
        
        logDetails('Created post reference', { postId: newPostRef.key });
        
        // Create test post data
        const testPost = {
          title: "Test Wanted Post",
          description: "This is a test wanted post created by the fix-paths API",
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
        logDetails('Test post created successfully', { 
          postId: newPostRef.key,
          path: `wanted/posts/${newPostRef.key}`
        });
        
        // Verify the post was actually saved
        const verifyRef = ref(firebaseDatabase, `wanted/posts/${newPostRef.key}`);
        const verifySnapshot = await get(verifyRef);
        
        if (verifySnapshot.exists()) {
          logDetails('Verified post was saved correctly', { 
            postId: newPostRef.key,
            hasTitle: !!verifySnapshot.val().title
          });
          
          pathResults.testPostCreated = {
            postId: newPostRef.key,
            path: `wanted/posts/${newPostRef.key}`
          };
        } else {
          logDetails('WARNING: Post was not found after saving', { 
            postId: newPostRef.key 
          });
          
          pathResults.testPostError = 'Post was not found after saving';
        }
      } catch (createError) {
        logDetails('Error creating test post', {
          error: createError instanceof Error ? createError.message : 'Unknown error'
        });
        
        pathResults.testPostError = createError instanceof Error ? 
          createError.message : 'Unknown error';
      }
    }
    
    // Return the results
    return res.status(200).json({
      message: postsFound ? 'Found existing posts' : 'No posts found, created test post',
      postsFound,
      totalPostsCount,
      pathResults
    });
  } catch (error) {
    console.error('Error in fix-paths API:', error);
    
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    });
  }
}