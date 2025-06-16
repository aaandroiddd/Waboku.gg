import { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { getFirebaseAdmin } from '@/lib/firebase-admin'
import { notificationService } from '@/lib/notification-service'

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
      // Log token verification attempt (without exposing the token)
      console.log(`Verifying token for message send request: ${token.substring(0, 10)}...`);
      
      const decodedToken = await admin.auth.verifyIdToken(token)
      const senderId = decodedToken.uid
      
      console.log(`Token verified successfully for user: ${senderId}`);

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

      const chatsRef = admin.database.ref('chats')
      let chatId = null

      // If there's a subject, always create a new chat thread
      // If there's a listingId, try to find existing chat with the EXACT SAME listing ID
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
      
      // We no longer fall back to finding any chat between these users
      // Each listing gets its own thread

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

      const messagesRef = admin.database.ref(`messages/${chatId}`)
      const newMessageRef = await messagesRef.push(messageData)

      // Update chat with last message
      const updates: { [key: string]: any } = {
        [`chats/${chatId}/lastMessage`]: {
          ...messageData,
          id: newMessageRef.key
        },
        [`chats/${chatId}/lastMessageTime`]: messageData.timestamp
      }

      // Get current unread count for recipient before updating
      const unreadCountRef = admin.database.ref(`chats/${chatId}/unreadCount/${recipientId}`)
      const currentUnreadCount = await unreadCountRef.once('value').then(snap => snap.val() || 0)
      const newUnreadCount = currentUnreadCount + 1

      // Update unread counts and message threads in a single atomic operation
      updates[`chats/${chatId}/unreadCount/${recipientId}`] = newUnreadCount

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
        unreadCount: newUnreadCount,
        ...(subject ? { subject } : {}),
        ...(listingId ? { listingId, listingTitle } : {})
      }

      await admin.database.ref().update(updates)

      // Create notification for the recipient
      try {
        console.log('Creating message notification for recipient:', recipientId);
        const senderData = await admin.auth.getUser(senderId);
        const senderName = senderData.displayName || 'Someone';
        
        console.log('Sender data retrieved:', { senderName, senderId });
        
        // Use the notification API endpoint instead of calling the service directly
        const notificationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: recipientId,
            type: 'message',
            title: '💬 New Message',
            message: `${senderName} sent you a message`,
            data: {
              messageThreadId: chatId,
              actionUrl: `/dashboard/messages`
            }
          })
        });
        
        if (notificationResponse.ok) {
          const result = await notificationResponse.json();
          console.log('Message notification created successfully:', result.notificationId);
        } else {
          const errorData = await notificationResponse.json();
          console.error('Failed to create message notification:', errorData);
        }
      } catch (notificationError) {
        console.error('Error creating message notification:', notificationError);
        console.error('Notification error details:', {
          message: notificationError instanceof Error ? notificationError.message : 'Unknown error',
          stack: notificationError instanceof Error ? notificationError.stack : 'No stack trace',
          recipientId,
          chatId
        });
        // Don't fail the message send if notification creation fails
      }

      return res.status(200).json({ success: true, chatId, messageId: newMessageRef.key })
    } catch (error) {
      console.error('Token verification error:', error)
      
      // Provide more detailed error information
      let errorMessage = 'Invalid token';
      let errorDetails = {};
      
      if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = {
          name: error.name,
          // Don't include stack trace in production response
          code: error.code || 'unknown_error_code'
        };
        
        // Log the full error details for debugging
        console.error('Detailed token verification error:', {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: error.stack
        });
      }
      
      return res.status(401).json({ 
        error: errorMessage,
        details: errorDetails
      });
    }
  } catch (error) {
    console.error('Error sending message:', error)
    return res.status(500).json({ 
      error: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}