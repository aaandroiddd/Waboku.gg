import { useState, useEffect, useRef } from 'react';
import { Listing } from '@/types/database';
import { parseDate, isExpired } from '@/lib/date-utils';

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
        if (listing.status !== 'active') {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Listing ${listing.id} filtered out due to status: ${listing.status}`);
          }
          return false;
        }
        
        // Check if the listing has expired
        const now = new Date();
        
        // Use our utility function to parse the date safely
        const expiresAt = parseDate(listing.expiresAt, null);
        
        // If we couldn't parse the date, skip this listing
        if (!expiresAt) {
          console.error(`Failed to parse expiresAt date for listing ${listing.id}:`, listing.expiresAt);
          problematicListingIds.current.add(listing.id);
          return false;
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