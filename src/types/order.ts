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
  };
  noTrackingConfirmed?: boolean;
  createdAt: Date;
  updatedAt: Date;
  listingSnapshot?: {
    title: string;
    price: number;
    imageUrl: string | null;
  };
}