import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getWantedPostUrl } from '@/lib/wanted-posts-slug';

interface WantedSuggestion {
  id: string;
  title: string;
  game: string;
  imageUrl?: string;
  type: 'wanted';
  score: number;
  url: string;
}

const CACHE_DURATION_MS = 30 * 1000; // in-memory cache for 30s
let memoryCache: Record<string, WantedSuggestion[]> = {};
let memoryCacheTime: Record<string, number> = {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).slice(2);
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // CDN caching headers
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('CDN-Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  const { q, limit = 8 } = req.query;
  const raw = (q as string) || '';
  const query = raw.toLowerCase().trim();
  const perPage = Math.max(1, Math.min(20, Number(limit) || 8));

  if (!query || query.length < 2) {
    return res.status(200).json([]);
  }

  const cacheKey = `${query}_${perPage}`;
  const now = Date.now();
  try {
    // in-memory cache
    if (memoryCache[cacheKey] && now - (memoryCacheTime[cacheKey] || 0) < CACHE_DURATION_MS) {
      return res.status(200).json(memoryCache[cacheKey]);
    }

    const { database } = getFirebaseAdmin();
    if (!database) {
      console.error('[WantedSuggestions] Firebase Admin RTDB not initialized');
      return res.status(200).json([]);
    }

    // Try preferred and legacy paths
    const paths = ['wantedPosts', 'wanted/posts'];
    const seen = new Set<string>();
    const suggestions: WantedSuggestion[] = [];
    const results: Array<{ path: string; data: Record<string, any> }> = [];

    for (const path of paths) {
      try {
        const snap = await database.ref(path).once('value');
        if (snap.exists()) {
          const data = snap.val();
          if (data && typeof data === 'object') {
            results.push({ path, data });
          }
        }
      } catch (e) {
        console.error(`[WantedSuggestions] Error reading path ${path}:`, e);
      }
    }

    // Score and collect
    for (const { data } of results) {
      for (const [id, value] of Object.entries<any>(data)) {
        if (seen.has(id)) continue;
        const title: string = (value?.title || '').toString();
        const game: string = (value?.game || 'other').toString();
        const description: string = (value?.description || '').toString();
        const cardName: string = (value?.cardName || '').toString();

        const titleLower = title.toLowerCase();
        const descLower = description.toLowerCase();
        const cardLower = cardName.toLowerCase();

        let score = 0;

        // Primary: title
        if (titleLower.includes(query)) {
          score += 100;
          if (titleLower.startsWith(query)) score += 50;

          // word-level exact matches
          const titleWords = titleLower.split(/\s+/);
          const qWords = query.split(/\s+/);
          for (const w of qWords) {
            if (w && titleWords.includes(w)) score += 20;
          }
        }

        // Secondary: cardName
        if (cardLower && cardLower.includes(query)) {
          score += 60;
          if (cardLower.startsWith(query)) score += 20;
        }

        // Tertiary: description
        if (descLower.includes(query)) score += 20;

        if (score <= 0) continue;

        // Recency boost
        const createdAt = value?.createdAt ? Number(value.createdAt) : Date.now();
        const ageDays = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60 * 24));
        if (ageDays < 1) score += 20;
        else if (ageDays < 7) score += 10;

        // Build URL
        const url = getWantedPostUrl({ id, title: title || 'Untitled', game: game || 'other' });

        // Best-effort preview image if available
        const imageUrl = (value && (
          (typeof value.imageUrl === 'string' && value.imageUrl) ||
          (Array.isArray(value.images) && typeof value.images[0] === 'string' && value.images[0]) ||
          (value.images && typeof value.images === 'object' && (value.images['0'] || value.images[0])) ||
          (typeof value.image === 'string' && value.image) ||
          (typeof value.photoUrl === 'string' && value.photoUrl) ||
          (typeof value.userAvatar === 'string' && value.userAvatar)
        )) || undefined;

        suggestions.push({
          id,
          title: title || 'Untitled',
          game: game || 'other',
          imageUrl,
          type: 'wanted',
          score,
          url,
        });

        seen.add(id);
      }
    }

    const sorted = suggestions.sort((a, b) => b.score - a.score).slice(0, perPage);

    // cache
    memoryCache[cacheKey] = sorted;
    memoryCacheTime[cacheKey] = now;

    return res.status(200).json(sorted);
  } catch (err) {
    console.error(`[WantedSuggestions][${requestId}] Error:`, err);
    return res.status(200).json([]);
  }
}