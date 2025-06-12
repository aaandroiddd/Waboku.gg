import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { moderatorAuthMiddleware } from '@/middleware/moderatorAuth';

// Initialize Firebase Admin
const { db, auth, database } = getFirebaseAdmin();

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { listingId, action, reason, moderatorId } = req.body;

  if (!listingId) {
    return res.status(400).json({ error: 'Listing ID is required' });
  }

  if (!['archive', 'restore', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be "archive", "restore", or "delete"' });
  }

  if (!reason) {
    return res.status(400).json({ error: 'Reason is required' });
  }

  try {
    console.log(`Performing ${action} on listing ${listingId} with reason: ${reason}`);

    // Get reference to the listing document
    const listingRef = db.collection('listings').doc(listingId);
    
    // Check if listing exists
    const listingSnap = await listingRef.get();
    if (!listingSnap.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get listing data
    const listingData = listingSnap.data();
    const listingOwnerId = listingData?.userId;
    const listingTitle = listingData?.title || 'Unknown Listing';

    if (!listingOwnerId) {
      return res.status(400).json({ error: 'Listing owner not found' });
    }

    // Prepare moderation details
    const moderationDetails = {
      moderatorId: moderatorId || 'system',
      actionTaken: action,
      timestamp: new Date(),
      reason: reason,
      originalStatus: listingData?.status || 'active'
    };

    // Update the listing based on the action
    let newStatus = listingData?.status;
    let updateData: any = {
      moderatedAt: new Date(),
      moderationDetails
    };

    switch (action) {
      case 'archive':
        newStatus = 'archived';
        updateData.status = 'archived';
        updateData.archivedAt = new Date();
        break;
      case 'restore':
        newStatus = 'active';
        updateData.status = 'active';
        // Remove archived timestamp if it exists
        updateData.archivedAt = null;
        break;
      case 'delete':
        newStatus = 'deleted';
        updateData.status = 'deleted';
        updateData.deletedAt = new Date();
        break;
    }

    // Update the listing
    await listingRef.update(updateData);

    // Send system message to the listing owner
    await sendSystemMessage(listingOwnerId, action, listingTitle, reason, moderatorId);

    console.log(`Listing ${listingId} ${action}d successfully by ${moderatorId || 'system'}`);

    return res.status(200).json({ 
      success: true,
      message: `Listing ${action}d successfully and user notified`,
      newStatus
    });

  } catch (error) {
    console.error(`Error ${action}ing listing:`, error);
    return res.status(500).json({ error: `Failed to ${action} listing` });
  }
};

// Function to send system message to user
async function sendSystemMessage(
  userId: string, 
  action: string, 
  listingTitle: string, 
  reason: string,
  moderatorId?: string
) {
  try {
    // Get user data to get their display name
    let userName = 'User';
    try {
      const userRecord = await auth.getUser(userId);
      userName = userRecord.displayName || 'User';
    } catch (error) {
      console.log('Could not get user display name, using default');
    }

    // Create system user ID (consistent system identifier)
    const systemUserId = 'system_moderation';

    // Prepare message content based on action
    let messageContent = '';
    let subject = '';

    switch (action) {
      case 'archive':
        subject = `Your listing "${listingTitle}" has been archived`;
        messageContent = `Hello ${userName},

Your listing "${listingTitle}" has been temporarily archived by our moderation team.

**Reason:** ${reason}

**What this means:**
- Your listing is no longer visible to other users
- The listing data is preserved in our system
- You can contact support if you believe this was done in error

**Next steps:**
If you believe this action was taken in error, please contact our support team with your listing details.

Thank you for your understanding.

Best regards,
The Moderation Team`;
        break;

      case 'restore':
        subject = `Your listing "${listingTitle}" has been restored`;
        messageContent = `Hello ${userName},

Your listing "${listingTitle}" has been restored and is now visible to other users.

**Reason for restoration:** ${reason}

**What this means:**
- Your listing is now active and visible to all users
- Users can view, favorite, and make offers on your listing
- All listing functionality has been restored

Thank you for your patience.

Best regards,
The Moderation Team`;
        break;

      case 'delete':
        subject = `Your listing "${listingTitle}" has been removed`;
        messageContent = `Hello ${userName},

Your listing "${listingTitle}" has been permanently removed from our platform.

**Reason:** ${reason}

**What this means:**
- Your listing has been permanently deleted
- The listing is no longer accessible to anyone
- This action cannot be undone

**Important:**
If you believe this action was taken in error, please contact our support team immediately with your listing details.

Best regards,
The Moderation Team`;
        break;
    }

    // Create a chat for system messages if it doesn't exist
    const chatsRef = database.ref('chats');
    let systemChatId = null;

    // Try to find existing system chat with this user
    const chatsSnapshot = await chatsRef.once('value');
    const chats = chatsSnapshot.val() || {};

    for (const [chatId, chat] of Object.entries(chats)) {
      const chatData = chat as any;
      if (
        chatData.participants?.[systemUserId] &&
        chatData.participants?.[userId] &&
        chatData.isSystemChat === true
      ) {
        systemChatId = chatId;
        break;
      }
    }

    // Create new system chat if none exists
    if (!systemChatId) {
      const newChatRef = await chatsRef.push({
        participants: {
          [systemUserId]: true,
          [userId]: true
        },
        participantNames: {
          [systemUserId]: 'Moderation Team',
          [userId]: userName
        },
        createdAt: Date.now(),
        isSystemChat: true,
        systemChatType: 'moderation'
      });
      systemChatId = newChatRef.key;
    }

    if (!systemChatId) {
      throw new Error('Failed to create system chat');
    }

    // Create the system message
    const messageData = {
      senderId: systemUserId,
      recipientId: userId,
      content: messageContent,
      timestamp: Date.now(),
      read: false,
      type: 'system',
      subject: subject,
      isSystemMessage: true,
      moderationAction: action,
      listingTitle: listingTitle,
      canReply: false // User cannot reply to system messages
    };

    const messagesRef = database.ref(`messages/${systemChatId}`);
    const newMessageRef = await messagesRef.push(messageData);

    // Update chat with last message
    const updates: { [key: string]: any } = {
      [`chats/${systemChatId}/lastMessage`]: {
        ...messageData,
        id: newMessageRef.key
      },
      [`chats/${systemChatId}/lastMessageTime`]: messageData.timestamp,
      [`chats/${systemChatId}/isSystemChat`]: true
    };

    // Update unread count for the user
    const unreadCountRef = database.ref(`chats/${systemChatId}/unreadCount/${userId}`);
    const currentUnreadCount = await unreadCountRef.once('value').then(snap => snap.val() || 0);
    const newUnreadCount = currentUnreadCount + 1;

    updates[`chats/${systemChatId}/unreadCount/${userId}`] = newUnreadCount;

    // Ensure user has the chat in their threads
    updates[`users/${userId}/messageThreads/${systemChatId}`] = {
      recipientId: systemUserId,
      chatId: systemChatId,
      lastMessageTime: messageData.timestamp,
      unreadCount: newUnreadCount,
      subject: subject,
      isSystemChat: true,
      canReply: false
    };

    await database.ref().update(updates);

    console.log(`System message sent to user ${userId} for ${action} action on listing "${listingTitle}"`);

  } catch (error) {
    console.error('Error sending system message:', error);
    // Don't throw error here as the main action was successful
    // Just log the error and continue
  }
}

// Apply the middleware and export
export default async function (req: NextApiRequest, res: NextApiResponse) {
  return moderatorAuthMiddleware(req, res, () => handler(req, res));
}