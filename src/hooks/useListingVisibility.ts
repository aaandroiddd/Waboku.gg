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
  // Keep track of filtered out listings for debugging
  const filteredOutReasons = useRef<Record<string, string>>({});
  
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
    
    // Reset filtered out reasons for this batch
    filteredOutReasons.current = {};
    
    // Filter listings to ensure only active ones are shown
    const filtered = listings.filter(listing => {
      // Skip listings without proper status or if they're known to be problematic
      if (!listing || !listing.id) {
        filteredOutReasons.current[listing?.id || 'unknown'] = 'Missing listing ID';
        return false;
      }
      
      // Skip processing if this listing has already been identified as problematic
      if (problematicListingIds.current.has(listing.id)) {
        filteredOutReasons.current[listing.id] = 'Previously marked as problematic';
        return false;
      }
      
      try {
        // Check if the listing has a status field and it's active
        if (listing.status !== 'active') {
          filteredOutReasons.current[listing.id] = `Status is "${listing.status}" (not "active")`;
          return false;
        }
        
        // Check if the listing has expired
        const now = new Date();
        
        // Use our utility function to parse the date safely
        let expiresAt = null;
        
        // Handle different date formats
        if (listing.expiresAt instanceof Date) {
          expiresAt = listing.expiresAt;
        } else if (typeof listing.expiresAt === 'object' && listing.expiresAt && 'toDate' in listing.expiresAt) {
          // Handle Firestore Timestamp
          try {
            // @ts-ignore - Firestore timestamp
            expiresAt = listing.expiresAt.toDate();
          } catch (e) {
            console.error(`Failed to convert Firestore timestamp for listing ${listing.id}:`, e);
          }
        } else {
          // Try to parse as string or number
          expiresAt = parseDate(listing.expiresAt, null);
        }
        
        // If we couldn't parse the date, skip this listing
        if (!expiresAt) {
          console.error(`Failed to parse expiresAt date for listing ${listing.id}:`, listing.expiresAt);
          filteredOutReasons.current[listing.id] = 'Invalid expiration date';
          problematicListingIds.current.add(listing.id);
          return false;
        }
        
        // Check if the listing has expired
        if (now > expiresAt) {
          filteredOutReasons.current[listing.id] = `Expired on ${expiresAt.toISOString()}`;
          return false;
        }
        
        // Check for required fields
        const requiredFields = ['title', 'price', 'imageUrls', 'userId', 'username'];
        const missingFields = requiredFields.filter(field => !listing[field as keyof Listing]);
        
        if (missingFields.length > 0) {
          filteredOutReasons.current[listing.id] = `Missing required fields: ${missingFields.join(', ')}`;
          return false;
        }
        
        // Check for valid images
        if (!Array.isArray(listing.imageUrls) || listing.imageUrls.length === 0) {
          filteredOutReasons.current[listing.id] = 'No valid images';
          return false;
        }
        
        // Include the listing if it passes all checks
        return true;
      } catch (error) {
        // If any error occurs while processing this listing, mark it as problematic
        console.error(`Error processing listing ${listing.id}:`, error);
        filteredOutReasons.current[listing.id] = `Error: ${error instanceof Error ? error.message : String(error)}`;
        problematicListingIds.current.add(listing.id);
        return false;
      }
    });
    
    // Always log filtered out reasons for specific listings
    const debugListingIds = ['BtND7c1ejRRZdlGLSCME', 'BND7c1ejRRZdlGLSCME']; // Add the listing ID from the screenshot
    
    for (const debugId of debugListingIds) {
      if (filteredOutReasons.current[debugId]) {
        console.warn(`Listing ${debugId} was filtered out: ${filteredOutReasons.current[debugId]}`);
      } else if (listings.some(l => l.id === debugId) && filtered.some(l => l.id === debugId)) {
        console.log(`Listing ${debugId} passed all visibility checks and is visible`);
      } else if (listings.some(l => l.id === debugId)) {
        console.warn(`Listing ${debugId} was filtered out but no reason was recorded`);
      }
    }
    
    // Only log in development environment to reduce noise
    if (process.env.NODE_ENV === 'development') {
      console.log(`[useListingVisibility] Filtered ${listings.length} listings to ${filtered.length} visible listings`);
      
      // Log the IDs of filtered listings for debugging
      if (listings.length > 0 && filtered.length === 0) {
        console.log('All listings were filtered out. Sample reasons:');
        const sampleReasons = Object.entries(filteredOutReasons.current).slice(0, 5);
        sampleReasons.forEach(([id, reason]) => {
          console.log(`- Listing ${id}: ${reason}`);
        });
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
  
  // Expose the filtered out reasons for debugging
  return { 
    visibleListings,
    filteredOutReasons: filteredOutReasons.current
  };
}