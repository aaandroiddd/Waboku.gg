export interface Order {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'paid' | 'awaiting_shipping' | 'shipped';
  paymentSessionId?: string;
  paymentIntentId?: string;
  transferId?: string;
  transferAmount?: number;
  platformFee?: number;
  paymentStatus?: string;
  offerPrice?: number; // Price from an accepted offer
  originalListingPrice?: number; // Original listing price before offer
  isPickup?: boolean; // Flag to indicate if this is a local pickup
  pickupCompleted?: boolean; // Flag to indicate if pickup has been completed
  pickupCompletedAt?: Date; // When the pickup was completed
  reviewSubmitted?: boolean; // Flag to indicate if a review has been submitted
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
  createdAt: Date;
  updatedAt: Date;
  listingSnapshot?: {
    title: string;
    price: number;
    imageUrl: string | null;
  };
}