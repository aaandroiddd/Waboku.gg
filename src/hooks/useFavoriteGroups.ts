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

  const fetchGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const groupsRef = collection(db, 'users', user.uid, 'favoriteGroups');
      const groupsSnapshot = await getDocs(groupsRef);
      
      const groupsData: FavoriteGroup[] = [];
      
      for (const groupDoc of groupsSnapshot.docs) {
        const groupData = groupDoc.data();
        
        // Get count of favorites in this group
        const favoritesRef = collection(db, 'users', user.uid, 'favorites');
        const favoritesQuery = query(favoritesRef, where('groupId', '==', groupDoc.id));
        const favoritesSnapshot = await getDocs(favoritesQuery);
        
        groupsData.push({
          id: groupDoc.id,
          name: groupData.name,
          createdAt: groupData.createdAt?.toDate() || new Date(),
          count: favoritesSnapshot.size
        });
      }
      
      // Sort groups by name
      groupsData.sort((a, b) => a.name.localeCompare(b.name));
      
      setGroups(groupsData);
    } catch (err) {
      console.error('Error fetching favorite groups:', err);
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
      const groupRef = doc(collection(db, 'users', user.uid, 'favoriteGroups'));
      await setDoc(groupRef, {
        name,
        createdAt: new Date()
      });
      
      // Refresh groups
      await fetchGroups();
      
      return groupRef.id;
    } catch (err) {
      console.error('Error creating favorite group:', err);
      throw err;
    }
  }, [user, fetchGroups]);

  const renameGroup = useCallback(async (groupId: string, newName: string) => {
    if (!user) {
      toast.error('Please sign in to rename a group');
      return;
    }

    try {
      const groupRef = doc(db, 'users', user.uid, 'favoriteGroups', groupId);
      await updateDoc(groupRef, {
        name: newName
      });
      
      // Update local state
      setGroups(prevGroups => 
        prevGroups.map(group => 
          group.id === groupId ? { ...group, name: newName } : group
        )
      );
    } catch (err) {
      console.error('Error renaming favorite group:', err);
      throw err;
    }
  }, [user]);

  const deleteGroup = useCallback(async (groupId: string) => {
    if (!user) {
      toast.error('Please sign in to delete a group');
      return;
    }

    try {
      // First, update all favorites in this group to have no group
      const favoritesRef = collection(db, 'users', user.uid, 'favorites');
      const favoritesQuery = query(favoritesRef, where('groupId', '==', groupId));
      const favoritesSnapshot = await getDocs(favoritesQuery);
      
      const batch = writeBatch(db);
      
      favoritesSnapshot.docs.forEach(favoriteDoc => {
        const favoriteRef = doc(db, 'users', user.uid, 'favorites', favoriteDoc.id);
        batch.update(favoriteRef, { groupId: null });
      });
      
      await batch.commit();
      
      // Then delete the group
      const groupRef = doc(db, 'users', user.uid, 'favoriteGroups', groupId);
      await deleteDoc(groupRef);
      
      // Update local state
      setGroups(prevGroups => prevGroups.filter(group => group.id !== groupId));
    } catch (err) {
      console.error('Error deleting favorite group:', err);
      throw err;
    }
  }, [user]);

  const addToGroup = useCallback(async (listingId: string, groupId: string) => {
    if (!user) {
      toast.error('Please sign in to add to a group');
      return;
    }

    try {
      const favoriteRef = doc(db, 'users', user.uid, 'favorites', listingId);
      const favoriteDoc = await getDoc(favoriteRef);
      
      if (!favoriteDoc.exists()) {
        throw new Error('Favorite not found');
      }
      
      await updateDoc(favoriteRef, {
        groupId
      });
      
      // Update group counts
      await fetchGroups();
    } catch (err) {
      console.error('Error adding to group:', err);
      throw err;
    }
  }, [user, fetchGroups]);

  const removeFromGroup = useCallback(async (listingId: string) => {
    if (!user) {
      toast.error('Please sign in to remove from group');
      return;
    }

    try {
      const favoriteRef = doc(db, 'users', user.uid, 'favorites', listingId);
      const favoriteDoc = await getDoc(favoriteRef);
      
      if (!favoriteDoc.exists()) {
        throw new Error('Favorite not found');
      }
      
      await updateDoc(favoriteRef, {
        groupId: null
      });
      
      // Update group counts
      await fetchGroups();
    } catch (err) {
      console.error('Error removing from group:', err);
      throw err;
    }
  }, [user, fetchGroups]);

  const createAndAddToGroup = useCallback(async (listingId: string, groupName: string) => {
    if (!user) {
      toast.error('Please sign in to create a group');
      return;
    }

    try {
      // Create the group
      const groupId = await createGroup(groupName);
      
      if (!groupId) {
        throw new Error('Failed to create group');
      }
      
      // Add the listing to the group
      await addToGroup(listingId, groupId);
    } catch (err) {
      console.error('Error creating and adding to group:', err);
      throw err;
    }
  }, [user, createGroup, addToGroup]);

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
    refresh: fetchGroups
  };
}