import { useCallback, useRef } from 'react';

interface SearchSession {
  sessionId: string;
  lastSearchTerm: string;
  lastSearchTime: number;
  searchCount: number;
}

export function useSearchAnalytics() {
  const sessionRef = useRef<SearchSession>({
    sessionId: Math.random().toString(36).substring(2, 15),
    lastSearchTerm: '',
    lastSearchTime: 0,
    searchCount: 0
  });

  const trackSearchClick = useCallback(async (
    searchTerm: string,
    listingId: string,
    listingTitle: string,
    resultPosition: number,
    userLocation?: string
  ) => {
    try {
      await fetch('/api/analytics/track-search-click', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchTerm,
          listingId,
          listingTitle,
          resultPosition,
          userLocation,
          sessionId: sessionRef.current.sessionId
        }),
      });
    } catch (error) {
      console.error('Error tracking search click:', error);
    }
  }, []);

  const trackSearchRefinement = useCallback(async (
    originalTerm: string,
    refinedTerm: string,
    resultCount: number
  ) => {
    try {
      const session = sessionRef.current;
      const timeBetween = Date.now() - session.lastSearchTime;

      await fetch('/api/analytics/track-search-refinement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalTerm,
          refinedTerm,
          timeBetween,
          resultCount,
          sessionId: session.sessionId
        }),
      });

      // Update session
      session.lastSearchTerm = refinedTerm;
      session.lastSearchTime = Date.now();
      session.searchCount += 1;
    } catch (error) {
      console.error('Error tracking search refinement:', error);
    }
  }, []);

  const updateSearchSession = useCallback((searchTerm: string, resultCount: number) => {
    const session = sessionRef.current;
    const now = Date.now();

    // Track refinement if this is a modification of the previous search
    if (session.lastSearchTerm && 
        session.lastSearchTerm !== searchTerm && 
        (now - session.lastSearchTime) < 60000) { // Within 1 minute
      trackSearchRefinement(session.lastSearchTerm, searchTerm, resultCount);
    }

    // Update session
    session.lastSearchTerm = searchTerm;
    session.lastSearchTime = now;
    session.searchCount += 1;
  }, [trackSearchRefinement]);

  const getSessionId = useCallback(() => {
    return sessionRef.current.sessionId;
  }, []);

  return {
    trackSearchClick,
    trackSearchRefinement,
    updateSearchSession,
    getSessionId
  };
}