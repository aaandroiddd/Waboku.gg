import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from 'firebase-admin/database';
import { validateSearchTerm } from '@/lib/search-validation';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';

interface SearchRefinementData {
  originalTerm: string;
  refinedTerm: string;
  timeBetween: number; // milliseconds
  resultCount: number;
  timestamp: number;
  sessionId?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[SearchRefinement] [${requestId}] Request received`);

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

    const { originalTerm, refinedTerm, timeBetween, resultCount, sessionId } = req.body;

    // Validate required fields
    if (!originalTerm || !refinedTerm) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['originalTerm', 'refinedTerm']
      });
    }

    // Validate search terms
    if (!validateSearchTerm(originalTerm) || !validateSearchTerm(refinedTerm)) {
      return res.status(400).json({ error: 'Invalid search terms' });
    }

    // Return success immediately
    res.status(200).json({ success: true, message: 'Refinement tracked' });

    // Process analytics in background
    try {
      await getFirebaseAdmin();
      const database = getDatabase();

      const refinementData: SearchRefinementData = {
        originalTerm: originalTerm.trim(),
        refinedTerm: refinedTerm.trim(),
        timeBetween: timeBetween || 0,
        resultCount: resultCount || 0,
        timestamp: Date.now(),
        sessionId
      };

      // Store refinement data
      await Promise.all([
        // Individual refinement record
        database.ref('analytics/searchRefinements').push(refinementData),
        
        // Refinement patterns
        updateRefinementPatterns(database, originalTerm, refinedTerm),
        
        // Failed search tracking (if original had no results)
        resultCount === 0 ? trackFailedSearch(database, originalTerm) : Promise.resolve()
      ]);

      console.log(`[SearchRefinement] [${requestId}] Successfully tracked: ${originalTerm} -> ${refinedTerm}`);
    } catch (error) {
      console.error(`[SearchRefinement] [${requestId}] Background processing error:`, error);
    }
  } catch (error) {
    console.error(`[SearchRefinement] [${requestId}] Error:`, error);
    if (!res.writableEnded) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

async function updateRefinementPatterns(
  database: any,
  originalTerm: string,
  refinedTerm: string
) {
  const patternKey = `${originalTerm.toLowerCase()}_to_${refinedTerm.toLowerCase()}`.replace(/[^a-z0-9_]/g, '_');
  const patternRef = database.ref(`analytics/refinementPatterns/${patternKey}`);
  
  const snapshot = await patternRef.once('value');
  const current = snapshot.val() || {
    originalTerm,
    refinedTerm,
    count: 0,
    lastSeen: 0
  };

  current.count += 1;
  current.lastSeen = Date.now();

  await patternRef.set(current);
}

async function trackFailedSearch(database: any, searchTerm: string) {
  const failedRef = database.ref(`analytics/failedSearches/${searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '_')}`);
  
  const snapshot = await failedRef.once('value');
  const current = snapshot.val() || {
    term: searchTerm,
    count: 0,
    lastFailed: 0
  };

  current.count += 1;
  current.lastFailed = Date.now();

  await failedRef.set(current);
}