import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';

initAdmin();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username } = req.query;
    
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username parameter is required' });
    }

    const db = getFirestore();
    
    // First check the usernames collection
    const usernameDoc = await db.collection('usernames').doc(username).get();
    
    if (usernameDoc.exists) {
      const userData = usernameDoc.data();
      const userId = userData?.uid;
      
      if (userId) {
        // Return the user ID
        return res.status(200).json({ 
          success: true, 
          userId,
          username
        });
      }
    }
    
    // If not found in usernames collection, try to find in users collection by username field
    const usersSnapshot = await db
      .collection('users')
      .where('username', '==', username)
      .limit(1)
      .get();
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      return res.status(200).json({ 
        success: true, 
        userId: userDoc.id,
        username
      });
    }
    
    // User not found
    return res.status(404).json({ error: 'User not found' });
  } catch (error) {
    console.error('Error getting user by username:', error);
    return res.status(500).json({ error: 'Failed to get user' });
  }
}