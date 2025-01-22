import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase, ref, query, orderByChild, get, limitToLast } from 'firebase/database';
import { app } from '@/lib/firebase';
import { validateSearchTerm } from '@/lib/search-validation';

const DEFAULT_TRENDING = [
  { term: "Charizard VSTAR", count: 15 },
  { term: "Black Lotus", count: 12 },
  { term: "Luffy Leader", count: 10 },
  { term: "Pikachu VMAX", count: 8 },
  { term: "Liliana of the Veil", count: 7 }
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const db = getDatabase(app);
    const searchesRef = ref(db, 'searches');
    
    // Get searches from the last 48 hours
    const twoDaysAgo = Date.now() - (48 * 60 * 60 * 1000);
    
    const searchesQuery = query(
      searchesRef,
      orderByChild('timestamp'),
      limitToLast(100) // Limit to last 100 searches for processing
    );

    const snapshot = await get(searchesQuery);
    const searches: any = [];
    
    snapshot.forEach((childSnapshot) => {
      const search = childSnapshot.val();
      // Only include valid searches from the last 48 hours
      if (search.timestamp >= twoDaysAgo && validateSearchTerm(search.term)) {
        searches.push(search);
      }
    });

    // Count occurrences and sort by frequency
    const searchCounts = searches.reduce((acc: any, curr: any) => {
      acc[curr.term] = (acc[curr.term] || 0) + 1;
      return acc;
    }, {});

    let trending = Object.entries(searchCounts)
      .map(([term, count]) => ({ term, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5); // Return top 5 trending searches

    // If we don't have enough real trending searches, use default ones
    if (trending.length < 5) {
      trending = DEFAULT_TRENDING;
    }

    return res.status(200).json(trending);
  } catch (error) {
    console.error('Error fetching trending searches:', error);
    // Return default trending searches in case of error
    return res.status(200).json(DEFAULT_TRENDING);
  }
}