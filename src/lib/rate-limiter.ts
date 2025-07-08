import { NextApiRequest } from 'next';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configurations
const RATE_LIMITS = {
  // API endpoint limits (requests per minute)
  '/api/offers/create': { limit: 5, window: 60000 }, // 5 offers per minute
  '/api/reviews/create': { limit: 3, window: 60000 }, // 3 reviews per minute
  '/api/messages/send': { limit: 20, window: 60000 }, // 20 messages per minute
  '/api/listings/create': { limit: 10, window: 60000 }, // 10 listings per minute
  '/api/notifications/create': { limit: 50, window: 60000 }, // 50 notifications per minute
  
  // Authentication limits (per hour)
  '/api/auth/sign-in': { limit: 10, window: 3600000 }, // 10 sign-in attempts per hour
  '/api/auth/sign-up': { limit: 5, window: 3600000 }, // 5 sign-up attempts per hour
  
  // General API limit (per minute)
  'default': { limit: 100, window: 60000 } // 100 requests per minute
};

/**
 * Get client identifier for rate limiting
 */
function getClientId(req: NextApiRequest): string {
  // Try to get user ID from auth token first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      // In a real implementation, you'd decode the JWT to get user ID
      // For now, we'll use IP + User-Agent as fallback
      const userAgent = req.headers['user-agent'] || '';
      const forwarded = req.headers['x-forwarded-for'];
      const ip = forwarded ? (forwarded as string).split(',')[0] : req.connection?.remoteAddress;
      return `${ip}-${userAgent.substring(0, 50)}`;
    } catch (error) {
      // Fall back to IP-based identification
    }
  }
  
  // Use IP address as identifier
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? (forwarded as string).split(',')[0] : req.connection?.remoteAddress || 'unknown';
  return ip;
}

/**
 * Get rate limit configuration for an endpoint
 */
function getRateLimitConfig(endpoint: string) {
  return RATE_LIMITS[endpoint] || RATE_LIMITS.default;
}

/**
 * Clean up expired entries from the rate limit store
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(req: NextApiRequest, endpoint?: string): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
} {
  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    cleanupExpiredEntries();
  }
  
  const clientId = getClientId(req);
  const actualEndpoint = endpoint || req.url || 'default';
  const config = getRateLimitConfig(actualEndpoint);
  const key = `${clientId}:${actualEndpoint}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    entry = {
      count: 1,
      resetTime: now + config.window
    };
    rateLimitStore.set(key, entry);
    
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetTime: entry.resetTime
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }
  
  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Middleware function to apply rate limiting to API routes
 */
export function withRateLimit(handler: Function, endpoint?: string) {
  return async (req: NextApiRequest, res: any) => {
    const rateLimitResult = checkRateLimit(req, endpoint);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimitResult.limit);
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000));
    
    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter
      });
    }
    
    return handler(req, res);
  };
}

/**
 * Enhanced rate limiter for sensitive operations
 */
export function checkSensitiveOperationLimit(
  req: NextApiRequest, 
  operation: string,
  customLimit?: { limit: number; window: number }
): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
} {
  const clientId = getClientId(req);
  const config = customLimit || { limit: 3, window: 300000 }; // 3 operations per 5 minutes by default
  const key = `sensitive:${clientId}:${operation}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 1,
      resetTime: now + config.window
    };
    rateLimitStore.set(key, entry);
    
    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetTime: entry.resetTime
    };
  }
  
  if (entry.count >= config.limit) {
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }
  
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime
  };
}