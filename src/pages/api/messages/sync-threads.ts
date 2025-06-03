import { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { getFirebaseAdmin } from '@/lib/firebase-admin'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const admin = getFirebaseAdmin();
    const token = authHeader.split('Bearer ')[1]
    
    const decodedToken = await admin.auth.verifyIdToken(token)
    const userId = decodedToken.uid

    // Get all chats where user is a participant
    const chatsRef = admin.database.ref('chats')
    const chatsSnapshot = await chatsRef.once('value')
    const allChats = chatsSnapshot.val() || {}

    // Get user's current message threads
    const userThreadsRef = admin.database.ref(`users/${userId}/messageThreads`)
    const userThreadsSnapshot = await userThreadsRef.once('value')
    const currentThreads = userThreadsSnapshot.val() || {}

    const updates: { [key: string]: any } = {}
    let syncedCount = 0

    // Find chats where user is a participant but doesn't have a message thread
    for (const [chatId, chatData] of Object.entries(allChats)) {
      const chat = chatData as any
      
      // Skip if user is not a participant or chat is deleted by user
      if (!chat.participants?.[userId] || chat.deletedBy?.[userId]) {
        continue
      }

      // Skip if user already has this thread
      if (currentThreads[chatId]) {
        continue
      }

      // Find the other participant
      const otherParticipantId = Object.keys(chat.participants).find(id => id !== userId)
      if (!otherParticipantId) {
        continue
      }

      // Get unread count for this user in this chat
      const unreadCount = chat.unreadCount?.[userId] || 0

      // Create the missing message thread
      updates[`users/${userId}/messageThreads/${chatId}`] = {
        recipientId: otherParticipantId,
        chatId: chatId,
        lastMessageTime: chat.lastMessage?.timestamp || chat.createdAt || Date.now(),
        unreadCount: unreadCount,
        ...(chat.subject ? { subject: chat.subject } : {}),
        ...(chat.listingId ? { listingId: chat.listingId } : {}),
        ...(chat.listingTitle ? { listingTitle: chat.listingTitle } : {})
      }

      syncedCount++
    }

    // Apply all updates atomically
    if (Object.keys(updates).length > 0) {
      await admin.database.ref().update(updates)
    }

    return res.status(200).json({ 
      success: true, 
      syncedThreads: syncedCount,
      message: `Synchronized ${syncedCount} message threads`
    })

  } catch (error) {
    console.error('Error syncing message threads:', error)
    return res.status(500).json({ 
      error: 'Failed to sync message threads',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}