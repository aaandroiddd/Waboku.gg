import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, set } from 'firebase/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, username } = req.body;

    if (!userId || !username) {
      return res.status(400).json({ error: 'Missing userId or username' });
    }

    // Don't store fallback usernames
    if (username.startsWith('User ') || username === 'Unknown User' || username === 'Deleted User') {
      return res.status(400).json({ error: 'Invalid username for storage' });
    }

    const { database } = getFirebaseServices();
    if (!database) {
      return res.status(500).json({ error: 'Database not available' });
    }

    // Store username in historical reference
    const usernameRef = ref(database, `usernames/${userId}`);
    await set(usernameRef, {
      username,
      lastUpdated: Date.now(),
      storedAt: new Date().toISOString()
    });

    res.status(200).json({ success: true, message: 'Username stored for historical reference' });
  } catch (error) {
    console.error('Error storing username history:', error);
    res.status(500).json({ error: 'Failed to store username history' });
  }
}