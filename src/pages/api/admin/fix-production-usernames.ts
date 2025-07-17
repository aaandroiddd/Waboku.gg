import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin access
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Invalid admin secret' });
    }

    const { action, limit = 50, listingIds } = req.body;

    // Use direct Firebase Admin SDK to avoid module resolution issues
    const admin = require('firebase-admin');
    
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      if (!projectId || !clientEmail || !privateKey) {
        return res.status(500).json({ error: 'Firebase configuration missing' });
      }

      // Handle private key formatting
      if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
          (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    const db = admin.firestore();

    // Helper function to check if string looks like user ID
    function looksLikeUserId(str: string): boolean {
      if (!str) return false;
      
      // Check if it starts with common user ID patterns
      if (str.startsWith('User ') && str.length < 15) return true;
      
      // Check if it's a long alphanumeric string (typical Firebase UID)
      if (str.length > 20 && /^[a-zA-Z0-9]+$/.test(str)) return true;
      
      // Check if it contains no spaces and is all lowercase/uppercase (typical UID pattern)
      if (str.length > 15 && !/\s/.test(str) && (/^[a-z0-9]+$/.test(str) || /^[A-Z0-9]+$/.test(str))) return true;
      
      return false;
    }

    // Helper function to get actual username
    async function getActualUsername(userId: string): Promise<string> {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          return userData.displayName || userData.username || `User ${userId.substring(0, 8)}`;
        }
        
        return `User ${userId.substring(0, 8)}`;
      } catch (error) {
        console.error('Error fetching username for user:', userId, error);
        return `User ${userId.substring(0, 8)}`;
      }
    }

    if (action === 'sample') {
      // Get a sample of listings to inspect
      const listingsSnapshot = await db.collection('listings')
        .where('status', '==', 'active')
        .limit(limit)
        .get();

      const sample = [];
      
      for (const doc of listingsSnapshot.docs) {
        const data = doc.data();
        const username = data.username || '';
        const isUserId = looksLikeUserId(username);
        
        const item: any = {
          id: doc.id,
          userId: data.userId,
          username: username,
          looksLikeUserId: isUserId,
          title: data.title?.substring(0, 50) + '...' || 'No title'
        };
        
        if (isUserId) {
          item.actualUsername = await getActualUsername(data.userId);
        }
        
        sample.push(item);
      }

      return res.status(200).json({ sample });

    } else if (action === 'check') {
      // Check and fix listings with user ID usernames
      const listingsSnapshot = await db.collection('listings')
        .where('status', '==', 'active')
        .limit(limit)
        .get();

      const results = {
        checked: 0,
        fixed: 0,
        errors: [] as string[]
      };

      const batch = db.batch();
      let batchCount = 0;
      const maxBatchSize = 500; // Firestore batch limit

      for (const doc of listingsSnapshot.docs) {
        results.checked++;
        const data = doc.data();
        const currentUsername = data.username || '';
        
        if (looksLikeUserId(currentUsername)) {
          try {
            const actualUsername = await getActualUsername(data.userId);
            
            batch.update(doc.ref, {
              username: actualUsername,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            batchCount++;
            results.fixed++;
            
            console.log(`Queued fix for listing ${doc.id}: "${currentUsername}" -> "${actualUsername}"`);
            
            // Commit batch if we reach the limit
            if (batchCount >= maxBatchSize) {
              await batch.commit();
              batchCount = 0;
            }
          } catch (error) {
            const errorMsg = `Failed to queue fix for listing ${doc.id}: ${error}`;
            console.error(errorMsg);
            results.errors.push(errorMsg);
          }
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
      }

      return res.status(200).json(results);

    } else if (action === 'fix-specific' && listingIds) {
      // Fix specific listing IDs
      const results = {
        fixed: 0,
        errors: [] as string[]
      };

      const batch = db.batch();
      let batchCount = 0;

      for (const listingId of listingIds) {
        try {
          const listingDoc = await db.collection('listings').doc(listingId).get();
          
          if (!listingDoc.exists) {
            results.errors.push(`Listing ${listingId} not found`);
            continue;
          }
          
          const data = listingDoc.data();
          const currentUsername = data.username || '';
          
          if (looksLikeUserId(currentUsername)) {
            const actualUsername = await getActualUsername(data.userId);
            
            batch.update(listingDoc.ref, {
              username: actualUsername,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            batchCount++;
            results.fixed++;
            
            console.log(`Queued fix for listing ${listingId}: "${currentUsername}" -> "${actualUsername}"`);
          }
        } catch (error) {
          const errorMsg = `Failed to process listing ${listingId}: ${error}`;
          console.error(errorMsg);
          results.errors.push(errorMsg);
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      return res.status(200).json(results);

    } else {
      return res.status(400).json({ error: 'Invalid action. Use: sample, check, or fix-specific' });
    }

  } catch (error: any) {
    console.error('Error in fix-production-usernames:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}