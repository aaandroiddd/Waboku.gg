import { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { initAdmin } from '@/lib/firebase-admin'

initAdmin()

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
    const decodedToken = await getAuth().verifyIdToken(token)
    const userId = decodedToken.uid

    const { blockedUserId } = req.body
    if (!blockedUserId) {
      return res.status(400).json({ error: 'Missing blockedUserId' })
    }

    // Verify that the blocked user exists
    await getAuth().getUser(blockedUserId)

    const db = getDatabase()
    
    // Add to blocked users list
    await db.ref(`users/${userId}/blockedUsers/${blockedUserId}`).set(true)
    
    // Remove any existing chat between these users
    const chatsRef = db.ref('chats')
    const chatsSnapshot = await chatsRef
      .orderByChild('participants')
      .get()

    const updates: { [key: string]: null } = {}
    
    chatsSnapshot.forEach((chat) => {
      const participants = chat.val().participants || {}
      if (participants[userId] && participants[blockedUserId]) {
        updates[chat.key as string] = null
      }
    })

    if (Object.keys(updates).length > 0) {
      await chatsRef.update(updates)
    }

    console.log(`User ${userId} blocked user ${blockedUserId}`)
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error blocking user:', error)
    return res.status(500).json({ error: 'Failed to block user' })
  }
}