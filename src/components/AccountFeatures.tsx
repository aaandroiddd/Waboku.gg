import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAccount } from '@/contexts/AccountContext';
import { ACCOUNT_TIERS } from '@/types/account';
import { CheckIcon, XIcon } from 'lucide-react';

export function AccountFeatures() {
  const { accountTier, upgradeToPremium } = useAccount();

  const features = [
    {
      name: 'Active Listings',
      free: '2 listings',
      premium: 'Unlimited',
    },
    {
      name: 'Listing Duration',
      free: '48 hours',
      premium: '30 days',
    },
    {
      name: 'Advanced Search',
      free: false,
      premium: true,
    },
    {
      name: 'Priority Messaging',
      free: false,
      premium: true,
    },
    {
      name: 'Bulk Listing Tools',
      free: false,
      premium: true,
    },
    {
      name: 'Price History Access',
      free: false,
      premium: true,
    },
    {
      name: 'Advertisements',
      free: true,
      premium: false,
    },
  ];

  return (
    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2">
      {Object.values(ACCOUNT_TIERS).map((tier) => (
        <Card key={tier.tier} className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">
              {tier.displayName}
              {tier.badge && <span className="ml-2">{tier.badge}</span>}
            </h3>
          </div>

          <ul className="mt-6 space-y-4">
            {features.map((feature) => (
              <li key={feature.name} className="flex items-center">
                {tier.tier === 'free' ? (
                  feature.free ? (
                    typeof feature.free === 'string' ? (
                      <>
                        <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
                        <span>{feature.free}</span>
                      </>
                    ) : (
                      <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
                    )
                  ) : (
                    <XIcon className="h-5 w-5 text-red-500 mr-2" />
                  )
                ) : feature.premium ? (
                  typeof feature.premium === 'string' ? (
                    <>
                      <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
                      <span>{feature.premium}</span>
                    </>
                  ) : (
                    <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
                  )
                ) : (
                  <XIcon className="h-5 w-5 text-red-500 mr-2" />
                )}
                <span className="text-gray-700">{feature.name}</span>
              </li>
            ))}
          </ul>

          {tier.tier === 'premium' && accountTier === 'free' && (
            <Button
              className="mt-6 w-full"
              onClick={upgradeToPremium}
            >
              Upgrade to Premium
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}