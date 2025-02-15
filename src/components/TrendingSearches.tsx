import { useTrendingSearches } from '@/hooks/useTrendingSearches';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/router';
import { Loader2 } from 'lucide-react';

export function TrendingSearches() {
  const { trendingSearches, loading, error } = useTrendingSearches();
  const router = useRouter();

  const handleSearchClick = (term: string) => {
    router.push({
      pathname: '/listings',
      query: { query: term }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (error || !trendingSearches.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center items-center">
      <span className="text-sm text-muted-foreground">Trending:</span>
      {trendingSearches.slice(0, 5).map((search, index) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          className="text-sm"
          onClick={() => handleSearchClick(search.term)}
        >
          {search.term}
        </Button>
      ))}
    </div>
  );
}