import { NextApiRequest, NextApiResponse } from 'next';
import { ref, get, set, remove } from 'firebase/database';
import { firebaseDatabase } from '@/lib/firebase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add basic security check for API endpoint
  const authHeader = req.headers.authorization;
  const adminSecret = process.env.ADMIN_SECRET;
  
  // Check if authorization is required and provided
  if (adminSecret && (!authHeader || authHeader !== `Bearer ${adminSecret}`)) {
    return res.status(401).json({ error: 'Unauthorized access' });
  }

  try {
    console.log('Starting wanted posts migration...');
    
    // Check if database is initialized
    if (!firebaseDatabase) {
      console.error('Database not initialized');
      return res.status(500).json({ 
        error: 'Database not initialized',
        databaseExists: !!firebaseDatabase,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
    }

    // Check all possible paths where posts might be stored
    const paths = [
      'wantedPosts',
      'wanted',
      'wanted/posts'
    ];
    
    let migrationResults = {
      postsFound: 0,
      postsMigrated: 0,
      errors: 0,
      pathsWithPosts: [] as string[],
      details: {} as Record<string, any>
    };
    
    // Check each path for posts
    for (const path of paths) {
      console.log(`Checking path: ${path}`);
      const pathRef = ref(firebaseDatabase, path);
      const snapshot = await get(pathRef);
      
      if (snapshot.exists()) {
        console.log(`Found posts at path: ${path}`);
        const postsData = snapshot.val();
        
        // If this is a direct post (not a collection)
        if (path === 'wanted' && postsData.title && postsData.description) {
          console.log('Found a direct post at wanted path, not a collection');
          migrationResults.details[path] = 'Found direct post, not a collection';
          continue;
        }
        
        const postCount = Object.keys(postsData).length;
        console.log(`Found ${postCount} posts at path: ${path}`);
        
        migrationResults.postsFound += postCount;
        migrationResults.pathsWithPosts.push(path);
        migrationResults.details[path] = { count: postCount };
        
        // If this is not the target path, migrate posts
        if (path !== 'wanted/posts') {
          console.log(`Migrating posts from ${path} to wanted/posts...`);
          
          // Migrate each post
          for (const [postId, postData] of Object.entries(postsData)) {
            try {
              // Skip if this doesn't look like a post
              if (typeof postData !== 'object' || !postData || !(postData as any).title) {
                console.log(`Skipping invalid post data at ${path}/${postId}`);
                continue;
              }
              
              // Create reference to the target post
              const targetPostRef = ref(firebaseDatabase, `wanted/posts/${postId}`);
              
              // Check if post already exists at target location
              const existingPostSnapshot = await get(targetPostRef);
              if (existingPostSnapshot.exists()) {
                console.log(`Post ${postId} already exists at target location, skipping`);
                continue;
              }
              
              // Copy the post data to the new location
              await set(targetPostRef, postData);
              
              console.log(`Migrated post ${postId} from ${path} to wanted/posts`);
              migrationResults.postsMigrated++;
              
              // Don't remove from old location for safety
              // await remove(ref(firebaseDatabase, `${path}/${postId}`));
            } catch (postError) {
              console.error(`Error migrating post ${postId}:`, postError);
              migrationResults.errors++;
              
              if (migrationResults.details[path].errors === undefined) {
                migrationResults.details[path].errors = [];
              }
              
              migrationResults.details[path].errors.push({
                postId,
                error: postError instanceof Error ? postError.message : 'Unknown error'
              });
            }
          }
        }
      } else {
        console.log(`No posts found at path: ${path}`);
        migrationResults.details[path] = 'No posts found';
      }
    }
    
    // Create a test post if no posts were found or migrated
    if (migrationResults.postsFound === 0) {
      try {
        console.log('No posts found, creating a test post...');
        
        // Create test post data
        const testPost = {
          title: "Test Wanted Post",
          description: "This is a test wanted post created by the migration script",
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
        
        // Generate a unique ID for the test post
        const testPostId = `test-post-${Date.now()}`;
        
        // Create reference to the test post
        const testPostRef = ref(firebaseDatabase, `wanted/posts/${testPostId}`);
        
        // Save the test post
        await set(testPostRef, testPost);
        
        console.log(`Created test post with ID: ${testPostId}`);
        migrationResults.testPostCreated = {
          id: testPostId,
          path: `wanted/posts/${testPostId}`
        };
      } catch (testPostError) {
        console.error('Error creating test post:', testPostError);
        migrationResults.testPostError = testPostError instanceof Error ? 
          testPostError.message : 'Unknown error';
      }
    }
    
    // Return the migration results
    return res.status(200).json({ 
      message: 'Migration completed',
      results: migrationResults
    });
  } catch (error) {
    console.error('Error during wanted posts migration:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    });
  }
}