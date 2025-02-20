import { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { initAdmin } from '@/lib/firebase-admin'

initAdmin()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const senderId = decodedToken.uid

    const { recipientId, subject, message } = req.body

    if (!recipientId || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Verify recipient exists
    try {
      await getAuth().getUser(recipientId)
    } catch (error) {
      console.error('Error verifying recipient:', error)
      return res.status(404).json({ error: 'Recipient not found' })
    }

    const db = getDatabase()
    const messageData = {
      senderId,
      recipientId,
      subject,
      message,
      timestamp: Date.now(),
      read: false
    }

    const newMessageRef = await db.ref('messages').push(messageData)

    // Create conversation references for both users
    const conversationData = {
      lastMessage: message,
      lastMessageTime: messageData.timestamp,
      messageId: newMessageRef.key,
      subject
    }

    await Promise.all([
      db.ref(`users/${senderId}/conversations/${recipientId}`).set(conversationData),
      db.ref(`users/${recipientId}/conversations/${senderId}`).set(conversationData)
    ])

    return res.status(200).json({ success: true, messageId: newMessageRef.key })
  } catch (error) {
    console.error('Error sending message:', error)
    return res.status(500).json({ error: 'Failed to send message' })
  }
}