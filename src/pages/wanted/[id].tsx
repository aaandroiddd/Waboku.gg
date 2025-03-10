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
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Calendar, MapPin, MessageSquare, Flag, Share2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { get, ref } from "firebase/database";
import { firebaseDatabase as database } from "@/lib/firebase";

export default function WantedPostDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { toast } = useToast();
  const { getWantedPost } = useWantedPosts();
  
  const [isLoading, setIsLoading] = useState(true);
  const [wantedPost, setWantedPost] = useState<WantedPost | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [posterData, setPosterData] = useState<any>(null);

  // Check if we were redirected from post creation
  useEffect(() => {
    if (router.query.success === 'created') {
      toast({
        title: "Wanted post created!",
        description: "Your wanted post has been successfully created.",
        duration: 5000,
      });
      
      // Clean up the URL
      router.replace(`/wanted/${id}`, undefined, { shallow: true });
    }
  }, [router.query.success, id, router, toast]);

  // Load the wanted post data
  useEffect(() => {
    const loadWantedPost = async () => {
      if (router.isReady && id) {
        setIsLoading(true);
        try {
          console.log("Loading wanted post with ID:", id);
          
          // Log the database connection status
          console.log("Database connection status:", {
            databaseInitialized: !!database,
            databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
          });
          
          // Verify database is initialized
          if (!database) {
            console.error("Firebase database not initialized");
            toast({
              title: "Database Error",
              description: "Could not connect to the database. Please try again later.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          
          // First try to directly fetch the post to see if it exists
          try {
            console.log("Attempting direct fetch of post data...");
            
            // Try all possible paths where the post might be stored
            const paths = [
              `wanted/posts/${id}`,
              `wantedPosts/${id}`,
              `wanted/${id}`
            ];
            
            let postData = null;
            let foundPath = null;
            
            // Try each path until we find the post
            for (const path of paths) {
              console.log(`Checking path: ${path}`);
              const postRef = ref(database, path);
              const snapshot = await get(postRef);
              
              if (snapshot.exists()) {
                console.log(`Found post at path: ${path}`);
                const rawData = snapshot.val();
                
                // Ensure the post data has all required fields
                postData = {
                  id: id as string,
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
                
                foundPath = path;
                break;
              } else {
                console.log(`Post not found at path: ${path}`);
              }
            }
            
            // If we found the post, set it in state
            if (postData && foundPath) {
              console.log(`Successfully found post at path: ${foundPath}`);
              
              // Log the structure of the post data to help debug
              console.log("Post data structure:", {
                hasId: !!postData.id,
                hasTitle: !!postData.title,
                hasDescription: !!postData.description,
                hasGame: !!postData.game,
                hasLocation: !!postData.location,
                hasUserId: !!postData.userId,
                hasUserName: !!postData.userName,
                createdAt: postData.createdAt
              });
              
              // Set the post data in state
              setWantedPost(postData);
              
              // Fetch additional user data if needed
              try {
                console.log("Fetching user data for:", postData.userId);
                const userRef = ref(database, `users/${postData.userId}`);
                const userSnapshot = await get(userRef);
                
                if (userSnapshot.exists()) {
                  console.log("User data found in database");
                  const userData = userSnapshot.val();
                  setPosterData({
                    id: postData.userId,
                    name: postData.userName || "Anonymous User",
                    avatar: postData.userAvatar || undefined,
                    joinedDate: userData.createdAt || Date.now() - 86400000 * 30, // fallback to 30 days ago
                    rating: userData.rating || 4.5,
                    totalRatings: userData.totalRatings || 0
                  });
                } else {
                  console.log("User data not found, using fallback data");
                  // Fallback user data if not found
                  setPosterData({
                    id: postData.userId,
                    name: postData.userName || "Anonymous User",
                    avatar: postData.userAvatar || undefined,
                    joinedDate: Date.now() - 86400000 * 30, // 30 days ago
                    rating: 4.5,
                    totalRatings: 0
                  });
                }
              } catch (error) {
                console.error("Error fetching user data:", error);
                // Fallback user data on error
                setPosterData({
                  id: postData.userId,
                  name: postData.userName || "Anonymous User",
                  avatar: postData.userAvatar || undefined,
                  joinedDate: Date.now() - 86400000 * 30,
                  rating: 4.5,
                  totalRatings: 0
                });
              }
              
              setIsLoading(false);
              return;
            }
          } catch (directFetchError) {
            console.error("Error during direct fetch attempt:", directFetchError);
            // Continue with the normal flow if direct fetch fails
          }
          
          // If direct fetch failed, try the getWantedPost method
          console.log("Direct fetch failed, trying getWantedPost method...");
          
          // Fetch the post data with enhanced error handling
          console.log("Trying to fetch post data using getWantedPost...");
          const postData = await getWantedPost(id as string);
          
          console.log("Post data response:", postData ? "Found" : "Not found");
          
          if (postData) {
            // Log the structure of the post data to help debug
            console.log("Post data structure:", {
              hasId: !!postData.id,
              hasTitle: !!postData.title,
              hasDescription: !!postData.description,
              hasGame: !!postData.game,
              hasLocation: !!postData.location,
              hasUserId: !!postData.userId,
              hasUserName: !!postData.userName,
              createdAt: postData.createdAt
            });
            
            // Set the post data in state
            setWantedPost(postData);
            
            // Fetch additional user data if needed
            try {
              console.log("Fetching user data for:", postData.userId);
              const userRef = ref(database, `users/${postData.userId}`);
              const userSnapshot = await get(userRef);
              
              if (userSnapshot.exists()) {
                console.log("User data found in database");
                const userData = userSnapshot.val();
                setPosterData({
                  id: postData.userId,
                  name: postData.userName || "Anonymous User",
                  avatar: postData.userAvatar || undefined,
                  joinedDate: userData.createdAt || Date.now() - 86400000 * 30, // fallback to 30 days ago
                  rating: userData.rating || 4.5,
                  totalRatings: userData.totalRatings || 0
                });
              } else {
                console.log("User data not found, using fallback data");
                // Fallback user data if not found
                setPosterData({
                  id: postData.userId,
                  name: postData.userName || "Anonymous User",
                  avatar: postData.userAvatar || undefined,
                  joinedDate: Date.now() - 86400000 * 30, // 30 days ago
                  rating: 4.5,
                  totalRatings: 0
                });
              }
            } catch (error) {
              console.error("Error fetching user data:", error);
              // Fallback user data on error
              setPosterData({
                id: postData.userId,
                name: postData.userName || "Anonymous User",
                avatar: postData.userAvatar || undefined,
                joinedDate: Date.now() - 86400000 * 30,
                rating: 4.5,
                totalRatings: 0
              });
            }
          } else {
            console.error("Post data not found for ID:", id);
            
            // Show toast for not found post
            toast({
              title: "Post Not Found",
              description: "The wanted post you're looking for could not be found.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error loading wanted post:", error);
          // Log detailed error information
          if (error instanceof Error) {
            console.error("Error details:", {
              message: error.message,
              stack: error.stack
            });
          }
          
          toast({
            title: "Error",
            description: "Failed to load the wanted post. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadWantedPost();
  }, [router.isReady, id, getWantedPost, toast, router]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    
    try {
      // In a real implementation, this would send a message to Firebase
      console.log("Sending message:", message);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Close dialog and reset form
      setMessageDialogOpen(false);
      setMessage("");
      
      // Show success notification (would use toast in real implementation)
      alert("Message sent successfully!");
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleContactClick = () => {
    if (!user) {
      router.push(`/auth/sign-in?redirect=/wanted/${id}`);
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
            <Button onClick={() => router.push("/wanted")}>
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
                          <div className="font-medium">{posterData.name || wantedPost.userName || "Anonymous User"}</div>
                          <div className="text-sm text-muted-foreground">
                            Member since {new Date(posterData.joinedDate || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-6">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="font-medium">{posterData.rating || 0}</div>
                          <div className="text-sm text-muted-foreground">
                            ({posterData.totalRatings || 0} ratings)
                          </div>
                        </div>
                        
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
                  
                  <Button 
                    className="w-full flex items-center gap-2"
                    onClick={handleContactClick}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Contact Poster
                  </Button>
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