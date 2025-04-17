import { useState, useEffect } from 'react';
import { Review, ReviewFilterOptions } from '@/types/review';
import { ReviewCard } from '@/components/ReviewCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Star } from 'lucide-react';
import { useReviews } from '@/hooks/useReviews';

interface ReviewsListProps {
  sellerId?: string;
  listingId?: string;
  reviewerId?: string;
  initialReviews?: Review[];
  showFilters?: boolean;
}

export function ReviewsList({ 
  sellerId, 
  listingId,
  reviewerId,
  initialReviews = [], 
  showFilters = true 
}: ReviewsListProps) {
  const { 
    loading, 
    error, 
    fetchSellerReviews, 
    fetchProductReviews,
    fetchUserReviews,
    totalReviews,
    reviewStats
  } = useReviews();
  
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  
  // Fetch reviews on component mount and when filters change
  useEffect(() => {
    const fetchReviews = async () => {
      let filterOptions: ReviewFilterOptions = {
        sortBy: sortBy as any
      };
      
      // Add rating filter if a specific rating tab is selected
      if (activeTab !== 'all') {
        filterOptions.rating = parseInt(activeTab);
      }
      
      console.log('ReviewsList: Fetching reviews with params:', { 
        sellerId, 
        listingId, 
        reviewerId, 
        filterOptions 
      });
      
      let result;
      if (sellerId) {
        console.log('ReviewsList: Fetching seller reviews for:', sellerId);
        result = await fetchSellerReviews(sellerId, 1, 10, filterOptions);
      } else if (listingId) {
        console.log('ReviewsList: Fetching product reviews for:', listingId);
        result = await fetchProductReviews(listingId, 1, 10, filterOptions);
      } else if (reviewerId) {
        console.log('ReviewsList: Fetching reviewer reviews for:', reviewerId);
        result = await fetchUserReviews(reviewerId, 1, 10, filterOptions);
      }
      
      if (result) {
        console.log('ReviewsList: Received reviews:', result.reviews.length, 'of', result.total);
        setReviews(result.reviews);
        setPage(1);
        setHasMore(result.reviews.length < (result.total || 0));
      } else {
        console.log('ReviewsList: No result returned from fetch');
      }
    };
    
    fetchReviews();
  }, [sellerId, listingId, reviewerId, activeTab, sortBy, fetchSellerReviews, fetchProductReviews, fetchUserReviews]);
  
  // Load more reviews
  const loadMore = async () => {
    if (loading || !hasMore) return;
    
    const nextPage = page + 1;
    
    let filterOptions: ReviewFilterOptions = {
      sortBy: sortBy as any
    };
    
    if (activeTab !== 'all') {
      filterOptions.rating = parseInt(activeTab);
    }
    
    let result;
    if (sellerId) {
      result = await fetchSellerReviews(sellerId, nextPage, 10, filterOptions);
    } else if (listingId) {
      result = await fetchProductReviews(listingId, nextPage, 10, filterOptions);
    } else if (reviewerId) {
      result = await fetchUserReviews(reviewerId, nextPage, 10, filterOptions);
    }
    
    if (result) {
      setReviews([...reviews, ...result.reviews]);
      setPage(nextPage);
      setHasMore(reviews.length + result.reviews.length < (result.total || 0));
    }
  };
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  // Handle sort change
  const handleSortChange = (value: string) => {
    setSortBy(value);
  };
  
  // Calculate rating counts for tabs
  const getRatingCount = (rating: number) => {
    if (!reviewStats) return 0;
    return reviewStats.ratingCounts[rating] || 0;
  };
  
  if (error) {
    return <div className="text-center text-red-500 my-4">{error}</div>;
  }
  
  return (
    <div className="space-y-6">
      {showFilters && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="text-lg font-semibold">
              {totalReviews} {totalReviews === 1 ? 'Review' : 'Reviews'}
            </h3>
            
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="highest_rating">Highest Rating</SelectItem>
                <SelectItem value="lowest_rating">Lowest Rating</SelectItem>
                <SelectItem value="most_helpful">Most Helpful</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid grid-cols-3 sm:grid-cols-6">
              <TabsTrigger value="all">All</TabsTrigger>
              {[5, 4, 3, 2, 1].map((rating) => (
                <TabsTrigger key={rating} value={rating.toString()} className="flex items-center gap-1">
                  {rating} <Star className="h-3 w-3" />
                  {reviewStats && <span className="text-xs">({getRatingCount(rating)})</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}
      
      {loading && reviews.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No reviews yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          
          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button 
                variant="outline" 
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More Reviews'
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}