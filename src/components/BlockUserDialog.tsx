import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

interface BlockUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  username: string
  onBlock: () => Promise<void>
}

export function BlockUserDialog({
  open,
  onOpenChange,
  userId,
  username,
  onBlock,
}: BlockUserDialogProps) {
  const [isBlocking, setIsBlocking] = useState(false)
  const { toast } = useToast()

  const handleBlock = async () => {
    try {
      setIsBlocking(true)
      await onBlock()
      toast({
        title: "User blocked",
        description: `${username} has been blocked successfully.`,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to block user. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsBlocking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block User</DialogTitle>
          <DialogDescription>
            Are you sure you want to block {username}? You won&apos;t receive any messages from them and they won&apos;t be able to send you new messages.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleBlock}
            disabled={isBlocking}
          >
            {isBlocking ? "Blocking..." : "Block User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}