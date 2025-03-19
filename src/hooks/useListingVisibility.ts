import { useState, useEffect, useRef } from 'react';
import { Listing } from '@/types/database';

/**
 * Hook to handle listing visibility filtering
 * This hook ensures listings are properly filtered based on their status and other criteria
 */
export function useListingVisibility(listings: Listing[]) {
  const [visibleListings, setVisibleListings] = useState<Listing[]>([]);
  // Keep track of problematic listing IDs to avoid repeated processing
  const problematicListingIds = useRef<Set<string>>(new Set());
  // Keep track of the previous listings array to avoid unnecessary processing
  const previousListingsRef = useRef<Listing[]>([]);
  
  useEffect(() => {
    // Skip processing if listings array is the same reference as before
    // This prevents unnecessary re-renders when the parent component re-renders
    // but the listings array hasn't actually changed
    if (listings === previousListingsRef.current) {
      return;
    }
    
    // Update the previous listings reference
    previousListingsRef.current = listings;
    
    if (!listings || !Array.isArray(listings)) {
      setVisibleListings([]);
      return;
    }
    
    // Filter listings to ensure only active ones are shown
    const filtered = listings.filter(listing => {
      // Skip listings without proper status or if they're known to be problematic
      if (!listing || !listing.id) return false;
      
      // Skip processing if this listing has already been identified as problematic
      if (problematicListingIds.current.has(listing.id)) {
        return false;
      }
      
      try {
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
            
            // Validate the date is valid
            if (isNaN(expiresAt.getTime())) {
              throw new Error('Invalid date');
            }
          } catch (error) {
            console.error(`Failed to parse expiresAt date for listing ${listing.id}:`, listing.expiresAt);
            // Mark this listing as problematic to avoid repeated processing
            problematicListingIds.current.add(listing.id);
            return false;
          }
        }
        
        // Only log in development environment to reduce noise
        if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_CO_DEV_ENV === 'true') {
          console.log(`Listing ${listing.id} - Status: ${listing.status}, Expires: ${expiresAt.toISOString()}, Now: ${now.toISOString()}, Expired: ${now > expiresAt}`);
        }
        
        if (now > expiresAt) return false;
        
        // Include the listing if it passes all checks
        return true;
      } catch (error) {
        // If any error occurs while processing this listing, mark it as problematic
        console.error(`Error processing listing ${listing.id}:`, error);
        problematicListingIds.current.add(listing.id);
        return false;
      }
    });
    
    // Only log in development environment to reduce noise
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_CO_DEV_ENV === 'true') {
      console.log(`[useListingVisibility] Filtered ${listings.length} listings to ${filtered.length} visible listings`);
      
      // Log the IDs of filtered listings for debugging
      if (listings.length > 0 && filtered.length === 0) {
        console.log('All listings were filtered out. Listing IDs:', listings.map(l => l.id));
        console.log('Listing statuses:', listings.map(l => l.status));
      }
      
      // Log problematic listings
      if (problematicListingIds.current.size > 0) {
        console.log('Problematic listing IDs (skipped):', Array.from(problematicListingIds.current));
      }
    }
    
    // Only update state if the filtered listings have actually changed
    // This prevents unnecessary re-renders
    const currentListingIds = new Set(visibleListings.map(l => l.id));
    const newListingIds = new Set(filtered.map(l => l.id));
    
    // Check if the sets are different
    let hasChanged = currentListingIds.size !== newListingIds.size;
    
    if (!hasChanged) {
      // Check if all IDs in the current set are also in the new set
      for (const id of currentListingIds) {
        if (!newListingIds.has(id)) {
          hasChanged = true;
          break;
        }
      }
    }
    
    if (hasChanged) {
      setVisibleListings(filtered);
    }
  }, [listings]);
  
  return { visibleListings };
}