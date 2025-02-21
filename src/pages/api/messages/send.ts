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
    const decodedToken = await admin.auth.verifyIdToken(token)
    const senderId = decodedToken.uid

    const { recipientId, subject, message, listingId, listingTitle } = req.body

    if (!recipientId || !message) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Verify recipient exists
    try {
      await admin.auth.getUser(recipientId)
    } catch (error) {
      console.error('Error verifying recipient:', error)
      return res.status(404).json({ error: 'Recipient not found' })
    }

    // Check for existing chat between these users
    const chatsRef = admin.rtdb.ref('chats')
    const chatsSnapshot = await chatsRef.once('value')
    const chats = chatsSnapshot.val() || {}

    let chatId = null
    
    // First try to find a chat with the same listing if listingId is provided
    if (listingId) {
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

    // If no chat found with listing, look for any existing chat between users
    if (!chatId) {
      for (const [id, chat] of Object.entries(chats)) {
        const chatData = chat as any
        if (
          chatData.participants?.[senderId] &&
          chatData.participants?.[recipientId] &&
          !chatData.deletedBy?.[senderId]
        ) {
          chatId = id
          break
        }
      }
    }

    // If no existing chat found, create a new one
    if (!chatId) {
      const newChatRef = await chatsRef.push({
        participants: {
          [senderId]: true,
          [recipientId]: true
        },
        createdAt: Date.now(),
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

    const newMessageRef = await admin.rtdb.ref(`messages/${chatId}`).push(messageData)

    // Update chat with last message
    const updates: { [key: string]: any } = {
      [`chats/${chatId}/lastMessage`]: {
        ...messageData,
        id: newMessageRef.key
      },
      [`chats/${chatId}/lastMessageTime`]: messageData.timestamp
    }

    // Update unread counts
    updates[`chats/${chatId}/unreadCount/${recipientId}`] = admin.rtdb.ref(`chats/${chatId}/unreadCount/${recipientId}`).transaction((current) => {
      return (current || 0) + 1
    })

    // Ensure both users have the chat in their threads
    updates[`users/${senderId}/messageThreads/${recipientId}`] = {
      chatId,
      lastMessageTime: messageData.timestamp,
      unreadCount: 0,
      ...(listingId ? { listingId, listingTitle } : {})
    }

    updates[`users/${recipientId}/messageThreads/${senderId}`] = {
      chatId,
      lastMessageTime: messageData.timestamp,
      unreadCount: admin.rtdb.ref(`chats/${chatId}/unreadCount/${recipientId}`),
      ...(listingId ? { listingId, listingTitle } : {})
    }

    await admin.rtdb.ref().update(updates)

    return res.status(200).json({ success: true, chatId, messageId: newMessageRef.key })
  } catch (error) {
    console.error('Error sending message:', error)
    return res.status(500).json({ error: 'Failed to send message' })
  }
}