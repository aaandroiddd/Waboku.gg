import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GameCategoryBadge } from '@/components/GameCategoryBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { WantedPost } from '@/hooks/useWantedPosts';
import { Calendar, MapPin, MessageSquare, Eye } from 'lucide-react';
import Link from 'next/link';
import { useAccount } from '@/contexts/AccountContext';
import { getWantedPostUrl } from '@/lib/wanted-posts-slug';

interface WantedPostCardProps {
  post: WantedPost;
  onContact?: (postId: string) => void;
}

export const WantedPostCard: React.FC<WantedPostCardProps> = ({ post, onContact }) => {
  const { accountTier } = useAccount();
  const isPremium = accountTier === 'premium';
  
  // Generate the new URL format for the wanted post
  const postUrl = getWantedPostUrl(post);
  
  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <Link href={postUrl} className="hover:underline">
              <h3 className="font-semibold text-lg line-clamp-1">{post.title}</h3>
            </Link>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <GameCategoryBadge game={post.game} size="sm" />
              
              {post.condition && post.condition !== 'any' && (
                <Badge variant="outline" className="text-xs">
                  {post.condition.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              )}
              
              <div className="flex items-center text-xs text-muted-foreground ml-auto">
                <Calendar className="h-3 w-3 mr-1" />
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{post.description}</p>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={post.userAvatar} />
              <AvatarFallback>{post.userName?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{post.userName || 'Anonymous'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {isPremium && post.viewCount !== undefined && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Eye className="h-3 w-3 mr-1" />
                <span>{post.viewCount}</span>
              </div>
            )}
            
            <div className="flex items-center text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 mr-1" />
              <span className="line-clamp-1">{post.location}</span>
            </div>
            
            {onContact && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2"
                onClick={() => onContact(post.id)}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                <span className="text-xs">Contact</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};