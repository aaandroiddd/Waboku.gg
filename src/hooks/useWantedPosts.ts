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
        console.log("Fetching wanted posts with options:", options);
        
        // Log Firebase database status and connection details
        console.log("Database initialized:", !!database);
        
        // Verify database connection
        if (!database) {
          await logToServer('Database not initialized when fetching wanted posts', {
            databaseExists: !!database,
            databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
          }, 'error');
          throw new Error('Database not initialized');
        }
        
        // Create reference to wanted/posts collection
        let postsRef = ref(database, 'wanted/posts');
        await logToServer('Created posts reference', { path: 'wanted/posts' }, 'info');
        
        // Check if the path exists by doing a direct get first
        const pathCheckSnapshot = await get(postsRef);
        await logToServer('Path check result', { 
          pathExists: pathCheckSnapshot.exists(),
          path: 'wanted/posts'
        }, 'info');
        
        // If path doesn't exist, try the old path as fallback
        if (!pathCheckSnapshot.exists()) {
          console.log("Path 'wanted/posts' doesn't exist, trying fallback path...");
          await logToServer('Trying fallback path', { fallbackPath: 'wantedPosts' }, 'info');
          
          // Try the old path as fallback
          postsRef = ref(database, 'wantedPosts');
          const fallbackSnapshot = await get(postsRef);
          
          await logToServer('Fallback path check result', { 
            fallbackPathExists: fallbackSnapshot.exists(),
            fallbackPath: 'wantedPosts'
          }, 'info');
          
          // If neither path exists, we'll continue with the new path but there will be no results
          if (!fallbackSnapshot.exists()) {
            console.log("Neither 'wanted/posts' nor 'wantedPosts' paths exist in the database");
            await logToServer('No wanted posts paths exist in database', {}, 'warn');
          }
        }
        
        let postsQuery = postsRef;

        // Apply filters based on options
        if (options.userId) {
          postsQuery = query(postsRef, orderByChild('userId'), equalTo(options.userId));
          await logToServer('Applied userId filter', { userId: options.userId }, 'info');
        } else if (options.game) {
          postsQuery = query(postsRef, orderByChild('game'), equalTo(options.game));
          await logToServer('Applied game filter', { game: options.game }, 'info');
        }

        console.log("Executing database query...");
        await logToServer('Executing database query', { 
          hasUserId: !!options.userId,
          hasGame: !!options.game,
          hasState: !!options.state,
          path: postsRef.toString()
        }, 'info');
        
        const snapshot = await get(postsQuery);
        console.log("Query completed, snapshot exists:", snapshot.exists());
        await logToServer('Query completed', { 
          snapshotExists: snapshot.exists(),
          path: postsRef.toString()
        }, 'info');
        
        const fetchedPosts: WantedPost[] = [];

        if (snapshot.exists()) {
          snapshot.forEach((childSnapshot) => {
            try {
              const postData = childSnapshot.val();
              // Validate post data has required fields
              if (!postData || !postData.title || !postData.game || !postData.location) {
                console.warn('Skipping invalid post data:', childSnapshot.key);
                return; // Skip this post
              }
              
              const post = {
                id: childSnapshot.key as string,
                ...postData
              };
              fetchedPosts.push(post);
            } catch (postError) {
              console.error('Error processing post:', childSnapshot.key, postError);
            }
          });
          console.log(`Found ${fetchedPosts.length} posts in database`);
          await logToServer('Posts found in database', { 
            count: fetchedPosts.length,
            path: postsRef.toString()
          }, 'info');
        } else {
          console.log("No posts found in database");
          await logToServer('No posts found in database', { path: postsRef.toString() }, 'info');
          
          // Make a direct API call to check and potentially create a test post
          try {
            const checkResponse = await fetch('/api/wanted/check-posts');
            const checkResult = await checkResponse.json();
            console.log("Check posts API result:", checkResult);
            await logToServer('Check posts API result', checkResult, 'info');
          } catch (apiError) {
            console.error("Error calling check-posts API:", apiError);
            await logToServer('Error calling check-posts API', {
              error: apiError instanceof Error ? apiError.message : String(apiError)
            }, 'error');
          }
        }

        // Apply additional filters that can't be done at the database level
        let filteredPosts = [...fetchedPosts];
        
        if (options.state) {
          filteredPosts = filteredPosts.filter(post => 
            post.location.toLowerCase().includes(options.state!.toLowerCase())
          );
          console.log(`After state filter: ${filteredPosts.length} posts`);
          await logToServer('Applied state filter', { 
            state: options.state,
            countAfterFilter: filteredPosts.length 
          }, 'info');
        }
        
        // Sort by createdAt (newest first)
        filteredPosts.sort((a, b) => b.createdAt - a.createdAt);
        
        // Apply limit if specified
        if (options.limit && filteredPosts.length > options.limit) {
          filteredPosts = filteredPosts.slice(0, options.limit);
          console.log(`After limit: ${filteredPosts.length} posts`);
          await logToServer('Applied limit', { 
            limit: options.limit,
            finalCount: filteredPosts.length 
          }, 'info');
        }
        
        console.log("Final posts to display:", filteredPosts.length);
        await logToServer('Final posts to display', { 
          count: filteredPosts.length,
          firstPostId: filteredPosts.length > 0 ? filteredPosts[0].id : null
        }, 'info');
        
        setPosts(filteredPosts);
      } catch (err) {
        console.error('Error fetching wanted posts:', err);
        await logToServer('Error fetching wanted posts', { 
          error: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : null
        }, 'error');
        setError('Failed to load wanted posts. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

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
      const postsRef = ref(database, 'wanted/posts');
      await logToServer('Created posts reference', { path: 'wanted/posts' }, 'info');
      
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
      
      // Create the new post object
      const newPost = {
        ...postData,
        createdAt: timestamp,
        userId: user.uid,
        userName: user.displayName || 'Anonymous User',
        userAvatar: user.photoURL || undefined,
      };
      
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
      // Get the post to verify ownership
      const postRef = ref(database, `wanted/posts/${postId}`);
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
      const postRef = ref(database, `wanted/posts/${postId}`);
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
      console.log(`Fetching wanted post with ID: ${postId}`);
      
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
      
      // First try the new path structure
      const postRef = ref(database, `wanted/posts/${postId}`);
      console.log(`Trying new path structure: wanted/posts/${postId}`);
      
      // Fetch the post data
      console.log('Executing get() for post data...');
      let snapshot = await get(postRef);
      console.log(`Post data fetch complete, exists: ${snapshot.exists()}`);
      
      // If not found, try the old path structure
      if (!snapshot.exists()) {
        console.log(`Post not found at new path, trying legacy path: wantedPosts/${postId}`);
        await logToServer('Post not found at new path, trying legacy path', { 
          postId, 
          newPath: `wanted/posts/${postId}`,
          legacyPath: `wantedPosts/${postId}`
        }, 'info');
        
        const legacyPostRef = ref(database, `wantedPosts/${postId}`);
        snapshot = await get(legacyPostRef);
        console.log(`Legacy path fetch complete, exists: ${snapshot.exists()}`);
        
        // If still not found, try direct path without subfolder
        if (!snapshot.exists()) {
          console.log(`Post not found at legacy path, trying direct path: wanted/${postId}`);
          await logToServer('Post not found at legacy path, trying direct path', { 
            postId, 
            directPath: `wanted/${postId}`
          }, 'info');
          
          const directPostRef = ref(database, `wanted/${postId}`);
          snapshot = await get(directPostRef);
          console.log(`Direct path fetch complete, exists: ${snapshot.exists()}`);
        }
      }
      
      // If still not found after trying all paths
      if (!snapshot.exists()) {
        console.log(`No post found with ID: ${postId} after trying all path variations`);
        await logToServer('Wanted post not found in any path location', { 
          postId,
          pathsChecked: [
            `wanted/posts/${postId}`,
            `wantedPosts/${postId}`,
            `wanted/${postId}`
          ]
        }, 'warn');
        
        // Try to fetch all wanted posts to see what's available
        try {
          console.log('Attempting to list all wanted posts to debug...');
          const allPostsRef = ref(database, 'wanted/posts');
          const allPostsSnapshot = await get(allPostsRef);
          
          if (allPostsSnapshot.exists()) {
            const postKeys = Object.keys(allPostsSnapshot.val());
            console.log(`Found ${postKeys.length} posts in wanted/posts path`);
            await logToServer('Found posts in wanted/posts path', { 
              count: postKeys.length,
              firstFewKeys: postKeys.slice(0, 3)
            }, 'info');
          } else {
            console.log('No posts found in wanted/posts path');
            
            // Check legacy path
            const legacyAllPostsRef = ref(database, 'wantedPosts');
            const legacyAllPostsSnapshot = await get(legacyAllPostsRef);
            
            if (legacyAllPostsSnapshot.exists()) {
              const postKeys = Object.keys(legacyAllPostsSnapshot.val());
              console.log(`Found ${postKeys.length} posts in wantedPosts path`);
              await logToServer('Found posts in wantedPosts path', { 
                count: postKeys.length,
                firstFewKeys: postKeys.slice(0, 3)
              }, 'info');
            } else {
              console.log('No posts found in wantedPosts path either');
              await logToServer('No posts found in any path', {}, 'warn');
            }
          }
        } catch (listError) {
          console.error('Error listing all posts:', listError);
        }
        
        return null;
      }
      
      // Get the post data
      const postData = snapshot.val();
      console.log('Post data retrieved successfully');
      
      // Validate required fields
      if (!postData || !postData.title || !postData.game) {
        console.error('Invalid post data structure:', postData);
        await logToServer('Invalid post data structure', { 
          postId,
          hasTitle: !!postData?.title,
          hasGame: !!postData?.game,
          hasLocation: !!postData?.location
        }, 'error');
        
        // Try to return partial data if possible
        if (postData) {
          return {
            id: postId,
            title: postData.title || 'Untitled Post',
            description: postData.description || 'No description provided',
            game: postData.game || 'Unknown Game',
            condition: postData.condition || 'any',
            isPriceNegotiable: postData.isPriceNegotiable || true,
            location: postData.location || 'Unknown Location',
            createdAt: postData.createdAt || Date.now(),
            userId: postData.userId || 'unknown',
            userName: postData.userName || 'Anonymous User',
            userAvatar: postData.userAvatar,
            ...postData
          };
        }
        
        return null;
      }
      
      // Return the complete post data
      const completePost: WantedPost = {
        id: postId,
        ...postData
      };
      
      console.log('Returning complete post data');
      return completePost;
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