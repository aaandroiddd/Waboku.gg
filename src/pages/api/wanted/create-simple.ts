import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { ref, push, set } from 'firebase/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Creating wanted post via simple API...');
    
    // Get the database from Firebase services
    const { database } = getFirebaseServices();
    
    if (!database) {
      console.error('Database not initialized');
      return res.status(500).json({ error: 'Database not initialized' });
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
    const postsRef = ref(database, 'wantedPosts');
    
    // Generate a new post ID
    const newPostRef = push(postsRef);
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
    
    // Save to Firebase
    console.log('Saving post to Firebase...');
    await set(newPostRef, newPost);
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