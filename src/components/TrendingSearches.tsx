import { useState, useEffect, useCallback } from 'react';
import { useTrendingSearches } from '@/hooks/useTrendingSearches';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { Loader2, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FirebaseErrorBoundary } from '@/components/FirebaseErrorBoundary';

const itemVariants = {
  initial: { opacity: 0, x: -10 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05, // Reduced delay between items
      duration: 0.3,   // Slightly faster animation
      ease: "easeOut", // Simpler easing function
    },
  }),
  exit: { 
    opacity: 0,
    x: -10,           // Reduced movement distance
    transition: {
      duration: 0.2,
      ease: "easeIn", // Simpler easing function
    },
  },
};

// The main component that will be wrapped with error boundary
function TrendingSearchesContent() {
  const { trendingSearches, loading, error, refreshTrending } = useTrendingSearches();
  const router = useRouter();
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localTrending, setLocalTrending] = useState<Array<{term: string, count: number}>>([]);
  const [fetchFailed, setFetchFailed] = useState(false);
  
  // Use local state as a fallback when API fails
  useEffect(() => {
    if (trendingSearches && trendingSearches.length > 0) {
      setLocalTrending(trendingSearches);
    }
  }, [trendingSearches]);
  
  // Provide some default trending searches as fallback
  const defaultTrending = [
    { term: "Pokemon", count: 10 },
    { term: "Magic", count: 8 },
    { term: "Yu-Gi-Oh", count: 6 }
  ];
  
  // The trending searches to display - use local cache if API fails, or default if nothing available
  const displayTrending = trendingSearches.length > 0 
    ? trendingSearches 
    : localTrending.length > 0 
      ? localTrending 
      : error ? defaultTrending : [];

  const handleSearchClick = useCallback((term: string) => {
    router.push({
      pathname: '/listings',
      query: { query: term }
    });
  }, [router]);

  const handleRefresh = useCallback(async () => {
    setRefreshAttempt(prev => prev + 1);
    setIsRefreshing(true);
    setErrorMessage(null);
    
    try {
      await refreshTrending();
    } catch (err: any) {
      console.error('Error refreshing trending searches:', err);
      setErrorMessage(err?.message || 'Failed to refresh trending searches');
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshTrending]);
  
  // Auto-retry on error, but only once and with a delay
  useEffect(() => {
    if (error && refreshAttempt < 1) {
      const timer = setTimeout(() => {
        console.log('Auto-retrying trending searches fetch due to error');
        handleRefresh();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [error, refreshAttempt, handleRefresh]);
  
  // Disable automatic fetching in development/preview environments
  useEffect(() => {
    // If we're in a preview environment, use default trending data
    if (typeof window !== 'undefined' && window.location.hostname.includes('preview.co.dev')) {
      console.log('Preview environment detected, using default trending data');
      setLocalTrending(defaultTrending);
      setFetchFailed(true); // Prevent API calls in preview environment
    }
  }, [defaultTrending]);
  
  // Log errors for debugging
  useEffect(() => {
    if (error) {
      console.error('TrendingSearches component encountered an error:', error);
      setErrorMessage(error);
      setFetchFailed(true);
    } else {
      setErrorMessage(null);
      setFetchFailed(false);
    }
  }, [error]);
  
  // Handle fetch errors gracefully
  useEffect(() => {
    // If we have local trending data but the fetch failed, use the local data
    if (fetchFailed && localTrending.length > 0) {
      console.log('Using cached trending data due to fetch failure');
    }
    // If we have no data at all, use default trending
    else if (fetchFailed && trendingSearches.length === 0 && localTrending.length === 0) {
      console.log('Using default trending data due to fetch failure');
    }
  }, [fetchFailed, localTrending.length, trendingSearches.length]);

  // Common container with fixed height to prevent layout shifts
  return (
    <div className="min-h-[48px] flex items-center">
      <AnimatePresence mode="wait">
        {loading && !trendingSearches.length ? (
          <motion.div 
            key="loading"
            className="flex items-center gap-2 text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ willChange: "opacity" }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading trending searches...</span>
          </motion.div>
        ) : (!displayTrending.length) ? (
          <motion.div 
            key="empty-state"
            className="flex items-center gap-2 text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ willChange: "opacity" }}
          >
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Start searching to see trending results</span>
          </motion.div>
        ) : (
          <motion.div 
            key="content"
            className="flex flex-wrap gap-2 items-center w-full"
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ willChange: "transform, opacity" }}
          >
            <div className="flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Trending:</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh trending searches</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              {(error || errorMessage) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Using cached data. Refresh to try again.</p>
                      {errorMessage && (
                        <p className="text-xs text-muted-foreground mt-1">{errorMessage}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            <AnimatePresence>
              {displayTrending.slice(0, 3).map((search, index) => (
                <motion.div
                  key={search.term}
                  custom={index}
                  variants={itemVariants}
                  style={{ willChange: "transform, opacity" }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sm hover:bg-accent"
                    onClick={() => handleSearchClick(search.term)}
                  >
                    {search.term}
                  </Button>
                </motion.div>
              ))}

              {displayTrending.length > 3 && (
                <motion.div
                  key="more-link"
                  variants={itemVariants}
                  custom={3}
                  style={{ willChange: "transform, opacity" }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-sm hover:bg-accent"
                    asChild
                  >
                    <Link href="/trending">...more</Link>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Export the component wrapped with error boundary
export function TrendingSearches() {
  return (
    <FirebaseErrorBoundary>
      <TrendingSearchesContent />
    </FirebaseErrorBoundary>
  );
}