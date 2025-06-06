import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminServices } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set a timeout for the entire operation
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), 25000); // 25 second timeout
  });

  try {
    console.log('=== WANTED POST DEBUG CREATE ===');
    
    const operationPromise = async () => {
      // Get Firebase Admin services
      const { database, auth } = await getFirebaseAdminServices();
      
      if (!database) {
        throw new Error('Admin database not initialized');
      }
      
      // Get the auth token from the request
      const authHeader = req.headers.authorization;
      let userId = 'test-user';
      let userName = 'Test User';
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decodedToken = await auth.verifyIdToken(token);
          const user = await auth.getUser(decodedToken.uid);
          
          userId = user.uid;
          userName = user.displayName || 'Test User';
        } catch (authError) {
          console.log('Auth error, using test user:', authError.message);
        }
      }
      
      // Get the post data from the request
      const postData = req.body;
      
      // Validate required fields
      if (!postData.title || !postData.game || !postData.location) {
        throw new Error('Missing required fields: title, game, or location');
      }
      
      // Create the new post object - only include fields that have values
      const newPost: any = {
        title: postData.title,
        description: postData.description || '',
        game: postData.game,
        condition: postData.condition || 'any',
        isPriceNegotiable: postData.isPriceNegotiable !== false,
        location: postData.location,
        createdAt: Date.now(),
        userId: userId,
        userName: userName,
        viewCount: 0
      };
      
      // Only add optional fields if they have values
      if (postData.cardName && postData.cardName.trim()) {
        newPost.cardName = postData.cardName.trim();
      }
      
      if (postData.priceRange && typeof postData.priceRange === 'object') {
        newPost.priceRange = postData.priceRange;
      }
      
      if (postData.detailedDescription && postData.detailedDescription.trim()) {
        newPost.detailedDescription = postData.detailedDescription.trim();
      }
      
      // Save to wantedPosts path (main path based on Firebase screenshot)
      const postsRef = database.ref('wantedPosts');
      const newPostRef = postsRef.push();
      
      if (!newPostRef || !newPostRef.key) {
        throw new Error('Could not generate post ID');
      }
      
      const newPostId = newPostRef.key;
      
      // Save to Firebase using admin SDK
      await newPostRef.set(newPost);
      
      console.log('Post saved successfully to wantedPosts');
      
      return {
        success: true,
        postId: newPostId,
        message: 'Wanted post created successfully',
        savedTo: ['wantedPosts'],
        postData: newPost
      };
    };

    // Race between the operation and timeout
    const result = await Promise.race([operationPromise(), timeoutPromise]);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error creating wanted post:', error);
    
    return res.status(500).json({ 
      error: 'Failed to create wanted post',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    });
  }
}