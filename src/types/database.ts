export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  game: string;
  imageUrls: string[];
  userId: string;
  createdAt: Date;
  status: 'active' | 'sold' | 'pending';
}

export interface CreateListingData {
  title: string;
  description: string;
  price: string;
  condition: string;
  game: string;
  images: File[];
}