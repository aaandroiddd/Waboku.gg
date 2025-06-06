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
    console.log('=== WANTED POST DEBUG CREATE ===');
    
    // Log environment variables (safely)
    console.log('Environment check:', {
      projectId: !!process.env.FIREBASE_PROJECT_ID,
      clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      databaseURLValue: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    });
    
    // Get the auth token from the request
    const authHeader = req.headers.authorization;
    let userId = 'anonymous';
    let userName = 'Anonymous User';
    let userAvatar = undefined;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const adminAuth = getAuth(firebaseAdmin);
        const decodedToken = await adminAuth.verifyIdToken(token);
        const user = await adminAuth.getUser(decodedToken.uid);
        
        userId = user.uid;
        userName = user.displayName || 'Anonymous User';
        userAvatar = user.photoURL || undefined;
        
        console.log('Authenticated user:', { userId, userName });
      } catch (authError) {
        console.error('Auth error:', authError);
        // Continue with anonymous user
      }
    } else {
      console.log('No auth token provided, using anonymous user');
    }
    
    // Use admin SDK to write to the database
    const adminDb = getDatabase(firebaseAdmin);
    
    if (!adminDb) {
      console.error('Admin database not initialized');
      return res.status(500).json({ error: 'Admin database not initialized' });
    }
    
    // Get the post data from the request
    const postData = req.body;
    console.log('Received post data:', JSON.stringify(postData, null, 2));
    
    // Validate required fields
    if (!postData.title || !postData.game || !postData.location) {
      console.error('Missing required fields', { 
        hasTitle: !!postData.title, 
        hasGame: !!postData.game, 
        hasLocation: !!postData.location 
      });
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: {
          hasTitle: !!postData.title,
          hasGame: !!postData.game,
          hasLocation: !!postData.location
        }
      });
    }
    
    // Create timestamp
    const timestamp = Date.now();
    
    // Create the new post object
    const newPost = {
      title: postData.title,
      description: postData.description || '',
      game: postData.game,
      cardName: postData.cardName || undefined,
      condition: postData.condition || 'any',
      isPriceNegotiable: postData.isPriceNegotiable !== false, // Default to true
      priceRange: postData.priceRange || undefined,
      location: postData.location,
      detailedDescription: postData.detailedDescription || undefined,
      createdAt: timestamp,
      userId: userId,
      userName: userName,
      userAvatar: userAvatar,
      viewCount: 0
    };
    
    console.log('Post object to save:', JSON.stringify(newPost, null, 2));
    
    // Try to save to the primary path first
    try {
      const postsRef = adminDb.ref('wanted/posts');
      const newPostRef = postsRef.push();
      
      if (!newPostRef || !newPostRef.key) {
        throw new Error('Could not generate post ID');
      }
      
      const newPostId = newPostRef.key;
      console.log('Generated new post ID:', newPostId);
      
      // Save to Firebase using admin SDK
      await newPostRef.set(newPost);
      console.log('Post saved successfully to wanted/posts');
      
      // Also save to legacy path for backward compatibility
      try {
        const legacyRef = adminDb.ref(`wantedPosts/${newPostId}`);
        await legacyRef.set(newPost);
        console.log('Post also saved to legacy wantedPosts path');
      } catch (legacyError) {
        console.warn('Failed to save to legacy path:', legacyError);
        // Don't fail the request if legacy save fails
      }
      
      // Verify the post was saved by reading it back
      const savedPostRef = adminDb.ref(`wanted/posts/${newPostId}`);
      const snapshot = await savedPostRef.get();
      
      if (snapshot.exists()) {
        console.log('Post verification successful - post exists in database');
        const savedData = snapshot.val();
        console.log('Saved post data:', JSON.stringify(savedData, null, 2));
      } else {
        console.error('Post verification failed - post not found in database after save');
        return res.status(500).json({ 
          error: 'Post was not saved properly',
          postId: newPostId
        });
      }
      
      return res.status(200).json({ 
        success: true, 
        postId: newPostId,
        message: 'Wanted post created successfully',
        savedTo: ['wanted/posts', 'wantedPosts'],
        postData: newPost
      });
    } catch (saveError) {
      console.error('Error saving to primary path:', saveError);
      
      // Try saving to legacy path as fallback
      try {
        console.log('Trying legacy path as fallback...');
        const legacyPostsRef = adminDb.ref('wantedPosts');
        const newLegacyPostRef = legacyPostsRef.push();
        
        if (!newLegacyPostRef || !newLegacyPostRef.key) {
          throw new Error('Could not generate post ID for legacy path');
        }
        
        const legacyPostId = newLegacyPostRef.key;
        console.log('Generated legacy post ID:', legacyPostId);
        
        await newLegacyPostRef.set(newPost);
        console.log('Post saved successfully to legacy wantedPosts path');
        
        return res.status(200).json({ 
          success: true, 
          postId: legacyPostId,
          message: 'Wanted post created successfully (legacy path)',
          savedTo: ['wantedPosts'],
          postData: newPost
        });
      } catch (legacyError) {
        console.error('Error saving to legacy path:', legacyError);
        throw legacyError;
      }
    }
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
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? {
        name: error.name,
        message: error.message
      } : null
    });
  }
}