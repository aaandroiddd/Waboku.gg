import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function AccountLinkingButton() {
  const { checkAndLinkAccounts, user } = useAuth();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckAccounts = async () => {
    if (!user?.email) {
      toast({
        title: 'Error',
        description: 'No user email found. Please sign in again.',
        variant: 'destructive',
      });
      return;
    }

    setIsChecking(true);
    try {
      const result = await checkAndLinkAccounts();
      
      if (result.success) {
        if (result.accountsFound && result.accountsFound.length > 0) {
          toast({
            title: 'Accounts Found',
            description: `Found ${result.accountsFound.length} other account(s) with your email address. Account linking is not yet implemented.`,
          });
        } else {
          toast({
            title: 'No Additional Accounts',
            description: 'No other accounts were found with your email address.',
          });
        }
      } else {
        toast({
          title: 'Information',
          description: result.message || 'Account check completed.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check accounts. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleCheckAccounts}
      disabled={isChecking}
    >
      {isChecking ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking Accounts...
        </>
      ) : (
        'Check for Linked Accounts'
      )}
    </Button>
  );
}