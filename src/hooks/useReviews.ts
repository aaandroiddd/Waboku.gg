import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Review, ReviewStats, ReviewFilterOptions } from '@/types/review';
import { toast } from 'sonner';
import { 
  fetchReviewsForSeller, 
  fetchReviewsByBuyer, 
  getSellerReviewStats, 
  submitReview as submitReviewService,
  markReviewAsHelpful as markReviewAsHelpfulService,
  addSellerResponse as addSellerResponseService
} from '@/services/reviewService';

export function useReviews() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sellerReviews, setSellerReviews] = useState<Review[]>([]);
  const [productReviews, setProductReviews] = useState<Review[]>([]);
  const [userReviews, setUserReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [totalReviews, setTotalReviews] = useState(0);
  const [averageRating, setAverageRating] = useState(0);

  // Function to fetch reviews for a seller
  const fetchSellerReviews = useCallback(async (
    sellerId: string, 
    page: number = 1, 
    pageSize: number = 10,
    filterOptions: ReviewFilterOptions = {}
  ) => {
    if (!sellerId) {
      console.log('useReviews: No sellerId provided to fetchSellerReviews');
      return;
    }
    
    console.log('useReviews: Fetching seller reviews for:', sellerId, 'with options:', filterOptions);
    setLoading(true);
    setError(null);
    
    try {
      // Use the client-side service to fetch reviews directly from Firestore
      const reviews = await fetchReviewsForSeller(sellerId, pageSize);
      console.log('useReviews: Fetched reviews from Firestore:', reviews.length);
      
      // Get seller stats
      const stats = await getSellerReviewStats(sellerId);
      console.log('useReviews: Fetched seller stats:', stats);
      
      // Log the first review if available for debugging
      if (reviews && reviews.length > 0) {
        console.log('useReviews: First review sample:', {
          id: reviews[0].id,
          sellerId: reviews[0].sellerId,
          reviewerId: reviews[0].reviewerId,
          rating: reviews[0].rating,
          status: reviews[0].status,
          isPublic: reviews[0].isPublic,
          comment: reviews[0].comment?.substring(0, 50) + (reviews[0].comment?.length > 50 ? '...' : '') || 'No comment',
          hasComment: !!reviews[0].comment,
          commentLength: reviews[0].comment?.length || 0
        });
        
        // Ensure all reviews have at least an empty string for comment
        const processedReviews = reviews.map(review => ({
          ...review,
          comment: review.comment || ''
        }));
        
        setSellerReviews(processedReviews);
      } else {
        console.log('useReviews: No reviews returned from Firestore');
        setSellerReviews([]);
      }
      
      setReviewStats(stats || null);
      setTotalReviews(stats?.totalReviews || 0);
      setAverageRating(stats?.averageRating || 0);
      
      return {
        reviews: reviews || [],
        stats: stats,
        total: stats?.totalReviews || 0,
        averageRating: stats?.averageRating || 0
      };
    } catch (error) {
      console.error('useReviews: Error fetching seller reviews:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch reviews');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to fetch reviews for a product
  const fetchProductReviews = useCallback(async (
    listingId: string, 
    page: number = 1, 
    pageSize: number = 10,
    filterOptions: ReviewFilterOptions = {}
  ) => {
    if (!listingId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const params = new URLSearchParams({
        listingId,
        page: page.toString(),
        limit: pageSize.toString(),
      });
      
      // Add filter options if provided
      if (filterOptions.rating) {
        params.append('rating', filterOptions.rating.toString());
      }
      
      if (filterOptions.sortBy) {
        params.append('sortBy', filterOptions.sortBy);
      }
      
      const response = await fetch(`/api/reviews/get-product-reviews?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch reviews');
      }
      
      setProductReviews(data.reviews || []);
      setTotalReviews(data.total || 0);
      setAverageRating(data.averageRating || 0);
      
      return {
        reviews: data.reviews || [],
        total: data.total || 0,
        averageRating: data.averageRating || 0
      };
    } catch (error) {
      console.error('Error fetching product reviews:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch reviews');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to submit a review
  const submitReview = useCallback(async (
    orderId: string,
    rating: number,
    comment: string,
    title?: string,
    images: string[] = []
  ) => {
    if (!user) {
      const errorMsg = 'You must be logged in to submit a review';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }
    
    if (!orderId || !rating) {
      const errorMsg = 'Missing required fields';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Submitting review:', { orderId, rating, title, userId: user.uid });
      
      // First, we need to get the order details to get the sellerId and listingId
      try {
        // Use the client-side service to submit the review
        const reviewData = {
          orderId,
          reviewerId: user.uid,
          sellerId: '', // This will be populated from the order in the service
          listingId: '', // This will be populated from the order in the service
          rating,
          comment,
          title: title || '',
          images: images || []
        };
        
        const reviewId = await submitReviewService(reviewData);
        console.log('Review submitted successfully with ID:', reviewId);
        
        toast.success('Review submitted successfully');
        return reviewId;
      } catch (submitError) {
        console.error('Error during review submission:', submitError);
        throw new Error(submitError instanceof Error ? submitError.message : 'Error submitting review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit review';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Function for a seller to respond to a review
  const respondToReview = useCallback(async (
    reviewId: string,
    comment: string
  ) => {
    if (!user) {
      setError('You must be logged in to respond to a review');
      return false;
    }
    
    if (!reviewId || !comment) {
      setError('Missing required fields');
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Responding to review:', reviewId);
      
      // First try using the client-side service
      try {
        await addSellerResponseService(reviewId, comment);
        console.log('Response added successfully via client-side service');
        toast.success('Response added successfully');
        return true;
      } catch (clientError) {
        console.error('Error with client-side service, trying API endpoint:', clientError);
        
        // If client-side service fails, try the API endpoint
        const response = await fetch('/api/reviews/respond', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reviewId,
            comment,
            userId: user.uid
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to respond to review');
        }
        
        console.log('Response added successfully via API endpoint');
        toast.success('Response added successfully');
        return true;
      }
    } catch (error) {
      console.error('Error responding to review:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to respond to review';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Function to mark a review as helpful
  const markReviewAsHelpful = useCallback(async (
    reviewId: string
  ) => {
    if (!user) {
      setError('You must be logged in to mark a review as helpful');
      return null;
    }
    
    if (!reviewId) {
      setError('Review ID is required');
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Use the client-side service to mark a review as helpful
      try {
        const newCount = await markReviewAsHelpfulService(reviewId);
        toast.success('Review marked as helpful');
        return newCount;
      } catch (serviceError) {
        console.error('Error with client-side service, trying API endpoint:', serviceError);
        
        // If client-side service fails, try the API endpoint
        const response = await fetch('/api/reviews/mark-helpful', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reviewId,
            userId: user.uid
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to mark review as helpful');
        }
        
        toast.success('Review marked as helpful');
        return data.helpfulCount;
      }
    } catch (error) {
      console.error('Error marking review as helpful:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark review as helpful';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Function to fetch reviews written by a user
  const fetchUserReviews = useCallback(async (
    userId: string, 
    page: number = 1, 
    pageSize: number = 10,
    filterOptions: ReviewFilterOptions = {}
  ) => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('useReviews: Fetching user reviews with params:', { 
        userId, 
        page, 
        pageSize, 
        role: filterOptions.role 
      });
      
      let reviews = [];
      
      // Determine which reviews to fetch based on role
      if (filterOptions.role === 'seller') {
        // Get reviews received by this seller
        reviews = await fetchReviewsForSeller(userId, pageSize);
        console.log('useReviews: Fetched seller reviews from Firestore:', reviews.length);
      } else {
        // Default to reviewer role - get reviews written by this buyer
        reviews = await fetchReviewsByBuyer(userId, pageSize);
        console.log('useReviews: Fetched buyer reviews from Firestore:', reviews.length);
      }
      
      // Ensure all reviews have at least an empty string for comment
      const processedReviews = reviews.map(review => ({
        ...review,
        comment: review.comment || ''
      }));
      
      setUserReviews(processedReviews);
      setTotalReviews(reviews.length);
      
      return {
        reviews: processedReviews,
        total: reviews.length
      };
    } catch (error) {
      console.error('Error fetching user reviews:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch reviews');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    sellerReviews,
    productReviews,
    userReviews,
    reviewStats,
    totalReviews,
    averageRating,
    fetchSellerReviews,
    fetchProductReviews,
    fetchUserReviews,
    submitReview,
    respondToReview,
    markReviewAsHelpful
  };
}