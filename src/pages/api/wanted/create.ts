import { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
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
    console.log('Creating wanted post via API with admin SDK...');
    
    // Get the auth token from the request
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No auth token provided');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Use admin SDK to write to the database
    const adminDb = getDatabase(firebaseAdmin);
    
    if (!adminDb) {
      console.error('Admin database not initialized');
      return res.status(500).json({ error: 'Admin database not initialized' });
    }
    
    // Verify the token using Firebase Admin
    const adminAuth = getAuth(firebaseAdmin);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    // Get the user from Firebase Admin
    const user = await adminAuth.getUser(userId);
    
    if (!user) {
      console.error('User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get the post data from the request
    const postData = req.body;
    
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
    
    // Create the new post object
    const newPost = {
      ...postData,
      createdAt: timestamp,
      userId: user.uid,
      userName: user.displayName || 'Anonymous User',
      userAvatar: user.photoURL || undefined,
    };
    
    // Save to Firebase using admin SDK
    console.log('Saving post to Firebase with admin SDK...');
    await newPostRef.set(newPost);
    console.log('Post saved successfully');
    
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