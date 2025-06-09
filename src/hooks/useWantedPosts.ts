import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, push, set, get, query, orderByChild, equalTo, remove, update } from 'firebase/database';
import { firebaseDatabase as database } from '@/lib/firebase';

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
  viewCount?: number;
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
    // Create a cache key based on the current options
    const cacheKey = `wantedPosts_${options.game || 'all'}_${options.state || 'all'}_${options.userId || 'all'}_${options.limit || 'none'}`;
    
    // Track if this effect is still the most recent one
    const effectId = Date.now();
    
    // Store the current effect ID to prevent race conditions (only if sessionStorage is available)
    const currentEffectIdKey = 'current_wanted_posts_effect_id';
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem(currentEffectIdKey, effectId.toString());
      } catch (e) {
        console.error("Error setting effect ID in sessionStorage:", e);
      }
    }
    
    // Check if we have cached data in sessionStorage (only if available)
    let cachedPosts: WantedPost[] | null = null;
    
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) {
          cachedPosts = JSON.parse(cachedData);
          // Set posts from cache immediately to improve perceived performance
          setPosts(cachedPosts);
          // If we have recent cached data (less than 60 seconds old), don't refetch
          const cacheTimestamp = sessionStorage.getItem(`${cacheKey}_timestamp`);
          if (cacheTimestamp) {
            const cacheAge = Date.now() - parseInt(cacheTimestamp);
            if (cacheAge < 60000) { // 60 seconds
              setIsLoading(false);
              return; // Skip fetching if cache is recent
            }
          }
        }
      } catch (e) {
        console.error("Error parsing cached posts:", e);
        // Clear invalid cache
        try {
          sessionStorage.removeItem(cacheKey);
          sessionStorage.removeItem(`${cacheKey}_timestamp`);
        } catch (clearError) {
          console.error("Error clearing cache:", clearError);
        }
      }
    }
    
    // Track if this effect is still the most recent one
    const fetchId = Date.now();
    
    const fetchWantedPosts = async () => {
      // If we're using cached data, don't show loading state
      if (!cachedPosts) {
        setIsLoading(true);
      }
      setError(null);

      try {
        console.log(`Fetching wanted posts with options (fetchId: ${fetchId}):`, options);
        
        // Use API endpoint instead of direct Firebase client access
        // This ensures we can fetch data even if client-side Firebase database isn't properly initialized
        console.log('Using API endpoint to fetch wanted posts...');
        
        const response = await fetch('/api/wanted/fetch-all');
        const apiResult = await response.json();
        
        let fetchedPosts: WantedPost[] = [];
        
        if (response.ok && apiResult.success && apiResult.posts) {
          fetchedPosts = apiResult.posts;
          console.log(`Successfully fetched ${fetchedPosts.length} posts from API (path: ${apiResult.path})`);
        } else {
          // Fallback: try direct Firebase access if API fails
          console.log('API fetch failed, falling back to direct Firebase access...');
          
          // Log Firebase database status and connection details
          console.log("Database initialized:", !!database);
          
          // Verify database connection
          if (!database) {
            await logToServer('Database not initialized when fetching wanted posts', {
              databaseExists: !!database,
              databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
            }, 'error');
            throw new Error('Database not initialized and API fetch failed');
          }
          
          // Try paths in order of preference: wantedPosts (where data actually exists), wanted/posts, wanted
          const pathsToTry = ['wantedPosts', 'wanted/posts', 'wanted'];
          let postsRef = null;
          let snapshot = null;
          let usedPath = '';
          
          for (const path of pathsToTry) {
            try {
              console.log(`Trying path: ${path}`);
              postsRef = ref(database, path);
              snapshot = await get(postsRef);
              
              if (snapshot.exists()) {
                console.log(`Found data at path: ${path}`);
                usedPath = path;
                break;
              } else {
                console.log(`No data found at path: ${path}`);
              }
            } catch (pathError) {
              console.error(`Error checking path ${path}:`, pathError);
              continue;
            }
          }
          
          if (!snapshot || !snapshot.exists()) {
            console.log("No posts found in any path");
            setPosts([]);
            return;
          }
          
          console.log(`Using data from path: ${usedPath}`);
          
          // Process the data
          const data = snapshot.val();
          
          // Handle different data structures
          if (typeof data === 'object' && data !== null) {
            Object.entries(data).forEach(([key, value]) => {
              try {
                const postData = value as any;
                
                // Validate post data has required fields
                if (!postData || typeof postData !== 'object' || !postData.title || !postData.game) {
                  console.warn('Skipping invalid post data:', key, postData);
                  return;
                }
                
                const post: WantedPost = {
                  id: key,
                  title: postData.title,
                  description: postData.description || '',
                  game: postData.game,
                  condition: postData.condition || 'any',
                  isPriceNegotiable: postData.isPriceNegotiable !== false,
                  location: postData.location || 'Unknown',
                  createdAt: postData.createdAt || Date.now(),
                  userId: postData.userId || 'unknown',
                  userName: postData.userName || 'Anonymous User',
                  userAvatar: postData.userAvatar,
                  cardName: postData.cardName,
                  priceRange: postData.priceRange,
                  detailedDescription: postData.detailedDescription,
                  viewCount: postData.viewCount || 0
                };
                
                fetchedPosts.push(post);
              } catch (postError) {
                console.error('Error processing post:', key, postError);
              }
            });
          }
          
          console.log(`Processed ${fetchedPosts.length} posts from database fallback`);
        }

        // Apply filters
        let filteredPosts = [...fetchedPosts];
        
        // Filter by game if specified
        if (options.game) {
          filteredPosts = filteredPosts.filter(post => 
            post.game === options.game
          );
          console.log(`After game filter (${options.game}): ${filteredPosts.length} posts`);
        }
        
        // Filter by user if specified
        if (options.userId) {
          filteredPosts = filteredPosts.filter(post => 
            post.userId === options.userId
          );
          console.log(`After user filter: ${filteredPosts.length} posts`);
        }
        
        // Filter by state if specified
        if (options.state) {
          filteredPosts = filteredPosts.filter(post => 
            post.location.toLowerCase().includes(options.state!.toLowerCase())
          );
          console.log(`After state filter: ${filteredPosts.length} posts`);
        }
        
        // Sort by createdAt (newest first)
        filteredPosts.sort((a, b) => b.createdAt - a.createdAt);
        
        // Apply limit if specified
        if (options.limit && filteredPosts.length > options.limit) {
          filteredPosts = filteredPosts.slice(0, options.limit);
          console.log(`After limit: ${filteredPosts.length} posts`);
        }
        
        console.log("Final posts to display:", filteredPosts.length);
        
        // Cache the results in sessionStorage for faster loading next time (only if available)
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(filteredPosts));
            sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
            console.log("Cached wanted posts data for future use");
          } catch (cacheError) {
            console.error("Error caching posts:", cacheError);
          }
        }
        
        setPosts(filteredPosts);
      } catch (err) {
        console.error('Error fetching wanted posts:', err);
        await logToServer('Error fetching wanted posts', { 
          error: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : null
        }, 'error');
        setError('Failed to load wanted posts. Please try again.');
        
        // If we have cached data and encounter an error, keep using the cached data
        if (cachedPosts) {
          console.log("Using cached data due to fetch error");
          setPosts(cachedPosts);
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Always fetch fresh data, but we might show cached data first
    fetchWantedPosts();
  }, [options.game, options.state, options.userId, options.limit]);

  // Helper function to log to server
  const logToServer = async (message: string, data: any, level: 'info' | 'warn' | 'error' = 'error') => {
    try {
      await fetch('/api/debug/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, data, level }),
      });
    } catch (e) {
      console.error('Failed to send log to server:', e);
    }
  };

  const createWantedPost = async (postData: Omit<WantedPost, 'id' | 'createdAt' | 'userId' | 'userName' | 'userAvatar'>) => {
    if (!user) {
      const errorMsg = 'Create wanted post failed: User not authenticated';
      console.error(errorMsg);
      await logToServer(errorMsg, { userId: null });
      throw new Error('User must be authenticated to create a wanted post');
    }

    // Validate required fields
    if (!postData.title || !postData.game || !postData.location) {
      const fieldData = { 
        hasTitle: !!postData.title, 
        hasGame: !!postData.game, 
        hasLocation: !!postData.location 
      };
      await logToServer('Create wanted post failed: Missing required fields', fieldData);
      throw new Error('Missing required fields for wanted post');
    }

    try {
      await logToServer('Creating wanted post', {
        title: postData.title,
        game: postData.game,
        condition: postData.condition,
        location: postData.location
      }, 'info');

      // Validate database is initialized
      if (!database) {
        const errorMsg = 'Create wanted post failed: Firebase database not initialized';
        await logToServer(errorMsg, { databaseExists: !!database });
        throw new Error('Database connection error. Please try again later.');
      }

      // Log Firebase config status
      await logToServer('Firebase config status', {
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      }, 'info');

      // Create a reference to the wanted posts collection
      const postsRef = ref(database, 'wantedPosts');
      await logToServer('Created posts reference', { path: 'wantedPosts' }, 'info');
      
      // Generate a new post ID
      const newPostRef = push(postsRef);
      if (!newPostRef || !newPostRef.key) {
        const errorMsg = 'Create wanted post failed: Could not generate post ID';
        await logToServer(errorMsg, { postRef: !!newPostRef });
        throw new Error('Failed to generate post ID. Please try again.');
      }
      
      const newPostId = newPostRef.key as string;
      await logToServer('Generated new post ID', { postId: newPostId }, 'info');
      
      // Create timestamp
      const timestamp = Date.now();
      
      // Create the new post object - always include all required fields with correct types
      const newPost: any = {
        title: postData.title,
        description: typeof postData.description === 'string' ? postData.description : '',
        game: postData.game,
        condition: postData.condition || 'any',
        isPriceNegotiable: typeof postData.isPriceNegotiable === 'boolean' ? postData.isPriceNegotiable : true,
        location: postData.location,
        createdAt: timestamp,
        userId: user.uid,
        userName: typeof user.displayName === 'string' && user.displayName.length > 0 ? user.displayName : 'Anonymous User',
        viewCount: 0
      };
      
      // Only add optional fields if they have values
      if (postData.cardName && postData.cardName.trim()) {
        newPost.cardName = postData.cardName.trim();
      }
      
      if (postData.priceRange && typeof postData.priceRange === 'object') {
        newPost.priceRange = postData.priceRange;
      }
      
      if (postData.detailedDescription && postData.detailedDescription.trim()) {
        newPost.detailedDescription = postData.detailedDescription.trim();
      }
      
      if (user.photoURL) {
        newPost.userAvatar = user.photoURL;
      }
      
      // Save to Firebase
      await logToServer('Attempting to save post to Firebase', { postId: newPostId }, 'info');
      try {
        await set(newPostRef, newPost);
        await logToServer('Post saved successfully', { postId: newPostId }, 'info');
      } catch (saveError) {
        await logToServer('Error saving post to Firebase', { 
          error: saveError instanceof Error ? saveError.message : 'Unknown error',
          postId: newPostId
        });
        throw saveError;
      }
      
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
        const errorDetails = {
          message: err.message,
          name: err.name,
          stack: err.stack
        };
        console.error('Error details:', errorDetails);
        await logToServer('Error creating wanted post', errorDetails);
      } else {
        await logToServer('Unknown error creating wanted post', { error: String(err) });
      }
      
      // Check for Firebase permission errors
      if (err instanceof Error && err.message.includes('permission_denied')) {
        await logToServer('Firebase permission denied error', { message: err.message });
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
      console.log(`Attempting to delete wanted post with ID: ${postId}`);
      await logToServer('Attempting to delete wanted post', { postId }, 'info');
      
      // First try using the API endpoint for more robust deletion
      try {
        const response = await fetch('/api/wanted/delete-post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            postId, 
            userId: user.uid 
          }),
        });
        
        const result = await response.json();
        
        if (response.ok) {
          console.log('Post deleted successfully via API:', result);
          await logToServer('Post deleted successfully via API', { 
            postId, 
            path: result.path 
          }, 'info');
          
          // Update local state
          setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
          return true;
        } else {
          console.error('API returned error when deleting post:', result.error);
          await logToServer('API error when deleting post', { 
            postId, 
            error: result.error 
          }, 'error');
          
          // If API fails, fall back to direct database deletion
          throw new Error(result.error || 'API error when deleting post');
        }
      } catch (apiError) {
        console.error('Error using API to delete post, falling back to direct deletion:', apiError);
        await logToServer('Falling back to direct deletion', { 
          postId, 
          error: apiError instanceof Error ? apiError.message : 'Unknown error' 
        }, 'warn');
        
        // Fall back to direct database deletion
        // First try the new path structure
        let postRef = ref(database, `wanted/posts/${postId}`);
        let snapshot = await get(postRef);
        
        // If not found in the new path, check the old path
        if (!snapshot.exists()) {
          console.log(`Post not found at new path, trying legacy path: wantedPosts/${postId}`);
          postRef = ref(database, `wantedPosts/${postId}`);
          snapshot = await get(postRef);
          
          // If still not found, try direct path
          if (!snapshot.exists()) {
            console.log(`Post not found at legacy path, trying direct path: wanted/${postId}`);
            postRef = ref(database, `wanted/${postId}`);
            snapshot = await get(postRef);
          }
        }
        
        if (!snapshot.exists()) {
          throw new Error('Post not found in any path');
        }
        
        const post = snapshot.val();
        
        // Verify the user owns this post
        if (post.userId !== user.uid) {
          throw new Error('You do not have permission to delete this post');
        }
        
        // Delete the post
        await remove(postRef);
        console.log(`Post deleted directly from path: ${postRef.toString()}`);
        await logToServer('Post deleted directly', { 
          postId, 
          path: postRef.toString() 
        }, 'info');
        
        // Update local state
        setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
        return true;
      }
    } catch (err) {
      console.error('Error deleting wanted post:', err);
      await logToServer('Error deleting wanted post', { 
        postId, 
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : null
      }, 'error');
      
      throw new Error('Failed to delete wanted post. Please try again.');
    }
  };

  const updateWantedPost = async (postId: string, updates: Partial<Omit<WantedPost, 'id' | 'createdAt' | 'userId' | 'userName' | 'userAvatar'>>) => {
    if (!user) {
      throw new Error('User must be authenticated to update a wanted post');
    }

    try {
      console.log(`Attempting to update wanted post with ID: ${postId}`);
      await logToServer('Attempting to update wanted post', { postId }, 'info');
      
      // Validate database connection
      if (!database) {
        console.error('Database not initialized when updating wanted post');
        await logToServer('Database not initialized when updating wanted post', {
          postId,
          databaseExists: !!database,
          databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
        }, 'error');
        throw new Error('Database not initialized');
      }
      
      // First try the new path structure
      let postRef = ref(database, `wanted/posts/${postId}`);
      console.log(`Trying to update post at path: wanted/posts/${postId}`);
      
      // Check if the post exists at this path
      let snapshot = await get(postRef);
      
      // If not found, try the old path structure
      if (!snapshot.exists()) {
        console.log(`Post not found at new path, trying legacy path: wantedPosts/${postId}`);
        await logToServer('Post not found at new path for update, trying legacy path', { 
          postId, 
          newPath: `wanted/posts/${postId}`,
          legacyPath: `wantedPosts/${postId}`
        }, 'info');
        
        postRef = ref(database, `wantedPosts/${postId}`);
        snapshot = await get(postRef);
        
        // If still not found, try direct path without subfolder
        if (!snapshot.exists()) {
          console.log(`Post not found at legacy path, trying direct path: wanted/${postId}`);
          await logToServer('Post not found at legacy path for update, trying direct path', { 
            postId, 
            directPath: `wanted/${postId}`
          }, 'info');
          
          postRef = ref(database, `wanted/${postId}`);
          snapshot = await get(postRef);
        }
      }
      
      // If still not found after trying all paths
      if (!snapshot.exists()) {
        console.error(`No post found with ID: ${postId} after trying all path variations`);
        await logToServer('Wanted post not found in any path location for update', { 
          postId,
          pathsChecked: [
            `wanted/posts/${postId}`,
            `wantedPosts/${postId}`,
            `wanted/${postId}`
          ]
        }, 'error');
        throw new Error('Post not found');
      }
      
      const post = snapshot.val();
      
      // Verify the user owns this post
      if (post.userId !== user.uid) {
        console.error(`User ${user.uid} does not own post ${postId}`);
        await logToServer('User does not own post for update', { 
          postId,
          userId: user.uid,
          postOwnerId: post.userId
        }, 'error');
        throw new Error('You do not have permission to update this post');
      }
      
      // Update the post
      console.log(`Updating post at path: ${postRef.toString()}`);
      await logToServer('Updating post', { 
        postId,
        path: postRef.toString(),
        updateFields: Object.keys(updates)
      }, 'info');
      
      await update(postRef, updates);
      console.log('Post updated successfully');
      await logToServer('Post updated successfully', { 
        postId,
        path: postRef.toString()
      }, 'info');
      
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
      
      // Log detailed error information
      if (err instanceof Error) {
        await logToServer('Error updating wanted post', {
          postId,
          error: err.message,
          stack: err.stack
        }, 'error');
      } else {
        await logToServer('Unknown error updating wanted post', {
          postId,
          error: String(err)
        }, 'error');
      }
      
      throw new Error('Failed to update wanted post. Please try again.');
    }
  };

  const getWantedPost = async (postId: string): Promise<WantedPost | null> => {
    try {
      console.log(`Fetching wanted post with ID: ${postId}`);
      
      // First try using the API endpoint since we know it works
      try {
        console.log('Trying API endpoint first...');
        const response = await fetch(`/api/wanted/get-post?postId=${postId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.post) {
            console.log('Successfully fetched post via API');
            return data.post;
          }
        }
        console.log('API fetch failed, falling back to direct database access...');
      } catch (apiError) {
        console.error('API fetch error:', apiError);
      }
      
      // Validate database connection
      if (!database) {
        console.error('Database not initialized when fetching specific wanted post');
        await logToServer('Database not initialized when fetching specific wanted post', {
          postId,
          databaseExists: !!database,
          databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
        }, 'error');
        throw new Error('Database not initialized');
      }
      
      // Try all possible paths where the post might be stored (prioritize wantedPosts since that's where data exists)
      const paths = [
        `wantedPosts/${postId}`,
        `wanted/posts/${postId}`,
        `wanted/${postId}`
      ];
      
      let postData = null;
      let usedPath = '';
      
      // Try each path until we find the post
      for (const path of paths) {
        console.log(`Checking path: ${path}`);
        try {
          const postRef = ref(database, path);
          const snapshot = await get(postRef);
          
          if (snapshot.exists()) {
            console.log(`Found post at path: ${path}`);
            const rawData = snapshot.val();
            
            // Ensure the post data has all required fields
            postData = {
              id: postId,
              title: rawData.title || "Untitled Post",
              description: rawData.description || "No description provided",
              game: rawData.game || "Unknown Game",
              condition: rawData.condition || "any",
              isPriceNegotiable: rawData.isPriceNegotiable || true,
              location: rawData.location || "Unknown Location",
              createdAt: rawData.createdAt || Date.now(),
              userId: rawData.userId || "unknown",
              userName: rawData.userName || "Anonymous User",
              ...rawData
            };
            
            usedPath = path;
            break;
          }
        } catch (pathError) {
          console.error(`Error checking path ${path}:`, pathError);
          // Continue to the next path
        }
      }
      
      // If still not found after trying all paths
      if (!postData) {
        console.log(`No post found with ID: ${postId} after trying all path variations`);
        await logToServer('Wanted post not found in any path location', { 
          postId,
          pathsChecked: [
            `wantedPosts/${postId}`,
            `wanted/posts/${postId}`,
            `wanted/${postId}`
          ]
        }, 'warn');
        
        return null;
      }
      
      console.log(`Post data retrieved successfully from path: ${usedPath}`);
      
      // Validate required fields
      if (!postData.title || !postData.game) {
        console.error('Invalid post data structure:', postData);
        await logToServer('Invalid post data structure', { 
          postId,
          hasTitle: !!postData?.title,
          hasGame: !!postData?.game,
          hasLocation: !!postData?.location
        }, 'error');
      }
      
      // Return the complete post data
      console.log('Returning complete post data');
      return postData;
    } catch (err) {
      console.error('Error fetching wanted post:', err);
      
      // Log detailed error information
      if (err instanceof Error) {
        await logToServer('Error fetching wanted post', {
          postId,
          error: err.message,
          stack: err.stack
        }, 'error');
      } else {
        await logToServer('Unknown error fetching wanted post', {
          postId,
          error: String(err)
        }, 'error');
      }
      
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