export interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  counterOffer?: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'countered';
  createdAt: Date;
  updatedAt: Date;
  listingSnapshot: {
    title: string;
    price: number;
    imageUrl: string;
  };
}