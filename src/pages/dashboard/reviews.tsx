import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MobileSelect } from '@/components/ui/mobile-select';
import { useAuth } from '@/contexts/AuthContext';
import { useReviews } from '@/hooks/useReviews';
import { ReviewCard } from '@/components/ReviewCard';
import { SellerResponseForm } from '@/components/SellerResponseForm';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RatingStars } from '@/components/RatingStars';
import { ReviewsDebugger } from '@/components/ReviewsDebugger';
import { Loader2, Search, Star, MessageSquare } from 'lucide-react';

export default function ReviewsDashboardPage() {
  const { user } = useAuth();
  const { 
    loading, 
    error, 
    sellerReviews, 
    reviewStats, 
    totalReviews,
    fetchSellerReviews 
  } = useReviews();
  
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredReviews, setFilteredReviews] = useState(sellerReviews);
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  
  // Fetch reviews when component mounts - only get reviews where the user is the seller
  useEffect(() => {
    if (user) {
      console.log('[ReviewsDashboard] Fetching seller reviews for user:', user.uid);
      fetchSellerReviews(user.uid);
    }
  }, [user, fetchSellerReviews]);
  
  // Filter reviews when sellerReviews, activeTab, or searchTerm changes
  useEffect(() => {
    if (!sellerReviews) return;
    
    let filtered = [...sellerReviews];
    
    // Filter by rating
    if (activeTab !== 'all') {
      filtered = filtered.filter(review => review.rating === parseInt(activeTab));
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(review => 
        review.comment.toLowerCase().includes(term) || 
        (review.title && review.title.toLowerCase().includes(term))
      );
    }
    
    // Sort reviews
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'highest_rating':
          return b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'lowest_rating':
          return a.rating - b.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'most_helpful':
          return (b.helpfulCount || 0) - (a.helpfulCount || 0);
        case 'needs_response':
          return (a.sellerResponse ? 1 : 0) - (b.sellerResponse ? 1 : 0);
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    
    setFilteredReviews(filtered);
  }, [sellerReviews, activeTab, searchTerm, sortBy]);
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };
  
  // Handle sort change
  const handleSortChange = (value: string) => {
    setSortBy(value);
  };
  
  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle response to review
  const handleRespondToReview = (reviewId: string) => {
    setSelectedReview(reviewId);
    setShowResponseDialog(true);
  };
  
  // Handle response success
  const handleResponseSuccess = () => {
    setShowResponseDialog(false);
    setSelectedReview(null);
    
    // Refresh reviews
    if (user) {
      fetchSellerReviews(user.uid);
    }
  };
  
  // Calculate rating counts for tabs
  const getRatingCount = (rating: number) => {
    if (!reviewStats) return 0;
    return reviewStats.ratingCounts[rating] || 0;
  };
  
  // Count reviews that need a response
  const needsResponseCount = sellerReviews.filter(review => !review.sellerResponse).length;
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reviews Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and respond to reviews from your customers
          </p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalReviews || 0}</div>
              <p className="text-xs text-muted-foreground">
                Lifetime reviews received
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <RatingStars rating={reviewStats?.averageRating || 0} size="sm" showEmpty={false} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {reviewStats?.averageRating ? reviewStats.averageRating.toFixed(1) : '0.0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Out of 5 stars
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">5-Star Reviews</CardTitle>
              <RatingStars rating={5} size="sm" showEmpty={false} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getRatingCount(5)}</div>
              <p className="text-xs text-muted-foreground">
                {reviewStats?.totalReviews ? 
                  `${Math.round((getRatingCount(5) / reviewStats.totalReviews) * 100)}% of total` : 
                  '0% of total'}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs Response</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{needsResponseCount}</div>
              <p className="text-xs text-muted-foreground">
                Reviews without your response
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Debug Component - Remove after fixing */}
        {process.env.NODE_ENV === 'development' && (
          <ReviewsDebugger />
        )}
        
        {/* Reviews List */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Reviews</CardTitle>
            <CardDescription>
              View and respond to reviews from your customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search reviews..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={handleSearch}
                  />
                </div>
                
                <MobileSelect
                  value={sortBy}
                  onValueChange={handleSortChange}
                  placeholder="Sort by"
                  className="w-full sm:w-[200px]"
                  options={[
                    { value: 'newest', label: 'Newest First' },
                    { value: 'oldest', label: 'Oldest First' },
                    { value: 'highest_rating', label: 'Highest Rating' },
                    { value: 'lowest_rating', label: 'Lowest Rating' },
                    { value: 'most_helpful', label: 'Most Helpful' },
                    { value: 'needs_response', label: 'Needs Response' }
                  ]}
                />
              </div>
              
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid grid-cols-3 sm:grid-cols-6">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <TabsTrigger key={rating} value={rating.toString()} className="flex items-center gap-1">
                      {rating} <Star className="h-3 w-3" />
                      <span className="text-xs">({getRatingCount(rating)})</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              
              {/* Reviews */}
              {loading && filteredReviews.length === 0 ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredReviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No reviews found</p>
                </div>
              ) : (
                <div className="space-y-4 mt-6">
                  {filteredReviews.map((review) => (
                    <div key={review.id} className="space-y-2">
                      <ReviewCard review={review} />
                      
                      {!review.sellerResponse && (
                        <div className="flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleRespondToReview(review.id)}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Respond to Review
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Response Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Respond to Review</DialogTitle>
            <DialogDescription>
              Your response will be publicly visible alongside the customer's review.
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <SellerResponseForm 
              reviewId={selectedReview}
              onSuccess={handleResponseSuccess}
              onCancel={() => setShowResponseDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}