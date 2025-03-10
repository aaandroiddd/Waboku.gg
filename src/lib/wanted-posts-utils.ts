import { ref, get, set } from 'firebase/database';
import { firebaseDatabase } from './firebase';

/**
 * Utility function to check if wanted posts need migration
 * and trigger migration if needed
 */
export async function checkAndMigrateWantedPosts() {
  try {
    console.log('Checking if wanted posts need migration...');
    
    // Check if database is initialized
    if (!firebaseDatabase) {
      console.error('Database not initialized');
      return {
        success: false,
        error: 'Database not initialized'
      };
    }

    // Check if posts exist in the target path
    const targetRef = ref(firebaseDatabase, 'wanted/posts');
    const targetSnapshot = await get(targetRef);
    
    // If posts already exist in the target path, no migration needed
    if (targetSnapshot.exists()) {
      const postCount = Object.keys(targetSnapshot.val()).length;
      console.log(`Found ${postCount} posts in target path, no migration needed`);
      return {
        success: true,
        migrated: false,
        message: 'Posts already exist in target path',
        postCount
      };
    }
    
    // Check if posts exist in the old path
    const oldRef = ref(firebaseDatabase, 'wantedPosts');
    const oldSnapshot = await get(oldRef);
    
    // If posts exist in the old path, trigger migration
    if (oldSnapshot.exists()) {
      console.log('Found posts in old path, triggering migration...');
      
      // Call the migration API
      const response = await fetch('/api/wanted/migrate-posts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Migration API returned ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Migration completed:', result);
      
      return {
        success: true,
        migrated: true,
        message: 'Migration completed successfully',
        result
      };
    }
    
    // If no posts exist in either path, create a test post
    console.log('No posts found in any path, creating a test post...');
    
    // Create test post data
    const testPost = {
      title: "Test Wanted Post",
      description: "This is a test wanted post created automatically",
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
    
    return {
      success: true,
      migrated: false,
      testPostCreated: true,
      message: 'Created test post',
      testPostId
    };
  } catch (error) {
    console.error('Error checking and migrating wanted posts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}