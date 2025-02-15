import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase, ref, query, orderByChild, get, limitToLast } from 'firebase/database';
import { app } from '@/lib/firebase';
import { validateSearchTerm } from '@/lib/search-validation';

const CACHE_DURATION = 30 * 1000; // 30 seconds cache
let cachedTrending: any = null;
let lastCacheTime = 0;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.method !== 'GET') {
    console.error('Invalid method for trending-searches:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }

  // Check if we have a valid cache
  const now = Date.now();
  if (cachedTrending && (now - lastCacheTime) < CACHE_DURATION) {
    return res.status(200).json(cachedTrending);
  }

  try {
    console.log('Fetching trending searches from Firebase...');
    const db = getDatabase(app);
    if (!db) {
      throw new Error('Firebase database connection failed');
    }

    const searchesRef = ref(db, 'searches');
    
    // Get searches from the last 48 hours
    const twoDaysAgo = now - (48 * 60 * 60 * 1000);
    
    const searchesQuery = query(
      searchesRef,
      orderByChild('timestamp'),
      limitToLast(500) // Increased limit for better trending calculation
    );

    const snapshot = await get(searchesQuery);
    if (!snapshot.exists()) {
      console.log('No trending searches found');
      return res.status(200).json([]);
    }

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
      const term = curr.term.trim().toLowerCase();
      acc[term] = (acc[term] || 0) + 1;
      return acc;
    }, {});

    let trending = Object.entries(searchCounts)
      .map(([term, count]) => ({ 
        term: term.charAt(0).toUpperCase() + term.slice(1), // Capitalize first letter
        count 
      }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5); // Return top 5 trending searches

    // Update cache
    cachedTrending = trending;
    lastCacheTime = now;

    console.log(`Successfully fetched ${trending.length} trending searches`);
    return res.status(200).json(trending);
  } catch (error: any) {
    console.error('Error in trending-searches API:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch trending searches'
    });
  }
}