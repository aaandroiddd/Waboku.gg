import { useState, useEffect } from 'react';
import { useTrendingSearches } from '@/hooks/useTrendingSearches';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { Loader2, TrendingUp, RefreshCw } from 'lucide-react';
import { motion } from "framer-motion";
import Link from 'next/link';

const itemVariants = {
  initial: { opacity: 0, x: -20 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: [0.23, 1, 0.32, 1],
    },
  }),
  exit: { 
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
      ease: [0.23, 1, 0.32, 1],
    },
  },
};

export function TrendingSearches() {
  const { trendingSearches, loading, error, refreshTrending } = useTrendingSearches();
  const router = useRouter();
  const [refreshAttempt, setRefreshAttempt] = useState(0);

  const handleSearchClick = (term: string) => {
    router.push({
      pathname: '/listings',
      query: { query: term }
    });
  };

  const handleRefresh = async () => {
    setRefreshAttempt(prev => prev + 1);
    try {
      await refreshTrending();
    } catch (err) {
      console.error('Error refreshing trending searches:', err);
    }
  };
  
  // Auto-retry on error, but only once
  useEffect(() => {
    if (error && refreshAttempt < 1) {
      const timer = setTimeout(() => {
        console.log('Auto-retrying trending searches fetch due to error');
        handleRefresh();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [error, refreshAttempt]);

  // Common container with fixed height to prevent layout shifts
  return (
    <div className="min-h-[48px] flex items-center">
      {loading ? (
        <motion.div 
          className="flex items-center gap-2 text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading trending searches...</span>
        </motion.div>
      ) : error || !trendingSearches.length ? (
        <motion.div 
          className="flex items-center gap-2 text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm">Start searching to see trends</span>
        </motion.div>
      ) : (
        <motion.div 
          className="flex flex-wrap gap-2 items-center w-full"
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <div className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Trending:</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {trendingSearches.slice(0, 3).map((search, index) => (
            <motion.div
              key={search.term}
              custom={index}
              variants={itemVariants}
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

          {trendingSearches.length > 3 && (
            <motion.div
              variants={itemVariants}
              custom={3}
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
        </motion.div>
      )}
    </div>
  );
}