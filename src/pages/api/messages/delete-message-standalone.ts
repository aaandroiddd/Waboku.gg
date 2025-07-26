import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { chatId, messageId } = req.body;

    if (!chatId || !messageId) {
      return res.status(400).json({ error: 'Chat ID and message ID are required' });
    }

    console.log(`[DeleteStandalone] Attempting to delete message ${messageId} from chat ${chatId}`);

    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Initialize Firebase Admin with minimal dependencies
    let admin: any;
    let db: any;
    let auth: any;
    
    try {
      // Use require instead of import to avoid module loading issues
      admin = require('firebase-admin');
      
      // Initialize Firebase Admin if not already initialized
      if (!admin.apps.length) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        
        if (!privateKey || !process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
          throw new Error('Missing required Firebase environment variables');
        }

        const serviceAccount = {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key: privateKey,
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
        };

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
        });
      }

      db = admin.database();
      auth = admin.auth();
      
    } catch (initError: any) {
      console.error('[DeleteStandalone] Firebase initialization error:', initError.message);
      return res.status(500).json({ 
        error: 'Firebase initialization failed',
        details: initError.message 
      });
    }

    // Verify the token
    let decodedToken: any;
    try {
      decodedToken = await auth.verifyIdToken(token);
      console.log('[DeleteStandalone] Token verified for user:', decodedToken.uid);
    } catch (tokenError: any) {
      console.error('[DeleteStandalone] Token verification failed:', tokenError.message);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const userId = decodedToken.uid;

    // Verify the message exists
    const messageRef = db.ref(`messages/${chatId}/${messageId}`);
    const messageSnapshot = await messageRef.once('value');
    
    if (!messageSnapshot.exists()) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const messageData = messageSnapshot.val();
    
    // Handle malformed message data (common with blank messages)
    if (!messageData || typeof messageData !== 'object') {
      console.warn(`[DeleteStandalone] Malformed message data for ${messageId}:`, messageData);
      // Still allow deletion of malformed messages if they exist
      try {
        await messageRef.remove();
        console.log(`[DeleteStandalone] Successfully deleted malformed message ${messageId}`);
        return res.status(200).json({ success: true, message: 'Malformed message deleted successfully' });
      } catch (deleteError) {
        console.error('[DeleteStandalone] Error deleting malformed message:', deleteError);
        return res.status(500).json({ error: 'Failed to delete malformed message' });
      }
    }
    
    // Check if the user is the sender of the message or if it's an orphaned message
    if (!messageData.senderId) {
      console.warn(`[DeleteStandalone] Message ${messageId} has no senderId, treating as orphaned message`);
      // For orphaned messages (no senderId), allow the current user to delete them
    } else if (messageData.senderId !== userId) {
      // Check if the sender's user account still exists
      try {
        const senderDoc = await admin.firestore().collection('users').doc(messageData.senderId).get();
        if (!senderDoc.exists) {
          console.warn(`[DeleteStandalone] Message ${messageId} has senderId ${messageData.senderId} but user account no longer exists, treating as orphaned message`);
          // Allow deletion of messages from non-existent users (orphaned messages)
        } else {
          return res.status(403).json({ error: 'You can only delete your own messages' });
        }
      } catch (error) {
        console.error(`[DeleteStandalone] Error checking if sender ${messageData.senderId} exists:`, error);
        // If we can't verify the sender exists, treat as orphaned and allow deletion
        console.warn(`[DeleteStandalone] Cannot verify sender ${messageData.senderId} exists, treating message ${messageId} as orphaned`);
      }
    }

    // Delete the message
    await messageRef.remove();
    console.log(`[DeleteStandalone] Successfully deleted message ${messageId}`);

    // Check if there are any remaining messages in the chat
    const remainingMessagesRef = db.ref(`messages/${chatId}`);
    const remainingMessagesSnapshot = await remainingMessagesRef.once('value');
    const remainingMessages = remainingMessagesSnapshot.val() || {};
    const hasRemainingMessages = Object.keys(remainingMessages).length > 0;

    // Update chat metadata
    try {
      const chatRef = db.ref(`chats/${chatId}`);
      const chatSnapshot = await chatRef.once('value');
      
      if (chatSnapshot.exists()) {
        const chatData = chatSnapshot.val();
        
        // If the deleted message was the last message, find the new last message
        if (chatData.lastMessage && chatData.lastMessage.id === messageId) {
          if (hasRemainingMessages) {
            // Find the most recent remaining message
            let newLastMessage = null;
            let newLastMessageId = null;
            let latestTimestamp = 0;
            
            for (const [msgId, msgData] of Object.entries(remainingMessages)) {
              const msg = msgData as any;
              if (msg && msg.timestamp && msg.timestamp > latestTimestamp) {
                latestTimestamp = msg.timestamp;
                newLastMessage = msg;
                newLastMessageId = msgId;
              }
            }
            
            if (newLastMessage && newLastMessageId) {
              await chatRef.update({
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
              // No valid messages left, clear last message
              await chatRef.update({
                lastMessage: null,
                lastMessageTime: null
              });
            }
          } else {
            // No messages left, clear last message
            await chatRef.update({
              lastMessage: null,
              lastMessageTime: null
            });
          }
        }

        // If no messages remain, mark the chat as deleted for all participants
        if (!hasRemainingMessages) {
          const deletionTimestamp = Date.now();
          const updates: Record<string, any> = {};
          
          if (chatData.participants) {
            Object.keys(chatData.participants).forEach(participantId => {
              updates[`chats/${chatId}/deletedBy/${participantId}`] = deletionTimestamp;
            });
            
            await db.ref().update(updates);
            console.log(`[DeleteStandalone] Marked empty chat ${chatId} as deleted for all participants`);
          }

          // Also clean up the message thread
          const threadsRef = db.ref('messageThreads');
          await threadsRef.child(chatId).remove();
          console.log(`[DeleteStandalone] Removed empty message thread ${chatId}`);
        }
      }
    } catch (error) {
      console.error('[DeleteStandalone] Error updating chat after message deletion:', error);
      // Don't fail the request if chat update fails
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Message deleted successfully',
      chatDeleted: !hasRemainingMessages
    });

  } catch (error: any) {
    console.error('[DeleteStandalone] Error deleting message:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}