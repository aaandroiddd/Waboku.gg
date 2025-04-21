// components/AddToGroupDialog.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Listing } from "@/types/database";
import { toast } from "sonner";
import { useRouter } from "next/router";

export interface FavoriteGroup {
  id: string;
  name: string;
}

interface AddToGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  listing: Listing | null;
  groups: FavoriteGroup[];
  onAddToGroup: (listingId: string, groupId: string) => Promise<boolean>;
  onCreateAndAddToGroup: (listingId: string, groupName: string) => Promise<string | undefined>;
}

export function AddToGroupDialog({
  isOpen,
  onClose,
  listing,
  groups,
  onAddToGroup,
  onCreateAndAddToGroup,
}: AddToGroupDialogProps) {
  const router = useRouter();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToGroup = async () => {
    if (!listing) return;

    try {
      setIsLoading(true);

      if (isCreatingNewGroup) {
        if (!newGroupName.trim()) {
          toast.error("Please enter a group name");
          setIsLoading(false);
          return;
        }
        
        // Check if a group with this name already exists
        const existingGroup = groups.find(g => g.name.toLowerCase() === newGroupName.trim().toLowerCase());
        
        if (existingGroup) {
          // If group exists, ask user if they want to add to existing group
          const confirmed = window.confirm(`A group named "${newGroupName}" already exists. Add to this group instead?`);
          
          if (confirmed) {
            // Add to existing group
            const success = await onAddToGroup(listing.id, existingGroup.id);
            
            if (success) {
              // Close dialog first
              setSelectedGroupId("");
              setNewGroupName("");
              setIsCreatingNewGroup(false);
              onClose();
              
              // Then show success toast with action to view favorites
              toast.success(`Added to existing group "${existingGroup.name}"`, {
                action: {
                  label: "View Favorites",
                  onClick: () => router.push("/dashboard/favorites")
                },
                duration: 5000
              });
            } else {
              toast.error("Failed to add to group");
            }
          } else {
            // User canceled, don't proceed
            setIsLoading(false);
            return;
          }
        } else {
          // Create new group and add listing
          try {
            const newGroupId = await onCreateAndAddToGroup(listing.id, newGroupName.trim());
            
            if (newGroupId) {
              // Close dialog first
              setSelectedGroupId("");
              setNewGroupName("");
              setIsCreatingNewGroup(false);
              onClose();
              
              // Then show success toast with action to view favorites
              toast.success(`Added to new group "${newGroupName}"`, {
                action: {
                  label: "View Favorites",
                  onClick: () => router.push("/dashboard/favorites")
                },
                duration: 5000
              });
            } else {
              console.error("Failed to create group and add listing: No group ID returned");
              toast.error("Failed to create group and add listing");
            }
          } catch (createError) {
            console.error("Error in createAndAddToGroup:", createError);
            toast.error("Failed to create group and add listing");
          }
        }
      } else {
        if (!selectedGroupId) {
          toast.error("Please select a group");
          setIsLoading(false);
          return;
        }
        
        const success = await onAddToGroup(listing.id, selectedGroupId);
        
        if (success) {
          const groupName = groups.find(g => g.id === selectedGroupId)?.name || "selected group";
          
          // Close dialog first
          setSelectedGroupId("");
          setNewGroupName("");
          setIsCreatingNewGroup(false);
          onClose();
          
          // Then show success toast with action to view favorites
          toast.success(`Added to ${groupName}`, {
            action: {
              label: "View Favorites",
              onClick: () => router.push("/dashboard/favorites")
            },
            duration: 5000
          });
        } else {
          toast.error("Failed to add to group");
        }
      }
    } catch (error) {
      console.error("Error adding to group:", error);
      toast.error("Failed to add to group");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedGroupId("");
    setNewGroupName("");
    setIsCreatingNewGroup(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Group</DialogTitle>
          <DialogDescription>
            Add this listing to one of your favorite groups or create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {!isCreatingNewGroup ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Group</label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="link"
                className="px-0"
                onClick={() => setIsCreatingNewGroup(true)}
              >
                Create a new group
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Enter group name"
                />
              </div>

              <Button
                variant="link"
                className="px-0"
                onClick={() => setIsCreatingNewGroup(false)}
              >
                Select existing group
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleAddToGroup} disabled={isLoading}>
            {isLoading ? "Adding..." : "Add to Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
