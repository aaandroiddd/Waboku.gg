import React, { useEffect, useState, useRef } from 'react';
import { OptimizedSimilarListings } from '@/components/OptimizedSimilarListings';
import { OwnerListings } from '@/components/OwnerListings';
import { MobileSimilarItems } from '@/components/MobileSimilarItems';
import { useListingPageCleanup } from '@/hooks/useFirestoreListener';
import { registerListener } from '@/lib/firebase-service';

// Add global type definition for the transform instances and cache
declare global {
  interface Window {
    __transformInstances?: Record<string, any>;
    __carouselApi?: any;
    __firestoreCache?: {
      sellerStatus?: Record<string, { hasStripeAccount: boolean; timestamp: number }>;
      users?: Record<string, any>;
      listings?: Record<string, any>;
      similarListings?: Record<string, any>;
    };
  }
}
import { doc, getDoc } from 'firebase/firestore';
import { batchFetchUserData } from '@/hooks/useFirestoreOptimizer';
import { loadStripe } from '@stripe/stripe-js';
import { BuyNowButton } from '@/components/BuyNowButton';
import { UserNameLink } from '@/components/UserNameLink';
import { StripeSellerBadge } from '@/components/StripeSellerBadge';
import { useRouter } from 'next/router';
import { formatPrice } from '@/lib/price';
import { getFirebaseServices } from '@/lib/firebase';
import { Listing } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameCategoryBadge } from '@/components/GameCategoryBadge';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Chat } from '@/components/Chat';
import { MessageDialog } from '@/components/MessageDialog';
import { MakeOfferDialog } from '@/components/MakeOfferDialog';
import { ReportListingDialog } from '@/components/ReportListingDialog';
import Image from 'next/image';
import { ArrowLeft, Calendar, Heart, MapPin, MessageCircle, User, ZoomIn, Minus, Plus, RotateCw, X, Flag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/contexts/AuthRedirectContext';
import { useFavorites } from '@/hooks/useFavorites';
import { toast } from 'sonner';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Footer } from '@/components/Footer';
import dynamic from 'next/dynamic';
import { DistanceIndicator } from '@/components/DistanceIndicator';
import { useLoading } from '@/contexts/LoadingContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { FirestoreRequestCounter } from '@/components/FirestoreRequestCounter';
import { extractListingIdFromSlug } from '@/lib/listing-slug';
import { getCleanImageUrl, getImageFilename } from '@/lib/image-utils';

const getConditionColor = (condition: string) => {
  const colors: Record<string, string> = {
    'poor': 'bg-[#e51f1f]/10 text-[#e51f1f] hover:bg-[#e51f1f]/20',
    'played': 'bg-[#e85f2a]/10 text-[#e85f2a] hover:bg-[#e85f2a]/20',
    'light-played': 'bg-[#f2a134]/10 text-[#f2a134] hover:bg-[#f2a134]/20',
    'good': 'bg-[#f2a134]/10 text-[#f2a134] hover:bg-[#f2a134]/20',
    'excellent': 'bg-[#f7e379]/10 text-[#f7e379] hover:bg-[#f7e379]/20',
    'near-mint': 'bg-[#7bce2a]/10 text-[#7bce2a] hover:bg-[#7bce2a]/20',
    'near mint': 'bg-[#7bce2a]/10 text-[#7bce2a] hover:bg-[#7bce2a]/20',
    'near_mint': 'bg-[#7bce2a]/10 text-[#7bce2a] hover:bg-[#7bce2a]/20',
    'mint': 'bg-[#44ce1b]/10 text-[#44ce1b] hover:bg-[#44ce1b]/20',
    'unknown': 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
  };
  return colors[condition?.toLowerCase()] || 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
};

export default function ListingPage() {
  const router = useRouter();
  const { slug } = router.query;
  
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);
  // Dialog state is now handled by Radix UI
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [sellerHasActiveStripeAccount, setSellerHasActiveStripeAccount] = useState(false);
  
  // Import the useMediaQuery hook at the top to avoid initialization issues
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    if (listing?.coverImageIndex !== undefined) {
      setCurrentImageIndex(listing.coverImageIndex);
    }
  }, [listing?.coverImageIndex]);
  
  // Initialize the transform instances tracking
  // Create refs to store zoom control functions for each image
  const zoomControlsRef = useRef<{[key: number]: {
    zoomIn: (step?: number) => void;
    zoomOut: (step?: number) => void;
    resetTransform: () => void;
  }}>({});

  // Initialize the transform instances tracking
  useEffect(() => {
    // Create a global registry for transform instances
    if (typeof window !== 'undefined') {
      window.__transformInstances = window.__transformInstances || {};
      
      // Set up a MutationObserver to detect when TransformWrapper components are added to the DOM
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) { // Element node
                // Find all transform components that were just added
                const transformComponents = (node as Element).querySelectorAll('.react-transform-wrapper');
                transformComponents.forEach((wrapper) => {
                  try {
                    // Find the carousel item index this wrapper belongs to
                    const carouselItem = wrapper.closest('[role="group"][aria-roledescription="slide"]');
                    if (!carouselItem) return;
                    
                    // Get the index from the carousel item's position in the carousel
                    const carouselItems = Array.from(document.querySelectorAll('[role="group"][aria-roledescription="slide"]'));
                    const index = carouselItems.indexOf(carouselItem as Element);
                    if (index === -1) return;
                    
                    // Add a data attribute to the carousel item for easier identification
                    carouselItem.setAttribute('data-slide-index', index.toString());
                    
                    // Find the React fiber node to access the component's methods
                    const fiberKey = Object.keys(wrapper).find(key => 
                      key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
                    );
                    
                    if (!fiberKey) return;
                    
                    const fiber = (wrapper as any)[fiberKey];
                    if (!fiber || !fiber.return || !fiber.return.memoizedProps) return;
                    
                    // Extract the zoom methods
                    const { zoomIn, zoomOut, resetTransform } = fiber.return.memoizedProps;
                    
                    if (typeof zoomIn === 'function' && 
                        typeof zoomOut === 'function' && 
                        typeof resetTransform === 'function') {
                      
                      // Store the methods in our registry with the index as the key
                      zoomControlsRef.current[index] = {
                        zoomIn,
                        zoomOut,
                        resetTransform
                      };
                      
                      // Also store in window for debugging
                      window.__transformInstances[`image-${index}`] = {
                        zoomIn,
                        zoomOut,
                        resetTransform
                      };
                      
                      console.log(`Registered zoom controls for image ${index}`);
                    }
                  } catch (error) {
                    console.error('Error registering zoom controls:', error);
                  }
                });
              }
            });
          }
        });
      });
      
      // Start observing the document with the configured parameters
      observer.observe(document.body, { childList: true, subtree: true });
      
      // Clean up the observer when the component unmounts
      return () => {
        observer.disconnect();
        zoomControlsRef.current = {};
        // Clean up window registry
        if (window.__transformInstances) {
          Object.keys(window.__transformInstances).forEach(key => {
            if (key.startsWith('image-')) {
              delete window.__transformInstances[key];
            }
          });
        }
      };
    }
  }, []);

  const handleCarouselChange = (api: any) => {
    if (!api) return;
    const index = api.selectedScrollSnap();
    setCurrentImageIndex(index);
    
    // Store the API reference globally for better access
    if (typeof window !== 'undefined') {
      window.__carouselApi = api;
    }
  };

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const { user } = useAuth();
  const { saveRedirectState } = useAuthRedirect();

  // Get favorites functionality from the hook
  const { toggleFavorite, isFavorite, initialized } = useFavorites();
  
  // Import the hook properly at the top level
  const { hasStripeAccount } = listing?.userId ? 
    { hasStripeAccount: false } : // Provide a default when userId is not available
    { hasStripeAccount: false };  // Default value to prevent errors
  
  // Effect to prefetch user data when listing is loaded
  useEffect(() => {
    if (listing) {
      // Prefetch seller data
      if (listing.userId) {
        batchFetchUserData([listing.userId]);
      }
      
      // Check if seller has active Stripe account
      if (listing.userId) {
        // Use the state setter directly instead of trying to use the hook inside a callback
        const checkSellerStatus = async () => {
          try {
            // Get seller data from the cache if available
            const now = Date.now();
            const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
            
            // Check if we have cached seller status
            if (typeof window !== 'undefined') {
              const cache = window.__firestoreCache || {};
              if (cache.sellerStatus && 
                  cache.sellerStatus[listing.userId] && 
                  now - cache.sellerStatus[listing.userId].timestamp < CACHE_EXPIRY) {
                setSellerHasActiveStripeAccount(cache.sellerStatus[listing.userId].hasStripeAccount);
                return;
              }
            }
            
            // If not in cache, fetch directly
            const { db } = getFirebaseServices();
            if (!db) return;
            
            const userDoc = await getDoc(doc(db, 'users', listing.userId));
            if (userDoc.exists()) {
              const data = userDoc.data();
              const hasAccount = !!(
                data.stripeConnectAccountId && 
                data.stripeConnectStatus === 'active'
              );
              setSellerHasActiveStripeAccount(hasAccount);
              
              // Cache the result
              if (typeof window !== 'undefined') {
                window.__firestoreCache = window.__firestoreCache || {};
                window.__firestoreCache.sellerStatus = window.__firestoreCache.sellerStatus || {};
                window.__firestoreCache.sellerStatus[listing.userId] = {
                  hasStripeAccount: hasAccount,
                  timestamp: now
                };
              }
            }
          } catch (error) {
            console.error('Error checking seller status:', error);
          }
        };
        
        checkSellerStatus();
      }
    }
  }, [listing]);

  const { startLoading, stopLoading } = useLoading();

  // Track view count when listing is loaded - with debounce to prevent duplicate requests
  useEffect(() => {
    // Create a unique key for this listing view to prevent duplicate tracking
    const viewTrackingKey = `view_tracked_${listing?.id}`;
    
    if (listing && user) {
      // Don't track views from the listing owner
      if (listing.userId !== user.uid) {
        // Check if we've already tracked this view in this session
        if (typeof window !== 'undefined' && !sessionStorage.getItem(viewTrackingKey)) {
          const trackView = async () => {
            try {
              // Mark as tracked immediately to prevent duplicate requests
              sessionStorage.setItem(viewTrackingKey, 'true');
              
              const response = await fetch('/api/listings/track-view', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  listingId: listing.id,
                  userId: user.uid
                }),
              });
              
              if (response.ok) {
                const data = await response.json();
                console.log('View tracked successfully:', data);
              }
            } catch (error) {
              console.error('Error tracking view:', error);
              // If there was an error, remove the tracking flag to allow retry
              sessionStorage.removeItem(viewTrackingKey);
            }
          };
          
          trackView();
        } else {
          console.log('View already tracked for this listing in this session');
        }
      }
    }
  }, [listing, user]);

  // Use the listing page cleanup hook to automatically clean up listeners when navigating away
  useListingPageCleanup(listingId || '');

  // Effect to resolve the listing ID from the URL slug
  useEffect(() => {
    if (!router.isReady || !slug) return;

    const resolveListingId = async () => {
      try {
        // Handle the new URL format: /listings/gameCategory/slug-7digitid
        if (Array.isArray(slug) && slug.length === 2) {
          const [gameCategory, slugWithId] = slug;
          
          // Extract the 7-digit numeric ID from the slug
          const shortId = extractListingIdFromSlug(slugWithId);
          
          if (shortId && /^\d{7}$/.test(shortId)) {
            // Try to resolve the 7-digit ID to a full Firebase document ID
            try {
              const response = await fetch(`/api/listings/resolve-short-id?shortId=${shortId}`);
              
              if (response.ok) {
                const data = await response.json();
                if (data.success && data.fullId) {
                  setListingId(data.fullId);
                  return;
                }
              }
              
              console.log('Failed to resolve short ID:', shortId);
            } catch (error) {
              console.error('Error resolving short ID:', error);
            }
          }
        }
        
        // Handle category-only URLs: /listings/gameCategory/
        if (Array.isArray(slug) && slug.length === 1) {
          const [gameCategory] = slug;
          
          // Import game mappings to check if this is a valid category
          const { GAME_MAPPING, OTHER_GAME_MAPPING } = await import('@/lib/game-mappings');
          const allGameValues = [...Object.values(GAME_MAPPING), ...Object.values(OTHER_GAME_MAPPING)];
          
          if (allGameValues.includes(gameCategory as any)) {
            // Redirect to listings page with game filter
            router.replace(`/listings?game=${gameCategory}`);
            return;
          }
        }

        // If we can't parse the URL or resolve the ID, show error
        setError('Invalid listing URL format');
      } catch (error) {
        console.error('Error resolving listing ID:', error);
        setError('Failed to resolve listing');
      }
    };

    resolveListingId();
  }, [router.isReady, slug]);

  useEffect(() => {
    if (!listingId) return;

    let isMounted = true;
    let retryCount = 0;
    let expirationCheckDone = false;
    const maxRetries = 5; // Increased from 3 to 5
    const retryDelay = 1500; // Increased from 1000ms to 1500ms

    async function fetchListing() {
      try {
        if (isMounted) {
          setLoading(true);
          setError(null);
          startLoading(); // Start global loading indicator
        }

        // Get Firebase services with retry logic
        let db = null;
        let firebaseError = null;
        
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            console.log(`[Listing] Attempting to initialize Firebase (attempt ${attempt + 1}/3)`);
            const services = getFirebaseServices();
            db = services.db;
            
            if (db) {
              console.log('[Listing] Firebase initialized successfully');
              break;
            } else {
              console.error('[Listing] Firebase services returned null db');
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (err) {
            console.error(`[Listing] Firebase initialization error (attempt ${attempt + 1}):`, err);
            firebaseError = err;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        if (!db) {
          throw firebaseError || new Error('Database not initialized after multiple attempts');
        }

        // First, trigger a background check for listing expiration
        // This happens silently and won't block the UI
        // Only do this once per component mount to prevent infinite loops
        if (!expirationCheckDone) {
          try {
            // Use async/await with proper error handling
            const checkExpiration = async () => {
              try {
                console.log(`[Listing] Checking expiration for listing ${listingId}`);
                
                // Add timeout to prevent long-running requests
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                try {
                  const response = await fetch('/api/listings/check-expiration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ listingId: listingId }),
                    signal: controller.signal
                  });
                  
                  // Clear the timeout since the request completed
                  clearTimeout(timeoutId);
                  
                  // Always try to parse the response, regardless of status code
                  let result;
                  try {
                    result = await response.json();
                  } catch (jsonError) {
                    console.log(`[Listing] Could not parse response as JSON:`, jsonError);
                    return; // Exit silently if we can't parse the response
                  }
                  
                  // Log the result for debugging
                  console.log(`[Listing] Expiration check response:`, {
                    status: response.status,
                    result
                  });
                  
                  // Check if the API returned an error (even with status 200)
                  if (!result.success) {
                    console.log(`[Listing] Expiration check failed:`, result.error || 'Unknown error');
                    return; // Exit silently
                  }
                  
                  // Process successful response
                  if (result.status === 'archived') {
                    console.log('[Listing] Listing was archived in background check');
                    // Could refresh the page or show a notification here if needed
                  }
                } catch (fetchError) {
                  // Clear the timeout in case of error
                  clearTimeout(timeoutId);
                  
                  if (fetchError.name === 'AbortError') {
                    console.log('[Listing] Expiration check request timed out');
                  } else {
                    console.error('[Listing] Fetch error during expiration check:', fetchError);
                  }
                }
              } catch (err) {
                // Silently log any errors without affecting the user experience
                console.error('[Listing] Background expiration check failed:', err);
              }
            };
            
            // Execute but don't await - let it run in background
            checkExpiration();
            // Mark as done to prevent repeated calls
            expirationCheckDone = true;
          } catch (error) {
            // Ignore any errors in the background check
            console.error('Error triggering background expiration check:', error);
            // Still mark as done to prevent repeated calls
            expirationCheckDone = true;
          }
        }

        // Fetch the listing with retry logic
        let listingDoc = null;
        let fetchError = null;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            // Check if component is still mounted before proceeding
            if (!isMounted) {
              console.log('[Listing] Component unmounted, aborting fetch');
              return;
            }
            
            console.log(`[Listing] Fetching listing ${listingId} (attempt ${attempt + 1}/${maxRetries + 1})`);
            const listingRef = doc(db, 'listings', listingId);
            listingDoc = await getDoc(listingRef);
            
            if (listingDoc.exists()) {
              // Successfully fetched the listing
              fetchError = null;
              break;
            } else {
              // Listing not found, but this might be temporary
              fetchError = new Error('Listing not found');
              
              // If this is not the last attempt, wait before retrying
              if (attempt < maxRetries) {
                console.log(`[Listing] Listing not found, retrying in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
              }
            }
          } catch (err: any) {
            // Store the error and retry if not the last attempt
            fetchError = err;
            console.error(`[Listing] Error fetching listing (attempt ${attempt + 1}):`, err);
            
            if (attempt < maxRetries) {
              console.log(`[Listing] Retrying in ${retryDelay}ms...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
          }
        }
        
        // If we still have an error after all retries, throw it
        if (fetchError || !listingDoc || !listingDoc.exists()) {
          throw fetchError || new Error('Listing not found after multiple attempts');
        }

        const data = listingDoc.data();
        
        // Set up a real-time listener for this listing to get updates
        // This is important for status changes, but we need to clean it up properly
        try {
          const listingRef = doc(db, 'listings', listingId);
          
          // Create a unique ID for this specific listener
          const listenerId = `listing-realtime-${listingId}`;
          
          // Register the listener with our centralized service
          registerListener(listenerId, listingRef, (doc) => {
            if (!isMounted) return; // Don't update state if component is unmounted
            
            if (doc.exists()) {
              const updatedData = doc.data();
              // Process the data and update the listing state
              console.log('[Listing] Received real-time update for listing');
              
              // Only update if there are actual changes to avoid infinite loops
              if (JSON.stringify(updatedData) !== JSON.stringify(data)) {
                console.log('[Listing] Updating listing with new data');
                
                // Process timestamps safely
                const convertTimestamp = (timestamp: any): Date => {
                  try {
                    if (!timestamp) return new Date();
                    
                    // Handle Firestore timestamp objects
                    if (timestamp && typeof timestamp.toDate === 'function') {
                      return timestamp.toDate();
                    }
                    
                    // Handle JavaScript Date objects
                    if (timestamp instanceof Date) {
                      return timestamp;
                    }
                    
                    // Handle numeric timestamps (milliseconds since epoch)
                    if (typeof timestamp === 'number') {
                      return new Date(timestamp);
                    }
                    
                    // Handle string timestamps
                    if (typeof timestamp === 'string') {
                      return new Date(timestamp);
                    }
                    
                    // Default fallback
                    return new Date();
                  } catch (error) {
                    console.error('Error converting timestamp:', error, timestamp);
                    return new Date();
                  }
                };
                
                // Create listing object with careful type handling
                const createdAt = convertTimestamp(updatedData.createdAt);
                const expiresAt = updatedData.expiresAt ? convertTimestamp(updatedData.expiresAt) : 
                  new Date(createdAt.getTime() + (updatedData.isPremium ? 30 : 2) * 24 * 60 * 60 * 1000);
                
                // Process location data safely
                let locationData = undefined;
                if (updatedData.location) {
                  try {
                    locationData = {
                      latitude: typeof updatedData.location.latitude === 'number' ? updatedData.location.latitude : undefined,
                      longitude: typeof updatedData.location.longitude === 'number' ? updatedData.location.longitude : undefined
                    };
                  } catch (error) {
                    console.error('Error processing location data:', error);
                  }
                }
                
                const updatedListing: Listing = {
                  id: doc.id,
                  title: updatedData.title || 'Untitled Listing',
                  description: updatedData.description || '',
                  price: typeof updatedData.price === 'number' ? updatedData.price : 
                         typeof updatedData.price === 'string' ? parseFloat(updatedData.price) : 0,
                  condition: updatedData.condition || 'unknown',
                  game: updatedData.game || 'other',
                  imageUrls: Array.isArray(updatedData.imageUrls) ? updatedData.imageUrls : [],
                  coverImageIndex: typeof updatedData.coverImageIndex === 'number' ? updatedData.coverImageIndex : 0,
                  userId: updatedData.userId || '',
                  username: updatedData.username || 'Unknown User',
                  createdAt: createdAt,
                  expiresAt: expiresAt,
                  status: updatedData.status || 'active',
                  isGraded: Boolean(updatedData.isGraded),
                  gradeLevel: updatedData.gradeLevel ? Number(updatedData.gradeLevel) : undefined,
                  gradingCompany: updatedData.gradingCompany,
                  city: updatedData.city || 'Unknown',
                  state: updatedData.state || 'Unknown',
                  favoriteCount: typeof updatedData.favoriteCount === 'number' ? updatedData.favoriteCount : 0,
                  quantity: updatedData.quantity ? Number(updatedData.quantity) : undefined,
                  cardName: updatedData.cardName || undefined,
                  location: locationData,
                  soldTo: updatedData.soldTo || null,
                  archivedAt: updatedData.archivedAt ? convertTimestamp(updatedData.archivedAt) : null,
                  // Explicitly include offersOnly property with default value
                  offersOnly: updatedData.offersOnly === true,
                  // Explicitly include finalSale property with default value
                  finalSale: updatedData.finalSale === true
                };
                
                // Update the listing state
                setListing(updatedListing);
              }
            }
          }, (error) => {
            console.error('[Listing] Error in real-time listener:', error);
          });
        } catch (listenerError) {
          console.error('[Listing] Failed to set up real-time listener:', listenerError);
          // Continue without real-time updates
        }
        
        if (!data) {
          throw new Error('Listing data is empty');
        }
        
        // Check if the listing is archived
        if (data.status === 'archived' || data.archivedAt) {
          throw new Error('This listing has been archived and is no longer available');
        }
        
        // Safely convert Firestore timestamp to Date with better error handling
        const convertTimestamp = (timestamp: any): Date => {
          try {
            if (!timestamp) return new Date();
            
            // Handle Firestore timestamp objects
            if (timestamp && typeof timestamp.toDate === 'function') {
              return timestamp.toDate();
            }
            
            // Handle JavaScript Date objects
            if (timestamp instanceof Date) {
              return timestamp;
            }
            
            // Handle numeric timestamps (milliseconds since epoch)
            if (typeof timestamp === 'number') {
              return new Date(timestamp);
            }
            
            // Handle string timestamps
            if (typeof timestamp === 'string') {
              return new Date(timestamp);
            }
            
            // Default fallback
            return new Date();
          } catch (error) {
            console.error('Error converting timestamp:', error, timestamp);
            return new Date();
          }
        };
        
        // Get created timestamp with robust error handling
        const createdAt = convertTimestamp(data.createdAt);
        
        // Process location data safely
        let locationData = undefined;
        if (data.location) {
          try {
            locationData = {
              latitude: typeof data.location.latitude === 'number' ? data.location.latitude : undefined,
              longitude: typeof data.location.longitude === 'number' ? data.location.longitude : undefined
            };
          } catch (error) {
            console.error('Error processing location data:', error);
          }
        }
        
        // Create listing object with careful type handling
        const expiresAt = data.expiresAt ? convertTimestamp(data.expiresAt) : new Date(createdAt.getTime() + (data.isPremium ? 30 : 2) * 24 * 60 * 60 * 1000);
        
        const listingData: Listing = {
          id: listingDoc.id,
          title: data.title || 'Untitled Listing',
          description: data.description || '',
          price: typeof data.price === 'number' ? data.price : 
                 typeof data.price === 'string' ? parseFloat(data.price) : 0,
          condition: data.condition || 'unknown',
          game: data.game || 'other',
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
          coverImageIndex: typeof data.coverImageIndex === 'number' ? data.coverImageIndex : 0,
          userId: data.userId || '',
          username: data.username || 'Unknown User',
          createdAt: createdAt,
          // Handle expiresAt field which is required by the Listing type
          expiresAt: expiresAt,
          status: data.status || 'active',
          isGraded: Boolean(data.isGraded),
          gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
          gradingCompany: data.gradingCompany,
          city: data.city || 'Unknown',
          state: data.state || 'Unknown',
          favoriteCount: typeof data.favoriteCount === 'number' ? data.favoriteCount : 0,
          quantity: data.quantity ? Number(data.quantity) : undefined,
          cardName: data.cardName || undefined,
          location: locationData,
          // Add sold status fields
          soldTo: data.soldTo || null,
          archivedAt: data.archivedAt ? convertTimestamp(data.archivedAt) : null,
          // Explicitly include offersOnly property with default value
          offersOnly: data.offersOnly === true,
          // Explicitly include finalSale property with default value
          finalSale: data.finalSale === true
        };
        
        // Make expiresAt available to the client-side code
        if (typeof window !== 'undefined') {
          (window as any).listingExpiresAt = expiresAt;
        }

        if (isMounted) {
          setListing(listingData);
          setLoading(false);
          stopLoading(); // Stop global loading indicator
        }
      } catch (err: any)  {
        console.error('Error fetching listing:', err);
        if (isMounted) {
          setError(err.message || 'Failed to load listing. Please try again later.');
          setLoading(false);
          stopLoading(); // Stop global loading indicator
        }
      }
    }

    fetchListing();

    return () => {
      isMounted = false;
    };
  }, [listingId, user, startLoading, stopLoading]);
  


  // Effect to handle URL parameters for post-login actions
  useEffect(() => {
    if (!router.isReady || !listing || !user) return;

    const { action, recipientId } = router.query;

    if (action === 'make_offer') {
      // Trigger make offer dialog
      setIsOfferDialogOpen(true);
      // Clean up URL parameters
      router.replace(router.asPath.split('?')[0], undefined, { shallow: true });
    } else if (action === 'send_message' && recipientId === listing.userId) {
      // Trigger message dialog/action
      if (isMobile) {
        // For mobile, redirect to message page
        router.push(`/messages/send?recipientId=${listing.userId}&listingId=${listing.id}&listingTitle=${encodeURIComponent(listing.title || '')}&returnTo=${encodeURIComponent(router.asPath)}`);
      } else {
        // For desktop, open chat dialog
        setIsChatOpen(true);
      }
      // Clean up URL parameters
      router.replace(router.asPath.split('?')[0], undefined, { shallow: true });
    }
  }, [router.isReady, router.query, listing, user, isMobile]);
  
  // Dialog is now handled directly in each carousel item

  // We already have the favorites functionality from above

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    const currentlyFavorited = listing ? isFavorite(listing.id) : false;
    console.log('handleFavoriteToggle called', { user: !!user, listing: !!listing, currentlyFavorited });
    
    // Prevent any default form submission or event propagation
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      console.log('No user, redirecting to sign up');
      toast.error('Please sign up to save favorites');
      router.push('/auth/sign-up');
      return;
    }

    if (!listing) {
      console.log('No listing available');
      return;
    }
    
    try {
      console.log('Calling toggleFavorite with listing:', listing.id);
      // Use the simplified toggleFavorite function
      toggleFavorite(listing, e);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      toast.error('Please sign in to make a purchase');
      router.push('/auth/sign-in');
      return;
    }

    if (user.uid === listing?.userId) {
      toast.error('You cannot buy your own listing');
      return;
    }

    try {
      // Make sure we have the user's email
      if (!user.email) {
        toast.error('Your account email is missing. Please update your profile.');
        return;
      }

      // Use the Connect API endpoint with proper parameters
      const response = await fetch('/api/stripe/connect/create-buy-now-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingId: listing?.id,
          userId: user.uid,
          email: user.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific error codes
        if (errorData.code === 'seller_not_connected') {
          // If the current user is the seller, offer to set up Stripe Connect
          if (user.uid === listing?.userId) {
            toast.error('You need to set up your Stripe Connect account to receive payments', {
              action: {
                label: 'Set Up Now',
                onClick: () => router.push('/dashboard/connect-account')
              },
              duration: 5000
            });
          } else {
            toast.error('The seller has not set up their payment account yet. Please try another listing or contact the seller.');
          }
          return;
        } else if (errorData.code === 'seller_not_active') {
          // If the current user is the seller, offer to complete Stripe Connect setup
          if (user.uid === listing?.userId) {
            toast.error('Your Stripe Connect account setup is incomplete', {
              action: {
                label: 'Complete Setup',
                onClick: () => router.push('/dashboard/connect-account')
              },
              duration: 5000
            });
          } else {
            toast.error('The seller\'s payment account is not fully set up yet. Please try another listing or contact the seller.');
          }
          return;
        }
        
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      if (!stripe) throw new Error('Failed to load Stripe');

      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        console.error('Stripe checkout error:', error);
        toast.error(error.message);
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      toast.error(error.message || 'Failed to process purchase. Please try again.');
    }
  };

  const handleMessage = () => {
    if (!user) {
      // Save the redirect state before redirecting to sign-in
      saveRedirectState('send_message', {
        recipientId: listing?.userId,
        listingId: listing?.id,
        listingTitle: listing?.title,
        returnPath: router.asPath
      });
      toast.error('Please sign up to send messages');
      router.push('/auth/sign-up');
      return;
    }

    if (user.uid === listing?.userId) {
      toast.error('You cannot message yourself');
      return;
    }

    // For mobile users, redirect to the dedicated message page
    if (isMobile) {
      router.push(`/messages/send?recipientId=${listing?.userId}&listingId=${listing?.id}&listingTitle=${encodeURIComponent(listing?.title || '')}&returnTo=${encodeURIComponent(router.asPath)}`);
      return;
    }

    // For desktop users, show the chat dialog
    setIsChatOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-4 flex-1">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !listing) {
    const isArchived = error?.includes('archived');
    const isExpired = error?.includes('expired');
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-4 flex-1">
          <Card className="bg-muted">
            <CardContent className="p-6 text-center">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold mb-2">
                  {isArchived || isExpired ? 'Listing No Longer Available' : 'Listing Not Found'}
                </h2>
                <p className="text-muted-foreground">
                  {isArchived || isExpired ? 
                    'This listing has been sold or is no longer available.' : 
                    'We couldn\'t find the listing you\'re looking for.'}
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => router.push('/listings')}
              >
                Browse Available Listings
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }
  
  // Check if the listing is archived and display the "no longer available" message
  if (listing.status === 'archived' || listing.archivedAt) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-4 flex-1">
          <Button 
            variant="ghost" 
            className="mb-4" 
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <Card className="max-w-6xl mx-auto bg-black/[0.2] dark:bg-black/40 backdrop-blur-md border-muted">
            <CardContent className="p-4 md:p-6">
              <div className="bg-red-500/90 text-white p-4 rounded-md mb-4 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold text-lg">
                      This listing is no longer available
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-white/90 pl-8">
                  The seller has archived this listing. It may have been sold elsewhere or is no longer for sale.
                </p>
              </div>
              
              {/* Rest of the archived listing display... */}
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const handleMakeOffer = () => {
    if (!user) {
      toast.error('Please sign in to make an offer');
      router.push('/auth/sign-in');
      return;
    }

    if (user.uid === listing?.userId) {
      toast.error('You cannot make an offer on your own listing');
      return;
    }

    setIsOfferDialogOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-4 flex-1">
        <Button 
          variant="ghost" 
          className="mb-4" 
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="max-w-6xl mx-auto bg-black/[0.2] dark:bg-black/40 backdrop-blur-md border-muted">
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              {/* Mobile title - only visible on small screens */}
              <div className="md:hidden space-y-4 mb-4">
                <div>
                  <h1 className="text-2xl font-bold mb-3">{listing.title}</h1>
                  <div className="flex flex-wrap gap-2">
                    {listing.game && (
                      <GameCategoryBadge game={listing.game} variant="secondary" className="text-sm" />
                    )}
                    <Badge className={`text-sm ${getConditionColor(listing.condition)}`}>
                      {listing.condition}
                    </Badge>
                    {listing.isGraded && (
                      <Badge variant="outline" className="bg-blue-500 text-white text-sm flex items-center gap-1">
                        <svg 
                          viewBox="0 0 24 24" 
                          className="w-4 h-4" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                        >
                          <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                          <path d="M2 17L12 22L22 17" />
                          <path d="M2 12L12 17L22 12" />
                        </svg>
                        {listing.gradingCompany} {listing.gradeLevel}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:space-y-6 order-1 md:order-2">
                <div className="relative">
                  <Carousel 
                    className="w-full h-[300px] md:h-[400px] touch-pan-y embla"
                    onSelect={handleCarouselChange}
                    defaultIndex={listing.coverImageIndex || 0}
                    index={currentImageIndex}
                  >
                    <div className="absolute top-4 right-4 z-10">
                      <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                        {currentImageIndex + 1} of {listing.imageUrls.length}
                      </Badge>
                    </div>
                    {/* Mobile swipe hint - only shown if there are multiple images */}
                    {isMobile && listing.imageUrls.length > 1 && (
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none select-none">
                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm px-3 py-1.5">
                          Swipe to view more images
                        </Badge>
                      </div>
                    )}
                    <CarouselContent>
                      {listing.imageUrls.map((url, index) => (
                        <CarouselItem key={index} className="flex items-center justify-center h-full">
                          <div className="relative w-full h-full group flex items-center justify-center p-4">
                            <div className="relative w-full h-full flex items-center justify-center">
                              <div className="relative w-full h-full">
                                <div className="relative w-full h-full">
                                  <div className="absolute inset-0 rounded-lg animate-pulse bg-gradient-to-r from-gray-200/20 via-gray-100/20 to-gray-200/20 dark:from-gray-800/20 dark:via-gray-700/20 dark:to-gray-800/20 bg-[length:200%_100%]" />
                                  <Image
                                    src={url}
                                    alt={`${listing.title} - Image ${index + 1}`}
                                    fill
                                    className="object-contain rounded-lg"
                                    sizes="(max-width: 640px) 90vw, (max-width: 768px) 70vw, (max-width: 1024px) 50vw, 600px"
                                    priority={index === 0}
                                    loading={index === 0 ? "eager" : "lazy"}
                                    quality={85}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = '/images/rect.png';
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="hidden md:flex -left-4 mx-[40px]" />
                    <CarouselNext className="hidden md:flex -right-4 mx-[40px]" />
                  </Carousel>
                  
                  {/* View Image Link - moved above thumbnails */}
                  <div className="mt-3 text-center">
                    <a
                      href={getCleanImageUrl(listing.imageUrls[currentImageIndex])}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:text-primary/80 underline transition-colors inline-flex items-center gap-1"
                      download={getImageFilename(listing.imageUrls[currentImageIndex])}
                    >
                      <ZoomIn className="w-4 h-4" />
                      View full image
                    </a>
                  </div>

                  {/* Thumbnails - show below carousel for both mobile and desktop */}
                  {listing.imageUrls.length > 1 && (
                    <div className={`flex mt-4 gap-2 overflow-x-auto pb-2 ${
                      isMobile ? 'justify-start' : 'justify-center'
                    }`}>
                      {listing.imageUrls.map((url, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            // Navigate the carousel to the selected image
                            const api = window.__carouselApi;
                            if (api) {
                              api.scrollTo(idx);
                              setCurrentImageIndex(idx);
                            }
                          }}
                          className={`flex-shrink-0 ${
                            isMobile ? 'w-16 h-16' : 'w-20 h-20'
                          } rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                            currentImageIndex === idx 
                              ? "border-blue-500 ring-2 ring-blue-500/30" 
                              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                          }`}
                          aria-label={`Go to image ${idx + 1}`}
                        >
                          <Image
                            src={url}
                            alt={`Thumbnail ${idx + 1}`}
                            width={isMobile ? 64 : 80}
                            height={isMobile ? 64 : 80}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-foreground">
                    {listing.offersOnly === true || (listing.price === 0 && listing.offersOnly !== false) ? (
                      <span>Offers Only</span>
                    ) : formatPrice(listing.price)}
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:space-y-6 order-2 md:order-1">
                {/* Sold/Unavailable Banner */}
                {(listing.soldTo || listing.archivedAt || listing.status === 'sold') && (
                  <div className="bg-red-500/90 text-white p-3 rounded-md mb-4 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="font-semibold">
                          {listing.soldTo ? "This item has been sold" : "This listing is no longer available"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Final Sale Banner */}
                {listing.finalSale && !(listing.soldTo || listing.archivedAt || listing.status === 'sold') && (
                  <div className="bg-orange-500/90 text-white p-3 rounded-md mb-4 shadow-md">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <span className="font-semibold">Final Sale</span>
                        <p className="text-sm text-white/90 mt-1">
                          This item is sold as-is with no returns or refunds accepted.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Desktop title - hidden on mobile */}
                <div className="hidden md:block">
                  <h1 className="text-3xl font-bold mb-3">{listing.title}</h1>
                  <div className="flex flex-wrap gap-2">
                    {listing.game && (
                      <GameCategoryBadge game={listing.game} variant="secondary" className="text-sm" />
                    )}
                    <Badge className={`text-sm ${getConditionColor(listing.condition)}`}>
                      {listing.condition}
                    </Badge>
                    {listing.isGraded && (
                      <Badge variant="outline" className="bg-blue-500 text-white text-sm flex items-center gap-1">
                        <svg 
                          viewBox="0 0 24 24" 
                          className="w-4 h-4" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                        >
                          <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                          <path d="M2 17L12 22L22 17" />
                          <path d="M2 12L12 17L22 12" />
                        </svg>
                        {listing.gradingCompany} {listing.gradeLevel}
                      </Badge>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      className="flex items-center justify-start space-x-2 h-8"
                    >
                      <User className="h-4 w-4" />
                      <UserNameLink userId={listing.userId} initialUsername={listing.username} />
                    </Button>
                    <StripeSellerBadge userId={listing.userId} />
                  </div>
                  <div className="flex items-center text-muted-foreground text-sm">
                    <MapPin className="h-4 w-4 mr-1" />
                    <span>{listing.city}, {listing.state}</span>
                    {listing.location?.latitude && listing.location?.longitude && (
                      <DistanceIndicator 
                        targetLat={listing.location.latitude} 
                        targetLon={listing.location.longitude} 
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {listing.cardName && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Card Name</h2>
                      <p className="text-muted-foreground text-sm md:text-base">{listing.cardName}</p>
                    </div>
                  )}
                  
                  <div>
                    <h2 className="text-lg font-semibold mb-2">Description</h2>
                    {/* Dynamically import MarkdownContent to avoid SSR issues */}
                    {(() => {
                      const MarkdownContent = dynamic(() => import('@/components/MarkdownContent').then(mod => mod.MarkdownContent), {
                        ssr: false,
                        loading: () => {
                          // Import LoadingAnimation component
                          const LoadingAnimation = dynamic(() => import('@/components/LoadingAnimation').then(mod => mod.LoadingAnimation), {
                            ssr: false,
                            loading: () => (
                              <div className="animate-pulse">
                                <div className="h-4 bg-gray-200/20 dark:bg-gray-700/20 rounded w-full mb-2"></div>
                                <div className="h-4 bg-gray-200/20 dark:bg-gray-700/20 rounded w-5/6 mb-2"></div>
                                <div className="h-4 bg-gray-200/20 dark:bg-gray-700/20 rounded w-4/6"></div>
                              </div>
                            )
                          });
                          
                          return (
                            <div className="min-h-[100px] flex flex-col">
                              <LoadingAnimation size="40" color="currentColor" className="text-muted-foreground/50 my-4" />
                            </div>
                          );
                        }
                      });
                      
                      try {
                        // Check if description exists and is not empty
                        const hasDescription = listing.description && listing.description.trim() !== '';
                        
                        return (
                          <div className="max-w-full overflow-hidden min-h-[50px]">
                            <MarkdownContent 
                              content={listing.description || ''} 
                              className="text-muted-foreground text-sm md:text-base"
                              emptyMessage="No description provided for this listing."
                            />
                          </div>
                        );
                      } catch (error) {
                        console.error('Error rendering description:', error);
                        return (
                          <div className="text-muted-foreground italic text-sm md:text-base">
                            Error loading description. Please try refreshing the page.
                          </div>
                        );
                      }
                    })()}
                  </div>

                  {listing.quantity && parseInt(listing.quantity) > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Quantity Available</h2>
                      <p className="text-muted-foreground text-sm md:text-base">{listing.quantity}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    Listed on {listing.createdAt.toLocaleDateString()}
                  </div>
                  {user && user.uid !== listing?.userId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => setIsReportDialogOpen(true)}
                    >
                      <Flag className="h-4 w-4 mr-1" />
                      Report
                    </Button>
                  )}
                </div>
                
                {/* Action buttons section - consistent layout and sizing */}
                <div className="flex flex-col gap-3">
                  {/* Top row: Save and Message buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={(e) => {
                        console.log('Save button clicked');
                        handleFavoriteToggle(e);
                      }}
                      className={`w-full ${user && listing && isFavorite(listing.id) ? "text-red-500" : ""}`}
                      type="button"
                      disabled={listing.soldTo || listing.archivedAt || listing.status === 'sold'}
                    >
                      <Heart className={`h-5 w-5 mr-2 ${user && listing && isFavorite(listing.id) ? "fill-current" : ""}`} />
                      {user && listing && isFavorite(listing.id) ? "Saved" : "Save"}
                    </Button>
                    <MessageDialog
                      recipientId={listing.userId}
                      recipientName={listing.username}
                      listingId={listing.id}
                      listingTitle={listing.title}
                    />
                  </div>
                  
                  {/* Bottom row: Buy Now and Make Offer buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {listing.soldTo || listing.archivedAt || listing.status === 'sold' ? (
                      <Button
                        variant="outline"
                        size="lg"
                        className="col-span-2 bg-gray-200 text-gray-500 hover:bg-gray-200 cursor-not-allowed"
                        disabled={true}
                      >
                        {listing.status === 'sold' ? 'Item Sold' : 'No Longer Available'}
                      </Button>
                    ) : (
                      <>
                        {/* Show Buy Now button only if not "Offers Only" */}
                        {!listing.offersOnly && sellerHasActiveStripeAccount ? (
                          <BuyNowButton
                            listingId={listing.id}
                            sellerId={listing.userId}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            disabled={user?.uid === listing.userId}
                            variant="default"
                            size="lg"
                          >
                            Buy Now
                          </BuyNowButton>
                        ) : !listing.offersOnly ? (
                          <Button
                            variant="outline"
                            size="lg"
                            className="w-full bg-gray-200 text-gray-500 hover:bg-gray-200 cursor-not-allowed"
                            disabled={true}
                            title="Seller has not set up payment processing yet"
                          >
                            Buy Now Unavailable
                          </Button>
                        ) : null}
                        
                        {/* Make Offer button - full width if offers only */}
                        <Button
                          variant={listing.offersOnly ? "default" : "outline"}
                          size="lg"
                          onClick={handleMakeOffer}
                          className={`${listing.offersOnly ? "col-span-2 bg-blue-600 hover:bg-blue-700 text-white" : "w-full border-blue-500 text-blue-500 hover:bg-blue-500/10"}`}
                          disabled={user?.uid === listing.userId || listing.soldTo || listing.archivedAt || listing.status === 'sold'}
                        >
                          {listing.offersOnly ? "Make Offer (Required)" : "Make Offer"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Similar Listings Section - Hidden on mobile */}
      {listing && !isMobile && (
        <div className="container mx-auto px-4">
          <OptimizedSimilarListings currentListing={listing} />
          <OwnerListings 
            ownerId={listing.userId} 
            currentListingId={listing.id} 
            ownerName={listing.username} 
          />
        </div>
      )}

      {/* Mobile Similar Items Section - Only shown on mobile */}
      {listing && isMobile && (
        <MobileSimilarItems currentListing={listing} />
      )}

      <Footer />
      
      {/* Firestore Request Counter */}
      {process.env.NODE_ENV === 'development' && <FirestoreRequestCounter />}

      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent 
          className="max-w-md p-0"
          style={{
            transform: "translate(-50%, -50%) translateZ(0)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            perspective: "1000px",
            WebkitPerspective: "1000px",
            willChange: "transform"
            // Removed manual visibility and opacity styles to let Radix handle them
          }}
        >
          <DialogTitle className="sr-only">Chat with {listing?.username}</DialogTitle>
          <DialogDescription className="sr-only">
            Conversation with {listing?.username} about {listing?.title}
          </DialogDescription>
          {listing && (
            <Chat
              receiverId={listing.userId}
              listingId={listing.id}
              listingTitle={listing.title}
              onClose={() => setIsChatOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {listing && (
        <MakeOfferDialog
          open={isOfferDialogOpen}
          onOpenChange={setIsOfferDialogOpen}
          listingId={listing.id}
          sellerId={listing.userId}
          listingTitle={listing.title}
          listingPrice={listing.price}
          listingImageUrl={listing.imageUrls[0] || ''}
        />
      )}

      {listing && (
        <ReportListingDialog
          open={isReportDialogOpen}
          onOpenChange={setIsReportDialogOpen}
          listingId={listing.id}
          listingTitle={listing.title}
          listingOwnerId={listing.userId}
        />
      )}
    </div>
  );
}