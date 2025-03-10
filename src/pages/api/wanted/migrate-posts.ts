import { NextApiRequest, NextApiResponse } from 'next';
import { ref, get, set } from 'firebase/database';
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

    // Create reference to old path
    const oldPathRef = ref(firebaseDatabase, 'wantedPosts');
    
    // Get data from old path
    const oldSnapshot = await get(oldPathRef);
    
    // Check if old path exists
    const oldPathExists = oldSnapshot.exists();
    
    if (!oldPathExists) {
      return res.status(200).json({ 
        message: 'No data found in old path',
        oldPathExists: false
      });
    }
    
    // Get old data
    const oldData = oldSnapshot.val();
    
    // Create reference to new path
    const newPathRef = ref(firebaseDatabase, 'wanted/posts');
    
    // Check if new path already has data
    const newSnapshot = await get(newPathRef);
    const newPathExists = newSnapshot.exists();
    
    // Migrate data
    let migratedCount = 0;
    const migrationErrors = [];
    
    for (const [key, value] of Object.entries(oldData)) {
      try {
        // Create reference to specific post in new path
        const newPostRef = ref(firebaseDatabase, `wanted/posts/${key}`);
        
        // Set data in new path
        await set(newPostRef, value);
        
        migratedCount++;
      } catch (error) {
        console.error(`Error migrating post ${key}:`, error);
        migrationErrors.push({
          key,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return res.status(200).json({ 
      message: 'Migration completed',
      oldPathExists,
      newPathExists,
      oldDataCount: Object.keys(oldData).length,
      migratedCount,
      migrationErrors
    });
  } catch (error) {
    console.error('Error migrating wanted posts:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    });
  }
}