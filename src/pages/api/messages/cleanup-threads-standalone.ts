import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[CleanupStandalone] Starting standalone cleanup request...');
    
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('[CleanupStandalone] Token received, length:', token ? token.length : 0);
    
    // Basic token validation
    if (!token || token.length < 100) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

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
      console.error('[CleanupStandalone] Firebase initialization error:', initError.message);
      return res.status(500).json({ 
        error: 'Firebase initialization failed',
        details: initError.message 
      });
    }

    // Verify the token
    let decodedToken: any;
    try {
      decodedToken = await auth.verifyIdToken(token);
      console.log('[CleanupStandalone] Token verified for user:', decodedToken.uid);
    } catch (tokenError: any) {
      console.error('[CleanupStandalone] Token verification failed:', tokenError.message);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const userId = decodedToken.uid;
    
    // Get all message threads for the user from both messageThreads and chats
    const threadsRef = db.ref('messageThreads');
    const chatsRef = db.ref('chats');
    
    // Get threads from messageThreads
    const userThreadsSnapshot = await threadsRef.orderByChild(`participants/${userId}`).equalTo(true).once('value');
    const userThreads = userThreadsSnapshot.val() || {};
    
    // Get chats where user is a participant (either senderId or recipientId)
    const allChatsSnapshot = await chatsRef.once('value');
    const allChats = allChatsSnapshot.val() || {};
    const userChats: Record<string, any> = {};
    
    // Filter chats where user is involved
    for (const [chatId, chatData] of Object.entries(allChats)) {
      const chat = chatData as any;
      if (chat && (chat.senderId === userId || chat.recipientId === userId)) {
        userChats[chatId] = chat;
      }
    }
    
    console.log('[CleanupStandalone] Found', Object.keys(userThreads).length, 'messageThreads and', Object.keys(userChats).length, 'chats for user');
    
    let cleanedCount = 0;
    const errors: string[] = [];
    const threadsToDelete: string[] = [];
    const chatsToDelete: string[] = [];
    
    // Check messageThreads for orphaned status
    for (const [threadId, threadData] of Object.entries(userThreads)) {
      try {
        const thread = threadData as any;
        
        // Check if thread has any messages
        const messagesRef = db.ref(`messages/${threadId}`);
        const messagesSnapshot = await messagesRef.once('value');
        const messages = messagesSnapshot.val();
        
        let hasValidMessages = false;
        
        if (messages && typeof messages === 'object') {
          // Check if there are any valid messages (not just empty objects)
          for (const [messageId, messageData] of Object.entries(messages)) {
            const msg = messageData as any;
            // A valid message should have content or be a proper message object
            if (msg && typeof msg === 'object' && 
                (msg.content || msg.type || msg.senderId || msg.timestamp)) {
              hasValidMessages = true;
              break;
            }
          }
        }
        
        // If no valid messages exist, this is an orphaned thread
        if (!hasValidMessages) {
          console.log('[CleanupStandalone] Found orphaned messageThread:', threadId);
          threadsToDelete.push(threadId);
        }
      } catch (threadError: any) {
        console.error('[CleanupStandalone] Error processing messageThread', threadId, ':', threadError.message);
        errors.push(`MessageThread ${threadId}: ${threadError.message}`);
      }
    }
    
    // Check chats for orphaned status
    for (const [chatId, chatData] of Object.entries(userChats)) {
      try {
        const chat = chatData as any;
        
        // Check if chat has any messages
        const messagesRef = db.ref(`messages/${chatId}`);
        const messagesSnapshot = await messagesRef.once('value');
        const messages = messagesSnapshot.val();
        
        let hasValidMessages = false;
        
        if (messages && typeof messages === 'object') {
          // Check if there are any valid messages (not just empty objects)
          for (const [messageId, messageData] of Object.entries(messages)) {
            const msg = messageData as any;
            // A valid message should have content or be a proper message object
            if (msg && typeof msg === 'object' && 
                (msg.content || msg.type || msg.senderId || msg.timestamp)) {
              hasValidMessages = true;
              break;
            }
          }
        }
        
        // Additional check: if chat has no messages but also no valid metadata, it's orphaned
        if (!hasValidMessages) {
          // Check if it's just an empty chat with minimal metadata
          const hasMinimalData = chat.subject || chat.listingTitle || chat.lastMessage;
          if (!hasMinimalData) {
            console.log('[CleanupStandalone] Found completely empty chat:', chatId);
            chatsToDelete.push(chatId);
          } else {
            // Even if it has metadata, if there are no actual messages, it's still orphaned
            console.log('[CleanupStandalone] Found orphaned chat with metadata:', chatId);
            chatsToDelete.push(chatId);
          }
        }
      } catch (chatError: any) {
        console.error('[CleanupStandalone] Error processing chat', chatId, ':', chatError.message);
        errors.push(`Chat ${chatId}: ${chatError.message}`);
      }
    }
    
    // Delete orphaned messageThreads
    for (const threadId of threadsToDelete) {
      try {
        // Remove from messageThreads
        await threadsRef.child(threadId).remove();
        
        // Remove any empty messages
        const messagesRef = db.ref(`messages/${threadId}`);
        await messagesRef.remove();
        
        // Remove from chats if exists
        const chatRef = db.ref(`chats/${threadId}`);
        await chatRef.remove();
        
        cleanedCount++;
        console.log('[CleanupStandalone] Successfully cleaned messageThread:', threadId);
      } catch (deleteError: any) {
        console.error('[CleanupStandalone] Error deleting messageThread', threadId, ':', deleteError.message);
        errors.push(`Delete messageThread ${threadId}: ${deleteError.message}`);
      }
    }
    
    // Delete orphaned chats
    for (const chatId of chatsToDelete) {
      try {
        // Remove from chats
        await chatsRef.child(chatId).remove();
        
        // Remove any empty messages
        const messagesRef = db.ref(`messages/${chatId}`);
        await messagesRef.remove();
        
        // Remove from messageThreads if exists
        await threadsRef.child(chatId).remove();
        
        cleanedCount++;
        console.log('[CleanupStandalone] Successfully cleaned chat:', chatId);
      } catch (deleteError: any) {
        console.error('[CleanupStandalone] Error deleting chat', chatId, ':', deleteError.message);
        errors.push(`Delete chat ${chatId}: ${deleteError.message}`);
      }
    }
    
    console.log('[CleanupStandalone] Cleanup completed. Cleaned:', cleanedCount, 'Errors:', errors.length);
    
    return res.status(200).json({
      success: true,
      cleaned: cleanedCount,
      errors: errors,
      message: cleanedCount > 0 
        ? `Successfully removed ${cleanedCount} empty conversation${cleanedCount === 1 ? '' : 's'}`
        : 'No orphaned threads found - all conversations are valid',
      debug: {
        totalMessageThreadsFound: Object.keys(userThreads).length,
        totalChatsFound: Object.keys(userChats).length,
        messageThreadsToDelete: threadsToDelete.length,
        chatsToDelete: chatsToDelete.length,
        userId: userId
      }
    });

  } catch (error: any) {
    console.error('[CleanupStandalone] Unexpected error:', error.message);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}