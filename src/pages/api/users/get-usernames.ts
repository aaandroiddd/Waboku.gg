import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }

    // Limit to prevent abuse
    if (userIds.length > 100) {
      return res.status(400).json({ error: 'Too many user IDs requested (max 100)' });
    }

    const { db } = getFirebaseAdmin();
    const usernames: Record<string, string> = {};

    // Batch fetch user documents
    const userPromises = userIds.map(async (userId: string) => {
      if (!userId || typeof userId !== 'string') return null;
      
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          return {
            id: userId,
            name: userData?.displayName || userData?.username || 'Unknown User'
          };
        }
        return { id: userId, name: 'Unknown User' };
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        return { id: userId, name: 'Unknown User' };
      }
    });

    const results = await Promise.all(userPromises);
    
    // Build the response object
    results.forEach(result => {
      if (result) {
        usernames[result.id] = result.name;
      }
    });

    res.status(200).json(usernames);
  } catch (error) {
    console.error('Error fetching usernames:', error);
    res.status(500).json({ error: 'Failed to fetch usernames' });
  }
}