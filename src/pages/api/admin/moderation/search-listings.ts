import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { moderatorAuthMiddleware } from '@/middleware/moderatorAuth';

// Initialize Firestore using Firebase Admin
const { db } = getFirebaseAdmin();

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q: searchQuery } = req.query;

  if (!searchQuery || typeof searchQuery !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    console.log(`Searching listings with query: ${searchQuery}`);

    const listings: any[] = [];
    const searchTerm = searchQuery.toLowerCase().trim();

    // Search by listing ID first (exact match)
    if (searchTerm.length > 10) {
      try {
        const listingDoc = await db.collection('listings').doc(searchTerm).get();
        if (listingDoc.exists) {
          const data = listingDoc.data();
          listings.push({
            id: listingDoc.id,
            ...data,
            createdAt: data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt,
            moderatedAt: data?.moderatedAt?.toDate?.()?.toISOString() || data?.moderatedAt
          });
        }
      } catch (error) {
        console.log('Not a valid document ID, continuing with text search');
      }
    }

    // If no exact ID match found, perform text-based search
    if (listings.length === 0) {
      // Get all listings and filter in memory (for small datasets)
      // For larger datasets, you'd want to use a search service like Algolia
      const listingsSnapshot = await db.collection('listings')
        .orderBy('createdAt', 'desc')
        .limit(500) // Limit to prevent memory issues
        .get();

      listingsSnapshot.forEach(doc => {
        const data = doc.data();
        const title = (data.title || '').toLowerCase();
        const description = (data.description || '').toLowerCase();
        const username = (data.username || '').toLowerCase();
        const game = (data.game || '').toLowerCase();

        // Check if search term matches any field
        if (
          title.includes(searchTerm) ||
          description.includes(searchTerm) ||
          username.includes(searchTerm) ||
          game.includes(searchTerm)
        ) {
          listings.push({
            id: doc.id,
            ...data,
            createdAt: data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt,
            moderatedAt: data?.moderatedAt?.toDate?.()?.toISOString() || data?.moderatedAt
          });
        }
      });
    }

    // Sort by creation date (newest first)
    listings.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    console.log(`Found ${listings.length} listings matching search query`);

    return res.status(200).json({
      success: true,
      listings: listings.slice(0, 50), // Limit results to 50
      total: listings.length
    });

  } catch (error) {
    console.error('Error searching listings:', error);
    return res.status(500).json({ error: 'Failed to search listings' });
  }
};

// Apply the middleware and export
export default async function (req: NextApiRequest, res: NextApiResponse) {
  return moderatorAuthMiddleware(req, res, () => handler(req, res));
}