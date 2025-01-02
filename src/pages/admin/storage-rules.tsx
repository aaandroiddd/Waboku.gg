import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

export default function StorageRulesPage() {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const updateRules = async () => {
    setIsUpdating(true);
    try {
      const adminSecret = prompt("Please enter admin secret:");
      if (!adminSecret) {
        toast({
          title: "Error",
          description: "Admin secret is required",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch('/api/admin/update-storage-rules', {
        method: 'POST',
        headers: {
          'x-admin-secret': adminSecret,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update storage rules');
      }

      toast({
        title: "Success",
        description: "Storage rules updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update storage rules',
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Update Firebase Storage Rules</CardTitle>
          <CardDescription>
            Update the storage rules for your Firebase project. This action requires admin authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={updateRules} 
            disabled={isUpdating}
          >
            {isUpdating ? "Updating..." : "Update Storage Rules"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}