import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get listing ID from query parameters
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Listing ID is required' });
    }
    
    // Initialize Firebase
    const { db } = await getFirebaseServices();
    if (!db) {
      return res.status(500).json({ error: 'Firebase database not initialized' });
    }
    
    // Get the listing document
    const listingRef = doc(db, 'listings', id);
    const listingSnap = await getDoc(listingRef);
    
    if (!listingSnap.exists()) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    // Get the listing data
    const data = listingSnap.data();
    
    // Format dates for better readability
    const formattedData = {
      ...data,
      id: listingSnap.id,
      createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
      expiresAt: data.expiresAt?.toDate?.() ? data.expiresAt.toDate().toISOString() : data.expiresAt,
      archivedAt: data.archivedAt?.toDate?.() ? data.archivedAt.toDate().toISOString() : data.archivedAt,
      updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : data.updatedAt,
    };
    
    // Return the listing data
    return res.status(200).json(formattedData);
  } catch (error: any) {
    console.error('Error checking listing:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}