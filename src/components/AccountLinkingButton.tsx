import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function AccountLinkingButton() {
  const { checkAndLinkAccounts, user } = useAuth();
  const { toast } = useToast();
  const [isLinking, setIsLinking] = useState(false);

  const handleLinkAccounts = async () => {
    if (!user?.email) {
      toast({
        title: 'Error',
        description: 'No user email found. Please sign in again.',
        variant: 'destructive',
      });
      return;
    }

    setIsLinking(true);
    try {
      const result = await checkAndLinkAccounts();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Your accounts have been linked successfully. ${result.linkedAccounts > 2 ? `${result.linkedAccounts} accounts were linked.` : ''}`,
        });
      } else if (result.message?.includes('No account linking needed')) {
        toast({
          title: 'Information',
          description: 'No other accounts were found with your email address.',
        });
      } else {
        toast({
          title: 'Information',
          description: result.message || 'Account check completed.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to link accounts. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleLinkAccounts}
      disabled={isLinking}
    >
      {isLinking ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Linking Accounts...
        </>
      ) : (
        'Link Accounts'
      )}
    </Button>
  );
}