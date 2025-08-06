import { NextApiRequest, NextApiResponse } from 'next';

// Import Firebase admin directly
let firebaseAdminInstance: any = null;

// In-memory cache for short ID mappings
const shortIdCache = new Map<string, { fullId: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getFirebaseAdminInstance() {
  if (firebaseAdminInstance) {
    return firebaseAdminInstance;
  }
  
  try {
    const { getFirebaseAdmin } = await import('@/lib/firebase-admin');
    firebaseAdminInstance = getFirebaseAdmin();
    return firebaseAdminInstance;
  } catch (error) {
    console.error('Failed to import Firebase admin:', error);
    throw new Error('Firebase admin not available');
  }
}

// Function to generate the same 7-digit numeric ID from a Firebase document ID
function generateNumericShortId(listingId: string): string {
  let hash = 0;
  for (let i = 0; i < listingId.length; i++) {
    const char = listingId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const positiveHash = Math.abs(hash);
  const shortId = (positiveHash % 9000000) + 1000000;
  
  return shortId.toString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { shortId } = req.query;

  if (!shortId || typeof shortId !== 'string') {
    return res.status(400).json({ error: 'Short ID is required' });
  }

  // Validate that shortId is a 7-digit number
  if (!/^\d{7}$/.test(shortId)) {
    return res.status(400).json({ error: 'Invalid short ID format' });
  }

  // Check in-memory cache first
  const cached = shortIdCache.get(shortId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json({ 
      success: true, 
      fullId: cached.fullId,
      shortId,
      cached: true
    });
  }

  try {
    const { db } = await getFirebaseAdminInstance();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // First, try to find the mapping in the shortIdMappings collection
    try {
      const mappingDoc = await db.collection('shortIdMappings').doc(shortId).get();
      if (mappingDoc.exists) {
        const data = mappingDoc.data();
        
        // Cache the result
        shortIdCache.set(shortId, { fullId: data.fullId, timestamp: Date.now() });
        
        // Quick existence check without fetching full document
        const listingRef = db.collection('listings').doc(data.fullId);
        const listingDoc = await listingRef.get();
        
        if (listingDoc.exists) {
          return res.status(200).json({ 
            success: true, 
            fullId: data.fullId,
            shortId 
          });
        } else {
          // Clean up invalid mapping
          try {
            await db.collection('shortIdMappings').doc(shortId).delete();
            shortIdCache.delete(shortId);
          } catch (cleanupError) {
            console.error('Failed to clean up invalid mapping:', cleanupError);
          }
        }
      }
    } catch (mappingError) {
      console.log('No mapping found, falling back to scan');
    }

    // Optimized fallback: Use batch processing and limit queries
    const batchSize = 500;
    let lastDoc: any = null;
    let found = false;
    let attempts = 0;
    const maxAttempts = 4; // Limit to 2000 documents max

    while (!found && attempts < maxAttempts) {
      let query = db.collection('listings')
        .where('status', '==', 'active')
        .limit(batchSize);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      
      if (snapshot.empty) {
        break;
      }

      for (const listingDoc of snapshot.docs) {
        const docId = listingDoc.id;
        const generatedShortId = generateNumericShortId(docId);
        
        if (generatedShortId === shortId) {
          // Found the matching listing, create the mapping for future use
          try {
            await db.collection('shortIdMappings').doc(shortId).set({
              fullId: docId,
              createdAt: new Date(),
              listingTitle: listingDoc.data().title || 'Unknown'
            });
            
            // Cache the result
            shortIdCache.set(shortId, { fullId: docId, timestamp: Date.now() });
          } catch (mappingCreateError) {
            console.error('Failed to create mapping:', mappingCreateError);
            // Continue anyway
          }

          return res.status(200).json({ 
            success: true, 
            fullId: docId,
            shortId 
          });
        }
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      attempts++;
    }

    // If we get here, no matching listing was found
    return res.status(404).json({ error: 'Listing not found' });

  } catch (error) {
    console.error('Error resolving short ID:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}