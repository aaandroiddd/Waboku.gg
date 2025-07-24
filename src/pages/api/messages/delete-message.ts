import { NextApiRequest, NextApiResponse } from 'next';
import { ref, remove, get, query, orderByChild, limitToLast, update } from 'firebase/database';
import { isValidMessageId } from '@/lib/message-id-generator';
import { cleanupSpecificThread } from '@/lib/message-thread-cleanup';

// Dynamic import to avoid module loading issues
async function getFirebaseAdmin() {
  try {
    const { getFirebaseAdmin } = await import('@/lib/firebase-admin');
    return getFirebaseAdmin();
  } catch (error) {
    console.error('Error loading firebase-admin:', error);
    return null;
  }
}

async function getFirebaseServices() {
  try {
    const { getFirebaseServices } = await import('@/lib/firebase');
    return getFirebaseServices();
  } catch (error) {
    console.error('Error loading firebase services:', error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { chatId, messageId } = req.body;

    if (!chatId || !messageId) {
      return res.status(400).json({ error: 'Chat ID and message ID are required' });
    }

    // Validate message ID format (supports both new MSG format and legacy Firebase format)
    if (!isValidMessageId(messageId)) {
      console.warn(`Invalid message ID format: ${messageId}`);
      return res.status(400).json({ error: 'Invalid message ID format' });
    }

    // Log the deletion attempt for debugging
    console.log(`Attempting to delete message ${messageId} from chat ${chatId} (format: ${messageId.startsWith('MSG') ? 'new' : 'legacy'})`);

    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const admin = await getFirebaseAdmin();
    if (!admin) {
      return res.status(500).json({ error: 'Firebase admin not available' });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const userId = decodedToken.uid;
    
    // Get Firebase services
    const firebaseServices = await getFirebaseServices();
    if (!firebaseServices?.database) {
      return res.status(500).json({ error: 'Database connection failed' });
    }

    const { database } = firebaseServices;

    // Verify the message exists and belongs to the authenticated user
    const messageRef = ref(database, `messages/${chatId}/${messageId}`);
    const messageSnapshot = await get(messageRef);
    
    if (!messageSnapshot.exists()) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const messageData = messageSnapshot.val();
    
    // Handle malformed message data (common with blank messages)
    if (!messageData || typeof messageData !== 'object') {
      console.warn(`Malformed message data for ${messageId}:`, messageData);
      // Still allow deletion of malformed messages if they exist
      try {
        await remove(messageRef);
        return res.status(200).json({ success: true, message: 'Malformed message deleted successfully' });
      } catch (deleteError) {
        console.error('Error deleting malformed message:', deleteError);
        return res.status(500).json({ error: 'Failed to delete malformed message' });
      }
    }
    
    // Check if the user is the sender of the message
    // Handle cases where senderId might be missing (blank messages)
    if (!messageData.senderId) {
      console.warn(`Message ${messageId} has no senderId, treating as orphaned message`);
      // For orphaned messages (no senderId), allow the current user to delete them
      // This handles blank messages that might have been created incorrectly
    } else if (messageData.senderId !== userId) {
      // Check if the sender's user account still exists
      try {
        const senderDoc = await admin.firestore().collection('users').doc(messageData.senderId).get();
        if (!senderDoc.exists) {
          console.warn(`Message ${messageId} has senderId ${messageData.senderId} but user account no longer exists, treating as orphaned message`);
          // Allow deletion of messages from non-existent users (orphaned messages)
        } else {
          return res.status(403).json({ error: 'You can only delete your own messages' });
        }
      } catch (error) {
        console.error(`Error checking if sender ${messageData.senderId} exists:`, error);
        // If we can't verify the sender exists, treat as orphaned and allow deletion
        console.warn(`Cannot verify sender ${messageData.senderId} exists, treating message ${messageId} as orphaned`);
      }
    }

    // Delete the message
    await remove(messageRef);

    // Check if there are any remaining messages in the chat
    const remainingMessagesRef = ref(database, `messages/${chatId}`);
    const remainingMessagesSnapshot = await get(remainingMessagesRef);
    const hasRemainingMessages = remainingMessagesSnapshot.exists() && 
      Object.keys(remainingMessagesSnapshot.val() || {}).length > 0;

    // Check if this was the last message in the chat and update accordingly
    try {
      const chatRef = ref(database, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (chatSnapshot.exists()) {
        const chatData = chatSnapshot.val();
        
        // If the deleted message was the last message, find the new last message
        if (chatData.lastMessage && chatData.lastMessage.id === messageId) {
          const messagesQuery = query(
            ref(database, `messages/${chatId}`),
            orderByChild('timestamp'),
            limitToLast(1)
          );
          
          const remainingMessagesSnapshot = await get(messagesQuery);
          
          if (remainingMessagesSnapshot.exists()) {
            // Update with the new last message
            const remainingMessages = remainingMessagesSnapshot.val();
            const newLastMessageId = Object.keys(remainingMessages)[0];
            const newLastMessage = remainingMessages[newLastMessageId];
            
            // Validate the new last message before updating
            if (newLastMessage && typeof newLastMessage === 'object') {
              await update(chatRef, {
                lastMessage: {
                  content: newLastMessage.content || '',
                  senderId: newLastMessage.senderId || '',
                  timestamp: newLastMessage.timestamp || Date.now(),
                  type: newLastMessage.type || 'text',
                  id: newLastMessageId
                },
                lastMessageTime: newLastMessage.timestamp || Date.now()
              });
            } else {
              // If the new last message is also malformed, clear it
              await update(chatRef, {
                lastMessage: null,
                lastMessageTime: null
              });
            }
          } else {
            // No messages left, remove lastMessage and lastMessageTime
            await update(chatRef, {
              lastMessage: null,
              lastMessageTime: null
            });
          }
        }
      }

      // If no messages remain, mark the chat as deleted for both participants
      // This will hide the empty conversation from the dashboard
      if (!hasRemainingMessages) {
        const chatData = chatSnapshot.val();
        if (chatData && chatData.participants) {
          const updates: Record<string, any> = {};
          const deletionTimestamp = Date.now();
          
          // Mark chat as deleted for all participants
          Object.keys(chatData.participants).forEach(participantId => {
            updates[`chats/${chatId}/deletedBy/${participantId}`] = deletionTimestamp;
          });
          
          await update(ref(database), updates);
          
          // Clean up orphaned message threads for all participants
          const participantIds = Object.keys(chatData.participants);
          for (const participantId of participantIds) {
            try {
              await cleanupSpecificThread(participantId, chatId);
              console.log(`[MessageDelete] Cleaned up orphaned thread for participant ${participantId}`);
            } catch (cleanupError) {
              console.error(`[MessageDelete] Error cleaning up thread for participant ${participantId}:`, cleanupError);
              // Don't fail the deletion if cleanup fails
            }
          }
        }
      }
    } catch (error) {
      console.error('Error updating chat after message deletion:', error);
      // Don't fail the request if chat update fails
    }

    return res.status(200).json({ success: true, message: 'Message deleted successfully' });

  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}