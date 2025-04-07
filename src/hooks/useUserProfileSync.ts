import { useState } from 'react';
import { syncUserProfile, updateUserProfile } from '@/lib/user-profile-sync';

/**
 * Hook for managing user profile synchronization between Firestore and Realtime Database
 * 
 * @returns Functions and state for user profile synchronization
 */
export function useUserProfileSync() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update a user's profile and sync the changes to Realtime Database
   * 
   * @param userId - The user's unique identifier
   * @param profileData - Object containing profile data to update
   * @returns Promise that resolves when update is complete
   */
  const updateProfile = async (
    userId: string, 
    profileData: { displayName?: string; avatarUrl?: string | null; [key: string]: any }
  ) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      await updateUserProfile(userId, profileData);
      return true;
    } catch (err) {
      console.error('Error updating user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user profile');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Manually sync a user's profile to Realtime Database
   * 
   * @param userId - The user's unique identifier
   * @param displayName - The user's display name
   * @param avatarUrl - The user's avatar URL (optional)
   * @returns Promise that resolves when sync is complete
   */
  const syncProfile = async (
    userId: string, 
    displayName: string, 
    avatarUrl?: string | null
  ) => {
    setIsUpdating(true);
    setError(null);
    
    try {
      await syncUserProfile(userId, displayName, avatarUrl);
      return true;
    } catch (err) {
      console.error('Error syncing user profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync user profile');
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    updateProfile,
    syncProfile,
    isUpdating,
    error
  };
}