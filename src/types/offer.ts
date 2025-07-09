export interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  counterOffer?: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'countered' | 'cancelled';
  cleared?: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // When the offer expires (24h default, premium users can choose 24h, 48h, 3 days, or 7 days)
  listingSnapshot: {
    title: string;
    price: number;
    imageUrl: string;
  };
  shippingAddress?: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  isPickup?: boolean; // Flag to indicate if this is a pickup instead of shipping
  requiresShippingInfo?: boolean; // Flag to indicate if shipping info needs to be collected after acceptance
  shippingInfoProvided?: boolean; // Flag to indicate if shipping info has been provided after acceptance
}