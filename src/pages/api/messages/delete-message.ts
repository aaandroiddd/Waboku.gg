import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase, ref, remove, get, update } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';
import { getAuth } from 'firebase-admin/auth';
import { getApps, initializeApp, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { chatId, messageId } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!chatId || !messageId) {
      return res.status(400).json({ error: 'Chat ID and message ID are required' });
    }

    const { database } = getFirebaseServices();
    if (!database) {
      return res.status(500).json({ error: 'Database connection failed' });
    }

    // Check if user is a participant in the chat
    const chatRef = ref(database, `chats/${chatId}`);
    const chatSnapshot = await get(chatRef);
    const chatData = chatSnapshot.val();

    if (!chatData || !chatData.participants || !chatData.participants[userId]) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if the message exists and belongs to the user
    const messageRef = ref(database, `messages/${chatId}/${messageId}`);
    const messageSnapshot = await get(messageRef);
    const messageData = messageSnapshot.val();

    if (!messageData) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (messageData.senderId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    // Delete the message
    await remove(messageRef);

    // Update the last message in the chat if this was the last message
    if (chatData.lastMessage && chatData.lastMessage.id === messageId) {
      // Find the new last message
      const messagesRef = ref(database, `messages/${chatId}`);
      const messagesSnapshot = await get(messagesRef);
      const messagesData = messagesSnapshot.val();

      if (messagesData) {
        const remainingMessages = Object.entries(messagesData)
          .map(([id, message]: [string, any]) => ({ id, ...message }))
          .sort((a, b) => b.timestamp - a.timestamp);

        if (remainingMessages.length > 0) {
          const newLastMessage = remainingMessages[0];
          await update(chatRef, {
            lastMessage: {
              id: newLastMessage.id,
              senderId: newLastMessage.senderId,
              receiverId: newLastMessage.receiverId,
              content: newLastMessage.content,
              timestamp: newLastMessage.timestamp,
              type: newLastMessage.type || 'text'
            }
          });
        } else {
          // No messages left, remove last message
          await update(chatRef, {
            lastMessage: null
          });
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
}