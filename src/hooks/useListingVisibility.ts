import { useState, useEffect } from 'react';
import { Listing } from '@/types/database';

/**
 * Hook to handle listing visibility filtering
 * This hook ensures listings are properly filtered based on their status and other criteria
 */
export function useListingVisibility(listings: Listing[]) {
  const [visibleListings, setVisibleListings] = useState<Listing[]>([]);
  
  useEffect(() => {
    if (!listings || !Array.isArray(listings)) {
      setVisibleListings([]);
      return;
    }
    
    // Filter listings to ensure only active ones are shown
    const filtered = listings.filter(listing => {
      // Skip listings without proper status
      if (!listing) return false;
      
      // Check if the listing has a status field and it's active
      if (listing.status !== 'active') return false;
      
      // Check if the listing has expired
      const now = new Date();
      const expiresAt = listing.expiresAt instanceof Date 
        ? listing.expiresAt 
        : new Date(listing.expiresAt);
      
      if (now > expiresAt) return false;
      
      // Include the listing if it passes all checks
      return true;
    });
    
    // Only log in development environment to reduce noise
    if (process.env.NODE_ENV === 'development') {
      console.log(`[useListingVisibility] Filtered ${listings.length} listings to ${filtered.length} visible listings`);
    }
    setVisibleListings(filtered);
  }, [listings]);
  
  return { visibleListings };
}