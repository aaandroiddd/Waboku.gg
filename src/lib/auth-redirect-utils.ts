import { Listing } from '@/types/database';
import { toast } from 'sonner';

/**
 * Checks if a sign-out operation is in progress
 * @returns true if sign-out is in progress, false otherwise
 */
export function isSignOutInProgress(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // Check for the sign-out flag
    const signOutFlag = localStorage.getItem('waboku_signout_in_progress') === 'true';
    
    // Also check if the user is already signed out by checking for auth data
    const noAuthUser = !localStorage.getItem('firebase:authUser');
    
    return signOutFlag || noAuthUser;
  } catch (error) {
    console.warn('Error checking sign-out status:', error);
    return false;
  }
}

/**
 * Handles post-login actions based on the saved redirect state
 * @param action The action to perform
 * @param params Parameters for the action
 * @param user The authenticated user
 * @param router Optional Next.js router instance for client-side navigation
 */
export async function handlePostLoginAction(
  action: string,
  params: Record<string, any>,
  user: any,
  router?: any
): Promise<boolean> {
  try {
    console.log('Handling post-login action:', { action, params, hasRouter: !!router });
    
    switch (action) {
      case 'toggle_favorite':
        if (params.listingId) {
          // Use router if available, otherwise fallback to window.location
          if (router) {
            await router.push(`/listings/${params.listingId}`);
          } else {
            window.location.href = `/listings/${params.listingId}`;
          }
          toast.success('You can now add this listing to your favorites');
          return true;
        }
        return false;
        
      case 'buy_now':
        if (params.listingId) {
          // Use router if available, otherwise fallback to window.location
          if (router) {
            await router.push(`/listings/${params.listingId}`);
          } else {
            window.location.href = `/listings/${params.listingId}`;
          }
          toast.success('You can now complete your purchase');
          return true;
        }
        return false;
        
      case 'make_offer':
        if (params.listingId) {
          console.log('Redirecting to make offer for listing:', params.listingId);
          
          // Use router if available for better client-side navigation
          if (router) {
            const url = `/listings/${params.listingId}?action=make_offer`;
            console.log('Using router.push to:', url);
            await router.push(url);
          } else {
            // Fallback to window.location
            const url = new URL(`/listings/${params.listingId}`, window.location.origin);
            url.searchParams.set('action', 'make_offer');
            console.log('Using window.location.href to:', url.toString());
            window.location.href = url.toString();
          }
          return true;
        }
        return false;
        
      case 'send_message':
        if (params.recipientId && params.listingId) {
          // Use router if available, otherwise fallback to window.location
          if (router) {
            const url = `/listings/${params.listingId}?action=send_message&recipientId=${params.recipientId}`;
            await router.push(url);
          } else {
            const url = new URL(`/listings/${params.listingId}`, window.location.origin);
            url.searchParams.set('action', 'send_message');
            url.searchParams.set('recipientId', params.recipientId);
            window.location.href = url.toString();
          }
          return true;
        } else if (params.recipientId && params.returnPath) {
          // Fallback: redirect back to the original page
          if (router) {
            await router.push(params.returnPath);
          } else {
            window.location.href = params.returnPath;
          }
          return true;
        }
        return false;
        
      case 'route_guard_redirect':
        if (params.returnPath) {
          // Use router if available, otherwise fallback to window.location
          if (router) {
            await router.push(params.returnPath);
          } else {
            window.location.href = params.returnPath;
          }
          return true;
        }
        return false;
        
      default:
        console.log('Unknown action:', action);
        return false;
    }
  } catch (error) {
    console.error('Error handling post-login action:', error);
    return false;
  }
}