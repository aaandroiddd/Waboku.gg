import { doc, getDoc } from 'firebase/firestore';
import { firebaseDb } from './firebase';
import { Listing } from '@/types/database';
import { toast } from 'sonner';

/**
 * Handles post-login actions based on the saved redirect state
 * @param action The action to perform
 * @param params Parameters for the action
 * @param user The authenticated user
 */
export async function handlePostLoginAction(
  action: string,
  params: Record<string, any>,
  user: any,
  toggleFavorite?: (listing: Listing, event?: React.MouseEvent) => Promise<void>
): Promise<boolean> {
  try {
    switch (action) {
      case 'toggle_favorite':
        if (params.listingId && toggleFavorite) {
          // Fetch the listing
          const listingDoc = await getDoc(doc(firebaseDb, 'listings', params.listingId));
          if (listingDoc.exists()) {
            const listing = {
              id: listingDoc.id,
              ...listingDoc.data()
            } as Listing;
            
            // Toggle the favorite
            await toggleFavorite(listing);
            return true;
          }
        }
        return false;
        
      case 'buy_now':
        if (params.listingId) {
          // Redirect to the listing page
          window.location.href = `/listings/${params.listingId}`;
          toast.success('You can now complete your purchase');
          return true;
        }
        return false;
        
      case 'route_guard_redirect':
        // This is handled by the AuthRedirectContext
        return true;
        
      case 'send_message':
        if (params.recipientId && params.returnPath) {
          // Redirect back to the original page
          window.location.href = params.returnPath;
          return true;
        }
        return false;
        
      default:
        return false;
    }
  } catch (error) {
    console.error('Error handling post-login action:', error);
    return false;
  }
}