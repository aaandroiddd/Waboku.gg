import { NextApiRequest, NextApiResponse } from 'next'
import { getFirebaseAdmin } from '@/lib/firebase-admin'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('[Block API] Starting block request processing');
    
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[Block API] Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = authHeader.split('Bearer ')[1]
    console.log('[Block API] Token extracted, length:', token?.length);
    
    console.log('[Block API] Getting Firebase Admin instance');
    const { admin, auth, database } = getFirebaseAdmin()
    console.log('[Block API] Firebase Admin instance obtained');
    
    console.log('[Block API] Verifying ID token');
    const decodedToken = await auth.verifyIdToken(token)
    const userId = decodedToken.uid
    console.log('[Block API] Token verified for user:', userId);

    const { blockedUserId } = req.body
    console.log('[Block API] Request body:', { blockedUserId });
    
    if (!blockedUserId) {
      console.log('[Block API] Missing blockedUserId in request body');
      return res.status(400).json({ error: 'Missing blockedUserId' })
    }

    if (userId === blockedUserId) {
      console.log('[Block API] User trying to block themselves');
      return res.status(400).json({ error: 'Cannot block yourself' })
    }

    // Verify that the blocked user exists
    try {
      console.log('[Block API] Verifying blocked user exists:', blockedUserId);
      await auth.getUser(blockedUserId)
      console.log('[Block API] Blocked user verified');
    } catch (error) {
      console.log('[Block API] Blocked user not found:', error);
      return res.status(400).json({ error: 'User not found' })
    }

    const db = database
    console.log('[Block API] Database instance obtained');
    
    // Add to blocked users list with timestamp
    console.log('[Block API] Setting blocked user entry');
    await db.ref(`users/${userId}/blockedUsers/${blockedUserId}`).set(Date.now())
    console.log('[Block API] Blocked user entry set');
    
    // Also add the reverse blocking to prevent the blocked user from messaging back
    console.log('[Block API] Setting blockedBy entry');
    await db.ref(`users/${blockedUserId}/blockedBy/${userId}`).set(Date.now())
    console.log('[Block API] BlockedBy entry set');
    
    // Mark any existing chats as blocked for both users
    console.log('[Block API] Checking for existing chats');
    const chatsRef = db.ref('chats')
    const chatsSnapshot = await chatsRef.get()
    console.log('[Block API] Chats snapshot obtained');

    const updates: { [key: string]: any } = {}
    
    chatsSnapshot.forEach((chat) => {
      const chatData = chat.val()
      const participants = chatData.participants || {}
      if (participants[userId] && participants[blockedUserId]) {
        const chatId = chat.key as string
        updates[`${chatId}/blockedBy/${userId}`] = Date.now()
        updates[`${chatId}/blockedBy/${blockedUserId}`] = Date.now()
        console.log('[Block API] Found chat to update:', chatId);
      }
    })

    if (Object.keys(updates).length > 0) {
      console.log('[Block API] Updating chats with blocking info, updates:', Object.keys(updates).length);
      await chatsRef.update(updates)
      console.log('[Block API] Chat updates completed');
    } else {
      console.log('[Block API] No existing chats found to update');
    }

    console.log(`[Block API] User ${userId} successfully blocked user ${blockedUserId}`)
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Block API] Error blocking user:', error)
    console.error('[Block API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return res.status(500).json({ 
      error: 'Failed to block user',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}