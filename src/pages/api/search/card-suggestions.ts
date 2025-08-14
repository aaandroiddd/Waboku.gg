import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Cache for card suggestions to improve performance
let cardSuggestionsCache: { [key: string]: string[] } = {};
let lastCacheTime: { [key: string]: number } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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

  // CDN caching for faster suggestions at the edge
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  const { q, limit = 8 } = req.query;
  const query = (q as string)?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return res.status(200).json([]);
  }

  const cacheKey = `${query}_${limit}`;

  try {
    // Check cache first
    const now = Date.now();
    if (cardSuggestionsCache[cacheKey] && (now - (lastCacheTime[cacheKey] || 0)) < CACHE_DURATION) {
      return res.status(200).json(cardSuggestionsCache[cacheKey]);
    }

    await getFirebaseAdmin();
    const db = getFirestore();

    // Get card suggestions from actual listings in Firestore
    const suggestions = await getCardSuggestionsFromListings(db, query, Number(limit));

    // Cache results
    cardSuggestionsCache[cacheKey] = suggestions;
    lastCacheTime[cacheKey] = now;

    res.status(200).json(suggestions);
  } catch (error) {
    console.error('Error fetching card suggestions:', error);
    res.status(200).json([]);
  }
}

async function getCardSuggestionsFromListings(db: any, query: string, limit: number): Promise<string[]> {
  try {
    const suggestions = new Set<string>();
    const now = new Date();

    // Query active listings for card names and titles that match the search
    const listingsRef = db.collection('listings');
    
    // Build case variants for prefix search
    const makeVariants = (s: string) => {
      const cap = s.charAt(0).toUpperCase() + s.slice(1);
      const titleCase = s.replace(/\b\w/g, (c: string) => c.toUpperCase());
      const upper = s.toUpperCase();
      return Array.from(new Set([s, cap, titleCase, upper]));
    };
    const variants = makeVariants(query);
    
    // Create queries for different fields
    const queries: any[] = [];
    
    // Search by cardName field
    for (const variant of variants) {
      queries.push(
        listingsRef
          .where('status', '==', 'active')
          .orderBy('cardName')
          .startAt(variant)
          .endAt(variant + '\uf8ff')
          .limit(limit * 2)
      );
    }
    
    // Search by title field
    for (const variant of variants) {
      queries.push(
        listingsRef
          .where('status', '==', 'active')
          .orderBy('title')
          .startAt(variant)
          .endAt(variant + '\uf8ff')
          .limit(limit * 2)
      );
    }

    // Execute all queries in parallel
    const queryPromises = queries.map(q => q.get());
    const querySnapshots = await Promise.all(queryPromises);

    // Process results from all queries
    for (const snapshot of querySnapshots) {
      snapshot.forEach((doc: any) => {
        const data = doc.data();

        // Filter: only include active and non-expired listings
        const expiresAtDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : data.expiresAt;
        if (data.status !== 'active' || (expiresAtDate && expiresAtDate <= now)) {
          return;
        }
        
        // Extract card names and titles that match our search query
        const cardName = (data.cardName || '').toLowerCase();
        const title = (data.title || '').toLowerCase();
        
        // Add cardName if it matches and is meaningful
        if (cardName && cardName.includes(query) && cardName.length > 2) {
          suggestions.add(data.cardName);
        }
        
        // Add title if it matches and is different from cardName
        if (title && title.includes(query) && title !== cardName && title.length > 2) {
          suggestions.add(data.title);
        }
      });
    }

    // Convert to array, sort by relevance, and limit results
    const suggestionArray = Array.from(suggestions);
    
    // Sort by relevance (exact matches first, then by length)
    const sortedSuggestions = suggestionArray
      .sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        // Exact matches first
        if (aLower === query && bLower !== query) return -1;
        if (bLower === query && aLower !== query) return 1;
        
        // Starts with query
        if (aLower.startsWith(query) && !bLower.startsWith(query)) return -1;
        if (bLower.startsWith(query) && !aLower.startsWith(query)) return 1;
        
        // Shorter strings first (more specific)
        return a.length - b.length;
      })
      .slice(0, limit);

    return sortedSuggestions;

  } catch (error) {
    console.error('Error getting card suggestions from listings:', error);
    return [];
  }
}