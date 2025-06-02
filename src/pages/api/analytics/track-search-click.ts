import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from 'firebase-admin/database';
import { validateSearchTerm } from '@/lib/search-validation';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';

interface SearchClickData {
  searchTerm: string;
  listingId: string;
  listingTitle: string;
  resultPosition: number;
  userLocation?: string;
  timestamp: number;
  sessionId?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[SearchClick] [${requestId}] Request received`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  try {
    // Rate limiting
    const isAllowed = await checkRateLimit(ip);
    if (!isAllowed) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const { searchTerm, listingId, listingTitle, resultPosition, userLocation, sessionId } = req.body;

    // Validate required fields
    if (!searchTerm || !listingId || !listingTitle || resultPosition === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['searchTerm', 'listingId', 'listingTitle', 'resultPosition']
      });
    }

    // Validate search term
    if (!validateSearchTerm(searchTerm)) {
      return res.status(400).json({ error: 'Invalid search term' });
    }

    // Return success immediately to avoid blocking user experience
    res.status(200).json({ success: true, message: 'Click tracked' });

    // Process analytics in background
    try {
      await getFirebaseAdmin();
      const database = getDatabase();

      const clickData: SearchClickData = {
        searchTerm: searchTerm.trim(),
        listingId,
        listingTitle,
        resultPosition,
        userLocation,
        timestamp: Date.now(),
        sessionId
      };

      // Store in multiple analytics paths for different query patterns
      const promises = [
        // 1. Individual click record
        database.ref('analytics/searchClicks').push(clickData),
        
        // 2. Search term performance aggregation
        updateSearchTermPerformance(database, searchTerm, listingId, resultPosition),
        
        // 3. Listing popularity tracking
        updateListingPopularity(database, listingId, listingTitle, searchTerm),
        
        // 4. Position-based click rates
        updatePositionAnalytics(database, resultPosition, searchTerm)
      ];

      await Promise.all(promises);
      console.log(`[SearchClick] [${requestId}] Successfully tracked click: ${searchTerm} -> ${listingTitle}`);
    } catch (error) {
      console.error(`[SearchClick] [${requestId}] Background processing error:`, error);
    }
  } catch (error) {
    console.error(`[SearchClick] [${requestId}] Error:`, error);
    if (!res.writableEnded) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

async function updateSearchTermPerformance(
  database: any, 
  searchTerm: string, 
  listingId: string, 
  position: number
) {
  const termKey = searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const perfRef = database.ref(`analytics/searchPerformance/${termKey}`);
  
  const snapshot = await perfRef.once('value');
  const current = snapshot.val() || {
    term: searchTerm,
    totalClicks: 0,
    uniqueListings: {},
    avgPosition: 0,
    lastUpdated: 0
  };

  current.totalClicks += 1;
  current.uniqueListings[listingId] = (current.uniqueListings[listingId] || 0) + 1;
  current.avgPosition = ((current.avgPosition * (current.totalClicks - 1)) + position) / current.totalClicks;
  current.lastUpdated = Date.now();

  await perfRef.set(current);
}

async function updateListingPopularity(
  database: any,
  listingId: string,
  listingTitle: string,
  searchTerm: string
) {
  const popRef = database.ref(`analytics/listingPopularity/${listingId}`);
  
  const snapshot = await popRef.once('value');
  const current = snapshot.val() || {
    title: listingTitle,
    clickCount: 0,
    searchTerms: {},
    lastClicked: 0
  };

  current.clickCount += 1;
  current.searchTerms[searchTerm.toLowerCase()] = (current.searchTerms[searchTerm.toLowerCase()] || 0) + 1;
  current.lastClicked = Date.now();

  await popRef.set(current);
}

async function updatePositionAnalytics(
  database: any,
  position: number,
  searchTerm: string
) {
  const posRef = database.ref(`analytics/positionClicks/${position}`);
  
  const snapshot = await posRef.once('value');
  const current = snapshot.val() || {
    position,
    totalClicks: 0,
    searchTerms: {},
    lastUpdated: 0
  };

  current.totalClicks += 1;
  current.searchTerms[searchTerm.toLowerCase()] = (current.searchTerms[searchTerm.toLowerCase()] || 0) + 1;
  current.lastUpdated = Date.now();

  await posRef.set(current);
}