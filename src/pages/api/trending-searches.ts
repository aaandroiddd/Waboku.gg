import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from 'firebase-admin/database';
import { validateSearchTerm } from '@/lib/search-validation';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

const CACHE_DURATION = 120 * 1000; // 120 seconds cache (increased from 60)
let cachedTrending: any = null;
let lastCacheTime = 0;

// Fallback data in case of errors
const FALLBACK_TRENDING = [
  { term: "Charizard", count: 42 },
  { term: "Pikachu", count: 38 },
  { term: "Black Lotus", count: 35 },
  { term: "Mox Pearl", count: 30 },
  { term: "Jace", count: 28 }
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.info(`Path: /api/trending-searches [${requestId}] Trending searches API called at:`, new Date().toISOString());
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    console.info(`Path: /api/trending-searches [${requestId}] Handling OPTIONS request`);
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    console.error(`Path: /api/trending-searches [${requestId}] Invalid method:`, req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }
  
  console.info(`Path: /api/trending-searches [${requestId}] Processing GET request`);

  // Check if we have a valid cache
  const now = Date.now();
  if (cachedTrending && (now - lastCacheTime) < CACHE_DURATION) {
    console.info(`Path: /api/trending-searches [${requestId}] Returning cached trending searches`);
    return res.status(200).json(cachedTrending);
  }

  try {
    // Return fallback data immediately to avoid timeouts
    // This ensures the client gets a response while we try to fetch fresh data
    cachedTrending = FALLBACK_TRENDING;
    lastCacheTime = now;
    
    console.info(`Path: /api/trending-searches [${requestId}] Initializing Firebase Admin...`);
    
    // Check if required environment variables are present
    const requiredEnvVars = {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    };
    
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);
      
    if (missingVars.length > 0) {
      console.error(`Path: /api/trending-searches [${requestId}] Missing required environment variables:`, missingVars);
      return res.status(200).json(FALLBACK_TRENDING);
    }
    
    // Use the centralized Firebase Admin initialization with timeout
    const adminInitPromise = Promise.race([
      getFirebaseAdmin(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase Admin initialization timeout')), 3000)
      )
    ]);
    
    const admin = await adminInitPromise;
    const database = getDatabase();
    
    if (!database) {
      throw new Error('Failed to get Firebase database instance');
    }
    
    console.info(`Path: /api/trending-searches [${requestId}] Fetching trending searches from Firebase...`);
    
    // Calculate timestamp for 24 hours ago
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Set a timeout for the database query
    const dbQueryPromise = Promise.race([
      database
        .ref('searchTerms')
        .orderByChild('lastUpdated')
        .startAt(twentyFourHoursAgo)
        .once('value'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout')), 4000)
      )
    ]);
    
    const snapshot = await dbQueryPromise;
    
    if (!snapshot.exists()) {
      console.info(`Path: /api/trending-searches [${requestId}] No trending searches found in the last 24 hours`);
      return res.status(200).json(FALLBACK_TRENDING);
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
    let trending = Object.values(searchCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Get top 10
      
    // If no trending searches found, use fallback data
    if (trending.length === 0) {
      trending = FALLBACK_TRENDING;
    }

    // Update cache
    cachedTrending = trending;
    lastCacheTime = now;

    console.info(`Path: /api/trending-searches [${requestId}] Successfully fetched ${trending.length} trending searches`);
    return res.status(200).json(trending);
  } catch (error: any) {
    console.error(`Path: /api/trending-searches [${requestId}] Error:`, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
      type: error.constructor.name,
      config: {
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        hasDatabaseUrl: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      },
      timestamp: new Date().toISOString()
    });
    
    // Return fallback data instead of error
    console.info(`Path: /api/trending-searches [${requestId}] Returning fallback trending data due to error`);
    return res.status(200).json(FALLBACK_TRENDING);
  }
}