import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { Footer } from '@/components/Footer';
import Header from '@/components/Header';
import { UserNameLink } from '@/components/UserNameLink';
import { useProfile } from '@/hooks/useProfile';

export default function SendMessagePage() {
  const router = useRouter();
  const { recipientId, listingId, listingTitle, returnTo } = router.query;
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSelfMessage, setIsSelfMessage] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile: recipientProfile } = useProfile(recipientId as string);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (recipientProfile?.username) {
      setDisplayName(recipientProfile.username);
    }
  }, [recipientProfile]);

  // Check if user is trying to message themselves
  useEffect(() => {
    if (recipientId) {
      const { auth } = getFirebaseServices();
      const currentUser = auth.currentUser;
      
      if (currentUser && currentUser.uid === recipientId) {
        setIsSelfMessage(true);
        toast({
          variant: "destructive",
          title: "Cannot message yourself",
          description: "You cannot send messages to yourself.",
        });
        // Redirect back after showing the toast
        setTimeout(() => router.back(), 1500);
      } else {
        setIsSelfMessage(false);
      }
    }
  }, [recipientId, toast, router]);

  const handleSendMessage = async () => {
    if (isSelfMessage) {
      toast({
        variant: "destructive",
        title: "Cannot message yourself",
        description: "You cannot send messages to yourself.",
      });
      router.back();
      return;
    }

    if (!message.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a message.",
      });
      return;
    }

    setIsSending(true);
    try {
      const { auth } = getFirebaseServices();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error("You must be logged in to send messages");
      }

      // Double-check to prevent self-messaging
      if (currentUser.uid === recipientId) {
        throw new Error("You cannot send messages to yourself");
      }
      
      // Log the message details to help with debugging
      console.log('Sending message:', {
        recipientId,
        hasListingId: !!listingId,
        messageLength: message.trim().length
      });

      // Import the token manager for better refresh handling
      const { refreshAuthToken } = await import('@/lib/auth-token-manager');
      
      // Use the more robust token refresh mechanism
      let token = await refreshAuthToken(currentUser);
      
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
              recipientId,
              message: message.trim(),
              listingId,
              listingTitle
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
            const newToken = await currentUser.getIdToken(true);
            
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
      
      // Navigate back to the previous page or to messages dashboard
      if (returnTo) {
        router.push(returnTo as string);
      } else if (listingId) {
        router.push(`/listings/${listingId}`);
      } else {
        router.push('/dashboard/messages');
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (!recipientId) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="container mx-auto p-4 flex-1">
          <Card>
            <CardContent className="pt-6">
              <p>Invalid recipient. Please try again.</p>
              <Button onClick={handleBack} className="mt-4">Go Back</Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="container mx-auto p-4 flex-1">
        <Button 
          variant="ghost" 
          className="mb-4" 
          onClick={handleBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Send Message to {displayName}</CardTitle>
            <CardDescription>
              Start a conversation with this user. Be clear and respectful in your communication.
            </CardDescription>
            {listingTitle && (
              <div className="mt-2 text-sm">
                <span className="font-medium">Regarding: </span>
                {listingId ? (
                  <a 
                    href={`/listings/${listingId}`}
                    className="text-primary hover:underline"
                  >
                    {listingTitle}
                  </a>
                ) : (
                  <span>{listingTitle}</span>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isSelfMessage ? (
              <div className="py-4 text-center text-destructive font-medium">
                You cannot send messages to yourself.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Textarea
                    id="message"
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="h-32"
                  />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleBack}>
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSendMessage}
              disabled={isSending || isSelfMessage || !message.trim()}
            >
              {isSending ? "Sending..." : "Send Message"}
            </Button>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  );
}