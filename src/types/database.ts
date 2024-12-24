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
  isGraded: boolean;
  gradeLevel?: number;
  gradingCompany?: string;
  city: string;
  state: string;
}

export interface CreateListingData {
  title: string;
  description: string;
  price: string;
  condition: string;
  game: string;
  images: File[];
  isGraded: boolean;
  gradeLevel?: number;
  gradingCompany?: string;
  city: string;
  state: string;
}