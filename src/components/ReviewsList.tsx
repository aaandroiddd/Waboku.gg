import { useState, useEffect } from 'react';
import { Review, ReviewFilterOptions } from '@/types/review';
import { ReviewCard } from '@/components/ReviewCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Star } from 'lucide-react';
import { useReviews } from '@/hooks/useReviews';
import { prefetchUserData } from '@/hooks/useUserData';

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
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Fetch reviews on component mount and when filters change
  useEffect(() => {
    const fetchReviews = async () => {
      setFetchError(null);
      
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
      
      try {
        let result;
        if (sellerId) {
          console.log('ReviewsList: Fetching seller reviews for:', sellerId);
          // Explicitly set role to 'seller' to get reviews received by this seller
          // The sellerId field represents the owner of the listing who should see reviews on their dashboard
          filterOptions.role = 'seller';
          result = await fetchSellerReviews(sellerId, 1, 10, filterOptions);
        } else if (listingId) {
          console.log('ReviewsList: Fetching product reviews for:', listingId);
          result = await fetchProductReviews(listingId, 1, 10, filterOptions);
        } else if (reviewerId) {
          console.log('ReviewsList: Fetching reviewer reviews for:', reviewerId);
          // IMPORTANT: Explicitly set role to 'reviewer' to get reviews written by this user
          // The reviewerId field represents the buyer who wrote the review
          filterOptions.role = 'reviewer';
          result = await fetchUserReviews(reviewerId, 1, 10, filterOptions);
        }
        
        if (result) {
          console.log('ReviewsList: Received reviews:', result.reviews.length, 'of', result.total);
          
          // Prefetch user data for all reviewers
          if (result.reviews.length > 0) {
            const reviewerIds = result.reviews.map(review => review.reviewerId).filter(Boolean);
            if (reviewerIds.length > 0) {
              prefetchUserData(reviewerIds);
            }
          }
          
          setReviews(result.reviews);
          setPage(1);
          setHasMore(result.reviews.length < (result.total || 0));
        } else {
          console.log('ReviewsList: No result returned from fetch');
          setReviews([]);
          setHasMore(false);
        }
      } catch (err) {
        console.error('ReviewsList: Error fetching reviews:', err);
        setFetchError(err instanceof Error ? err.message : 'Failed to fetch reviews');
        setReviews([]);
        setHasMore(false);
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
    
    try {
      let result;
      if (sellerId) {
        // Explicitly set role to 'seller' to get reviews received by this seller
        // The sellerId field represents the owner of the listing who should see reviews on their dashboard
        filterOptions.role = 'seller';
        result = await fetchSellerReviews(sellerId, nextPage, 10, filterOptions);
      } else if (listingId) {
        result = await fetchProductReviews(listingId, nextPage, 10, filterOptions);
      } else if (reviewerId) {
        // IMPORTANT: Explicitly set role to 'reviewer' to get reviews written by this user
        // The reviewerId field represents the buyer who wrote the review
        filterOptions.role = 'reviewer';
        result = await fetchUserReviews(reviewerId, nextPage, 10, filterOptions);
      }
      
      if (result) {
        // Prefetch user data for all new reviewers
        if (result.reviews.length > 0) {
          const reviewerIds = result.reviews.map(review => review.reviewerId).filter(Boolean);
          if (reviewerIds.length > 0) {
            prefetchUserData(reviewerIds);
          }
        }
        
        setReviews([...reviews, ...result.reviews]);
        setPage(nextPage);
        setHasMore(reviews.length + result.reviews.length < (result.total || 0));
      }
    } catch (err) {
      console.error('ReviewsList: Error loading more reviews:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load more reviews');
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
  
  if (error || fetchError) {
    return (
      <div className="text-center text-red-500 my-4 p-4 border border-red-200 rounded-md bg-red-50 dark:bg-red-900/20 dark:border-red-800">
        {error || fetchError}
      </div>
    );
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
          {process.env.NEXT_PUBLIC_CO_DEV_ENV && (
            <div className="mt-4 text-xs text-muted-foreground">
              <p>Debug info: Attempted to fetch reviews for:</p>
              {sellerId && <p>Seller ID: {sellerId}</p>}
              {listingId && <p>Listing ID: {listingId}</p>}
              {reviewerId && <p>Reviewer ID: {reviewerId}</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {process.env.NEXT_PUBLIC_CO_DEV_ENV && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded mb-4">
              <p>Debug info: Found {reviews.length} reviews</p>
              <p>First review: {reviews[0]?.id} - Rating: {reviews[0]?.rating} - Comment: {reviews[0]?.comment?.substring(0, 50)}{reviews[0]?.comment?.length > 50 ? '...' : ''}</p>
            </div>
          )}
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