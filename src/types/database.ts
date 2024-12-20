export interface Listing {
  id: string
  created_at: string
  user_id: string
  title: string
  description?: string
  price: number
  card_condition: string
  game_type: string
  location: string
  state: string
  images?: string[]
  status: 'active' | 'sold' | 'pending'
}

export type NewListing = Omit<Listing, 'id' | 'created_at' | 'user_id' | 'status'>