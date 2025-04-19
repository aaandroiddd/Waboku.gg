import { Listing } from '@/types/database';
import { toast } from 'sonner';

/**
 * Handles post-login actions based on the saved redirect state
 * @param action The action to perform
 * @param params Parameters for the action
 * @param user The authenticated user
 */
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
 */
export async function handlePostLoginAction(
  action: string,
  params: Record<string, any>,
  user: any
): Promise<boolean> {
  try {
    switch (action) {
      case 'toggle_favorite':
        if (params.listingId) {
          // Redirect to the listing page
          window.location.href = `/listings/${params.listingId}`;
          toast.success('You can now add this listing to your favorites');
          return true;
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