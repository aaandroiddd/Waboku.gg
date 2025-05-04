import { useState, useEffect, useRef } from 'react';
import { Listing } from '@/types/database';
import { parseDate, isExpired } from '@/lib/date-utils';
import { GAME_NAME_MAPPING } from '@/lib/game-mappings';

// Debug flag to help troubleshoot visibility issues
const DEBUG_VISIBILITY = process.env.NODE_ENV === 'development' || true;

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
      console.warn('useListingVisibility received invalid listings data:', listings);
      setVisibleListings([]);
      return;
    }
    
    // Log the initial count for debugging
    console.log(`useListingVisibility processing ${listings.length} listings`);
    
    // Check for empty listings array
    if (listings.length === 0) {
      console.log('useListingVisibility: Empty listings array received');
      setVisibleListings([]);
      return;
    }
    
    // Reset filtered out reasons for this batch
    filteredOutReasons.current = {};
    
    // Clear problematic listings cache when listings array changes
    // This allows previously problematic listings to be re-evaluated
    problematicListingIds.current.clear();
    
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
        
        // Enhanced date parsing for expiresAt field
        try {
          // First try to use the expiresAt field if it exists
          if (listing.expiresAt) {
            // Handle different date formats
            if (listing.expiresAt instanceof Date) {
              expiresAt = listing.expiresAt;
            } else if (typeof listing.expiresAt === 'object') {
              // Handle Firestore Timestamp with toDate method
              if ('toDate' in listing.expiresAt && typeof listing.expiresAt.toDate === 'function') {
                expiresAt = listing.expiresAt.toDate();
              } 
              // Handle Firestore Timestamp with seconds field
              else if ('seconds' in listing.expiresAt) {
                expiresAt = new Date(listing.expiresAt.seconds * 1000);
              }
              // Handle serialized Firestore Timestamp (_seconds field)
              else if ('_seconds' in listing.expiresAt) {
                expiresAt = new Date(listing.expiresAt._seconds * 1000);
              }
            } else if (typeof listing.expiresAt === 'string') {
              // Handle string date
              expiresAt = new Date(listing.expiresAt);
            } else if (typeof listing.expiresAt === 'number') {
              // Handle numeric timestamp
              expiresAt = new Date(listing.expiresAt);
            }
            
            // Log the parsed expiresAt for debugging
            if (expiresAt && !isNaN(expiresAt.getTime())) {
              console.log(`Parsed expiresAt for listing ${listing.id}: ${expiresAt.toISOString()}`);
            } else {
              console.log(`Failed to parse expiresAt for listing ${listing.id}, value:`, listing.expiresAt);
              expiresAt = null; // Reset to null if parsing failed
            }
          }
        } catch (e) {
          console.error(`Error parsing expiresAt for listing ${listing.id}:`, e);
          expiresAt = null;
        }
        
        // If we couldn't parse the expiresAt field, calculate it from createdAt and accountTier
        if (!expiresAt || isNaN(expiresAt.getTime())) {
          console.log(`No valid expiresAt for listing ${listing.id}, calculating from createdAt and accountTier`);
          
          try {
            // Parse createdAt date with enhanced handling
            let createdAt: Date | null = null;
            
            if (listing.createdAt instanceof Date) {
              createdAt = listing.createdAt;
            } else if (typeof listing.createdAt === 'object' && listing.createdAt) {
              // Handle Firestore Timestamp with toDate method
              if ('toDate' in listing.createdAt && typeof listing.createdAt.toDate === 'function') {
                createdAt = listing.createdAt.toDate();
              } 
              // Handle Firestore Timestamp with seconds field
              else if ('seconds' in listing.createdAt) {
                createdAt = new Date(listing.createdAt.seconds * 1000);
              }
              // Handle serialized Firestore Timestamp (_seconds field)
              else if ('_seconds' in listing.createdAt) {
                createdAt = new Date(listing.createdAt._seconds * 1000);
              }
            } else if (typeof listing.createdAt === 'string') {
              createdAt = new Date(listing.createdAt);
            } else if (typeof listing.createdAt === 'number') {
              createdAt = new Date(listing.createdAt);
            }
            
            if (!createdAt || isNaN(createdAt.getTime())) {
              throw new Error('Invalid createdAt date');
            }
            
            // Calculate expiration based on account tier
            // Free tier: 48 hours, Premium tier: 720 hours (30 days)
            const tierDuration = (listing.accountTier === 'premium' ? 720 : 48) * 60 * 60 * 1000;
            expiresAt = new Date(createdAt.getTime() + tierDuration);
            
            console.log(`Calculated expiration for listing ${listing.id}: ${expiresAt.toISOString()}`);
          } catch (e) {
            console.error(`Failed to calculate expiration date for listing ${listing.id}:`, e);
            filteredOutReasons.current[listing.id] = 'Could not calculate expiration date';
            problematicListingIds.current.add(listing.id);
            return false;
          }
        }
        
        // Check if the listing has expired
        // Add a small buffer time (5 minutes) to prevent edge cases where listings
        // might appear expired due to slight time differences between client and server
        const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
        
        // Debug log the expiration check
        console.log(`Checking expiration for listing ${listing.id}:`, {
          now: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          isExpired: now > expiresAt,
          timeRemaining: (expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000) + ' hours'
        });
        
        // Fix: Add buffer time to now to prevent premature expiration
        // This gives listings a 5-minute grace period
        const nowWithBuffer = new Date(now.getTime() - bufferTime);
        
        if (nowWithBuffer > expiresAt) {
          filteredOutReasons.current[listing.id] = `Expired on ${expiresAt.toISOString()}`;
          return false;
        }
        
        // Check for required fields
        const requiredFields = ['title', 'price', 'userId', 'username'];
        const missingFields = requiredFields.filter(field => !listing[field as keyof Listing]);
        
        if (missingFields.length > 0) {
          filteredOutReasons.current[listing.id] = `Missing required fields: ${missingFields.join(', ')}`;
          return false;
        }
        
        // Check for valid images - with more detailed logging
        if (!listing.imageUrls) {
          filteredOutReasons.current[listing.id] = 'imageUrls is undefined or null';
          return false;
        }
        
        if (!Array.isArray(listing.imageUrls)) {
          filteredOutReasons.current[listing.id] = `imageUrls is not an array: ${typeof listing.imageUrls}`;
          return false;
        }
        
        if (listing.imageUrls.length === 0) {
          filteredOutReasons.current[listing.id] = 'imageUrls array is empty';
          return false;
        }
        
        // Verify the first image URL is valid
        const firstImageUrl = listing.imageUrls[0];
        if (!firstImageUrl || typeof firstImageUrl !== 'string' || !firstImageUrl.startsWith('http')) {
          filteredOutReasons.current[listing.id] = `Invalid first image URL: ${firstImageUrl}`;
          return false;
        }
        
        // Note: We explicitly do NOT check for cardName as it's optional and should not affect visibility
        
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