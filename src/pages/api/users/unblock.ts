import { NextApiRequest, NextApiResponse } from 'next'

// Dynamic imports to handle module resolution issues
let firebaseAdminInstance: any = null;

async function getFirebaseAdminInstance() {
  if (firebaseAdminInstance) {
    return firebaseAdminInstance;
  }
  
  try {
    const { getFirebaseAdmin } = await import('@/lib/firebase-admin');
    firebaseAdminInstance = getFirebaseAdmin();
    return firebaseAdminInstance;
  } catch (error) {
    console.error('Failed to import Firebase admin:', error);
    throw new Error('Firebase admin not available');
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = authHeader.split('Bearer ')[1]
    
    // Get Firebase admin instance dynamically
    const { admin, auth, database } = await getFirebaseAdminInstance()
    
    const decodedToken = await auth.verifyIdToken(token)
    const userId = decodedToken.uid

    const { unblockedUserId } = req.body
    if (!unblockedUserId) {
      return res.status(400).json({ error: 'Missing unblockedUserId' })
    }

    // Verify that the unblocked user exists
    try {
      await auth.getUser(unblockedUserId)
    } catch (error) {
      return res.status(404).json({ error: 'User not found' })
    }

    const db = database
    
    // Remove from blocked users list
    await db.ref(`users/${userId}/blockedUsers/${unblockedUserId}`).remove()

    console.log(`User ${userId} unblocked user ${unblockedUserId}`)
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error unblocking user:', error)
    return res.status(500).json({ error: 'Failed to unblock user' })
  }
}