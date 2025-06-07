import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { generateNumericShortId } from '@/lib/wanted-posts-slug';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { database } = getFirebaseAdmin();
    
    if (!database) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Create a test wanted post
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

    // Generate the short ID for this post
    const shortId = generateNumericShortId(postId);

    // Create the mapping
    const mappingRef = database.ref(`wantedPostMappings/${shortId}`);
    await mappingRef.set(postId);

    return res.status(200).json({
      success: true,
      postId,
      shortId,
      testPost,
      url: `/wanted/pokemon/need-absol-cards-${shortId}`
    });

  } catch (error) {
    console.error('Error creating test post:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}