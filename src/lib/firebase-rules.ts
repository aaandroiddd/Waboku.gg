import { getDatabase, ref, set } from "firebase/database";
import { app } from "./firebase";

// Initialize Realtime Database
const db = getDatabase(app);

// Define the rules object
const databaseRules = {
  rules: {
    ".read": false,
    ".write": false,
    
    messages: {
      ".read": false,
      "$chatId": {
        ".read": "auth != null && root.child('chats').child($chatId).child('participants').child(auth.uid).val() === true",
        ".write": "auth != null && root.child('chats').child($chatId).child('participants').child(auth.uid).val() === true",
        "$messageId": {
          ".validate": "newData.hasChildren(['senderId', 'receiverId', 'content', 'timestamp'])",
          senderId: {
            ".validate": "newData.val() === auth.uid"
          },
          receiverId: {
            ".validate": "newData.isString()"
          },
          content: {
            ".validate": "newData.isString() && newData.val().length <= 2000"
          },
          timestamp: {
            ".validate": "newData.isNumber() && newData.val() <= now"
          },
          listingId: {
            ".validate": "!newData.exists() || newData.isString()"
          },
          read: {
            ".validate": "newData.isBoolean()"
          }
        }
      }
    },

    chats: {
      ".read": false,
      "$chatId": {
        ".read": "auth != null && data.child('participants').child(auth.uid).val() === true",
        ".write": "auth != null && (!data.exists() || data.child('participants').child(auth.uid).val() === true)",
        participants: {
          ".validate": "newData.hasChildren() && newData.val().keys().length >= 2"
        },
        lastMessage: {
          ".validate": "newData.hasChildren(['senderId', 'receiverId', 'content', 'timestamp'])"
        },
        listingId: {
          ".validate": "!newData.exists() || newData.isString()"
        },
        listingTitle: {
          ".validate": "!newData.exists() || newData.isString()"
        },
        createdAt: {
          ".validate": "newData.isNumber() && (!data.exists() || data.val() === newData.val()) && newData.val() <= now"
        }
      }
    },

    userStatus: {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid",
        ".validate": "newData.hasChildren(['status', 'lastSeen'])",
        status: {
          ".validate": "newData.isString() && newData.val().length <= 100"
        },
        lastSeen: {
          ".validate": "newData.isNumber() && newData.val() <= now"
        }
      }
    },

    typing: {
      "$chatId": {
        "$uid": {
          ".read": "auth != null && root.child('chats').child($chatId).child('participants').child(auth.uid).val() === true",
          ".write": "auth != null && auth.uid == $uid",
          ".validate": "newData.isBoolean()"
        }
      }
    },

    lastActive: {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid",
        ".validate": "newData.isNumber() && newData.val() <= now"
      }
    }
  }
};

// Types for the database structure
interface Message {
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  listingId?: string;
  read: boolean;
}

interface Chat {
  participants: {
    [key: string]: boolean;
  };
  lastMessage: Message;
  listingId?: string;
  listingTitle?: string;
  createdAt: number;
}

interface UserStatus {
  status: string;
  lastSeen: number;
}

interface DatabaseStructure {
  messages: {
    [chatId: string]: {
      [messageId: string]: Message;
    };
  };
  chats: {
    [chatId: string]: Chat;
  };
  userStatus: {
    [userId: string]: UserStatus;
  };
  typing: {
    [chatId: string]: {
      [userId: string]: boolean;
    };
  };
  lastActive: {
    [userId: string]: number;
  };
}

// Validation functions
export const validateMessage = (message: Partial<Message>): boolean => {
  if (!message.senderId || !message.receiverId || !message.content || !message.timestamp) {
    return false;
  }
  if (typeof message.content !== 'string' || message.content.length > 2000) {
    return false;
  }
  if (typeof message.timestamp !== 'number' || message.timestamp > Date.now()) {
    return false;
  }
  if (message.listingId && typeof message.listingId !== 'string') {
    return false;
  }
  if (typeof message.read !== 'boolean') {
    return false;
  }
  return true;
};

export const validateChat = (chat: Partial<Chat>): boolean => {
  if (!chat.participants || Object.keys(chat.participants).length < 2) {
    return false;
  }
  if (!chat.lastMessage || !validateMessage(chat.lastMessage)) {
    return false;
  }
  if (chat.listingId && typeof chat.listingId !== 'string') {
    return false;
  }
  if (chat.listingTitle && typeof chat.listingTitle !== 'string') {
    return false;
  }
  if (!chat.createdAt || typeof chat.createdAt !== 'number' || chat.createdAt > Date.now()) {
    return false;
  }
  return true;
};

export { databaseRules, type DatabaseStructure };