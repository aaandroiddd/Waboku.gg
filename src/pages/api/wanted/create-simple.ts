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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Creating wanted post via simple API with admin SDK...');
    
    // Use admin SDK to write to the database
    const adminDb = getDatabase(firebaseAdmin);
    
    if (!adminDb) {
      console.error('Admin database not initialized');
      return res.status(500).json({ error: 'Admin database not initialized' });
    }
    
    // Get the post data from the request
    const postData = req.body;
    
    // Log the received data
    console.log('Received post data:', JSON.stringify(postData, null, 2));
    
    // Validate required fields
    if (!postData.title || !postData.game || !postData.location) {
      console.error('Missing required fields', { 
        hasTitle: !!postData.title, 
        hasGame: !!postData.game, 
        hasLocation: !!postData.location 
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create a reference to the wanted posts collection
    const postsRef = adminDb.ref('wantedPosts');
    console.log('Created posts reference to path:', 'wantedPosts');
    
    // Generate a new post ID
    const newPostRef = postsRef.push();
    if (!newPostRef || !newPostRef.key) {
      console.error('Could not generate post ID');
      return res.status(500).json({ error: 'Failed to generate post ID' });
    }
    
    const newPostId = newPostRef.key;
    console.log('Generated new post ID:', newPostId);
    
    // Create timestamp
    const timestamp = Date.now();
    
    // Create the new post object with default user info
    const newPost = {
      ...postData,
      createdAt: timestamp,
      userId: postData.userId || 'anonymous',
      userName: postData.userName || 'Anonymous User',
      userAvatar: postData.userAvatar || undefined,
    };
    
    // Log the post object being saved
    console.log('Post object to save:', JSON.stringify(newPost, null, 2));
    
    // Save to Firebase using admin SDK
    console.log('Saving post to Firebase with admin SDK...');
    try {
      await newPostRef.set(newPost);
      console.log('Post saved successfully with ID:', newPostId);
    } catch (saveError) {
      console.error('Error during database save operation:', saveError);
      throw saveError;
    }
    
    // Verify the post was saved by reading it back
    try {
      const savedPostRef = adminDb.ref(`wantedPosts/${newPostId}`);
      const snapshot = await savedPostRef.get();
      
      if (snapshot.exists()) {
        console.log('Post verification successful - post exists in database');
      } else {
        console.error('Post verification failed - post not found in database after save');
      }
    } catch (verifyError) {
      console.error('Error verifying post was saved:', verifyError);
      // Continue anyway since the post might have been saved
    }
    
    return res.status(200).json({ 
      success: true, 
      postId: newPostId,
      message: 'Wanted post created successfully' 
    });
  } catch (error) {
    console.error('Error creating wanted post:', error);
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to create wanted post',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}