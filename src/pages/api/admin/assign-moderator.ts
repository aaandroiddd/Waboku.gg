import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

// Initialize Firestore
const db = getFirestore(firebaseApp);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin access
  const adminSecret = req.headers['x-admin-secret'] as string;
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get user ID and action from request body
  const { userId, action } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (action !== 'add' && action !== 'remove') {
    return res.status(400).json({ error: 'Invalid action. Must be "add" or "remove"' });
  }

  try {
    // Get reference to the user document
    const userRef = doc(db, 'users', userId);
    
    // Check if user exists
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update the user's roles based on the action
    if (action === 'add') {
      // Add moderator role to the user
      await updateDoc(userRef, {
        roles: arrayUnion('moderator')
      });

      return res.status(200).json({ 
        success: true,
        message: 'Moderator role assigned successfully'
      });
    } else {
      // Remove moderator role from the user
      await updateDoc(userRef, {
        roles: arrayRemove('moderator')
      });

      return res.status(200).json({ 
        success: true,
        message: 'Moderator role removed successfully'
      });
    }
  } catch (error) {
    console.error(`Error ${action === 'add' ? 'assigning' : 'removing'} moderator role:`, error);
    return res.status(500).json({ error: `Failed to ${action === 'add' ? 'assign' : 'remove'} moderator role` });
  }
}