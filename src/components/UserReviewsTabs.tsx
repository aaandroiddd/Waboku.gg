import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ReviewsList } from '@/components/ReviewsList';
import { useReviews } from '@/hooks/useReviews';
import { useProfile } from '@/hooks/useProfile';

interface UserReviewsTabsProps {
  userId: string;
}

export function UserReviewsTabs({ userId }: UserReviewsTabsProps) {
  const [activeTab, setActiveTab] = useState('received');
  const { profile } = useProfile(userId);
  const { reviewStats } = useReviews();

  // Update profile rating when reviewStats changes
  useEffect(() => {
    if (reviewStats && activeTab === 'received') {
      console.log('UserReviewsTabs: Got review stats with average rating:', reviewStats.averageRating);
    }
  }, [reviewStats, activeTab]);

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="received">Reviews Received</TabsTrigger>
            <TabsTrigger value="written">Reviews Written</TabsTrigger>
          </TabsList>
          
          <TabsContent value="received">
            <h3 className="text-xl font-semibold mb-4">Reviews Received</h3>
            <ReviewsList sellerId={userId} showFilters={true} />
          </TabsContent>
          
          <TabsContent value="written">
            <h3 className="text-xl font-semibold mb-4">Reviews Written</h3>
            <ReviewsList reviewerId={userId} showFilters={true} />
          </TabsContent>
        </Tabs>
        

      </CardContent>
    </Card>
  );
}