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

interface MessageDialogProps {
  recipientId: string
  recipientName: string
}

export function MessageDialog({ recipientId, recipientName }: MessageDialogProps) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isSelfMessage, setIsSelfMessage] = useState(false)
  const { toast } = useToast()

  // Check if user is trying to message themselves
  useEffect(() => {
    if (isOpen) {
      const { auth } = getFirebaseServices()
      const currentUser = auth.currentUser
      
      if (currentUser && currentUser.uid === recipientId) {
        setIsSelfMessage(true)
        toast({
          variant: "destructive",
          title: "Cannot message yourself",
          description: "You cannot send messages to yourself.",
        })
        // Close the dialog after showing the toast
        setTimeout(() => setIsOpen(false), 1500)
      } else {
        setIsSelfMessage(false)
      }
    }
  }, [isOpen, recipientId, toast])

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
      const { auth } = getFirebaseServices()
      const currentUser = auth.currentUser
      
      if (!currentUser) {
        throw new Error("You must be logged in to send messages")
      }

      // Double-check to prevent self-messaging
      if (currentUser.uid === recipientId) {
        throw new Error("You cannot send messages to yourself")
      }
      
      // Log the message details to help with debugging
      console.log('Sending message:', {
        recipientId,
        subject: subject.trim(),
        hasListingId: !!listingId,
        messageLength: message.trim().length
      });

      const token = await currentUser.getIdToken()
      
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId,
          subject: subject.trim(),
          message: message.trim()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Send Message</Button>
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