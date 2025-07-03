import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardPreloader, DashboardData, DashboardLoadingState } from '@/lib/dashboard-preloader';

export function useDashboardPreloader() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<DashboardLoadingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize dashboard data
  const initializeDashboard = useCallback(async (forceRefresh: boolean = false) => {
    if (!user) return;

    try {
      setError(null);
      
      // Check if we have cached data first
      const cachedData = dashboardPreloader.getCachedData(user.uid);
      const cachedLoading = dashboardPreloader.getLoadingState(user.uid);
      
      if (cachedData && cachedLoading && !forceRefresh) {
        setData(cachedData);
        setLoading(cachedLoading);
        setIsInitialized(true);
        return;
      }

      // Start preloading
      const dashboardData = await dashboardPreloader.preloadDashboard(user, forceRefresh);
      const loadingState = dashboardPreloader.getLoadingState(user.uid);
      
      setData(dashboardData);
      setLoading(loadingState);
      setIsInitialized(true);
    } catch (err) {
      console.error('Failed to initialize dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setIsInitialized(true);
    }
  }, [user]);

  // Refresh specific section
  const refreshSection = useCallback(async (section: keyof DashboardData) => {
    if (!user) return;

    try {
      await dashboardPreloader.refreshSection(user, section);
    } catch (err) {
      console.error(`Failed to refresh ${section}:`, err);
      setError(err instanceof Error ? err.message : `Failed to refresh ${section}`);
    }
  }, [user]);

  // Force refresh all data
  const forceRefresh = useCallback(() => {
    initializeDashboard(true);
  }, [initializeDashboard]);

  // Clear cache
  const clearCache = useCallback(() => {
    if (!user) return;
    dashboardPreloader.clearCache(user.uid);
    setData(null);
    setLoading(null);
    setIsInitialized(false);
  }, [user]);

  // Subscribe to updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = dashboardPreloader.subscribe(user.uid, (newData, newLoading) => {
      setData(newData);
      setLoading(newLoading);
    });

    return unsubscribe;
  }, [user]);

  // Initialize on mount or user change
  useEffect(() => {
    if (user && !isInitialized) {
      initializeDashboard();
    } else if (!user) {
      setData(null);
      setLoading(null);
      setIsInitialized(false);
      setError(null);
    }
  }, [user, isInitialized, initializeDashboard]);

  // Handle page refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save current state to sessionStorage for recovery after refresh
      if (user && data) {
        sessionStorage.setItem(`dashboard_state_${user.uid}`, JSON.stringify({
          data,
          loading,
          timestamp: Date.now()
        }));
      }
    };

    const handleLoad = () => {
      // Check if we're recovering from a page refresh
      if (user) {
        const savedState = sessionStorage.getItem(`dashboard_state_${user.uid}`);
        if (savedState) {
          try {
            const parsed = JSON.parse(savedState);
            const age = Date.now() - parsed.timestamp;
            
            // If state is less than 1 minute old, use it temporarily while refreshing
            if (age < 60000) {
              setData(parsed.data);
              setLoading(parsed.loading);
              setIsInitialized(true);
              
              // Then refresh in the background
              setTimeout(() => {
                initializeDashboard(true);
              }, 100);
            }
          } catch (err) {
            console.warn('Failed to restore dashboard state:', err);
          }
          
          // Clean up
          sessionStorage.removeItem(`dashboard_state_${user.uid}`);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Check if we just loaded the page
    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('load', handleLoad);
    };
  }, [user, data, loading, initializeDashboard]);

  return {
    data,
    loading,
    error,
    isInitialized,
    refreshSection,
    forceRefresh,
    clearCache,
    // Helper functions to get specific data
    getListings: () => data?.listings || [],
    getOffers: () => data?.offers || [],
    getOrders: () => data?.orders || [],
    getMessages: () => data?.messages || [],
    getNotifications: () => data?.notifications || [],
    getWantedPosts: () => data?.wantedPosts || [],
    getReviews: () => data?.reviews || [],
    getFavorites: () => data?.favorites || [],
    // Loading states for specific sections
    isLoadingListings: () => loading?.listings || false,
    isLoadingOffers: () => loading?.offers || false,
    isLoadingOrders: () => loading?.orders || false,
    isLoadingMessages: () => loading?.messages || false,
    isLoadingNotifications: () => loading?.notifications || false,
    isLoadingWantedPosts: () => loading?.wantedPosts || false,
    isLoadingReviews: () => loading?.reviews || false,
    isLoadingFavorites: () => loading?.favorites || false,
    isLoadingOverall: () => loading?.overall || false
  };
}