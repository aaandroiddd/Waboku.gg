import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, push, set, get, query, orderByChild, equalTo, remove, update } from 'firebase/database';
import { database } from '@/lib/firebase';

export type WantedPostCondition = 
  | 'any'
  | 'near_mint'
  | 'lightly_played'
  | 'moderately_played'
  | 'heavily_played'
  | 'damaged';

export interface WantedPost {
  id: string;
  title: string;
  description: string;
  game: string;
  cardName?: string;
  condition: WantedPostCondition;
  isPriceNegotiable: boolean;
  priceRange?: {
    min: number;
    max: number;
  };
  location: string;
  detailedDescription?: string;
  createdAt: number;
  userId: string;
  userName: string;
  userAvatar?: string;
}

interface WantedPostsOptions {
  game?: string;
  state?: string;
  userId?: string;
  limit?: number;
}

export function useWantedPosts(options: WantedPostsOptions = {}) {
  const [posts, setPosts] = useState<WantedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchWantedPosts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let postsRef = ref(database, 'wantedPosts');
        let postsQuery = postsRef;

        // Apply filters based on options
        if (options.userId) {
          postsQuery = query(postsRef, orderByChild('userId'), equalTo(options.userId));
        } else if (options.game) {
          postsQuery = query(postsRef, orderByChild('game'), equalTo(options.game));
        }

        const snapshot = await get(postsQuery);
        const fetchedPosts: WantedPost[] = [];

        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            const post = {
              id: childSnapshot.key as string,
              ...childSnapshot.val()
            };
            fetchedPosts.push(post);
          });
        }

        // Apply additional filters that can't be done at the database level
        let filteredPosts = [...fetchedPosts];
        
        if (options.state) {
          filteredPosts = filteredPosts.filter(post => 
            post.location.toLowerCase().includes(options.state!.toLowerCase())
          );
        }
        
        // Sort by createdAt (newest first)
        filteredPosts.sort((a, b) => b.createdAt - a.createdAt);
        
        // Apply limit if specified
        if (options.limit && filteredPosts.length > options.limit) {
          filteredPosts = filteredPosts.slice(0, options.limit);
        }
        
        setPosts(filteredPosts);
      } catch (err) {
        console.error('Error fetching wanted posts:', err);
        setError('Failed to load wanted posts. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWantedPosts();
  }, [options.game, options.state, options.userId, options.limit]);

  const createWantedPost = async (postData: Omit<WantedPost, 'id' | 'createdAt' | 'userId' | 'userName' | 'userAvatar'>) => {
    if (!user) {
      console.error('Create wanted post failed: User not authenticated');
      throw new Error('User must be authenticated to create a wanted post');
    }

    // Validate required fields
    if (!postData.title || !postData.game || !postData.location) {
      console.error('Create wanted post failed: Missing required fields', { 
        hasTitle: !!postData.title, 
        hasGame: !!postData.game, 
        hasLocation: !!postData.location 
      });
      throw new Error('Missing required fields for wanted post');
    }

    try {
      console.log('Creating wanted post with data:', {
        title: postData.title,
        game: postData.game,
        condition: postData.condition,
        location: postData.location
      });

      // Validate database is initialized
      if (!database) {
        console.error('Create wanted post failed: Firebase database not initialized');
        throw new Error('Database connection error. Please try again later.');
      }

      // Create a reference to the wanted posts collection
      const postsRef = ref(database, 'wantedPosts');
      
      // Generate a new post ID
      const newPostRef = push(postsRef);
      if (!newPostRef || !newPostRef.key) {
        console.error('Create wanted post failed: Could not generate post ID');
        throw new Error('Failed to generate post ID. Please try again.');
      }
      
      const newPostId = newPostRef.key as string;
      console.log('Generated new post ID:', newPostId);
      
      // Create timestamp
      const timestamp = Date.now();
      
      // Create the new post object
      const newPost = {
        ...postData,
        createdAt: timestamp,
        userId: user.uid,
        userName: user.displayName || 'Anonymous User',
        userAvatar: user.photoURL || undefined,
      };
      
      // Save to Firebase
      console.log('Saving post to Firebase...');
      await set(newPostRef, newPost);
      console.log('Post saved successfully');
      
      // Update local state
      setPosts(prevPosts => [{
        ...newPost,
        id: newPostId
      } as WantedPost, ...prevPosts]);
      
      return newPostId;
    } catch (err) {
      // Detailed error logging
      console.error('Error creating wanted post:', err);
      
      // Log specific error details
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
      }
      
      // Check for Firebase permission errors
      if (err instanceof Error && err.message.includes('permission_denied')) {
        console.error('Firebase permission denied error. Check database rules.');
        throw new Error('You do not have permission to create posts. Please check your account status.');
      }
      
      throw new Error('Failed to create wanted post. Please try again.');
    }
  };

  const deleteWantedPost = async (postId: string) => {
    if (!user) {
      throw new Error('User must be authenticated to delete a wanted post');
    }

    try {
      // Get the post to verify ownership
      const postRef = ref(database, `wantedPosts/${postId}`);
      const snapshot = await get(postRef);
      
      if (!snapshot.exists()) {
        throw new Error('Post not found');
      }
      
      const post = snapshot.val();
      
      // Verify the user owns this post
      if (post.userId !== user.uid) {
        throw new Error('You do not have permission to delete this post');
      }
      
      // Delete the post
      await remove(postRef);
      
      // Update local state
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
      
      return true;
    } catch (err) {
      console.error('Error deleting wanted post:', err);
      throw new Error('Failed to delete wanted post. Please try again.');
    }
  };

  const updateWantedPost = async (postId: string, updates: Partial<Omit<WantedPost, 'id' | 'createdAt' | 'userId' | 'userName' | 'userAvatar'>>) => {
    if (!user) {
      throw new Error('User must be authenticated to update a wanted post');
    }

    try {
      // Get the post to verify ownership
      const postRef = ref(database, `wantedPosts/${postId}`);
      const snapshot = await get(postRef);
      
      if (!snapshot.exists()) {
        throw new Error('Post not found');
      }
      
      const post = snapshot.val();
      
      // Verify the user owns this post
      if (post.userId !== user.uid) {
        throw new Error('You do not have permission to update this post');
      }
      
      // Update the post
      await update(postRef, updates);
      
      // Update local state
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, ...updates } 
            : post
        )
      );
      
      return true;
    } catch (err) {
      console.error('Error updating wanted post:', err);
      throw new Error('Failed to update wanted post. Please try again.');
    }
  };

  const getWantedPost = async (postId: string): Promise<WantedPost | null> => {
    try {
      const postRef = ref(database, `wantedPosts/${postId}`);
      const snapshot = await get(postRef);
      
      if (!snapshot.exists()) {
        return null;
      }
      
      return {
        id: postId,
        ...snapshot.val()
      };
    } catch (err) {
      console.error('Error fetching wanted post:', err);
      return null;
    }
  };

  const getUserWantedPosts = () => {
    if (!user) return [];
    return posts.filter(post => post.userId === user.uid);
  };

  return {
    posts,
    isLoading,
    error,
    createWantedPost,
    deleteWantedPost,
    updateWantedPost,
    getWantedPost,
    getUserWantedPosts,
  };
}