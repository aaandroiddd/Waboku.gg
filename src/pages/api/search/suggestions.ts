import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from 'firebase-admin/database';
import { validateSearchTerm } from '@/lib/search-validation';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
let cachedSuggestions: string[] = [];
let lastCacheTime = 0;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CDN caching: edge cache for 60s, allow serving stale for 5m while revalidating
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  const { q } = req.query;
  const query = (q as string)?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return res.status(200).json([]);
  }

  try {
    // Check cache first
    const now = Date.now();
    if (cachedSuggestions.length > 0 && (now - lastCacheTime) < CACHE_DURATION) {
      const filtered = cachedSuggestions
        .filter(term => term.toLowerCase().includes(query))
        .slice(0, 8);
      return res.status(200).json(filtered);
    }

    // Get Firebase Admin
    await getFirebaseAdmin();
    const database = getDatabase();

    // Get all search terms from the last 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const snapshot = await database
      .ref('searchTerms')
      .orderByChild('lastUpdated')
      .startAt(sevenDaysAgo)
      .once('value');

    if (!snapshot.exists()) {
      return res.status(200).json([]);
    }

    // Build suggestions from search history
    const suggestions: { term: string, count: number, lastUsed: number }[] = [];
    
    snapshot.forEach((childSnapshot) => {
      const search = childSnapshot.val();
      if (search && search.term && validateSearchTerm(search.term)) {
        suggestions.push({
          term: search.term,
          count: search.count || 1,
          lastUsed: search.lastUpdated || 0
        });
      }
      return false;
    });

    // Sort by popularity and recency
    suggestions.sort((a, b) => {
      const scoreA = a.count + (a.lastUsed / 1000000); // Boost recent searches
      const scoreB = b.count + (b.lastUsed / 1000000);
      return scoreB - scoreA;
    });

    // Cache the top suggestions
    cachedSuggestions = suggestions.slice(0, 100).map(s => s.term);
    lastCacheTime = now;

    // Filter by query and return
    const filtered = cachedSuggestions
      .filter(term => term.toLowerCase().includes(query))
      .slice(0, 8);

    res.status(200).json(filtered);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(200).json([]);
  }
}