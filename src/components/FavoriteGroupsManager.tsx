import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Folder, Edit, Trash } from "lucide-react";
import { toast } from "sonner";

export interface FavoriteGroup {
  id: string;
  name: string;
  count?: number;
}

interface FavoriteGroupsManagerProps {
  groups: FavoriteGroup[];
  onCreateGroup: (name: string) => Promise<void>;
  onRenameGroup: (id: string, name: string) => Promise<void>;
  onDeleteGroup: (id: string) => Promise<void>;
  onGroupClick?: (groupId: string) => void;
}

export function FavoriteGroupsManager({
  groups,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
  onGroupClick
}: FavoriteGroupsManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editGroupName, setEditGroupName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<FavoriteGroup | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateGroup = async () => {
    console.log("handleCreateGroup called with name:", newGroupName);
    
    if (!newGroupName.trim()) {
      console.log("No group name provided");
      toast.error("Please enter a group name");
      return;
    }

    try {
      console.log("Starting group creation process...");
      setIsLoading(true);
      await onCreateGroup(newGroupName.trim());
      console.log("Group creation successful");
      setNewGroupName("");
      setIsCreateDialogOpen(false);
      toast.success("Group created successfully");
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameGroup = async () => {
    if (!selectedGroup) return;
    if (!editGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    try {
      setIsLoading(true);
      await onRenameGroup(selectedGroup.id, editGroupName.trim());
      setEditGroupName("");
      setIsEditDialogOpen(false);
      setSelectedGroup(null);
      toast.success("Group renamed successfully");
    } catch (error) {
      console.error("Error renaming group:", error);
      toast.error("Failed to rename group");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;

    try {
      setIsLoading(true);
      await onDeleteGroup(selectedGroup.id);
      setIsDeleteDialogOpen(false);
      setSelectedGroup(null);
      toast.success("Group deleted successfully");
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (group: FavoriteGroup) => {
    setSelectedGroup(group);
    setEditGroupName(group.name);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (group: FavoriteGroup) => {
    setSelectedGroup(group);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Favorite Groups</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              className="flex items-center gap-1"
              onClick={() => {
                console.log("New Group button clicked");
                setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>New Group</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
              <DialogDescription>
                Create a new group to organize your favorite listings.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateGroup} disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Group"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {groups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No groups created yet</p>
            <p className="text-sm">Create groups to organize your favorites</p>
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/50 cursor-pointer"
              onClick={() => onGroupClick && onGroupClick(group.id)}
            >
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-muted-foreground" />
                <span>{group.name}</span>
                {group.count !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    ({group.count})
                  </span>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()} // Prevent triggering group click
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering group click
                      openEditDialog(group);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering group click
                      openDeleteDialog(group);
                    }}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>

      {/* Edit Group Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Group</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Group name"
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameGroup} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this group? This action cannot be
              undone. Your favorites will not be deleted, just removed from this
              group.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}