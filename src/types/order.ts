export interface Order {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'paid' | 'awaiting_shipping' | 'shipped' | 'refunded' | 'partially_refunded';
  paymentSessionId?: string;
  paymentIntentId?: string;
  transferId?: string;
  transferAmount?: number;
  platformFee?: number;
  paymentStatus?: string;
  paymentMethod?: {
    brand: string;
    last4: string;
    exp_month?: number;
    exp_year?: number;
  };
  offerPrice?: number; // Price from an accepted offer
  originalListingPrice?: number; // Original listing price before offer
  isPickup?: boolean; // Flag to indicate if this is a local pickup
  pickupCompleted?: boolean; // Flag to indicate if pickup has been completed
  pickupCompletedAt?: Date; // When the pickup was completed
  // New dual pickup confirmation fields
  buyerPickupConfirmed?: boolean; // Flag to indicate if buyer has confirmed pickup
  buyerPickupConfirmedAt?: Date; // When the buyer confirmed pickup
  sellerPickupConfirmed?: boolean; // Flag to indicate if seller has confirmed pickup
  sellerPickupConfirmedAt?: Date; // When the seller confirmed pickup
  // QR code pickup system fields
  pickupToken?: string; // Unique token for QR code pickup verification
  pickupTokenCreatedAt?: Date; // When the pickup token was created
  pickupTokenExpiresAt?: Date; // When the pickup token expires
  sellerPickupInitiated?: boolean; // Flag to indicate if seller has initiated pickup with QR
  sellerPickupInitiatedAt?: Date; // When the seller initiated pickup
  reviewSubmitted?: boolean; // Flag to indicate if a review has been submitted
  sellerHasStripeAccount?: boolean; // Flag to indicate if the seller has a Stripe Connect account
  paymentRequired?: boolean; // Flag to indicate if payment is required for this order
  shippingAddress?: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  trackingInfo?: {
    carrier: string;
    trackingNumber: string;
    notes?: string;
    addedAt: Date;
    addedBy: string;
    lastChecked?: Date;
    lastUpdated?: Date;
    currentStatus?: string;
    statusDescription?: string;
    estimatedDelivery?: string;
    lastUpdate?: string;
    location?: string;
    events?: Array<{
      timestamp: string;
      description: string;
      location?: string;
    }>;
  };
  noTrackingConfirmed?: boolean;
  trackingRequired?: boolean; // Flag to indicate if tracking is required
  deliveryConfirmed?: boolean; // Flag to indicate if delivery has been confirmed by buyer
  // Refund-related fields
  refundStatus?: 'none' | 'requested' | 'processing' | 'completed' | 'failed' | 'cancelled';
  refundAmount?: number; // Amount refunded (may be partial)
  refundReason?: string; // Buyer's reason for refund
  refundRequestedAt?: Date; // When refund was requested
  refundProcessedAt?: Date; // When refund was processed
  refundId?: string; // Stripe refund ID
  refundNotes?: string; // Admin/seller notes about the refund
  isRefundEligible?: boolean; // Whether the order is eligible for refund
  refundDeadline?: Date; // Deadline for requesting refund
  createdAt: Date;
  updatedAt: Date;
  listingSnapshot?: {
    title: string;
    price: number;
    imageUrl: string | null;
  };
}