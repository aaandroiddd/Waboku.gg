import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ContentLoader } from "@/components/ContentLoader";
import { GameCategoryBadge } from "@/components/GameCategoryBadge";
import { Calendar, MapPin, PlusCircle, Pencil, Trash2, ExternalLink, Eye } from "lucide-react";
import { useWantedPosts, WantedPost } from "@/hooks/useWantedPosts";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function WantedPostsSection() {
  const router = useRouter();
  const { user } = useAuth();
  const [retryCount, setRetryCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const { posts, isLoading, error, deleteWantedPost } = useWantedPosts({ 
    userId: user?.uid,
    refreshKey // Add refresh key to force re-fetch
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  
  // Log for debugging
  useEffect(() => {
    if (user) {
      console.log("WantedPostsSection - Current user:", user.uid);
      console.log("WantedPostsSection - Posts loaded:", posts.length);
      
      // Log to server for debugging
      const logData = async () => {
        try {
          await fetch('/api/debug/log', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              message: "WantedPostsSection - User and posts data", 
              data: { 
                userId: user.uid,
                postsCount: posts.length,
                hasError: !!error,
                errorMessage: error || null,
                databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
                retryCount
              }, 
              level: 'info' 
            }),
          });
        } catch (e) {
          console.error('Failed to send log to server:', e);
        }
      };
      
      logData();
    }
    
    if (error) {
      console.error("WantedPostsSection - Error loading posts:", error);
      
      // If there's an error and we haven't retried too many times, retry
      if (retryCount < 3) {
        const timer = setTimeout(() => {
          console.log(`Retrying to fetch posts (attempt ${retryCount + 1}/3)...`);
          setRetryCount(prev => prev + 1);
          // This will cause the component to re-render and the useWantedPosts hook to re-fetch
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, posts, error, retryCount]);

  // Listen for page focus to refresh data when user returns from editing
  useEffect(() => {
    const handleFocus = () => {
      // Clear cache and refresh data when user returns to the page
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          // Clear wanted posts cache to force fresh data
          const keys = Object.keys(sessionStorage);
          keys.forEach(key => {
            if (key.startsWith('wantedPosts_')) {
              sessionStorage.removeItem(key);
              sessionStorage.removeItem(`${key}_timestamp`);
            }
          });
        } catch (e) {
          console.error('Error clearing cache:', e);
        }
      }
      
      // Force refresh by updating the refresh key
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleCreateClick = () => {
    router.push("/wanted/create");
  };

  const handleEditClick = (postId: string) => {
    router.push(`/wanted/edit/${postId}`);
  };

  const handleDeleteClick = (postId: string) => {
    setPostToDelete(postId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!postToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteWantedPost(postToDelete);
      setDeleteDialogOpen(false);
      
      // Show success toast
      toast({
        title: "Post deleted",
        description: "Your wanted post has been successfully deleted.",
        variant: "default",
      });
    } catch (error) {
      console.error("Error deleting post:", error);
      
      // Show error toast
      toast({
        title: "Error deleting post",
        description: error instanceof Error ? error.message : "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setPostToDelete(null);
    }
  };

  // Format condition for display
  const formatCondition = (condition: string) => {
    return condition
      .replace('_', ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-center w-full">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleCreateClick}
              className="flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Create Wanted Post
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push("/wanted/posts")}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View All Wanted Posts
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ContentLoader 
          isLoading={isLoading} 
          loadingMessage="Loading your wanted posts..."
          minHeight="300px"
          fallback={
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          }
        >
          {posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="relative">
                <div className="absolute right-2 top-2 z-10 flex gap-1">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm"
                    onClick={() => handleEditClick(post.id)}
                  >
                    <Pencil className="h-3 w-3" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-7 w-7 p-0 bg-background/80 backdrop-blur-sm text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(post.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
                
                <Card key={post.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium mb-1">{post.title}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{post.description}</p>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          <GameCategoryBadge game={post.game} />
                          {post.condition && post.condition !== 'any' && (
                            <Badge variant="outline">
                              {formatCondition(post.condition)}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span>{post.location}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                          </div>
                          {post.viewCount !== undefined && (
                            <div className="flex items-center">
                              <Eye className="h-3 w-3 mr-1" />
                              <span>{post.viewCount} views</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col justify-between gap-3 flex-shrink-0 min-w-[120px] sm:min-w-[160px]">
                        <div className="text-sm font-medium text-right">
                          <span className="block break-words">
                            {post.priceRange && !post.isPriceNegotiable
                              ? `$${post.priceRange.min} - $${post.priceRange.max}` 
                              : "Price Negotiable"
                            }
                          </span>
                        </div>
                        <div className="mt-auto">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex items-center gap-1 w-full"
                            onClick={() => router.push(`/wanted/${post.id}`)}
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span className="hidden sm:inline">View Post</span>
                            <span className="sm:hidden">View</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <h3 className="text-xl font-medium mb-2">No wanted posts yet</h3>
            <p className="text-muted-foreground mb-6">
              Create a wanted post to let others know what you're looking for
            </p>
            <div className="flex justify-center">
              <Button onClick={handleCreateClick}>
                Create Wanted Post
              </Button>
            </div>
          </div>
        )}
        </ContentLoader>
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wanted Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this wanted post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}