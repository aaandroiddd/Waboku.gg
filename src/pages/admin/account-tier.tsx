import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";

export default function AccountStatusPage() {
  const [userId, setUserId] = useState('');
  const [accountTier, setAccountTier] = useState('premium');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/fix-specific-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`
        },
        body: JSON.stringify({ userId, accountTier })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `Account status updated for user ${userId} to ${accountTier}`,
        });
        setUserId(''); // Reset form
      } else {
        throw new Error(data.error || 'Failed to update account status');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-6">Update Account Status</h1>
        
        <Alert className="mb-6">
          <AlertDescription>
            Use this form to update a user&apos;s account tier. Please ensure you have the correct user ID.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="userId" className="text-sm font-medium">
              User ID
            </label>
            <Input
              id="userId"
              placeholder="Enter user ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="accountTier" className="text-sm font-medium">
              Account Tier
            </label>
            <Select
              value={accountTier}
              onValueChange={setAccountTier}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="free">Free</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Updating..." : "Update Account Status"}
          </Button>
        </form>
      </Card>
    </div>
  );
}