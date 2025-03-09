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

export default function WantedPostDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [wantedPost, setWantedPost] = useState<any>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Simulate loading data
  useEffect(() => {
    if (router.isReady && id) {
      // In a real implementation, this would fetch data from Firebase
      setTimeout(() => {
        // Mock data for demonstration
        setWantedPost({
          id: id,
          title: "Looking for Charizard VMAX Rainbow Rare",
          description: "Searching for Charizard VMAX Rainbow Rare from Darkness Ablaze in NM/M condition.",
          game: "pokemon",
          condition: "near_mint",
          isPriceNegotiable: true,
          priceRange: null,
          location: "Seattle, WA",
          createdAt: new Date().toISOString(),
          detailedDescription: "# Charizard VMAX Rainbow Rare\n\nI'm looking for the Charizard VMAX Rainbow Rare (Secret) from Sword & Shield: Darkness Ablaze.\n\n## Condition Requirements\n- Near Mint or Mint condition only\n- No whitening on edges\n- Centered well\n\nWilling to negotiate on price for the right card. Local meetup preferred but can discuss shipping options.\n\nPlease message me if you have this card available!",
          user: {
            id: "user123",
            name: "CardCollector42",
            avatar: null,
            joinedDate: "2023-05-15T00:00:00.000Z",
            rating: 4.8,
            totalRatings: 15
          }
        });
        setIsLoading(false);
      }, 1000);
    }
  }, [router.isReady, id]);

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
                        : `$${wantedPost.priceRange.min} - $${wantedPost.priceRange.max}`
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
                    alert("Link copied to clipboard!");
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
                  
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar>
                      <AvatarImage src={wantedPost.user.avatar} />
                      <AvatarFallback>
                        {wantedPost.user.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div className="font-medium">{wantedPost.user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Member since {new Date(wantedPost.user.joinedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex items-center gap-1 mb-1">
                      <div className="font-medium">{wantedPost.user.rating}</div>
                      <div className="text-sm text-muted-foreground">
                        ({wantedPost.user.totalRatings} ratings)
                      </div>
                    </div>
                    
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < Math.floor(wantedPost.user.rating)
                              ? "text-yellow-400"
                              : i < wantedPost.user.rating
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
              Send a message to {wantedPost.user.name} about their wanted post.
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