import { useEffect } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

interface Listing {
  id: string;
  title: string;
  price: string;
  condition: string;
  game: string;
  inquiries?: number;
  status?: string;
  buyer?: string;
  date?: string;
}

interface Message {
  id: string;
  sender: string;
  listing: string;
  preview: string;
  date: string;
  unread: boolean;
}



export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/auth/sign-in");
    } else if (!user.emailVerified) {
      router.push("/auth/verify-email");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const { toast } = useToast();
  
  const EmailVerificationBanner = () => {
    if (user.emailVerified) return null;

    return (
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Verify your email</AlertTitle>
        <AlertDescription>
          Please check your inbox and verify your email address to start trading cards.
          If you haven't received the verification email, you can request a new one.
        </AlertDescription>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={async () => {
            try {
              await user.sendEmailVerification({
                url: window.location.origin + '/dashboard',
                handleCodeInApp: false,
              });
              toast({
                title: "Verification email sent",
                description: "Please check your inbox and click the verification link.",
                duration: 5000,
              });
            } catch (error: any) {
              console.error("Error sending verification email:", error);
              toast({
                title: "Error sending verification email",
                description: error.message || "Please try again later.",
                variant: "destructive",
                duration: 5000,
              });
            }
          }}
        >
          Resend verification email
        </Button>
      </Alert>
    );
  };

  const EmptyState = ({ title, description }: { title: string; description: string }) => (
    <Card className="w-full">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground text-center mb-4">{description}</p>
      </CardContent>
    </Card>
  );

  const ListingCard = ({ listing }: { listing: Listing }) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl">{listing.title}</CardTitle>
          <Badge variant="outline">{listing.game}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-2xl font-bold text-primary">{listing.price}</p>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full bg-${listing.condition === "Mint" ? "green" : "gray"}-500`} />
            <span className="text-sm text-muted-foreground">{listing.condition}</span>
          </div>
          {listing.inquiries && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageCircle size={16} />
              <span>{listing.inquiries} inquiries</span>
            </div>
          )}
          {listing.buyer && (
            <div className="text-sm text-muted-foreground">
              <p>Sold to: {listing.buyer}</p>
              <p>Date: {listing.date}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const MessageCard = ({ message }: { message: Message }) => (
    <Card className={`hover:shadow-lg transition-shadow ${message.unread ? 'border-primary' : ''}`}>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold">{message.sender}</h3>
          <Badge variant="outline">{message.date}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-2">Re: {message.listing}</p>
        <p className="text-sm">{message.preview}</p>
        <div className="flex justify-end mt-4">
          <Button size="sm">View Conversation</Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <EmailVerificationBanner />
        
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button disabled={!user.emailVerified}>+ New Listing</Button>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active Listings</TabsTrigger>
            <TabsTrigger value="previous">Previous Listings & Purchases</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="favorites">Favorites</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            <EmptyState
              title="No Active Listings"
              description="You haven't created any listings yet. Click the 'New Listing' button to get started!"
            />
          </TabsContent>

          <TabsContent value="previous" className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Previous Sales</h2>
              <EmptyState
                title="No Previous Sales"
                description="Your completed sales will appear here."
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-4">Your Purchases</h2>
              <EmptyState
                title="No Purchases Yet"
                description="Cards you've bought will appear here."
              />
            </div>
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <EmptyState
              title="No Messages"
              description="When you receive messages about your listings, they'll appear here."
            />
          </TabsContent>

          <TabsContent value="favorites" className="space-y-4">
            <EmptyState
              title="No Favorites Yet"
              description="Cards you've marked as favorites will appear here."
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}