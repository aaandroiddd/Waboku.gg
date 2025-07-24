/**
 * Message Thread Cleanup Utilities
 * Handles cleanup of orphaned message threads that point to non-existent messages
 */

import { getDatabase, ref, get, remove, update } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';

/**
 * Clean up orphaned message threads for a specific user
 * This removes threads that point to chats with no valid messages
 */
export async function cleanupOrphanedThreads(userId: string): Promise<{
  cleaned: number;
  errors: string[];
}> {
  const results = {
    cleaned: 0,
    errors: [] as string[]
  };

  try {
    const { database } = getFirebaseServices();
    if (!database) {
      results.errors.push('Database connection not available');
      return results;
    }

    // Get all message threads for the user
    const threadsRef = ref(database, `users/${userId}/messageThreads`);
    const threadsSnapshot = await get(threadsRef);

    if (!threadsSnapshot.exists()) {
      return results; // No threads to clean
    }

    const threads = threadsSnapshot.val();
    const threadsToRemove: string[] = [];

    // Check each thread
    for (const [chatId, threadData] of Object.entries(threads)) {
      try {
        // Check if the chat exists and has valid messages
        const messagesRef = ref(database, `messages/${chatId}`);
        const messagesSnapshot = await get(messagesRef);

        let hasValidMessages = false;
        if (messagesSnapshot.exists()) {
          const messagesData = messagesSnapshot.val();
          if (messagesData && typeof messagesData === 'object') {
            // Check if there are any valid message objects
            const messageEntries = Object.entries(messagesData);
            hasValidMessages = messageEntries.some(([messageId, messageData]) => {
              return messageData && 
                     typeof messageData === 'object' && 
                     (messageData as any).content !== undefined &&
                     (messageData as any).senderId !== undefined &&
                     (messageData as any).timestamp !== undefined;
            });
          }
        }

        // Also check if the chat itself is deleted for this user
        const chatRef = ref(database, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);
        const chatData = chatSnapshot.val();
        const isChatDeleted = chatData?.deletedBy?.[userId];

        // Mark for removal if no valid messages or chat is deleted
        if (!hasValidMessages || isChatDeleted) {
          threadsToRemove.push(chatId);
          console.log(`[ThreadCleanup] Marking thread ${chatId} for removal - hasValidMessages: ${hasValidMessages}, isChatDeleted: ${isChatDeleted}`);
        }
      } catch (error) {
        console.error(`[ThreadCleanup] Error checking thread ${chatId}:`, error);
        results.errors.push(`Error checking thread ${chatId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Remove orphaned threads
    if (threadsToRemove.length > 0) {
      const updates: Record<string, null> = {};
      threadsToRemove.forEach(chatId => {
        updates[`users/${userId}/messageThreads/${chatId}`] = null;
      });

      await update(ref(database), updates);
      results.cleaned = threadsToRemove.length;
      console.log(`[ThreadCleanup] Cleaned up ${results.cleaned} orphaned threads for user ${userId}`);
    }

    return results;
  } catch (error) {
    console.error('[ThreadCleanup] Error during cleanup:', error);
    results.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return results;
  }
}

/**
 * Clean up a specific message thread if it's orphaned
 */
export async function cleanupSpecificThread(userId: string, chatId: string): Promise<boolean> {
  try {
    const { database } = getFirebaseServices();
    if (!database) {
      return false;
    }

    // Check if the thread has valid messages
    const messagesRef = ref(database, `messages/${chatId}`);
    const messagesSnapshot = await get(messagesRef);

    let hasValidMessages = false;
    if (messagesSnapshot.exists()) {
      const messagesData = messagesSnapshot.val();
      if (messagesData && typeof messagesData === 'object') {
        const messageEntries = Object.entries(messagesData);
        hasValidMessages = messageEntries.some(([messageId, messageData]) => {
          return messageData && 
                 typeof messageData === 'object' && 
                 (messageData as any).content !== undefined &&
                 (messageData as any).senderId !== undefined &&
                 (messageData as any).timestamp !== undefined;
        });
      }
    }

    // If no valid messages, remove the thread
    if (!hasValidMessages) {
      const threadRef = ref(database, `users/${userId}/messageThreads/${chatId}`);
      await remove(threadRef);
      console.log(`[ThreadCleanup] Removed orphaned thread ${chatId} for user ${userId}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[ThreadCleanup] Error cleaning specific thread ${chatId}:`, error);
    return false;
  }
}

/**
 * Validate if a message thread should exist based on its chat content
 */
export async function validateMessageThread(chatId: string): Promise<{
  isValid: boolean;
  reason?: string;
  messageCount: number;
}> {
  try {
    const { database } = getFirebaseServices();
    if (!database) {
      return { isValid: false, reason: 'Database not available', messageCount: 0 };
    }

    const messagesRef = ref(database, `messages/${chatId}`);
    const messagesSnapshot = await get(messagesRef);

    if (!messagesSnapshot.exists()) {
      return { isValid: false, reason: 'No messages node exists', messageCount: 0 };
    }

    const messagesData = messagesSnapshot.val();
    if (!messagesData || typeof messagesData !== 'object') {
      return { isValid: false, reason: 'Messages data is invalid', messageCount: 0 };
    }

    const messageEntries = Object.entries(messagesData);
    const validMessages = messageEntries.filter(([messageId, messageData]) => {
      return messageData && 
             typeof messageData === 'object' && 
             (messageData as any).content !== undefined &&
             (messageData as any).senderId !== undefined &&
             (messageData as any).timestamp !== undefined;
    });

    if (validMessages.length === 0) {
      return { 
        isValid: false, 
        reason: 'No valid messages found', 
        messageCount: messageEntries.length 
      };
    }

    return { 
      isValid: true, 
      messageCount: validMessages.length 
    };
  } catch (error) {
    console.error(`[ThreadCleanup] Error validating thread ${chatId}:`, error);
    return { 
      isValid: false, 
      reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      messageCount: 0 
    };
  }
}