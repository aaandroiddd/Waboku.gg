import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"
import { getAuth } from "firebase/auth"
import { useToast } from "./ui/use-toast"
import { getFirebaseServices } from "@/lib/firebase"
import { useAuthRedirect } from "@/contexts/AuthRedirectContext"
import { useRouter } from "next/router"
import { MessageCircle, Ban } from "lucide-react"
import { useBlockingStatus } from "@/hooks/useBlockingStatus"

interface MessageDialogProps {
  recipientId: string
  recipientName: string
  listingId?: string
  listingTitle?: string
}

export function MessageDialog({ recipientId, recipientName, listingId: propListingId, listingTitle: propListingTitle }: MessageDialogProps) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isSelfMessage, setIsSelfMessage] = useState(false)
  const { toast } = useToast()
  const { saveRedirectState } = useAuthRedirect()
  const router = useRouter()
  const { isEitherBlocked, isBlocked, isBlockedBy } = useBlockingStatus(recipientId)
  
  // Use props first, then fall back to URL query parameters
  const { query } = router
  const listingId = propListingId || (query.listingId as string)
  const listingTitle = propListingTitle || (query.listingTitle as string)

  // Auto-fill subject line with listing title when dialog opens
  useEffect(() => {
    if (isOpen && listingTitle && !subject) {
      setSubject(`Re: ${listingTitle}`);
    }
  }, [isOpen, listingTitle, subject]);

  // Check if user is trying to message themselves
  useEffect(() => {
    const checkSelfMessage = async () => {
      if (isOpen) {
        const services = await getFirebaseServices();
        const auth = services.auth;

        if (!auth) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Authentication service unavailable. Please try again later.",
          });
          setIsOpen(false);
          return;
        }
        const currentUser = auth.currentUser;

        if (currentUser && currentUser.uid === recipientId) {
          setIsSelfMessage(true);
          toast({
            variant: "destructive",
            title: "Cannot message yourself",
            description: "You cannot send messages to yourself.",
          });
          // Close the dialog after showing the toast
          setTimeout(() => setIsOpen(false), 1500);
        } else {
          setIsSelfMessage(false);
        }
      }
    };
    checkSelfMessage();
  }, [isOpen, recipientId, toast]);

  const handleSendMessage = async () => {
    if (isSelfMessage) {
      toast({
        variant: "destructive",
        title: "Cannot message yourself",
        description: "You cannot send messages to yourself.",
      })
      setIsOpen(false)
      return
    }

    if (!subject.trim() || !message.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in both subject and message fields.",
      })
      return
    }

    setIsSending(true)
    try {
      const services = await getFirebaseServices();
      const auth = services.auth;

      if (!auth) {
        throw new Error("Firebase Auth service is not available. Initialization may have failed.");
      }
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
        subject: subject.trim(),
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
              subject: subject.trim(),
              message: message.trim(),
              ...(listingId ? { listingId, listingTitle } : {})
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
      })
      setIsOpen(false)
      setSubject("")
      setMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleMessageButtonClick = async () => {
    const services = await getFirebaseServices();
    const auth = services.auth;

    if (!auth) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Messaging service is currently unavailable. Please try again later.",
      });
      return;
    }
    const currentUser = auth.currentUser;

    if (!currentUser) {
      // User is not authenticated, save the action and redirect
      saveRedirectState('send_message', {
        recipientId,
        recipientName,
        returnPath: router.asPath
      });
      router.push('/auth/sign-in');
      return;
    }

    // User is authenticated, open the dialog
    setIsOpen(true);
  };

  // Show blocked button if users are blocked
  if (isEitherBlocked) {
    return (
      <Button 
        variant="destructive" 
        size="lg" 
        className="w-full"
        disabled={true}
      >
        <Ban className="h-5 w-5 mr-2" />
        {isBlocked ? 'User Blocked' : 'Cannot Message'}
      </Button>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          size="lg" 
          onClick={handleMessageButtonClick}
          className="w-full"
          disabled={false}
        >
          <MessageCircle className="h-5 w-5 mr-2" />
          Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Message to {recipientName}</DialogTitle>
          <DialogDescription>
            Start a conversation with this user. Be clear and respectful in your communication.
          </DialogDescription>
        </DialogHeader>
        {isSelfMessage ? (
          <div className="py-4 text-center text-destructive font-medium">
            You cannot send messages to yourself.
          </div>
        ) : isEitherBlocked ? (
          <div className="py-4 text-center text-destructive">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Ban className="h-5 w-5" />
              <span className="font-medium">
                {isBlocked ? 'User Blocked' : 'Cannot Send Message'}
              </span>
            </div>
            <p className="text-sm">
              {isBlocked 
                ? `You have blocked ${recipientName}. Unblock them to send messages.`
                : `${recipientName} has blocked you. You cannot send messages to this user.`
              }
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Input
                  id="subject"
                  placeholder="Subject (required)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  aria-required="true"
                />
              </div>
              <div className="grid gap-2">
                <Textarea
                  id="message"
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="h-32"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleSendMessage}
                disabled={isSending}
              >
                {isSending ? "Sending..." : "Send Message"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}