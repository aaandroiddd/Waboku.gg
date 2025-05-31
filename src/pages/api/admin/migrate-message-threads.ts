import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminServices } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { database } = getFirebaseAdminServices();
    
    console.log('Starting message threads migration...');
    
    // Get all chats
    const chatsSnapshot = await database.ref('chats').once('value');
    const chats = chatsSnapshot.val() || {};
    
    console.log(`Found ${Object.keys(chats).length} chats`);
    
    const updates: Record<string, any> = {};
    let threadsCreated = 0;
    
    // Process each chat
    for (const [chatId, chatData] of Object.entries(chats)) {
      const chat = chatData as any;
      
      if (!chat.participants) {
        console.log(`Skipping chat ${chatId} - no participants`);
        continue;
      }
      
      const participantIds = Object.keys(chat.participants);
      
      // Create message threads for each participant
      for (const participantId of participantIds) {
        // Skip if user has deleted this chat
        if (chat.deletedBy?.[participantId]) {
          continue;
        }
        
        // Find the other participant
        const otherParticipantId = participantIds.find(id => id !== participantId);
        if (!otherParticipantId) {
          continue;
        }
        
        // Check if message thread already exists
        const existingThreadSnapshot = await database.ref(`users/${participantId}/messageThreads/${chatId}`).once('value');
        if (existingThreadSnapshot.exists()) {
          console.log(`Thread already exists for user ${participantId} in chat ${chatId}`);
          continue;
        }
        
        // Create message thread
        const threadData = {
          recipientId: otherParticipantId,
          chatId: chatId,
          lastMessageTime: chat.lastMessage?.timestamp || chat.createdAt || Date.now(),
          unreadCount: 0, // Start with 0, will be updated when new messages arrive
          ...(chat.listingId ? { listingId: chat.listingId } : {}),
          ...(chat.listingTitle ? { listingTitle: chat.listingTitle } : {}),
          ...(chat.subject ? { subject: chat.subject } : {})
        };
        
        updates[`users/${participantId}/messageThreads/${chatId}`] = threadData;
        threadsCreated++;
        
        console.log(`Created thread for user ${participantId} in chat ${chatId}`);
      }
    }
    
    // Apply all updates
    if (Object.keys(updates).length > 0) {
      await database.ref().update(updates);
      console.log(`Migration completed: ${threadsCreated} message threads created`);
    } else {
      console.log('No message threads needed to be created');
    }
    
    res.status(200).json({
      success: true,
      message: `Migration completed: ${threadsCreated} message threads created`,
      threadsCreated
    });
    
  } catch (error) {
    console.error('Error migrating message threads:', error);
    res.status(500).json({
      error: 'Failed to migrate message threads',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}