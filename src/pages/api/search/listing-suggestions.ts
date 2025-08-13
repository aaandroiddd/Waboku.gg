import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

interface ListingSuggestion {
  id: string;
  title: string;
  price: number;
  game: string;
  condition: string;
  city: string;
  state: string;
  imageUrl?: string;
  type: 'listing';
  score: number;
}

const CACHE_DURATION = 30 * 1000; // 30 seconds cache for real-time feel
let cachedSuggestions: { [key: string]: ListingSuggestion[] } = {};
let lastCacheTime: { [key: string]: number } = {};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[ListingSuggestions] [${requestId}] Request received`);

  // CORS headers
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

  const { q, limit = 8 } = req.query;
  const query = (q as string)?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return res.status(200).json([]);
  }

  const cacheKey = `${query}_${limit}`;

  try {
    // Check cache first
    const now = Date.now();
    if (cachedSuggestions[cacheKey] && (now - (lastCacheTime[cacheKey] || 0)) < CACHE_DURATION) {
      console.log(`[ListingSuggestions] [${requestId}] Returning cached suggestions for: ${query}`);
      return res.status(200).json(cachedSuggestions[cacheKey]);
    }

    await getFirebaseAdmin();
    const db = getFirestore();

    // Query active listings that match the search term
    const suggestions = await getListingSuggestions(db, query, Number(limit));

    // Cache results
    cachedSuggestions[cacheKey] = suggestions;
    lastCacheTime[cacheKey] = now;

    console.log(`[ListingSuggestions] [${requestId}] Generated ${suggestions.length} suggestions for: ${query}`);
    res.status(200).json(suggestions);
  } catch (error) {
    console.error(`[ListingSuggestions] [${requestId}] Error:`, error);
    res.status(200).json([]);
  }
}

async function getListingSuggestions(db: any, query: string, limit: number): Promise<ListingSuggestion[]> {
  try {
    const suggestions: ListingSuggestion[] = [];
    const now = new Date();

    // Query listings collection for active listings
    const listingsRef = db.collection('listings');
    
    // Create multiple queries to search different fields
    const queries = [
      // Search by title (most important)
      listingsRef
        .where('status', '==', 'active')
        .where('expiresAt', '>', now)
        .orderBy('expiresAt')
        .orderBy('createdAt', 'desc')
        .limit(limit * 2), // Get more to filter and rank
    ];

    // Execute all queries in parallel
    const queryPromises = queries.map(q => q.get());
    const querySnapshots = await Promise.all(queryPromises);

    // Process results from all queries
    const seenIds = new Set<string>();
    
    for (const snapshot of querySnapshots) {
      snapshot.forEach((doc: any) => {
        if (seenIds.has(doc.id)) return; // Skip duplicates
        seenIds.add(doc.id);

        const data = doc.data();
        
        // Check if the listing matches our search query
        const title = (data.title || '').toLowerCase();
        const cardName = (data.cardName || '').toLowerCase();
        const game = (data.game || '').toLowerCase();
        const description = (data.description || '').toLowerCase();
        
        // Calculate relevance score
        let score = 0;
        
        // Title matches are most important
        if (title.includes(query)) {
          score += 100;
          // Boost if it starts with the query
          if (title.startsWith(query)) {
            score += 50;
          }
          // Boost for exact word matches
          const titleWords = title.split(/\s+/);
          const queryWords = query.split(/\s+/);
          for (const queryWord of queryWords) {
            if (titleWords.some(titleWord => titleWord === queryWord)) {
              score += 25;
            }
          }
        }
        
        // Card name matches
        if (cardName.includes(query)) {
          score += 80;
          if (cardName.startsWith(query)) {
            score += 30;
          }
        }
        
        // Game matches
        if (game.includes(query)) {
          score += 20;
        }
        
        // Description matches (lower priority)
        if (description.includes(query)) {
          score += 10;
        }
        
        // Only include if there's a match
        if (score > 0) {
          // Boost recent listings
          const createdAt = data.createdAt?.toDate() || new Date();
          const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceCreated < 1) score += 20; // Boost listings from last 24 hours
          else if (daysSinceCreated < 7) score += 10; // Boost listings from last week
          
          // Boost listings with images
          if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
            score += 5;
          }
          
          suggestions.push({
            id: doc.id,
            title: data.title || 'Untitled',
            price: Number(data.price) || 0,
            game: data.game || 'Unknown',
            condition: data.condition || 'Not specified',
            city: data.city || 'Unknown',
            state: data.state || 'Unknown',
            imageUrl: data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0 
              ? data.imageUrls[data.coverImageIndex || 0] || data.imageUrls[0]
              : undefined,
            type: 'listing',
            score
          });
        }
      });
    }

    // Sort by score and return top results
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

  } catch (error) {
    console.error('Error getting listing suggestions:', error);
    return [];
  }
}