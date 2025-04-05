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

    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const token = authHeader.split('Bearer ')[1]
    
    try {
      const decodedToken = await admin.auth.verifyIdToken(token)
      const senderId = decodedToken.uid

      const { recipientId, subject, message, listingId, listingTitle } = req.body

      if (!recipientId || !message) {
        return res.status(400).json({ error: 'Missing required fields' })
      }
      
      // Prevent users from messaging themselves
      if (senderId === recipientId) {
        return res.status(400).json({ error: 'You cannot send messages to yourself' })
      }

      // Verify recipient exists
      try {
        await admin.auth.getUser(recipientId)
      } catch (error) {
        console.error('Error verifying recipient:', error)
        return res.status(404).json({ error: 'Recipient not found' })
      }

      const chatsRef = admin.rtdb.ref('chats')
      let chatId = null

      // If there's a subject, always create a new chat thread
      // If there's a listingId, try to find existing chat or create new one
      if (!subject && listingId) {
        const chatsSnapshot = await chatsRef.once('value')
        const chats = chatsSnapshot.val() || {}
        
        // Try to find a chat with the same listing
        for (const [id, chat] of Object.entries(chats)) {
          const chatData = chat as any
          if (
            chatData.participants?.[senderId] &&
            chatData.participants?.[recipientId] &&
            chatData.listingId === listingId &&
            !chatData.deletedBy?.[senderId]
          ) {
            chatId = id
            break
          }
        }
      }

      // If no existing chat found or if there's a subject, create a new one
      if (!chatId) {
        // Get recipient's user data
        const recipientData = await admin.auth.getUser(recipientId);
        const recipientName = recipientData.displayName || 'Unknown User';

        const newChatRef = await chatsRef.push({
          participants: {
            [senderId]: true,
            [recipientId]: true
          },
          participantNames: {
            [senderId]: (await admin.auth.getUser(senderId)).displayName || 'Unknown User',
            [recipientId]: recipientName
          },
          createdAt: Date.now(),
          ...(subject ? { subject } : {}),
          ...(listingId ? { listingId, listingTitle } : {})
        })
        chatId = newChatRef.key
      }

      if (!chatId) {
        throw new Error('Failed to create or find chat')
      }

      // Create the message
      const messageData = {
        senderId,
        recipientId,
        content: message,
        timestamp: Date.now(),
        read: false,
        type: message.startsWith('![Image]') ? 'image' : 'text',
        ...(subject ? { subject } : {}),
        ...(listingId ? { listingId } : {})
      }

      const messagesRef = admin.rtdb.ref(`messages/${chatId}`)
      const newMessageRef = await messagesRef.push(messageData)

      // Update chat with last message
      const updates: { [key: string]: any } = {
        [`chats/${chatId}/lastMessage`]: {
          ...messageData,
          id: newMessageRef.key
        },
        [`chats/${chatId}/lastMessageTime`]: messageData.timestamp
      }

      // Update unread counts
      const unreadCountRef = admin.rtdb.ref(`chats/${chatId}/unreadCount/${recipientId}`)
      await unreadCountRef.transaction((current) => (current || 0) + 1)

      // Ensure both users have the chat in their threads
      updates[`users/${senderId}/messageThreads/${chatId}`] = {
        recipientId,
        chatId,
        lastMessageTime: messageData.timestamp,
        unreadCount: 0,
        ...(subject ? { subject } : {}),
        ...(listingId ? { listingId, listingTitle } : {})
      }

      updates[`users/${recipientId}/messageThreads/${chatId}`] = {
        recipientId: senderId,
        chatId,
        lastMessageTime: messageData.timestamp,
        unreadCount: await unreadCountRef.once('value').then(snap => snap.val() || 0),
        ...(subject ? { subject } : {}),
        ...(listingId ? { listingId, listingTitle } : {})
      }

      await admin.rtdb.ref().update(updates)

      return res.status(200).json({ success: true, chatId, messageId: newMessageRef.key })
    } catch (error) {
      console.error('Token verification error:', error)
      return res.status(401).json({ error: 'Invalid token' })
    }
  } catch (error) {
    console.error('Error sending message:', error)
    return res.status(500).json({ 
      error: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}