export interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  listingSnapshot: {
    title: string;
    price: number;
    imageUrl: string;
  };
}