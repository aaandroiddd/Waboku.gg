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
      
      // Properly handle different types of expiresAt
      let expiresAt: Date;
      
      if (listing.expiresAt instanceof Date) {
        expiresAt = listing.expiresAt;
      } else if (listing.expiresAt && typeof listing.expiresAt.toDate === 'function') {
        // Handle Firestore timestamp
        expiresAt = listing.expiresAt.toDate();
      } else if (listing.expiresAt && typeof listing.expiresAt === 'object' && 'seconds' in listing.expiresAt) {
        // Handle Firestore timestamp in serialized form
        expiresAt = new Date((listing.expiresAt as any).seconds * 1000);
      } else {
        // Fallback for other formats
        try {
          expiresAt = new Date(listing.expiresAt as any);
        } catch (error) {
          console.error('Failed to parse expiresAt date:', listing.expiresAt);
          // Default to a future date to avoid filtering out listings with invalid dates
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30); // 30 days in the future
        }
      }
      
      // Log for debugging
      console.log(`Listing ${listing.id} - Status: ${listing.status}, Expires: ${expiresAt.toISOString()}, Now: ${now.toISOString()}, Expired: ${now > expiresAt}`);
      
      if (now > expiresAt) return false;
      
      // Include the listing if it passes all checks
      return true;
    });
    
    // Only log in development environment to reduce noise
    if (process.env.NODE_ENV === 'development') {
      console.log(`[useListingVisibility] Filtered ${listings.length} listings to ${filtered.length} visible listings`);
      
      // Log the IDs of filtered listings for debugging
      if (listings.length > 0 && filtered.length === 0) {
        console.log('All listings were filtered out. Listing IDs:', listings.map(l => l.id));
        console.log('Listing statuses:', listings.map(l => l.status));
      }
    }
    
    setVisibleListings(filtered);
  }, [listings]);
  
  return { visibleListings };
}