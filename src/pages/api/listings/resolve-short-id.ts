import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

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

  try {
    const { db } = getFirebaseAdmin();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // First, try to find the mapping in the shortIdMappings collection
    try {
      const mappingDoc = await db.collection('shortIdMappings').doc(shortId).get();
      if (mappingDoc.exists) {
        const data = mappingDoc.data();
        // Verify the listing still exists
        const listingDoc = await db.collection('listings').doc(data.fullId).get();
        if (listingDoc.exists) {
          return res.status(200).json({ 
            success: true, 
            fullId: data.fullId,
            shortId 
          });
        }
      }
    } catch (mappingError) {
      console.log('No mapping found, falling back to scan');
    }

    // Fallback: scan through active listings (limited to prevent timeout)
    const activeListingsQuery = await db.collection('listings')
      .where('status', '==', 'active')
      .limit(1000) // Limit to prevent timeout
      .get();
    
    for (const listingDoc of activeListingsQuery.docs) {
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

    // If we get here, no matching listing was found
    return res.status(404).json({ error: 'Listing not found' });

  } catch (error) {
    console.error('Error resolving short ID:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}