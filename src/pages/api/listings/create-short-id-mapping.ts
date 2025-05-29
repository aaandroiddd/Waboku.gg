import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { listingId, listingTitle } = req.body;

  if (!listingId || typeof listingId !== 'string') {
    return res.status(400).json({ error: 'Listing ID is required' });
  }

  try {
    const { db } = getFirebaseServices();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Generate the short ID
    const shortId = generateNumericShortId(listingId);

    // Check if the listing exists
    const listingDoc = await getDoc(doc(db, 'listings', listingId));
    if (!listingDoc.exists()) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Create or update the mapping
    await setDoc(doc(db, 'shortIdMappings', shortId), {
      fullId: listingId,
      createdAt: new Date(),
      listingTitle: listingTitle || listingDoc.data().title || 'Unknown',
      updatedAt: new Date()
    });

    return res.status(200).json({ 
      success: true, 
      shortId,
      fullId: listingId
    });

  } catch (error) {
    console.error('Error creating short ID mapping:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}