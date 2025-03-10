import { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';

// Helper function to log detailed information
const logDetails = (message: string, data: any = {}) => {
  console.log(`[delete-post] ${message}`, data);
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
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { postId, userId } = req.body;

    // Validate required parameters
    if (!postId || !userId) {
      logDetails('Missing required parameters', { postId, userId });
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    logDetails('Starting delete-post API handler', { postId, userId });
    
    // Use admin SDK to access the database
    const adminDb = getDatabase(firebaseAdmin);
    
    // Check if database is initialized
    if (!adminDb) {
      logDetails('Admin database not initialized', {
        databaseExists: !!adminDb,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      
      return res.status(500).json({ 
        error: 'Admin database not initialized',
        databaseExists: !!adminDb,
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
    }

    // Check all possible paths where the post might be stored
    const paths = [
      `wanted/posts/${postId}`,
      `wantedPosts/${postId}`,
      `wanted/${postId}`
    ];
    
    let postFound = false;
    let postPath = '';
    let postData = null;
    
    // Check each path for the post
    for (const path of paths) {
      logDetails(`Checking path: ${path}`);
      const pathRef = adminDb.ref(path);
      
      try {
        const snapshot = await pathRef.get();
        if (snapshot.exists()) {
          postFound = true;
          postPath = path;
          postData = snapshot.val();
          logDetails(`Post found at path: ${path}`, { 
            postId, 
            userId: postData.userId 
          });
          break;
        }
      } catch (pathError) {
        logDetails(`Error checking path: ${path}`, {
          error: pathError instanceof Error ? pathError.message : 'Unknown error'
        });
      }
    }
    
    // If post doesn't exist in any path
    if (!postFound || !postData) {
      logDetails('Post not found in any path', { postId });
      return res.status(404).json({ error: 'Post not found' });
    }
    
    // Verify the user owns this post
    if (postData.userId !== userId) {
      logDetails('User does not own this post', { 
        postId, 
        userId, 
        postOwnerId: postData.userId 
      });
      return res.status(403).json({ error: 'You do not have permission to delete this post' });
    }
    
    // Delete the post from all possible paths to ensure it's completely removed
    const deletePromises = paths.map(path => {
      logDetails(`Attempting to delete from path: ${path}`);
      return adminDb.ref(path).remove()
        .then(() => ({ path, success: true }))
        .catch(error => ({ 
          path, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }));
    });
    
    const deleteResults = await Promise.all(deletePromises);
    logDetails('Delete operations completed', { results: deleteResults });
    
    // Verify the post was deleted from the path where it was found
    const verifyRef = adminDb.ref(postPath);
    const verifySnapshot = await verifyRef.get();
    
    if (verifySnapshot.exists()) {
      logDetails('WARNING: Post still exists after deletion attempt', { postId, path: postPath });
      return res.status(500).json({ 
        error: 'Failed to delete post',
        deleteResults
      });
    }
    
    logDetails('Post deleted successfully', { postId, path: postPath });
    return res.status(200).json({ 
      success: true, 
      message: 'Post deleted successfully',
      postId,
      path: postPath,
      deleteResults
    });
  } catch (error) {
    console.error('Error deleting wanted post:', error);
    
    // Detailed error logging
    if (error instanceof Error) {
      logDetails('Error details', {
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