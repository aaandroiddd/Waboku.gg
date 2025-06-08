import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { database } = getFirebaseAdmin();
    
    if (!database) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Create a test wanted post with specific data that matches the failing URL
    const testPost = {
      title: "Need Absol Cards",
      description: "Looking for Absol cards in good condition",
      game: "pokemon",
      condition: "near_mint",
      isPriceNegotiable: true,
      location: "California, USA",
      createdAt: Date.now(),
      userId: "test-user-123",
      userName: "Test User",
      userAvatar: null,
      detailedDescription: "Looking for various Absol cards from different sets. Willing to pay fair market price."
    };

    // Generate a new post ID
    const postRef = database.ref('wantedPosts').push();
    const postId = postRef.key;

    if (!postId) {
      return res.status(500).json({ error: 'Failed to generate post ID' });
    }

    // Save the post
    await postRef.set(testPost);

    // Create the mapping with the specific short ID from the failing URL
    const targetShortId = '599756';
    const mappingRef = database.ref(`wantedPostMappings/${targetShortId}`);
    await mappingRef.set(postId);

    // Verify the mapping was created
    const verifySnapshot = await mappingRef.once('value');
    const mappingExists = verifySnapshot.exists();
    const mappingValue = verifySnapshot.val();

    // Also verify the post exists
    const postSnapshot = await postRef.once('value');
    const postExists = postSnapshot.exists();
    const postData = postSnapshot.val();

    return res.status(200).json({
      success: true,
      postId,
      shortId: targetShortId,
      testPost,
      url: `/wanted/pokemon/need-absol-cards-${targetShortId}`,
      verification: {
        mappingExists,
        mappingValue,
        postExists,
        postData
      }
    });

  } catch (error) {
    console.error('Error creating test post for 599756:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}