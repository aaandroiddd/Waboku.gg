import React, { createContext, useContext, ReactNode } from 'react';
import { useDashboardPreloader } from '@/hooks/useDashboardPreloader';
import { DashboardData, DashboardLoadingState } from '@/lib/dashboard-preloader';

interface DashboardContextType {
  data: DashboardData | null;
  loading: DashboardLoadingState | null;
  error: string | null;
  isInitialized: boolean;
  refreshSection: (section: keyof DashboardData) => Promise<void>;
  forceRefresh: () => void;
  clearCache: () => void;
  // Helper functions
  getListings: () => any[];
  getOffers: () => any[];
  getOrders: () => any[];
  getMessages: () => any[];
  getNotifications: () => any[];
  getWantedPosts: () => any[];
  getReviews: () => any[];
  getFavorites: () => any[];
  // Loading states
  isLoadingListings: () => boolean;
  isLoadingOffers: () => boolean;
  isLoadingOrders: () => boolean;
  isLoadingMessages: () => boolean;
  isLoadingNotifications: () => boolean;
  isLoadingWantedPosts: () => boolean;
  isLoadingReviews: () => boolean;
  isLoadingFavorites: () => boolean;
  isLoadingOverall: () => boolean;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

interface DashboardProviderProps {
  children: ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps) {
  const dashboardData = useDashboardPreloader();

  return (
    <DashboardContext.Provider value={dashboardData}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}