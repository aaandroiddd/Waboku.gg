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
    if (!sellerId) return;
    
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
      
      const response = await fetch(`/api/reviews/get-seller-reviews?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch reviews');
      }
      
      setSellerReviews(data.reviews || []);
      setReviewStats(data.stats || null);
      setTotalReviews(data.total || 0);
      
      return {
        reviews: data.reviews || [],
        stats: data.stats,
        total: data.total || 0
      };
    } catch (error) {
      console.error('Error fetching seller reviews:', error);
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
      setError('You must be logged in to submit a review');
      return null;
    }
    
    if (!orderId || !rating) {
      setError('Missing required fields');
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/reviews/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          rating,
          comment,
          title,
          images,
          userId: user.uid,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit review');
      }
      
      toast.success('Review submitted successfully');
      return data.reviewId;
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

  return {
    loading,
    error,
    sellerReviews,
    productReviews,
    reviewStats,
    totalReviews,
    averageRating,
    fetchSellerReviews,
    fetchProductReviews,
    submitReview,
    respondToReview,
    markReviewAsHelpful
  };
}