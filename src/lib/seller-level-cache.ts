import { SellerLevelData } from '@/types/seller-level';

interface CachedSellerLevel {
  data: SellerLevelData;
  timestamp: number;
  expiresAt: number;
}

class SellerLevelCache {
  private cache = new Map<string, CachedSellerLevel>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;

  set(userId: string, data: SellerLevelData): void {
    // Clean up expired entries if cache is getting large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanup();
    }

    const now = Date.now();
    this.cache.set(userId, {
      data,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION
    });
  }

  get(userId: string): SellerLevelData | null {
    const cached = this.cache.get(userId);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(userId);
      return null;
    }

    return cached.data;
  }

  has(userId: string): boolean {
    const cached = this.cache.get(userId);
    
    if (!cached) {
      return false;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(userId);
      return false;
    }

    return true;
  }

  delete(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [userId, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        toDelete.push(userId);
      }
    }

    toDelete.forEach(userId => this.cache.delete(userId));

    // If still too large, remove oldest entries
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
      toRemove.forEach(([userId]) => this.cache.delete(userId));
    }
  }

  // Get cache stats for debugging
  getStats(): { size: number; expired: number } {
    const now = Date.now();
    let expired = 0;

    for (const cached of this.cache.values()) {
      if (now > cached.expiresAt) {
        expired++;
      }
    }

    return {
      size: this.cache.size,
      expired
    };
  }
}

// Export singleton instance
export const sellerLevelCache = new SellerLevelCache();