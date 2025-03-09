import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { ref, push, set } from 'firebase/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('Testing database write...');
    const { database } = getFirebaseServices();
    
    if (!database) {
      console.error('Database not initialized');
      return res.status(500).json({ error: 'Database not initialized' });
    }
    
    // Try to write to a test location
    const testRef = ref(database, 'test');
    const newTestRef = push(testRef);
    
    await set(newTestRef, {
      message: 'Test write',
      timestamp: Date.now()
    });
    
    console.log('Test write successful');
    
    // Try to write to wantedPosts
    const wantedPostsRef = ref(database, 'wantedPosts');
    const newPostRef = push(wantedPostsRef);
    
    await set(newPostRef, {
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
    
    console.log('Wanted post test write successful');
    
    return res.status(200).json({ 
      success: true, 
      message: 'Database write test successful',
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