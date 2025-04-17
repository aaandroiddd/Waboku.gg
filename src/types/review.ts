export interface Review {
  id: string;
  orderId: string;
  listingId: string;
  reviewerId: string; // The user who wrote the review (buyer/customer)
  sellerId: string;   // The user who owned the listing (seller/merchant)
  rating: number;     // 1-5 star rating
  comment: string;    // Review text
  title?: string;     // Optional review title
  images?: string[];  // Optional array of image URLs
  isVerifiedPurchase: boolean;
  isPublic: boolean;  // Whether the review is publicly visible
  status: 'pending' | 'published' | 'rejected' | 'flagged';
  sellerResponse?: {  // Optional seller response to the review
    comment: string;
    createdAt: Date;
  };
  helpfulCount?: number; // Number of users who found this review helpful
  reportCount?: number;  // Number of users who reported this review
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewStats {
  sellerId: string;
  totalReviews: number;
  averageRating: number;
  ratingCounts: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  lastUpdated: Date;
}

export interface ReviewFilterOptions {
  rating?: number | number[];
  sortBy?: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating' | 'most_helpful';
  hasImages?: boolean;
  hasComment?: boolean;
  verifiedOnly?: boolean;
  searchTerm?: string;
  role?: 'reviewer' | 'seller'; // 'reviewer' = reviews written by buyer, 'seller' = reviews received by seller
}