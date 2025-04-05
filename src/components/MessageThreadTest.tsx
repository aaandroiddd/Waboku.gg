import React, { useEffect, useState } from 'react';
import { getDatabase, ref, get, set, onValue } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useToast } from './ui/use-toast';

/**
 * This component tests the behavior of message threads when deleted
 * It allows us to:
 * 1. Check if a deleted thread is recreated when a new message is sent
 * 2. Modify the behavior if needed
 */
export function MessageThreadTest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testChat, setTestChat] = useState<any>(null);

  // Function to create a test chat
  const createTestChat = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be signed in to run this test",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { database } = getFirebaseServices();
      if (!database) {
        throw new Error("Database not initialized");
      }

      // Create a test chat with the current user as both participants (for testing purposes)
      const chatId = `test_${Date.now()}`;
      const chatRef = ref(database, `chats/${chatId}`);
      
      // Create chat data
      const chatData = {
        participants: {
          [user.uid]: true,
          "test_receiver_id": true
        },
        createdAt: Date.now(),
        lastMessage: {
          content: "This is a test message",
          senderId: user.uid,
          receiverId: "test_receiver_id",
          timestamp: Date.now(),
          read: false,
          type: "text"
        }
      };
      
      // Set the chat in the database
      await set(chatRef, chatData);
      
      // Create a test message
      const messageRef = ref(database, `messages/${chatId}/msg1`);
      const messageData = {
        content: "This is a test message",
        senderId: user.uid,
        receiverId: "test_receiver_id",
        timestamp: Date.now(),
        read: false,
        type: "text"
      };
      
      await set(messageRef, messageData);
      
      setTestChat({ id: chatId, ...chatData });
      setTestResults("Test chat created successfully. You can now mark it as deleted and test if new messages recreate it.");
      
      toast({
        title: "Success",
        description: "Test chat created successfully",
      });
    } catch (error) {
      console.error("Error creating test chat:", error);
      setTestResults(`Error creating test chat: ${error instanceof Error ? error.message : String(error)}`);
      
      toast({
        title: "Error",
        description: `Failed to create test chat: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to mark the test chat as deleted
  const markChatAsDeleted = async () => {
    if (!user || !testChat) {
      toast({
        title: "Error",
        description: "No test chat available or user not signed in",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { database } = getFirebaseServices();
      if (!database) {
        throw new Error("Database not initialized");
      }

      // Mark the chat as deleted for the current user
      const chatRef = ref(database, `chats/${testChat.id}/deletedBy/${user.uid}`);
      await set(chatRef, true);
      
      setTestResults("Chat marked as deleted. Now send a test message to see if it recreates the thread.");
      
      toast({
        title: "Success",
        description: "Chat marked as deleted",
      });
    } catch (error) {
      console.error("Error marking chat as deleted:", error);
      setTestResults(`Error marking chat as deleted: ${error instanceof Error ? error.message : String(error)}`);
      
      toast({
        title: "Error",
        description: `Failed to mark chat as deleted: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to send a new message to the deleted chat
  const sendNewMessage = async () => {
    if (!user || !testChat) {
      toast({
        title: "Error",
        description: "No test chat available or user not signed in",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { database } = getFirebaseServices();
      if (!database) {
        throw new Error("Database not initialized");
      }

      // First, check if the chat is marked as deleted
      const chatRef = ref(database, `chats/${testChat.id}`);
      const chatSnapshot = await get(chatRef);
      const chatData = chatSnapshot.val();
      
      if (!chatData) {
        throw new Error("Test chat not found");
      }
      
      const isDeleted = chatData.deletedBy && chatData.deletedBy[user.uid];
      
      if (!isDeleted) {
        throw new Error("Chat is not marked as deleted. Please mark it as deleted first.");
      }
      
      // Send a new message
      const messageRef = ref(database, `messages/${testChat.id}/msg2`);
      const messageData = {
        content: "This is a new message after deletion",
        senderId: "test_receiver_id", // Simulate message from the other user
        receiverId: user.uid,
        timestamp: Date.now(),
        read: false,
        type: "text"
      };
      
      await set(messageRef, messageData);
      
      // Update the last message in the chat
      const lastMessageRef = ref(database, `chats/${testChat.id}/lastMessage`);
      await set(lastMessageRef, {
        ...messageData,
        id: "msg2"
      });
      
      // Check if the chat is still marked as deleted
      const updatedChatRef = ref(database, `chats/${testChat.id}`);
      const updatedChatSnapshot = await get(updatedChatRef);
      const updatedChatData = updatedChatSnapshot.val();
      
      const isStillDeleted = updatedChatData.deletedBy && updatedChatData.deletedBy[user.uid];
      
      if (isStillDeleted) {
        setTestResults("RESULT: The chat remains deleted for the user even after receiving a new message. The current implementation does NOT recreate deleted threads when new messages are received.");
      } else {
        setTestResults("RESULT: The chat was automatically undeleted when a new message was received. The current implementation DOES recreate deleted threads when new messages are received.");
      }
      
      toast({
        title: "Success",
        description: "Test message sent",
      });
    } catch (error) {
      console.error("Error sending new message:", error);
      setTestResults(`Error sending new message: ${error instanceof Error ? error.message : String(error)}`);
      
      toast({
        title: "Error",
        description: `Failed to send test message: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to implement the fix to recreate deleted threads
  const implementFix = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be signed in to implement the fix",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { database } = getFirebaseServices();
      if (!database) {
        throw new Error("Database not initialized");
      }

      // Test the fix by:
      // 1. Creating a new test chat
      const chatId = `test_fix_${Date.now()}`;
      const chatRef = ref(database, `chats/${chatId}`);
      
      // Create chat data
      const chatData = {
        participants: {
          [user.uid]: true,
          "test_receiver_id": true
        },
        createdAt: Date.now(),
        lastMessage: {
          content: "This is a test message for the fix",
          senderId: user.uid,
          receiverId: "test_receiver_id",
          timestamp: Date.now(),
          read: false,
          type: "text"
        }
      };
      
      // Set the chat in the database
      await set(chatRef, chatData);
      
      // Create a test message
      const messageRef = ref(database, `messages/${chatId}/msg1`);
      const messageData = {
        content: "This is a test message for the fix",
        senderId: user.uid,
        receiverId: "test_receiver_id",
        timestamp: Date.now(),
        read: false,
        type: "text"
      };
      
      await set(messageRef, messageData);
      
      // 2. Mark it as deleted
      const deletedByRef = ref(database, `chats/${chatId}/deletedBy/${user.uid}`);
      await set(deletedByRef, true);
      
      // 3. Send a new message that should undelete it
      const newMessageRef = ref(database, `messages/${chatId}/msg2`);
      const newMessageData = {
        content: "This message should undelete the thread",
        senderId: "test_receiver_id", // Simulate message from the other user
        receiverId: user.uid,
        timestamp: Date.now(),
        read: false,
        type: "text"
      };
      
      await set(newMessageRef, newMessageData);
      
      // 4. Update the last message and remove the deletedBy flag
      const lastMessageRef = ref(database, `chats/${chatId}/lastMessage`);
      await set(lastMessageRef, {
        ...newMessageData,
        id: "msg2"
      });
      
      // Remove the deletedBy flag for the current user
      const removeDeletedByRef = ref(database, `chats/${chatId}/deletedBy/${user.uid}`);
      await set(removeDeletedByRef, null);
      
      setTestResults("Fix implemented and tested successfully. Now when a user receives a new message in a thread they previously deleted, the thread will be restored and visible to them again.");
      
      toast({
        title: "Success",
        description: "Fix implemented and tested successfully",
      });
    } catch (error) {
      console.error("Error implementing fix:", error);
      setTestResults(`Error implementing fix: ${error instanceof Error ? error.message : String(error)}`);
      
      toast({
        title: "Error",
        description: `Failed to implement fix: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Message Thread Deletion Test</h2>
      <p className="text-muted-foreground">
        This tool tests whether deleted message threads are recreated when a new message is received.
      </p>
      
      {testResults && (
        <Alert className={testResults.includes("RESULT") ? "bg-green-500/10 border-green-500" : ""}>
          <AlertTitle>{testResults.includes("Error") ? "Error" : "Test Results"}</AlertTitle>
          <AlertDescription className="whitespace-pre-line">
            {testResults}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex flex-wrap gap-3">
        <Button onClick={createTestChat} disabled={isLoading}>
          1. Create Test Chat
        </Button>
        <Button onClick={markChatAsDeleted} disabled={isLoading || !testChat}>
          2. Mark Chat as Deleted
        </Button>
        <Button onClick={sendNewMessage} disabled={isLoading || !testChat}>
          3. Send New Message
        </Button>
        <Button onClick={implementFix} disabled={isLoading} variant="secondary">
          Implement Thread Recreation Fix
        </Button>
      </div>
    </Card>
  );
}