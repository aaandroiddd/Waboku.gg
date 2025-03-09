import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
  createdAt: string;
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
        // In a real implementation, this would fetch data from Firebase
        // based on the provided options (game, state, userId, etc.)
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data for demonstration
        const mockPosts: WantedPost[] = [
          {
            id: 'wanted1',
            title: 'Looking for Charizard VMAX Rainbow Rare',
            description: 'Searching for Charizard VMAX Rainbow Rare from Darkness Ablaze in NM/M condition.',
            game: 'pokemon',
            cardName: 'Charizard VMAX Rainbow Rare',
            condition: 'near_mint',
            isPriceNegotiable: true,
            location: 'Seattle, WA',
            createdAt: new Date().toISOString(),
            userId: 'user123',
            userName: 'CardCollector42',
          },
          {
            id: 'wanted2',
            title: 'Wanted: Liliana of the Veil',
            description: 'Looking for Liliana of the Veil from Innistrad, any condition.',
            game: 'mtg',
            cardName: 'Liliana of the Veil',
            condition: 'any',
            isPriceNegotiable: false,
            priceRange: {
              min: 50,
              max: 100,
            },
            location: 'Portland, OR',
            createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            userId: 'user456',
            userName: 'MTGFanatic',
          },
          {
            id: 'wanted3',
            title: 'Blue-Eyes White Dragon - Original Art',
            description: 'Searching for original art Blue-Eyes White Dragon in good condition.',
            game: 'yugioh',
            cardName: 'Blue-Eyes White Dragon',
            condition: 'lightly_played',
            isPriceNegotiable: true,
            location: 'Los Angeles, CA',
            createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            userId: 'user789',
            userName: 'DuelistKing',
          },
        ];
        
        // Filter based on options
        let filteredPosts = [...mockPosts];
        
        if (options.game) {
          filteredPosts = filteredPosts.filter(post => post.game === options.game);
        }
        
        if (options.state) {
          filteredPosts = filteredPosts.filter(post => post.location.includes(options.state));
        }
        
        if (options.userId) {
          filteredPosts = filteredPosts.filter(post => post.userId === options.userId);
        }
        
        if (options.limit) {
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
      throw new Error('User must be authenticated to create a wanted post');
    }

    try {
      // In a real implementation, this would save to Firebase
      console.log('Creating wanted post:', postData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate a mock ID
      const newPostId = 'wanted' + Date.now();
      
      // Create the new post object
      const newPost: WantedPost = {
        ...postData,
        id: newPostId,
        createdAt: new Date().toISOString(),
        userId: user.uid,
        userName: user.displayName || 'Anonymous User',
        userAvatar: user.photoURL || undefined,
      };
      
      // Update local state
      setPosts(prevPosts => [newPost, ...prevPosts]);
      
      return newPostId;
    } catch (err) {
      console.error('Error creating wanted post:', err);
      throw new Error('Failed to create wanted post. Please try again.');
    }
  };

  const deleteWantedPost = async (postId: string) => {
    if (!user) {
      throw new Error('User must be authenticated to delete a wanted post');
    }

    try {
      // In a real implementation, this would delete from Firebase
      console.log('Deleting wanted post:', postId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update local state
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
      
      return true;
    } catch (err) {
      console.error('Error deleting wanted post:', err);
      throw new Error('Failed to delete wanted post. Please try again.');
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
    getUserWantedPosts,
  };
}