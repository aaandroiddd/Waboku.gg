import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { extractListingIdFromSlug } from '@/lib/listing-slug';

// This is a catch-all route that handles the new URL format
// /listings/gameCategory/slug-7digitid
export default function ListingCatchAll() {
  const router = useRouter();
  const { slug } = router.query;
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!router.isReady || !slug || isResolving) return;

    const resolveAndRedirect = async () => {
      setIsResolving(true);

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
                  // Redirect to the main listing page with the full ID
                  router.replace(`/listings/${data.fullId}`, undefined, { shallow: true });
                  return;
                }
              }
              
              console.log('Failed to resolve short ID:', shortId);
            } catch (error) {
              console.error('Error resolving short ID:', error);
            }
          }
        }

        // If we can't parse the URL or resolve the ID, redirect to listings page
        console.log('Unable to resolve listing URL, redirecting to listings page');
        router.replace('/listings');
      } finally {
        setIsResolving(false);
      }
    };

    resolveAndRedirect();
  }, [router, slug, isResolving]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>
  );
}