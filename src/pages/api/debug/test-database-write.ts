import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { ref, push, set } from 'firebase/database';
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
  try {
    console.log('Testing database write with admin credentials...');
    
    // Use admin SDK to write to the database
    const adminDb = getDatabase(firebaseAdmin);
    
    if (!adminDb) {
      console.error('Admin database not initialized');
      return res.status(500).json({ error: 'Admin database not initialized' });
    }
    
    // Try to write to a test location using admin SDK
    const testRef = adminDb.ref('test');
    const newTestRef = testRef.push();
    
    await newTestRef.set({
      message: 'Test write with admin SDK',
      timestamp: Date.now()
    });
    
    console.log('Test write successful with admin SDK');
    
    // Try to write to wantedPosts using admin SDK
    const wantedPostsRef = adminDb.ref('wantedPosts');
    const newPostRef = wantedPostsRef.push();
    
    await newPostRef.set({
      title: 'Test Wanted Post',
      description: 'This is a test post',
      game: 'pokemon',
      condition: 'any',
      isPriceNegotiable: true,
      location: 'Test Location',
      createdAt: Date.now(),
      userId: 'test-user',
      userName: 'Test User'
    });
    
    console.log('Wanted post test write successful with admin SDK');
    
    return res.status(200).json({ 
      success: true, 
      message: 'Database write test successful with admin SDK',
      testId: newTestRef.key,
      postId: newPostRef.key
    });
  } catch (error) {
    console.error('Error testing database write:', error);
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to write to database',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}