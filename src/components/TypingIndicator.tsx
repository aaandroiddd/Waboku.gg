import { useEffect, useState, useRef } from 'react';
import { getDatabase, ref, onValue, set, onDisconnect } from 'firebase/database';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { databaseOptimizer } from '@/lib/database-usage-optimizer';

interface TypingIndicatorProps {
  chatId: string;
  receiverId: string;
  className?: string;
}

export function TypingIndicator({ chatId, receiverId, className = '' }: TypingIndicatorProps) {
  const [isTyping, setIsTyping] = useState(false);
  const { user } = useAuth();
  const [database, setDatabase] = useState<any>(null);
  const listenerRef = useRef<string>('');
  
  // Initialize database connection
  useEffect(() => {
    const { database: db } = getFirebaseServices();
    if (db) {
      setDatabase(db);
    } else {
      try {
        setDatabase(getDatabase());
      } catch (error) {
        console.error('[TypingIndicator] Error initializing database:', error);
      }
    }
  }, []);

  // Listen for typing status changes from the other user using optimized listener
  useEffect(() => {
    if (!chatId || !user || !database || !receiverId) {
      // Clean up existing listener
      if (listenerRef.current) {
        databaseOptimizer.removeListener(listenerRef.current);
        listenerRef.current = '';
      }
      return;
    }

    // Clean up previous listener
    if (listenerRef.current) {
      databaseOptimizer.removeListener(listenerRef.current);
    }

    // Create optimized listener for typing status
    const listenerId = databaseOptimizer.createOptimizedListener({
      path: `typing/${chatId}/${receiverId}`,
      callback: (typingData) => {
        // Check if the other user is typing and the timestamp is recent (within last 10 seconds)
        if (typingData && typingData.isTyping) {
          const now = Date.now();
          const typingTimestamp = typingData.timestamp || 0;
          const isRecent = now - typingTimestamp < 10000; // 10 seconds
          
          setIsTyping(isRecent);
          
          // If the timestamp is not recent, automatically clear the typing status
          if (!isRecent) {
            setIsTyping(false);
          }
        } else {
          setIsTyping(false);
        }
      },
      options: { once: false }
    });
    
    listenerRef.current = listenerId;
    
    return () => {
      if (listenerRef.current) {
        databaseOptimizer.removeListener(listenerRef.current);
        listenerRef.current = '';
      }
    };
  }, [chatId, user, database, receiverId]);

  // If not typing or missing required props, don't render anything
  if (!isTyping) return null;

  return (
    <div className={`flex items-center text-xs text-muted-foreground animate-pulse ${className}`}>
      <span className="mr-2">Typing</span>
      <span className="flex space-x-1">
        <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
        <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
      </span>
    </div>
  );
}

// Utility function to update the current user's typing status
export function useTypingStatus(chatId: string) {
  const { user } = useAuth();
  const [database, setDatabase] = useState<any>(null);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Initialize database connection
  useEffect(() => {
    const { database: db } = getFirebaseServices();
    if (db) {
      setDatabase(db);
    } else {
      try {
        setDatabase(getDatabase());
      } catch (error) {
        console.error('[useTypingStatus] Error initializing database:', error);
      }
    }
    
    // Clean up any existing timeout on unmount
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, []);
  
  // Function to update typing status
  const setTypingStatus = (isTyping: boolean) => {
    if (!chatId || !user || !database) return;
    
    // Clear any existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
    }
    
    // Create a reference to the typing status node for the current user
    const typingRef = ref(database, `typing/${chatId}/${user.uid}`);
    
    // Update the typing status with the current timestamp
    set(typingRef, {
      isTyping,
      timestamp: Date.now()
    }).catch(error => {
      console.error('[useTypingStatus] Error updating typing status:', error);
    });
    
    // Set up automatic clearing of typing status after 5 seconds
    if (isTyping) {
      const timeout = setTimeout(() => {
        // Only clear if the database and user are still available
        if (database && user) {
          set(ref(database, `typing/${chatId}/${user.uid}`), {
            isTyping: false,
            timestamp: Date.now()
          }).catch(error => {
            console.error('[useTypingStatus] Error clearing typing status:', error);
          });
        }
      }, 5000);
      
      setTypingTimeout(timeout);
    }
    
    // Set up automatic clearing when the user disconnects
    if (database && user) {
      onDisconnect(typingRef).set({
        isTyping: false,
        timestamp: Date.now()
      }).catch(error => {
        console.error('[useTypingStatus] Error setting onDisconnect handler:', error);
      });
    }
  };
  
  return { setTypingStatus };
}