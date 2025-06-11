import { firebaseDb as db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  updateDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface FavoriteGroup {
  id: string;
  name: string;
  createdAt: Date;
  count?: number;
}

export function useFavoriteGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<FavoriteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!user) {
      console.log('No user found, clearing groups');
      setGroups([]);
      setIsLoading(false);
      return;
    }

    try {
      console.log('Fetching favorite groups for user:', user.uid);
      setIsLoading(true);
      setError(null);
      
      const groupsRef = collection(db, 'users', user.uid, 'favoriteGroups');
      console.log('Groups collection path:', groupsRef.path);
      
      const groupsSnapshot = await getDocs(groupsRef);
      console.log('Found', groupsSnapshot.size, 'groups in database');
      
      const groupsData: FavoriteGroup[] = [];
      let defaultGroup: FavoriteGroup | null = null;
      
      for (const groupDoc of groupsSnapshot.docs) {
        const groupData = groupDoc.data();
        console.log('Processing group:', groupDoc.id, groupData);
        
        // Get count of favorites in this group
        const favoritesRef = collection(db, 'users', user.uid, 'favorites');
        const favoritesQuery = query(favoritesRef, where('groupId', '==', groupDoc.id));
        const favoritesSnapshot = await getDocs(favoritesQuery);
        
        const group = {
          id: groupDoc.id,
          name: groupData.name,
          createdAt: groupData.createdAt?.toDate() || new Date(),
          count: favoritesSnapshot.size
        };
        
        // Check if this is the default group
        if (groupData.name === 'Default') {
          defaultGroup = group;
          setDefaultGroupId(groupDoc.id);
          console.log('Found default group with ID:', groupDoc.id);
        }
        
        groupsData.push(group);
      }
      
      // Create default group if it doesn't exist
      if (!defaultGroup && user) {
        try {
          console.log('No default group found, creating one...');
          
          // Generate a new document reference
          const defaultGroupRef = doc(groupsRef);
          console.log('Creating default group with path:', defaultGroupRef.path);
          
          // Create the document with the group data
          await setDoc(defaultGroupRef, {
            name: 'Default',
            createdAt: new Date(),
            isDefault: true
          });
          
          console.log('Default group created successfully with ID:', defaultGroupRef.id);
          
          // Add to groups data
          const newDefaultGroup = {
            id: defaultGroupRef.id,
            name: 'Default',
            createdAt: new Date(),
            count: 0
          };
          
          groupsData.push(newDefaultGroup);
          setDefaultGroupId(defaultGroupRef.id);
        } catch (err) {
          console.error('Error creating default group:', err);
          console.error('Error details:', {
            message: err instanceof Error ? err.message : 'Unknown error',
            code: (err as any)?.code,
            stack: err instanceof Error ? err.stack : undefined
          });
        }
      }
      
      // Sort groups by name, but put Default first
      groupsData.sort((a, b) => {
        if (a.name === 'Default') return -1;
        if (b.name === 'Default') return 1;
        return a.name.localeCompare(b.name);
      });
      
      console.log('Final groups data:', groupsData);
      setGroups(groupsData);
    } catch (err) {
      console.error('Error fetching favorite groups:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        code: (err as any)?.code,
        stack: err instanceof Error ? err.stack : undefined
      });
      setError(err instanceof Error ? err.message : 'Failed to fetch favorite groups');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const createGroup = useCallback(async (name: string) => {
    if (!user) {
      toast.error('Please sign in to create a group');
      return;
    }

    try {
      console.log('Creating favorite group with name:', name);
      
      // Ensure the favoriteGroups collection exists
      const groupsCollectionRef = collection(db, 'users', user.uid, 'favoriteGroups');
      
      // Check if a group with this name already exists
      const existingGroupsQuery = query(groupsCollectionRef, where('name', '==', name));
      const existingGroupsSnapshot = await getDocs(existingGroupsQuery);
      
      if (!existingGroupsSnapshot.empty) {
        console.log('Group with this name already exists');
        toast.error('A group with this name already exists');
        return null;
      }
      
      // Generate a new document reference
      const groupRef = doc(groupsCollectionRef);
      console.log('Group document path:', groupRef.path);
      
      // Create the document with the group data
      await setDoc(groupRef, {
        name,
        createdAt: new Date()
      });
      
      console.log('Group created successfully with ID:', groupRef.id);
      
      // Refresh groups
      await fetchGroups();
      
      return groupRef.id;
    } catch (err) {
      console.error('Error creating favorite group:', err);
      
      // Log more detailed error information
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        
        // Show a more specific error message to the user
        if (err.message.includes('permission-denied')) {
          toast.error('Permission denied. Please check your account permissions.');
        } else if (err.message.includes('network')) {
          toast.error('Network error. Please check your internet connection.');
        } else {
          toast.error(`Failed to create group: ${err.message}`);
        }
      } else {
        toast.error('An unknown error occurred while creating the group');
      }
      
      throw err;
    }
  }, [user, fetchGroups]);

  const renameGroup = useCallback(async (groupId: string, newName: string) => {
    if (!user) {
      toast.error('Please sign in to rename a group');
      return;
    }

    try {
      console.log('Renaming group with ID:', groupId, 'to:', newName);
      
      const groupRef = doc(db, 'users', user.uid, 'favoriteGroups', groupId);
      await updateDoc(groupRef, {
        name: newName
      });
      
      console.log('Group renamed successfully');
      
      // Update local state
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? { ...group, name: newName } : group
        )
      );
    } catch (err) {
      console.error('Error renaming favorite group:', err);
      
      // Log more detailed error information
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        
        // Show a more specific error message to the user
        if (err.message.includes('permission-denied')) {
          toast.error('Permission denied. Please check your account permissions.');
        } else if (err.message.includes('network')) {
          toast.error('Network error. Please check your internet connection.');
        } else if (err.message.includes('not-found')) {
          toast.error('Group not found. It may have been deleted.');
        } else {
          toast.error(`Failed to rename group: ${err.message}`);
        }
      } else {
        toast.error('An unknown error occurred while renaming the group');
      }
      
      throw err;
    }
  }, [user]);

  const deleteGroup = useCallback(async (groupId: string) => {
    if (!user) {
      toast.error('Please sign in to delete a group');
      return;
    }

    try {
      console.log('Deleting group with ID:', groupId);
      
      // First, update all favorites in this group to have no group
      const favoritesRef = collection(db, 'users', user.uid, 'favorites');
      const favoritesQuery = query(favoritesRef, where('groupId', '==', groupId));
      const favoritesSnapshot = await getDocs(favoritesQuery);
      
      console.log(`Found ${favoritesSnapshot.size} favorites to update`);
      
      if (favoritesSnapshot.size > 0) {
        const batch = writeBatch(db);
        
        favoritesSnapshot.docs.forEach(favoriteDoc => {
          const favoriteRef = doc(db, 'users', user.uid, 'favorites', favoriteDoc.id);
          batch.update(favoriteRef, { groupId: null });
        });
        
        await batch.commit();
        console.log('Updated all favorites to remove group reference');
      }
      
      // Then delete the group
      const groupRef = doc(db, 'users', user.uid, 'favoriteGroups', groupId);
      await deleteDoc(groupRef);
      console.log('Group deleted successfully');
      
      // Update local state
      setGroups(prevGroups => prevGroups.filter(group => group.id !== groupId));
    } catch (err) {
      console.error('Error deleting favorite group:', err);
      
      // Log more detailed error information
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        
        // Show a more specific error message to the user
        if (err.message.includes('permission-denied')) {
          toast.error('Permission denied. Please check your account permissions.');
        } else if (err.message.includes('network')) {
          toast.error('Network error. Please check your internet connection.');
        } else if (err.message.includes('not-found')) {
          toast.error('Group not found. It may have been deleted already.');
        } else {
          toast.error(`Failed to delete group: ${err.message}`);
        }
      } else {
        toast.error('An unknown error occurred while deleting the group');
      }
      
      throw err;
    }
  }, [user]);

  const addToGroup = useCallback(async (listingId: string, groupId: string) => {
    if (!user) {
      toast.error('Please sign in to add to a group');
      return;
    }

    try {
      console.log(`Adding listing ${listingId} to group ${groupId}`);
      
      // First check if the group exists
      const groupRef = doc(db, 'users', user.uid, 'favoriteGroups', groupId);
      const groupDoc = await getDoc(groupRef);
      
      if (!groupDoc.exists()) {
        console.error('Group not found:', groupId);
        toast.error('The selected group no longer exists');
        throw new Error('Group not found');
      }
      
      // Then check if the favorite exists
      const favoriteRef = doc(db, 'users', user.uid, 'favorites', listingId);
      const favoriteDoc = await getDoc(favoriteRef);
      
      if (!favoriteDoc.exists()) {
        console.error('Favorite not found:', listingId);
        toast.error('The favorite listing no longer exists');
        throw new Error('Favorite not found');
      }
      
      // Update the favorite with the group ID
      await updateDoc(favoriteRef, {
        groupId
      });
      
      console.log('Successfully added listing to group');
      
      // Update group counts
      await fetchGroups();
    } catch (err) {
      console.error('Error adding to group:', err);
      
      // Log more detailed error information
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        
        // Show a more specific error message to the user
        if (err.message.includes('permission-denied')) {
          toast.error('Permission denied. Please check your account permissions.');
        } else if (err.message.includes('network')) {
          toast.error('Network error. Please check your internet connection.');
        } else if (!err.message.includes('Group not found') && !err.message.includes('Favorite not found')) {
          toast.error(`Failed to add to group: ${err.message}`);
        }
      } else {
        toast.error('An unknown error occurred while adding to group');
      }
      
      throw err;
    }
  }, [user, fetchGroups]);

  const removeFromGroup = useCallback(async (listingId: string) => {
    if (!user) {
      toast.error('Please sign in to remove from group');
      return;
    }

    try {
      console.log(`Removing listing ${listingId} from group`);
      
      const favoriteRef = doc(db, 'users', user.uid, 'favorites', listingId);
      const favoriteDoc = await getDoc(favoriteRef);
      
      if (!favoriteDoc.exists()) {
        console.error('Favorite not found:', listingId);
        toast.error('The favorite listing no longer exists');
        throw new Error('Favorite not found');
      }
      
      // Check if the favorite is actually in a group
      const favoriteData = favoriteDoc.data();
      if (!favoriteData.groupId) {
        console.log('Listing is not in any group, no need to remove');
        return;
      }
      
      // Update the favorite to remove the group ID
      await updateDoc(favoriteRef, {
        groupId: null
      });
      
      console.log('Successfully removed listing from group');
      
      // Update group counts
      await fetchGroups();
    } catch (err) {
      console.error('Error removing from group:', err);
      
      // Log more detailed error information
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        
        // Show a more specific error message to the user
        if (err.message.includes('permission-denied')) {
          toast.error('Permission denied. Please check your account permissions.');
        } else if (err.message.includes('network')) {
          toast.error('Network error. Please check your internet connection.');
        } else if (!err.message.includes('Favorite not found')) {
          toast.error(`Failed to remove from group: ${err.message}`);
        }
      } else {
        toast.error('An unknown error occurred while removing from group');
      }
      
      throw err;
    }
  }, [user, fetchGroups]);

  const createAndAddToGroup = useCallback(async (listingId: string, groupName: string) => {
    if (!user) {
      toast.error('Please sign in to create a group');
      return null;
    }

    try {
      console.log(`Creating new group "${groupName}" and adding listing ${listingId}`);
      
      // Check if a group with this name already exists
      const groupsCollectionRef = collection(db, 'users', user.uid, 'favoriteGroups');
      const existingGroupsQuery = query(groupsCollectionRef, where('name', '==', groupName));
      const existingGroupsSnapshot = await getDocs(existingGroupsQuery);
      
      let groupId;
      
      if (!existingGroupsSnapshot.empty) {
        // If group already exists, use that group instead of creating a new one
        console.log('Group with this name already exists, using existing group');
        groupId = existingGroupsSnapshot.docs[0].id;
        toast.info('Added to existing group with the same name');
      } else {
        // Create the group
        groupId = await createGroup(groupName);
        
        if (!groupId) {
          console.error('Failed to create group - no group ID returned');
          return null; // Return early instead of throwing error since createGroup already shows an error toast
        }
        
        console.log(`Group created with ID: ${groupId}, now adding listing`);
      }
      
      // Add the listing to the group
      try {
        console.log(`Adding listing ${listingId} to group ${groupId}`);
        
        // First check if the listing is already a favorite
        const favoriteRef = doc(db, 'users', user.uid, 'favorites', listingId);
        const favoriteDoc = await getDoc(favoriteRef);
        
        if (favoriteDoc.exists()) {
          // If it's already a favorite, just update the group ID
          await updateDoc(favoriteRef, { groupId });
          console.log('Updated existing favorite with new group ID');
        } else {
          // If it's not a favorite yet, create it with the group ID
          await setDoc(favoriteRef, {
            listingId,
            createdAt: new Date(),
            groupId
          });
          console.log('Created new favorite with group ID');
        }
        
        console.log('Successfully added listing to group');
      } catch (addError) {
        console.error('Error adding listing to group:', addError);
        // If adding to group fails, we still want to return the groupId
        // so the dialog knows the group was created successfully
        toast.error('Group created but failed to add listing. Please try adding it manually.');
      }
      
      // Refresh groups to update counts - this is important to ensure UI is updated
      await fetchGroups();
      
      return groupId;
    } catch (err) {
      console.error('Error creating and adding to group:', err);
      
      // Log more detailed error information
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack
        });
        
        // Show a more specific error message to the user
        if (err.message.includes('permission-denied')) {
          toast.error('Permission denied. Please check your account permissions.');
        } else if (err.message.includes('network')) {
          toast.error('Network error. Please check your internet connection.');
        } else {
          toast.error(`Failed to add listing to group: ${err.message}`);
        }
      } else {
        toast.error('An unknown error occurred while adding to group');
      }
      
      throw err;
    }
  }, [user, createGroup, addToGroup, fetchGroups]);

  useEffect(() => {
    fetchGroups();
  }, [user, fetchGroups]);

  return {
    groups,
    isLoading,
    error,
    createGroup,
    renameGroup,
    deleteGroup,
    addToGroup,
    removeFromGroup,
    createAndAddToGroup,
    refresh: fetchGroups,
    defaultGroupId
  };
}