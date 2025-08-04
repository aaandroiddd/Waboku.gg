interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface SubscriptionHistoryData {
  events: any[];
  paymentMethods: any[];
  hasMore?: boolean;
  lastEventId?: string;
  totalPages?: number;
  currentPage?: number;
}

interface PaginatedCacheKey {
  userId: string;
  page: number;
  limit: number;
}

class SubscriptionHistoryCache {
  private cache = new Map<string, CacheEntry<SubscriptionHistoryData>>();
  private paginatedCache = new Map<string, CacheEntry<SubscriptionHistoryData>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private generatePaginatedKey(userId: string, page: number, limit: number): string {
    return `${userId}_p${page}_l${limit}`;
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

  getPaginated(userId: string, page: number, limit: number): SubscriptionHistoryData | null {
    const key = this.generatePaginatedKey(userId, page, limit);
    const entry = this.paginatedCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (this.isExpired(entry)) {
      this.paginatedCache.delete(key);
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

  setPaginated(userId: string, page: number, limit: number, data: SubscriptionHistoryData, ttl?: number): void {
    const key = this.generatePaginatedKey(userId, page, limit);
    const entry: CacheEntry<SubscriptionHistoryData> = {
      data: {
        ...data,
        currentPage: page
      },
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    };
    
    this.paginatedCache.set(key, entry);
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
    
    // Also invalidate all paginated entries for this user
    for (const key of this.paginatedCache.keys()) {
      if (key.startsWith(`${userId}_`)) {
        this.paginatedCache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.paginatedCache.clear();
  }

  // Clean up expired entries periodically
  cleanup(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
    
    for (const [key, entry] of this.paginatedCache.entries()) {
      if (this.isExpired(entry)) {
        this.paginatedCache.delete(key);
      }
    }
  }

  // Get cache stats for monitoring
  getStats() {
    return {
      size: this.cache.size + this.paginatedCache.size,
      basicCacheSize: this.cache.size,
      paginatedCacheSize: this.paginatedCache.size,
      entries: Array.from(this.cache.keys()),
      paginatedEntries: Array.from(this.paginatedCache.keys())
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