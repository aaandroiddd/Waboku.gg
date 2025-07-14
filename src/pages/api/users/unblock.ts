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

    const { unblockedUserId } = req.body
    if (!unblockedUserId) {
      return res.status(400).json({ error: 'Missing unblockedUserId' })
    }

    // Verify that the unblocked user exists
    try {
      await getAuth().getUser(unblockedUserId)
    } catch (error) {
      return res.status(404).json({ error: 'User not found' })
    }

    const db = getDatabase()
    
    // Remove from blocked users list
    await db.ref(`users/${userId}/blockedUsers/${unblockedUserId}`).remove()

    console.log(`User ${userId} unblocked user ${unblockedUserId}`)
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error unblocking user:', error)
    return res.status(500).json({ error: 'Failed to unblock user' })
  }
}