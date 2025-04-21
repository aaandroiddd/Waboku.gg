import { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { initializeApp, getApps } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action } = req.body;
    
    if (action === 'fix_chat_permissions') {
      // Get current rules
      const database = admin.database();
      const currentRules = await database.getRules();
      
      // Save current rules as backup
      const backupPath = path.join(process.cwd(), 'database.rules.json.backup');
      fs.writeFileSync(backupPath, currentRules);
      
      // Create simplified rules for chats and messages
      const simplifiedRules = {
        rules: {
          // Keep existing rules
          ...JSON.parse(currentRules).rules,
          
          // Override chat and message rules
          chats: {
            ".read": "auth != null",
            ".write": "auth != null",
            ".indexOn": ["createdAt", "participants"],
            "$chatId": {
              ".read": "auth != null",
              ".write": "auth != null",
              "participants": {
                "$uid": {
                  ".validate": "newData.isBoolean() && ($uid === auth.uid || root.child('users').child($uid).exists())"
                }
              },
              "createdAt": {
                ".validate": "newData.isNumber() && newData.val() <= now"
              }
            }
          },
          
          messages: {
            ".read": "auth != null",
            ".write": "auth != null",
            ".indexOn": ["timestamp", "chatId"],
            "$chatId": {
              ".read": "auth != null",
              ".write": "auth != null",
              "$messageId": {
                "senderId": {
                  ".validate": "newData.val() === auth.uid"
                },
                "content": {
                  ".validate": "newData.isString()"
                },
                "timestamp": {
                  ".validate": "newData.isNumber() && newData.val() <= now"
                }
              }
            }
          }
        }
      };
      
      // Update rules
      await database.setRules(JSON.stringify(simplifiedRules, null, 2));
      
      return res.status(200).json({ 
        success: true, 
        message: 'Database rules updated successfully' 
      });
    }
    
    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Error updating database rules:', error);
    return res.status(500).json({ 
      error: 'Failed to update database rules',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}