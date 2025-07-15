import { NextApiRequest, NextApiResponse } from 'next'

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
    
    // Dynamic import to handle module resolution
    const { getFirebaseAdmin } = await import('@/lib/firebase-admin')
    const { admin, auth, database } = getFirebaseAdmin()
    
    const decodedToken = await auth.verifyIdToken(token)
    const userId = decodedToken.uid

    const { unblockedUserId } = req.body
    if (!unblockedUserId) {
      return res.status(400).json({ error: 'Missing unblockedUserId' })
    }

    if (userId === unblockedUserId) {
      return res.status(400).json({ error: 'Cannot unblock yourself' })
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
    
    // Remove the reverse blocking
    await db.ref(`users/${unblockedUserId}/blockedBy/${userId}`).remove()
    
    // Remove blocking from any existing chats
    const chatsRef = db.ref('chats')
    const chatsSnapshot = await chatsRef.get()

    const updates: { [key: string]: any } = {}
    
    chatsSnapshot.forEach((chat) => {
      const chatData = chat.val()
      const participants = chatData.participants || {}
      if (participants[userId] && participants[unblockedUserId]) {
        const chatId = chat.key as string
        updates[`${chatId}/blockedBy/${userId}`] = null
        updates[`${chatId}/blockedBy/${unblockedUserId}`] = null
      }
    })

    if (Object.keys(updates).length > 0) {
      await chatsRef.update(updates)
    }

    console.log(`User ${userId} unblocked user ${unblockedUserId}`)
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error unblocking user:', error)
    return res.status(500).json({ error: 'Failed to unblock user' })
  }
}