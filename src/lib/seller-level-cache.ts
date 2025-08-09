import { SellerLevel, SellerLevelData } from '@/types/seller-level';

// In-memory cache for seller level data
class SellerLevelCache {
  private cache = new Map<string, { data: SellerLevelData; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  set(userId: string, data: SellerLevelData): void {
    this.cache.set(userId, {
      data,
      timestamp: Date.now()
    });
  }

  get(userId: string): SellerLevelData | null {
    const cached = this.cache.get(userId);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(userId);
      return null;
    }

    return cached.data;
  }

  delete(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }

  // Get cache stats for debugging
  getStats(): { size: number; entries: Array<{ userId: string; age: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([userId, cached]) => ({
      userId,
      age: now - cached.timestamp
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

export const sellerLevelCache = new SellerLevelCache();