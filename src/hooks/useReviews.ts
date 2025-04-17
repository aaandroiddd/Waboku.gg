import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Review, ReviewStats, ReviewFilterOptions } from '@/types/review';
import { toast } from 'sonner';

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
      // Build query parameters
      const params = new URLSearchParams({
        sellerId,
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
      
      // Explicitly set role to 'seller' to get reviews received by this seller
      params.append('role', 'seller');
      
      const url = `/api/reviews/get-seller-reviews?${params.toString()}`;
      console.log('useReviews: Fetching from URL:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('useReviews: API response status:', response.status);
      console.log('useReviews: API response data:', {
        success: data.success,
        message: data.message,
        reviewsCount: data.reviews?.length || 0,
        total: data.total || 0,
        hasStats: !!data.stats,
        averageRating: data.stats?.averageRating
      });
      
      // Log the first review if available for debugging
      if (data.reviews && data.reviews.length > 0) {
        console.log('useReviews: First review sample:', {
          id: data.reviews[0].id,
          sellerId: data.reviews[0].sellerId,
          reviewerId: data.reviews[0].reviewerId,
          rating: data.reviews[0].rating,
          status: data.reviews[0].status,
          isPublic: data.reviews[0].isPublic,
          comment: data.reviews[0].comment?.substring(0, 50) + (data.reviews[0].comment?.length > 50 ? '...' : '') || 'No comment',
          hasComment: !!data.reviews[0].comment,
          commentLength: data.reviews[0].comment?.length || 0
        });
        
        // Ensure all reviews have at least an empty string for comment
        data.reviews = data.reviews.map(review => ({
          ...review,
          comment: review.comment || ''
        }));
      } else {
        console.log('useReviews: No reviews returned from API');
        
        // If we're in development, log debug info from the API if available
        if (process.env.NEXT_PUBLIC_CO_DEV_ENV && data.debug) {
          console.log('useReviews: Debug info from API:', data.debug);
        }
      }
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch reviews');
      }
      
      setSellerReviews(data.reviews || []);
      setReviewStats(data.stats || null);
      setTotalReviews(data.total || 0);
      
      // If we have stats, set the average rating
      if (data.stats) {
        setAverageRating(data.stats.averageRating || 0);
      }
      
      return {
        reviews: data.reviews || [],
        stats: data.stats,
        total: data.total || 0,
        averageRating: data.stats?.averageRating || 0
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
      
      const requestBody = {
        orderId,
        rating,
        comment,
        title,
        images: [], // Removed image upload functionality
        userId: user.uid,
      };
      
      console.log('Request body:', JSON.stringify(requestBody));
      
      try {
        // First, check if Firebase Admin is working properly
        console.log('Testing Firebase Admin connection before submitting review');
        const testResponse = await fetch('/api/debug/test-firebase-admin-enhanced');
        const testData = await testResponse.json();
        
        if (!testResponse.ok || !testData.success) {
          console.error('Firebase Admin test failed:', testData);
          throw new Error('Database connection issue. Please try again later.');
        }
        
        console.log('Firebase Admin test successful, proceeding with review submission');
        
        // Now submit the review
        const response = await fetch('/api/reviews/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Review submission response:', data);
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to submit review');
        }
        
        toast.success('Review submitted successfully');
        return data.reviewId;
      } catch (fetchError) {
        console.error('Fetch error during review submission:', fetchError);
        throw new Error(fetchError instanceof Error ? fetchError.message : 'Network error during review submission');
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
      const response = await fetch('/api/reviews/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewId,
          comment,
          userId: user.uid,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to respond to review');
      }
      
      toast.success('Response added successfully');
      return true;
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
      const response = await fetch('/api/reviews/mark-helpful', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewId,
          userId: user.uid,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to mark review as helpful');
      }
      
      toast.success('Review marked as helpful');
      return data.helpfulCount;
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
      // Build query parameters
      const params = new URLSearchParams({
        userId,
        page: page.toString(),
        limit: pageSize.toString(),
      });
      
      // Add filter options if provided
      if (filterOptions.sortBy) {
        params.append('sortBy', filterOptions.sortBy);
      }
      
      // Add role parameter if provided (reviewer or seller)
      if (filterOptions.role) {
        params.append('role', filterOptions.role);
      }
      
      const response = await fetch(`/api/reviews/get-user-reviews?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch reviews');
      }
      
      setUserReviews(data.reviews || []);
      setTotalReviews(data.total || 0);
      
      return {
        reviews: data.reviews || [],
        total: data.total || 0
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