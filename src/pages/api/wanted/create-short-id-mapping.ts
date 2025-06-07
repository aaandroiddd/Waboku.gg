import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminServices } from '@/lib/firebase-admin';
import { generateNumericShortId } from '@/lib/wanted-posts-slug';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { postId } = req.body;

  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: 'Post ID is required' });
  }

  try {
    const { database } = getFirebaseAdminServices();
    
    if (!database) {
      console.error('Firebase Admin database not initialized');
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Generate the short ID for this post
    const shortId = generateNumericShortId(postId);
    
    // Store the mapping
    const mappingRef = database.ref(`wantedPostMappings/${shortId}`);
    await mappingRef.set(postId);
    
    console.log(`Created mapping: ${shortId} -> ${postId}`);
    
    return res.status(200).json({ 
      success: true, 
      shortId,
      fullId: postId
    });

  } catch (error) {
    console.error('Error creating short ID mapping:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

