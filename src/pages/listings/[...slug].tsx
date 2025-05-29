import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { extractListingIdFromSlug } from '@/lib/listing-slug';

// This is a catch-all route that handles the new URL format
// /listings/gameCategory/slug-id
export default function ListingCatchAll() {
  const router = useRouter();
  const { slug } = router.query;

  useEffect(() => {
    if (!router.isReady || !slug) return;

    // Handle the new URL format: /listings/gameCategory/slug-id
    if (Array.isArray(slug) && slug.length === 2) {
      const [gameCategory, slugWithId] = slug;
      
      // Extract the listing ID from the slug
      const listingId = extractListingIdFromSlug(slugWithId);
      
      if (listingId) {
        // Redirect to the main listing page with the extracted ID
        router.replace(`/listings/${listingId}`, undefined, { shallow: true });
        return;
      }
    }

    // If we can't parse the URL, redirect to listings page
    router.replace('/listings');
  }, [router, slug]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>
  );
}