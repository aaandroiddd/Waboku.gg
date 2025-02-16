import { useTrendingSearches } from '@/hooks/useTrendingSearches';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { Loader2, TrendingUp, RefreshCw } from 'lucide-react';

export function TrendingSearches() {
  const { trendingSearches, loading, error, refreshTrending } = useTrendingSearches();
  const router = useRouter();

  const handleSearchClick = (term: string) => {
    router.push({
      pathname: '/listings',
      query: { query: term }
    });
  };

  const handleRefresh = async () => {
    await refreshTrending();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading trending searches...</span>
      </div>
    );
  }

  if (error || !trendingSearches.length) {
    return (
      <div className="flex items-center gap-2 py-2 text-muted-foreground">
        <TrendingUp className="h-4 w-4" />
        <span className="text-sm">Start searching to see trends</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 items-center py-2">
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
      {trendingSearches.slice(0, 5).map((search, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          className="text-sm hover:bg-accent"
          onClick={() => handleSearchClick(search.term)}
        >
          {search.term}
        </Button>
      ))}
    </div>
  );
}