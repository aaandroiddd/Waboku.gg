import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Listing, NewListing } from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    fetchListings()
  }, [])

  const fetchListings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setListings(data || [])
    } catch (error) {
      console.error('Error fetching listings:', error)
    } finally {
      setLoading(false)
    }
  }

  const createListing = async (newListing: NewListing) => {
    try {
      if (!user) throw new Error('Must be logged in to create a listing')

      const { data, error } = await supabase
        .from('listings')
        .insert([{ ...newListing, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      setListings(prev => [data, ...prev])
      return data
    } catch (error) {
      console.error('Error creating listing:', error)
      throw error
    }
  }

  const updateListing = async (id: string, updates: Partial<NewListing>) => {
    try {
      if (!user) throw new Error('Must be logged in to update a listing')

      const { data, error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id) // Ensure user owns the listing
        .select()
        .single()

      if (error) throw error

      setListings(prev =>
        prev.map(listing => (listing.id === id ? { ...listing, ...data } : listing))
      )
      return data
    } catch (error) {
      console.error('Error updating listing:', error)
      throw error
    }
  }

  const deleteListing = async (id: string) => {
    try {
      if (!user) throw new Error('Must be logged in to delete a listing')

      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id) // Ensure user owns the listing

      if (error) throw error

      setListings(prev => prev.filter(listing => listing.id !== id))
    } catch (error) {
      console.error('Error deleting listing:', error)
      throw error
    }
  }

  return {
    listings,
    loading,
    createListing,
    updateListing,
    deleteListing,
    refreshListings: fetchListings,
  }
}