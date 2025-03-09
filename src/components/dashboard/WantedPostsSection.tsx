import { useState } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GameCategoryBadge } from "@/components/GameCategoryBadge";
import { Calendar, MapPin, PlusCircle, Pencil, Trash2 } from "lucide-react";
import { useWantedPosts, WantedPost } from "@/hooks/useWantedPosts";
import { useAuth } from "@/contexts/AuthContext";
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
  const { posts, isLoading, deleteWantedPost } = useWantedPosts({ userId: user?.uid });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    } catch (error) {
      console.error("Error deleting post:", error);
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Your Wanted Posts</CardTitle>
            <CardDescription>
              Cards and accessories you're looking for
            </CardDescription>
          </div>
          <Button 
            onClick={handleCreateClick}
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Create Wanted Post
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
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
                      
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span className="mr-3">{post.location}</span>
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2">
                      <div className="text-sm font-medium">
                        {post.priceRange 
                          ? `$${post.priceRange.min} - $${post.priceRange.max}` 
                          : "Price Negotiable"
                        }
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex items-center gap-1"
                          onClick={() => handleEditClick(post.id)}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex items-center gap-1 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(post.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <h3 className="text-xl font-medium mb-2">No wanted posts yet</h3>
            <p className="text-muted-foreground mb-6">
              Create a wanted post to let others know what you're looking for
            </p>
            <Button onClick={handleCreateClick}>
              Create Wanted Post
            </Button>
          </div>
        )}
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