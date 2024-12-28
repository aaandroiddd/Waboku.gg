import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, deleteDoc, doc } from 'firebase/firestore';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Verify admin secret to ensure only authorized cleanup
  const { adminSecret } = req.body;
  
  if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const results = {
      processedListings: 0,
      deletedListings: 0,
      errors: [] as string[]
    };

    // Get all listings
    const listingsRef = collection(db, 'listings');
    const listingsSnapshot = await getDocs(query(listingsRef));
    
    // Get all users for checking
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(query(usersRef));
    
    // Create a Set of user IDs for faster lookup
    const userIds = new Set<string>();
    usersSnapshot.forEach(doc => {
      userIds.add(doc.id);
    });

    // Process each listing
    for (const listingDoc of listingsSnapshot.docs) {
      results.processedListings++;
      const listing = listingDoc.data();
      
      // Check both userId and uid fields
      const hasValidUser = userIds.has(listing.userId) || userIds.has(listing.uid);
      
      if (!hasValidUser) {
        try {
          await deleteDoc(doc(db, 'listings', listingDoc.id));
          results.deletedListings++;
        } catch (error) {
          results.errors.push(`Failed to delete listing ${listingDoc.id}: ${error}`);
        }
      }
    }

    return res.status(200).json({
      message: 'Cleanup completed',
      ...results
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ 
      message: 'Error during cleanup process',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}