import { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';

// Helper function to log detailed information
const logDetails = (message: string, data: any = {}) => {
  console.log(`[fix-paths] ${message}`, data);
};

// Initialize Firebase Admin if not already initialized
let firebaseAdmin: admin.app.App;
try {
  firebaseAdmin = admin.app();
  logDetails('Using existing Firebase Admin app');
} catch (error) {
  logDetails('Initializing new Firebase Admin app', {
    projectId: process.env.FIREBASE_PROJECT_ID ? 'set' : 'missing',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? 'set' : 'missing',
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? 'set (length: ' + process.env.FIREBASE_PRIVATE_KEY?.length + ')' : 'missing',
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? 'set' : 'missing'
  });
  
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  };

  firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    logDetails('Starting fix-paths API handler');
    
    // Use admin SDK to access the database
    const adminDb = getDatabase(firebaseAdmin);
    
    // Check if database is initialized
    if (!adminDb) {
      logDetails('Admin database not initialized', {
        databaseExists: !!adminDb,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
      
      return res.status(500).json({ 
        error: 'Admin database not initialized',
        databaseExists: !!adminDb,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
    }
    
    // Log Firebase configuration status
    logDetails('Firebase configuration status', {
      databaseInitialized: !!adminDb,
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
      const pathRef = adminDb.ref(path);
      
      try {
        const snapshot = await pathRef.get();
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
        const postsRef = adminDb.ref('wanted/posts');
        const newPostRef = postsRef.push();
        
        if (!newPostRef || !newPostRef.key) {
          logDetails('Failed to create post reference', {
            refExists: !!newPostRef,
            keyExists: !!(newPostRef && newPostRef.key)
          });
          
          return res.status(500).json({
            error: 'Failed to create post reference',
            databaseInitialized: !!adminDb
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
        
        // Save the test post to both paths for consistency
        const updates: Record<string, any> = {};
        updates[`wanted/posts/${newPostRef.key}`] = testPost;
        updates[`wantedPosts/${newPostRef.key}`] = testPost;
        
        await adminDb.ref().update(updates);
        
        logDetails('Test post created successfully', { 
          postId: newPostRef.key,
          paths: [
            `wanted/posts/${newPostRef.key}`,
            `wantedPosts/${newPostRef.key}`
          ]
        });
        
        // Verify the post was actually saved
        const verifyRef = adminDb.ref(`wanted/posts/${newPostRef.key}`);
        const verifySnapshot = await verifyRef.get();
        
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