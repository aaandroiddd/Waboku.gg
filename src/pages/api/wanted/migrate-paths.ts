import { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';

// Initialize Firebase Admin if not already initialized
let firebaseAdmin: admin.app.App;
try {
  firebaseAdmin = admin.app();
} catch (error) {
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
    console.log('Starting wanted posts path migration');
    
    // Use admin SDK to access the database
    const adminDb = getDatabase(firebaseAdmin);
    
    if (!adminDb) {
      console.error('Admin database not initialized');
      return res.status(500).json({ error: 'Admin database not initialized' });
    }
    
    // Check the old path (wantedPosts)
    console.log('Checking old path (wantedPosts)');
    const oldPathRef = adminDb.ref('wantedPosts');
    const oldPathSnapshot = await oldPathRef.get();
    const oldPathExists = oldPathSnapshot.exists();
    const oldPathCount = oldPathExists ? Object.keys(oldPathSnapshot.val() || {}).length : 0;
    
    console.log(`Old path check results: exists=${oldPathExists}, count=${oldPathCount}`);
    
    // Check the new path (wanted/posts)
    console.log('Checking new path (wanted/posts)');
    const newPathRef = adminDb.ref('wanted/posts');
    const newPathSnapshot = await newPathRef.get();
    const newPathExists = newPathSnapshot.exists();
    const newPathCount = newPathExists ? Object.keys(newPathSnapshot.val() || {}).length : 0;
    
    console.log(`New path check results: exists=${newPathExists}, count=${newPathCount}`);
    
    // If old path exists but new path doesn't, migrate data
    if (oldPathExists && oldPathCount > 0) {
      console.log(`Migrating ${oldPathCount} posts from old path to new path`);
      
      // Get all posts from old path
      const oldPosts = oldPathSnapshot.val() || {};
      
      // Prepare migration operations
      const updates: Record<string, any> = {};
      
      // Copy each post to the new path
      for (const [postId, postData] of Object.entries(oldPosts)) {
        updates[`wanted/posts/${postId}`] = postData;
      }
      
      // Execute the migration
      if (Object.keys(updates).length > 0) {
        console.log(`Executing migration for ${Object.keys(updates).length} posts`);
        await adminDb.ref().update(updates);
        console.log('Migration completed successfully');
      }
    }
    
    // Check the new path again after migration
    const finalCheckRef = adminDb.ref('wanted/posts');
    const finalCheckSnapshot = await finalCheckRef.get();
    const finalPathExists = finalCheckSnapshot.exists();
    const finalPathCount = finalPathExists ? Object.keys(finalCheckSnapshot.val() || {}).length : 0;
    
    console.log(`Final path check results: exists=${finalPathExists}, count=${finalPathCount}`);
    
    return res.status(200).json({
      message: 'Path migration check completed',
      oldPath: {
        exists: oldPathExists,
        count: oldPathCount
      },
      newPath: {
        exists: newPathExists,
        count: newPathCount
      },
      finalPath: {
        exists: finalPathExists,
        count: finalPathCount
      },
      migrationPerformed: oldPathExists && oldPathCount > 0
    });
  } catch (error) {
    console.error('Error during wanted posts path migration:', error);
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to migrate wanted posts paths',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}