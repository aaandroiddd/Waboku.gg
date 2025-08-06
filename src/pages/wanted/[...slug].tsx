import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { PageTransition } from "@/components/PageTransition";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useWantedPosts, WantedPost } from "@/hooks/useWantedPosts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { GameCategoryBadge } from "@/components/GameCategoryBadge";
import { MarkdownContent } from "@/components/MarkdownContent";
import { UserNameLink } from "@/components/UserNameLink";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Calendar, MapPin, MessageSquare, Flag, Share2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { get, ref } from "firebase/database";
import { database } from "@/lib/firebase";
import { extractWantedPostIdFromSlug, getGameDisplayName } from "@/lib/wanted-posts-slug";
import { getSellerReviewStats } from "@/services/reviewService";
import { ReviewStats } from "@/types/review";

export default function WantedPostDetailPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { user } = useAuth();
  const { toast } = useToast();
  const { getWantedPost } = useWantedPosts();
  
  const [isLoading, setIsLoading] = useState(true);
  const [wantedPost, setWantedPost] = useState<WantedPost | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [posterData, setPosterData] = useState<any>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);
  const [postId, setPostId] = useState<string | null>(null);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Check if we were redirected from post creation
  useEffect(() => {
    if (router.query.success === 'created') {
      toast({
        title: "Wanted post created!",
        description: "Your wanted post has been successfully created.",
        duration: 5000,
      });
      
      // Clean up the URL
      router.replace(router.asPath.split('?')[0], undefined, { shallow: true });
    }
  }, [router.query.success, router, toast]);

  // Effect to resolve the post ID from the URL slug
  useEffect(() => {
    if (!router.isReady || !slug) return;

    const resolvePostId = async () => {
      try {
        console.log('=== FRONTEND DEBUG ===');
        console.log('Router ready:', router.isReady);
        console.log('Slug from router:', slug);
        console.log('Slug type:', typeof slug, Array.isArray(slug));
        
        // Handle the new URL format: /wanted/gameCategory/slug-6digitid
        if (Array.isArray(slug) && slug.length === 2) {
          const [gameCategory, slugWithId] = slug;
          console.log('Game category:', gameCategory, 'Slug with ID:', slugWithId);
          
          // Extract the numeric ID from the slug
          const shortId = extractWantedPostIdFromSlug(slugWithId);
          console.log('Extracted short ID:', shortId);
          console.log('Short ID type:', typeof shortId);
          console.log('Short ID regex test:', shortId ? /^\d+$/.test(shortId) : 'shortId is null');
          
          if (shortId && /^\d+$/.test(shortId)) {
            // Try to resolve the ID to a full Firebase document ID
            try {
              console.log('Attempting to resolve short ID:', shortId);
              const apiUrl = `/api/wanted/resolve-short-id?shortId=${shortId}`;
              console.log('API URL:', apiUrl);
              
              const response = await fetch(apiUrl);
              console.log('Response status:', response.status);
              console.log('Response ok:', response.ok);
              
              if (response.ok) {
                const data = await response.json();
                console.log('Resolve response data:', data);
                if (data.success && data.fullId) {
                  console.log('Successfully resolved to full ID:', data.fullId);
                  console.log('Setting postId state to:', data.fullId);
                  setPostId(data.fullId);
                  return;
                } else {
                  console.log('Resolve response indicates failure:', data);
                }
              } else {
                console.log('Resolve API response not OK:', response.status, response.statusText);
                const errorData = await response.text();
                console.log('Error response body:', errorData);
              }
              
              console.log('Failed to resolve short ID:', shortId);
            } catch (error) {
              console.error('Error resolving short ID:', error);
            }
          } else {
            console.log('Invalid short ID format or null:', shortId);
          }
        } else {
          console.log('Slug format not recognized. Length:', Array.isArray(slug) ? slug.length : 'not array');
        }
        
        // Handle category-only URLs: /wanted/gameCategory/
        if (Array.isArray(slug) && slug.length === 1) {
          const [gameCategory] = slug;
          
          // Import game mappings to check if this is a valid category
          const { GAME_MAPPING, OTHER_GAME_MAPPING } = await import('@/lib/game-mappings');
          const allGameValues = [...Object.values(GAME_MAPPING), ...Object.values(OTHER_GAME_MAPPING)];
          
          if (allGameValues.includes(gameCategory as any)) {
            // Redirect to wanted posts page with game filter
            router.replace(`/wanted/posts?game=${gameCategory}`);
            return;
          }
        }

        // If we can't parse the URL or resolve the ID, show error
        setIsLoading(false);
        toast({
          title: "Post Not Found",
          description: "The wanted post you're looking for could not be found.",
          variant: "destructive",
        });
      } catch (error) {
        console.error('Error resolving post ID:', error);
        setIsLoading(false);
        toast({
          title: "Error",
          description: "Failed to resolve wanted post.",
          variant: "destructive",
        });
      }
    };

    resolvePostId();
  }, [router.isReady, slug, router, toast]);

  // Track view count when post is loaded
  useEffect(() => {
    if (wantedPost && user) {
      // Don't track views from the post owner
      if (wantedPost.userId !== user.uid) {
        const trackView = async () => {
          try {
            const response = await fetch('/api/wanted/track-view', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                postId: wantedPost.id,
                userId: user.uid
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('View tracked successfully:', data);
            }
          } catch (error) {
            console.error('Error tracking view:', error);
          }
        };
        
        trackView();
      }
    }
  }, [wantedPost, user]);

  // Load the wanted post data
  useEffect(() => {
    // Only run this effect if router is ready, postId exists, and we haven't already attempted to fetch
    if (router.isReady && postId && !fetchAttempted) {
      const loadWantedPost = async () => {
        setIsLoading(true);
        setFetchAttempted(true); // Mark that we've attempted to fetch
        
        try {
          console.log("=== LOADING WANTED POST ===");
          console.log("Loading wanted post with ID:", postId);
          console.log("PostId type:", typeof postId);
          console.log("PostId length:", postId.length);
          
          // Try to directly fetch the post from the database
          if (database) {
            // Try all possible paths where the post might be stored
            const paths = [
              `wantedPosts/${postId}`,
              `wanted/posts/${postId}`,
              `wanted/${postId}`
            ];
            
            let postData = null;
            
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
                    id: postId as string,
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
                  
                  break;
                }
              } catch (pathError) {
                console.error(`Error checking path ${path}:`, pathError);
                // Continue to the next path
              }
            }
            
            // If we found the post directly, set it in state
            if (postData) {
              setWantedPost(postData);
              
              // Fetch additional user data if needed
              try {
                if (postData.userId && postData.userId !== "unknown") {
                  const userRef = ref(database, `users/${postData.userId}`);
                  const userSnapshot = await get(userRef);
                  
                  if (userSnapshot.exists()) {
                    const userData = userSnapshot.val();
                    setPosterData({
                      id: postData.userId,
                      name: postData.userName || "Anonymous User",
                      avatar: postData.userAvatar || undefined,
                      joinedDate: userData.createdAt || Date.now() - 86400000 * 30,
                      rating: userData.rating || 0,
                      totalRatings: userData.totalRatings || 0
                    });
                  } else {
                    // Fallback user data if not found
                    setPosterData({
                      id: postData.userId,
                      name: postData.userName || "Anonymous User",
                      avatar: postData.userAvatar || undefined,
                      joinedDate: Date.now() - 86400000 * 30,
                      rating: 0,
                      totalRatings: 0
                    });
                  }
                }
              } catch (userError) {
                console.error("Error fetching user data:", userError);
                // Use fallback user data
                setPosterData({
                  id: postData.userId,
                  name: postData.userName || "Anonymous User",
                  avatar: postData.userAvatar || undefined,
                  joinedDate: Date.now() - 86400000 * 30,
                  rating: 0,
                  totalRatings: 0
                });
              }
              
              setIsLoading(false);
              return;
            }
          }
          
          // If direct fetch failed or database isn't initialized, try the hook method
          console.log("Direct fetch failed, trying getWantedPost method...");
          const postData = await getWantedPost(postId as string);
          
          if (postData) {
            setWantedPost(postData);
            
            // Set basic poster data from the post
            setPosterData({
              id: postData.userId,
              name: postData.userName || "Anonymous User",
              avatar: postData.userAvatar || undefined,
              joinedDate: Date.now() - 86400000 * 30,
              rating: 0,
              totalRatings: 0
            });
          } else {
            console.error("Post data not found for ID:", postId);
            
            // Show toast for not found post
            toast({
              title: "Post Not Found",
              description: "The wanted post you're looking for could not be found.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error loading wanted post:", error);
          
          toast({
            title: "Error",
            description: "Failed to load the wanted post. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      };

      loadWantedPost();
    }
  }, [router.isReady, postId, getWantedPost, toast, fetchAttempted]);

  // Fetch review statistics for the poster
  useEffect(() => {
    const fetchReviewStats = async () => {
      if (!posterData?.id || posterData.id === "unknown") return;
      
      setLoadingReviews(true);
      
      try {
        console.log("Fetching review stats for user:", posterData.id);
        const stats = await getSellerReviewStats(posterData.id);
        console.log("Review stats fetched:", stats);
        
        if (stats) {
          setReviewStats(stats);
          // Update poster data with actual review statistics
          setPosterData(prev => ({
            ...prev,
            rating: stats.averageRating || 0,
            totalRatings: stats.totalReviews || 0
          }));
        }
      } catch (error) {
        console.error("Error fetching review stats:", error);
        // Keep the existing poster data if review fetch fails
      } finally {
        setLoadingReviews(false);
      }
    };

    fetchReviewStats();
  }, [posterData?.id]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    
    try {
      if (!user) {
        throw new Error("You must be logged in to send messages");
      }

      // Double-check to prevent self-messaging
      if (user.uid === wantedPost?.userId) {
        throw new Error("You cannot send messages to yourself");
      }

      // Log the message details to help with debugging
      console.log('Sending message about wanted post:', {
        recipientId: wantedPost?.userId,
        postTitle: wantedPost?.title,
        messageLength: message.trim().length
      });

      // Import the token manager for better refresh handling
      const { refreshAuthToken } = await import('@/lib/auth-token-manager');
      
      // Use the more robust token refresh mechanism
      let token = await refreshAuthToken(user);
      
      if (!token) {
        throw new Error("Failed to get authentication token. Please try signing in again.");
      }
      
      // Add retry logic for the API call
      let retryCount = 0;
      const maxRetries = 3;
      let response;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`Attempting to send message (attempt ${retryCount + 1}/${maxRetries})...`);
          
          response = await fetch('/api/messages/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              recipientId: wantedPost?.userId,
              subject: `Re: ${wantedPost?.title}`,
              message: message.trim(),
              listingId: wantedPost?.id,
              listingTitle: wantedPost?.title
            })
          });
          
          // If successful, break out of the retry loop
          if (response.ok) {
            console.log('Message sent successfully');
            break;
          }
          
          // If we get a 401, try to refresh the token and retry
          if (response.status === 401) {
            console.log('Authentication error (401), attempting to refresh token...');
            
            // Force a new token refresh
            const newToken = await user.getIdToken(true);
            
            if (newToken) {
              console.log('Token refreshed, retrying with new token');
              token = newToken;
            } else {
              throw new Error("Failed to refresh authentication token");
            }
          } else {
            // For other errors, parse the response and throw
            const error = await response.json();
            throw new Error(error.error || 'Failed to send message');
          }
        } catch (fetchError) {
          console.error(`Error during message send attempt ${retryCount + 1}:`, fetchError);
          
          // If this is the last retry, rethrow the error
          if (retryCount === maxRetries - 1) {
            throw fetchError;
          }
          
          // Wait before retrying
          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        retryCount++;
      }
      
      // Final check if response is not ok
      if (response && !response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }

      // Close dialog and reset form
      setMessageDialogOpen(false);
      setMessage("");
      
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/messages")}
          >
            View Messages
          </Button>
        ),
        duration: 5000
      });
    } catch (err) {
      console.error("Error sending message:", err);
      
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleContactClick = () => {
    if (!user) {
      // Create the current URL for redirect
      const currentUrl = router.asPath;
      router.push(`/auth/sign-in?redirect=${encodeURIComponent(currentUrl)}`);
      return;
    }
    
    // Check if the user is trying to message themselves
    if (user.uid === wantedPost?.userId) {
      toast({
        title: "Cannot message yourself",
        description: "You cannot send a message to your own wanted post.",
        variant: "destructive",
      });
      return;
    }
    
    setMessageDialogOpen(true);
  };

  if (isLoading) {
    return (
      <PageTransition>
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              className="mb-6 pl-0"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <Skeleton className="h-10 w-3/4 mb-4" />
            <Skeleton className="h-6 w-1/2 mb-8" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <Skeleton className="h-64 w-full mb-6" />
                <Skeleton className="h-32 w-full" />
              </div>
              
              <div>
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </PageTransition>
    );
  }

  if (!wantedPost) {
    return (
      <PageTransition>
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center py-12">
            <h1 className="text-3xl font-bold mb-4">Wanted Post Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The wanted post you're looking for may have been removed or doesn't exist.
            </p>
            <Button onClick={() => router.push("/wanted/posts")}>
              Browse Wanted Board
            </Button>
          </div>
        </main>
        <Footer />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            className="mb-6 pl-0"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-3xl font-bold mb-2">{wantedPost.title}</h1>
          
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <GameCategoryBadge game={wantedPost.game} />
            
            {wantedPost.condition && (
              <Badge variant="outline">
                {wantedPost.condition.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            )}
            
            <div className="flex items-center text-sm text-muted-foreground ml-auto">
              <Calendar className="h-3 w-3 mr-1" />
              <span>{new Date(wantedPost.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{wantedPost.location}</span>
                  </div>
                  
                  <p className="text-lg mb-6">{wantedPost.description}</p>
                  
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2">Price</h3>
                    <p>
                      {wantedPost.isPriceNegotiable 
                        ? "Price Negotiable" 
                        : wantedPost.priceRange && wantedPost.priceRange.min && wantedPost.priceRange.max
                          ? `$${wantedPost.priceRange.min} - $${wantedPost.priceRange.max}`
                          : "Price not specified"
                      }
                    </p>
                  </div>
                  
                  {wantedPost.detailedDescription && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <h3 className="text-lg font-medium mb-4">Details</h3>
                        <MarkdownContent content={wantedPost.detailedDescription} />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast({
                      title: "Link copied",
                      description: "Post link copied to clipboard",
                    });
                  }}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-1 text-muted-foreground"
                >
                  <Flag className="h-4 w-4" />
                  Report
                </Button>
              </div>
            </div>
            
            <div>
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-medium mb-4">Posted by</h3>
                  
                  {posterData ? (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar>
                          <AvatarImage src={posterData.avatar || wantedPost.userAvatar} />
                          <AvatarFallback>
                            {(posterData.name || wantedPost.userName || "User").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          {posterData?.id ? (
                            <UserNameLink 
                              userId={posterData.id} 
                              initialUsername={posterData.name || wantedPost.userName || "Anonymous User"} 
                              className="font-medium"
                            />
                          ) : (
                            <div className="font-medium">{posterData?.name || wantedPost.userName || "Anonymous User"}</div>
                          )}
                          <div className="text-sm text-muted-foreground">
                            Member since {new Date(posterData.joinedDate || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        {loadingReviews ? (
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 mb-1">
                              <div className="font-medium">
                                {posterData.totalRatings > 0 ? Number(posterData.rating).toFixed(1) : 'No reviews'}
                              </div>
                              {posterData.totalRatings > 0 && (
                                <div className="text-sm text-muted-foreground">
                                  ({posterData.totalRatings} {posterData.totalRatings === 1 ? 'review' : 'reviews'})
                                </div>
                              )}
                            </div>
                            
                            {posterData.totalRatings > 0 && (
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < Math.floor(posterData.rating || 0)
                                        ? "text-yellow-400"
                                        : i < (posterData.rating || 0)
                                        ? "text-yellow-200"
                                        : "text-gray-300"
                                    }`}
                                    aria-hidden="true"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="currentColor"
                                    viewBox="0 0 22 20"
                                  >
                                    <path d="M20.924 7.625a1.523 1.523 0 0 0-1.238-1.044l-5.051-.734-2.259-4.577a1.534 1.534 0 0 0-2.752 0L7.365 5.847l-5.051.734A1.535 1.535 0 0 0 1.463 9.2l3.656 3.563-.863 5.031a1.532 1.532 0 0 0 2.226 1.616L11 17.033l4.518 2.375a1.534 1.534 0 0 0 2.226-1.617l-.863-5.03L20.537 9.2a1.523 1.523 0 0 0 .387-1.575Z" />
                                  </svg>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-4">
                        <Avatar>
                          <AvatarImage src={wantedPost.userAvatar} />
                          <AvatarFallback>
                            {(wantedPost.userName || "User").substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <div className="font-medium">{wantedPost.userName || "Anonymous User"}</div>
                          <div className="text-sm text-muted-foreground">
                            Member
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <div className="space-y-2">
                    {posterData?.id && posterData.id !== "unknown" && (
                      <Button 
                        variant="outline"
                        className="w-full flex items-center gap-2"
                        onClick={() => router.push(`/profile/${posterData.name || posterData.id}`)}
                      >
                        View Profile
                      </Button>
                    )}
                    
                    <Button 
                      className="w-full flex items-center gap-2"
                      onClick={handleContactClick}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Contact Poster
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact About Wanted Post</DialogTitle>
            <DialogDescription>
              Send a message to {posterData?.name || wantedPost.userName || "the poster"} about their wanted post.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <h4 className="font-medium mb-1">{wantedPost.title}</h4>
            <p className="text-sm text-muted-foreground mb-4">{wantedPost.description}</p>
            
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message here..."
              rows={5}
              className="mb-2"
            />
            <p className="text-xs text-muted-foreground">
              Be specific about what you have to offer and any details about condition or pricing.
            </p>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMessageDialogOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSendMessage}
              disabled={!message.trim() || isSending}
            >
              {isSending ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </PageTransition>
  );
}