interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface SubscriptionHistoryData {
  events: any[];
  paymentMethods: any[];
}

class SubscriptionHistoryCache {
  private cache = new Map<string, CacheEntry<SubscriptionHistoryData>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  get(userId: string): SubscriptionHistoryData | null {
    const entry = this.cache.get(userId);
    
    if (!entry) {
      return null;
    }
    
    if (this.isExpired(entry)) {
      this.cache.delete(userId);
      return null;
    }
    
    return entry.data;
  }

  set(userId: string, data: SubscriptionHistoryData, ttl?: number): void {
    const entry: CacheEntry<SubscriptionHistoryData> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    };
    
    this.cache.set(userId, entry);
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries periodically
  cleanup(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats for monitoring
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Create a singleton instance
export const subscriptionHistoryCache = new SubscriptionHistoryCache();

// Clean up expired entries every 10 minutes
if (typeof window === 'undefined') {
  setInterval(() => {
    subscriptionHistoryCache.cleanup();
  }, 10 * 60 * 1000);
}