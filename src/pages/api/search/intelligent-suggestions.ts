import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from 'firebase-admin/database';
import { validateSearchTerm } from '@/lib/search-validation';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

interface IntelligentSuggestion {
  text: string;
  type: 'behavioral' | 'refinement' | 'popular' | 'trending';
  score: number;
  metadata?: {
    clickRate?: number;
    avgPosition?: number;
    refinementCount?: number;
    recentPopularity?: number;
  };
}

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache
let cachedSuggestions: { [key: string]: IntelligentSuggestion[] } = {};
let lastCacheTime: { [key: string]: number } = {};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[IntelligentSuggestions] [${requestId}] Request received`);

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
      console.log(`[IntelligentSuggestions] [${requestId}] Returning cached suggestions for: ${query}`);
      return res.status(200).json(cachedSuggestions[cacheKey]);
    }

    await getFirebaseAdmin();
    const database = getDatabase();

    // Gather suggestions from multiple behavioral sources
    const [
      behavioralSuggestions,
      refinementSuggestions,
      popularSuggestions,
      trendingSuggestions
    ] = await Promise.all([
      getBehavioralSuggestions(database, query),
      getRefinementSuggestions(database, query),
      getPopularSuggestions(database, query),
      getTrendingSuggestions(database, query)
    ]);

    // Combine and score all suggestions
    const allSuggestions = [
      ...behavioralSuggestions,
      ...refinementSuggestions,
      ...popularSuggestions,
      ...trendingSuggestions
    ];

    // Remove duplicates and sort by score
    const uniqueSuggestions = deduplicateAndScore(allSuggestions);
    const topSuggestions = uniqueSuggestions.slice(0, Number(limit));

    // Cache results
    cachedSuggestions[cacheKey] = topSuggestions;
    lastCacheTime[cacheKey] = now;

    console.log(`[IntelligentSuggestions] [${requestId}] Generated ${topSuggestions.length} suggestions for: ${query}`);
    res.status(200).json(topSuggestions);
  } catch (error) {
    console.error(`[IntelligentSuggestions] [${requestId}] Error:`, error);
    res.status(200).json([]);
  }
}

async function getBehavioralSuggestions(database: any, query: string): Promise<IntelligentSuggestion[]> {
  try {
    const perfSnapshot = await database.ref('analytics/searchPerformance').once('value');
    const suggestions: IntelligentSuggestion[] = [];

    if (perfSnapshot.exists()) {
      perfSnapshot.forEach((child: any) => {
        const data = child.val();
        if (data.term && data.term.toLowerCase().includes(query)) {
          const clickRate = data.totalClicks / Math.max(1, Object.keys(data.uniqueListings).length);
          const recencyBoost = Math.max(0, 1 - (Date.now() - data.lastUpdated) / (7 * 24 * 60 * 60 * 1000));
          
          suggestions.push({
            text: data.term,
            type: 'behavioral',
            score: (clickRate * 10) + (recencyBoost * 5) + (data.totalClicks * 0.1),
            metadata: {
              clickRate,
              avgPosition: data.avgPosition
            }
          });
        }
        return false;
      });
    }

    return suggestions;
  } catch (error) {
    console.error('Error getting behavioral suggestions:', error);
    return [];
  }
}

async function getRefinementSuggestions(database: any, query: string): Promise<IntelligentSuggestion[]> {
  try {
    const refinementSnapshot = await database.ref('analytics/refinementPatterns').once('value');
    const suggestions: IntelligentSuggestion[] = [];

    if (refinementSnapshot.exists()) {
      refinementSnapshot.forEach((child: any) => {
        const data = child.val();
        if (data.originalTerm && data.originalTerm.toLowerCase().includes(query)) {
          // Suggest the refined term if original matches query
          const recencyBoost = Math.max(0, 1 - (Date.now() - data.lastSeen) / (7 * 24 * 60 * 60 * 1000));
          
          suggestions.push({
            text: data.refinedTerm,
            type: 'refinement',
            score: (data.count * 2) + (recencyBoost * 3),
            metadata: {
              refinementCount: data.count
            }
          });
        }
        return false;
      });
    }

    return suggestions;
  } catch (error) {
    console.error('Error getting refinement suggestions:', error);
    return [];
  }
}

async function getPopularSuggestions(database: any, query: string): Promise<IntelligentSuggestion[]> {
  try {
    const popularSnapshot = await database.ref('analytics/listingPopularity').once('value');
    const suggestions: IntelligentSuggestion[] = [];

    if (popularSnapshot.exists()) {
      popularSnapshot.forEach((child: any) => {
        const data = child.val();
        if (data.title && data.title.toLowerCase().includes(query)) {
          const recencyBoost = Math.max(0, 1 - (Date.now() - data.lastClicked) / (30 * 24 * 60 * 60 * 1000));
          
          suggestions.push({
            text: data.title,
            type: 'popular',
            score: (data.clickCount * 1.5) + (recencyBoost * 2),
            metadata: {
              recentPopularity: data.clickCount
            }
          });
        }
        return false;
      });
    }

    return suggestions;
  } catch (error) {
    console.error('Error getting popular suggestions:', error);
    return [];
  }
}

async function getTrendingSuggestions(database: any, query: string): Promise<IntelligentSuggestion[]> {
  try {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const trendingSnapshot = await database
      .ref('searchTerms')
      .orderByChild('lastUpdated')
      .startAt(sevenDaysAgo)
      .once('value');

    const suggestions: IntelligentSuggestion[] = [];

    if (trendingSnapshot.exists()) {
      trendingSnapshot.forEach((child: any) => {
        const data = child.val();
        if (data.term && data.term.toLowerCase().includes(query) && validateSearchTerm(data.term)) {
          const recencyBoost = Math.max(0, 1 - (Date.now() - data.lastUpdated) / (24 * 60 * 60 * 1000));
          
          suggestions.push({
            text: data.term,
            type: 'trending',
            score: (data.count * 1) + (recencyBoost * 4),
            metadata: {}
          });
        }
        return false;
      });
    }

    return suggestions;
  } catch (error) {
    console.error('Error getting trending suggestions:', error);
    return [];
  }
}

function deduplicateAndScore(suggestions: IntelligentSuggestion[]): IntelligentSuggestion[] {
  const suggestionMap = new Map<string, IntelligentSuggestion>();

  suggestions.forEach(suggestion => {
    const key = suggestion.text.toLowerCase();
    const existing = suggestionMap.get(key);

    if (!existing || suggestion.score > existing.score) {
      suggestionMap.set(key, suggestion);
    }
  });

  return Array.from(suggestionMap.values())
    .sort((a, b) => b.score - a.score);
}