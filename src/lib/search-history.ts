/**
 * Search History Manager - Manages user's local search history
 * Stores search history in localStorage with user-specific keys
 */

interface SearchHistoryEntry {
  term: string;
  timestamp: number;
  count: number;
}

const MAX_HISTORY_ITEMS = 20;
const HISTORY_EXPIRY_DAYS = 30;

export class SearchHistoryManager {
  private static instance: SearchHistoryManager;
  
  private constructor() {}
  
  static getInstance(): SearchHistoryManager {
    if (!SearchHistoryManager.instance) {
      SearchHistoryManager.instance = new SearchHistoryManager();
    }
    return SearchHistoryManager.instance;
  }
  
  private getStorageKey(userId?: string): string {
    return userId ? `waboku_search_history_${userId}` : 'waboku_search_history_guest';
  }
  
  /**
   * Add a search term to user's history
   */
  addSearchTerm(term: string, userId?: string): void {
    if (typeof window === 'undefined' || !term.trim()) return;
    
    try {
      const storageKey = this.getStorageKey(userId);
      const history = this.getSearchHistory(userId);
      const normalizedTerm = term.trim().toLowerCase();
      
      // Find existing entry or create new one
      const existingIndex = history.findIndex(entry => 
        entry.term.toLowerCase() === normalizedTerm
      );
      
      if (existingIndex >= 0) {
        // Update existing entry
        history[existingIndex].count += 1;
        history[existingIndex].timestamp = Date.now();
        // Move to front
        const [updatedEntry] = history.splice(existingIndex, 1);
        history.unshift(updatedEntry);
      } else {
        // Add new entry at the front
        history.unshift({
          term: term.trim(),
          timestamp: Date.now(),
          count: 1
        });
      }
      
      // Keep only the most recent items
      const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);
      
      // Remove expired entries
      const cutoffTime = Date.now() - (HISTORY_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const validHistory = trimmedHistory.filter(entry => entry.timestamp > cutoffTime);
      
      localStorage.setItem(storageKey, JSON.stringify(validHistory));
      
      console.log(`[SearchHistory] Added search term: "${term}" for ${userId || 'guest'}`);
    } catch (error) {
      console.error('[SearchHistory] Error adding search term:', error);
    }
  }
  
  /**
   * Get user's search history
   */
  getSearchHistory(userId?: string): SearchHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const storageKey = this.getStorageKey(userId);
      const stored = localStorage.getItem(storageKey);
      
      if (!stored) return [];
      
      const history: SearchHistoryEntry[] = JSON.parse(stored);
      
      // Filter out expired entries
      const cutoffTime = Date.now() - (HISTORY_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const validHistory = history.filter(entry => entry.timestamp > cutoffTime);
      
      // If we filtered out items, update storage
      if (validHistory.length !== history.length) {
        localStorage.setItem(storageKey, JSON.stringify(validHistory));
      }
      
      return validHistory;
    } catch (error) {
      console.error('[SearchHistory] Error getting search history:', error);
      return [];
    }
  }
  
  /**
   * Get search suggestions based on user's history and query
   */
  getHistorySuggestions(query: string, userId?: string, limit: number = 5): SearchHistoryEntry[] {
    if (!query.trim()) return [];
    
    const history = this.getSearchHistory(userId);
    const normalizedQuery = query.toLowerCase();
    
    return history
      .filter(entry => entry.term.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        // Sort by relevance: exact matches first, then by frequency and recency
        const aExact = a.term.toLowerCase().startsWith(normalizedQuery) ? 1 : 0;
        const bExact = b.term.toLowerCase().startsWith(normalizedQuery) ? 1 : 0;
        
        if (aExact !== bExact) return bExact - aExact;
        
        // Then by frequency and recency combined
        const aScore = a.count * 0.7 + (a.timestamp / 1000000) * 0.3;
        const bScore = b.count * 0.7 + (b.timestamp / 1000000) * 0.3;
        
        return bScore - aScore;
      })
      .slice(0, limit);
  }
  
  /**
   * Clear user's search history
   */
  clearSearchHistory(userId?: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const storageKey = this.getStorageKey(userId);
      localStorage.removeItem(storageKey);
      console.log(`[SearchHistory] Cleared search history for ${userId || 'guest'}`);
    } catch (error) {
      console.error('[SearchHistory] Error clearing search history:', error);
    }
  }
  
  /**
   * Get search history statistics
   */
  getHistoryStats(userId?: string): {
    totalSearches: number;
    uniqueTerms: number;
    mostSearchedTerm: string | null;
    oldestSearch: number | null;
    newestSearch: number | null;
  } {
    const history = this.getSearchHistory(userId);
    
    if (history.length === 0) {
      return {
        totalSearches: 0,
        uniqueTerms: 0,
        mostSearchedTerm: null,
        oldestSearch: null,
        newestSearch: null
      };
    }
    
    const totalSearches = history.reduce((sum, entry) => sum + entry.count, 0);
    const uniqueTerms = history.length;
    const mostSearched = history.reduce((max, entry) => 
      entry.count > max.count ? entry : max
    );
    const timestamps = history.map(entry => entry.timestamp);
    
    return {
      totalSearches,
      uniqueTerms,
      mostSearchedTerm: mostSearched.term,
      oldestSearch: Math.min(...timestamps),
      newestSearch: Math.max(...timestamps)
    };
  }
  
  /**
   * Migrate search history when user logs in/out
   */
  migrateSearchHistory(fromUserId?: string, toUserId?: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const fromHistory = this.getSearchHistory(fromUserId);
      const toHistory = this.getSearchHistory(toUserId);
      
      // Merge histories, prioritizing the target user's existing history
      const mergedHistory = [...toHistory];
      
      fromHistory.forEach(fromEntry => {
        const existingIndex = mergedHistory.findIndex(entry => 
          entry.term.toLowerCase() === fromEntry.term.toLowerCase()
        );
        
        if (existingIndex >= 0) {
          // Merge counts and use most recent timestamp
          mergedHistory[existingIndex].count += fromEntry.count;
          mergedHistory[existingIndex].timestamp = Math.max(
            mergedHistory[existingIndex].timestamp,
            fromEntry.timestamp
          );
        } else {
          mergedHistory.push(fromEntry);
        }
      });
      
      // Sort by timestamp and limit
      const sortedHistory = mergedHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_HISTORY_ITEMS);
      
      // Save merged history to target user
      const toStorageKey = this.getStorageKey(toUserId);
      localStorage.setItem(toStorageKey, JSON.stringify(sortedHistory));
      
      // Clear source history if different users
      if (fromUserId !== toUserId) {
        this.clearSearchHistory(fromUserId);
      }
      
      console.log(`[SearchHistory] Migrated search history from ${fromUserId || 'guest'} to ${toUserId || 'guest'}`);
    } catch (error) {
      console.error('[SearchHistory] Error migrating search history:', error);
    }
  }
}

// Export singleton instance
export const searchHistoryManager = SearchHistoryManager.getInstance();

// Utility functions for easy access
export const addSearchTerm = (term: string, userId?: string) => 
  searchHistoryManager.addSearchTerm(term, userId);

export const getSearchHistory = (userId?: string) => 
  searchHistoryManager.getSearchHistory(userId);

export const getHistorySuggestions = (query: string, userId?: string, limit?: number) => 
  searchHistoryManager.getHistorySuggestions(query, userId, limit);

export const clearSearchHistory = (userId?: string) => 
  searchHistoryManager.clearSearchHistory(userId);

export const getHistoryStats = (userId?: string) => 
  searchHistoryManager.getHistoryStats(userId);

export const migrateSearchHistory = (fromUserId?: string, toUserId?: string) => 
  searchHistoryManager.migrateSearchHistory(fromUserId, toUserId);