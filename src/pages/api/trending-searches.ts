import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from 'firebase-admin/database';
import { validateSearchTerm } from '@/lib/search-validation';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

const CACHE_DURATION = 30 * 1000; // 30 seconds cache
let cachedTrending: any = null;
let lastCacheTime = 0;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.info(`[${requestId}] Trending searches API called at:`, new Date().toISOString());
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  
  // Set a longer timeout for the response
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=10');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    console.info(`[${requestId}] Handling OPTIONS request`);
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    console.error(`[${requestId}] Invalid method for trending-searches:`, req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }
  
  console.info(`[${requestId}] Processing GET request for trending searches`);

  // Check if we have a valid cache
  const now = Date.now();
  if (cachedTrending && (now - lastCacheTime) < CACHE_DURATION) {
    console.log('Returning cached trending searches');
    return res.status(200).json(cachedTrending);
  }

  try {
    console.log('Initializing Firebase Admin...');
    // Use the centralized Firebase Admin initialization
    getFirebaseAdmin();
    const database = getDatabase();
    
    console.log('Fetching trending searches from Firebase...');
    
    // Calculate timestamp for 24 hours ago
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    const snapshot = await database
      .ref('searchTerms')
      .orderByChild('lastUpdated')
      .startAt(twentyFourHoursAgo)
      .once('value');
    
    if (!snapshot.exists()) {
      console.log('No trending searches found in the last 24 hours');
      cachedTrending = [];
      lastCacheTime = now;
      return res.status(200).json([]);
    }

    const searchCounts: { [key: string]: { term: string, count: number } } = {};
    
    // Aggregate search counts from the last 24 hours
    snapshot.forEach((childSnapshot) => {
      const search = childSnapshot.val();
      if (search && search.term && validateSearchTerm(search.term)) {
        const normalizedTerm = search.term.toLowerCase();
        if (!searchCounts[normalizedTerm]) {
          searchCounts[normalizedTerm] = {
            term: search.term.charAt(0).toUpperCase() + search.term.slice(1),
            count: 0
          };
        }
        searchCounts[normalizedTerm].count += 1;
      }
      return false;
    });

    // Convert to array and sort by count
    const trending = Object.values(searchCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Get top 10

    // Update cache
    cachedTrending = trending;
    lastCacheTime = now;

    console.log(`Successfully fetched ${trending.length} trending searches from the last 24 hours`);
    return res.status(200).json(trending);
  } catch (error: any) {
    console.error('Error in trending-searches API:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      config: {
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        hasDatabaseUrl: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      },
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NEXT_PUBLIC_CO_DEV_ENV === 'development' 
        ? error.message 
        : 'Failed to fetch trending searches',
      code: error.code
    });
  }
}