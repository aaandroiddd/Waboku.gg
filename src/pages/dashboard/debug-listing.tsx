import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ListingDebugger } from '@/components/ListingDebugger';
import { useRouter } from 'next/router';

export default function DebugListingPage() {
  const router = useRouter();
  const { id: initialId } = router.query;
  const [listingId, setListingId] = useState<string>(
    typeof initialId === 'string' ? initialId : ''
  );
  const [currentDebugId, setCurrentDebugId] = useState<string>(
    typeof initialId === 'string' ? initialId : ''
  );

  const handleDebug = () => {
    if (listingId) {
      setCurrentDebugId(listingId);
      
      // Update URL to include the listing ID
      router.push({
        pathname: router.pathname,
        query: { id: listingId }
      }, undefined, { shallow: true });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Listing Visibility Debugger</CardTitle>
            <CardDescription>
              Debug why a listing might not be appearing in search results or on the front page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter listing ID"
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
                className="max-w-md"
              />
              <Button onClick={handleDebug}>Debug</Button>
            </div>
          </CardContent>
        </Card>

        {currentDebugId && <ListingDebugger listingId={currentDebugId} />}
      </div>
    </DashboardLayout>
  );
}