import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from './firebase-admin';
import { NextApiRequest, NextApiResponse } from 'next';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 searches per minute

export async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    // Ensure Firebase Admin is initialized
    await getFirebaseAdmin();
    const database = getDatabase();
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    // Clean up old entries first
    const cleanupRef = database.ref(`rateLimits/${ip}`).orderByChild('timestamp').endAt(windowStart);
    await cleanupRef.once('value', async (snapshot) => {
      if (snapshot.exists()) {
        const updates = {};
        snapshot.forEach((child) => {
          updates[child.key] = null;
        });
        await database.ref(`rateLimits/${ip}`).update(updates);
      }
    });

    // Get current requests in window
    const snapshot = await database
      .ref(`rateLimits/${ip}`)
      .orderByChild('timestamp')
      .startAt(windowStart)
      .once('value');

    const requests = [];
    snapshot.forEach((childSnapshot) => {
      requests.push(childSnapshot.val());
      return false;
    });

    if (requests.length >= MAX_REQUESTS_PER_WINDOW) {
      console.warn(`Rate limit exceeded for IP: ${ip}`);
      return false;
    }

    // Add new request
    const newRequestRef = database.ref(`rateLimits/${ip}`).push();
    await newRequestRef.set({
      timestamp: now
    });

    return true;
  } catch (error) {
    console.error('Rate limit check error:', error);
    // In case of error, allow the request but log it
    return true;
  }
}

// Middleware function for API routes
export function rateLimit(options: {
  limit?: number;
  window?: number;
} = {}) {
  const limit = options.limit || MAX_REQUESTS_PER_WINDOW;
  const window = options.window || RATE_LIMIT_WINDOW;

  return async function rateLimitMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    next?: () => void
  ) {
    try {
      // Get client IP
      const ip = req.headers['x-forwarded-for'] || 
                req.socket.remoteAddress || 
                'unknown';
      
      const ipStr = Array.isArray(ip) ? ip[0] : ip as string;
      
      // Check rate limit
      const allowed = await checkRateLimit(ipStr);
      
      if (!allowed) {
        res.status(429).json({ 
          error: 'Too many requests, please try again later' 
        });
        return;
      }
      
      // Continue to the next middleware or handler
      if (next) {
        next();
      }
      
      return true;
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // In case of error, allow the request but log it
      if (next) {
        next();
      }
      return true;
    }
  };
}