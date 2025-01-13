import { AccountFeatures } from '@/components/AccountFeatures';
import { useAccount } from '@/contexts/AccountContext';
import { Badge } from '@/components/ui/badge';

export default function AccountStatus() {
  const { accountTier } = useAccount();

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Account Status</h1>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground">Current Plan:</p>
          <Badge variant={accountTier === 'premium' ? 'default' : 'secondary'} className={accountTier === 'premium' ? 'bg-gradient-to-r from-blue-500 to-purple-500' : ''}>
            {accountTier === 'premium' ? 'Premium' : 'Free'}
          </Badge>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4">Available Features</h2>
        <AccountFeatures />
      </div>
    </div>
  );
}

AccountStatus.getLayout = function getLayout(page: React.ReactElement) {
  return page;
};