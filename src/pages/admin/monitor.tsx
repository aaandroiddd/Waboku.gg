import { useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getDatabase, ref, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { AlertCircle } from "lucide-react";

interface Stats {
  totalListings: number;
  activeListings: number;
  archivedListings: number;
  totalUsers: number;
  premiumUsers: number;
  recentArchivals: number;
}

import { checkAdminStatus } from '@/middleware/adminAuth';

export default function AdminMonitor() {
  const [stats, setStats] = useState<Stats>({
    totalListings: 0,
    activeListings: 0,
    archivedListings: 0,
    totalUsers: 0,
    premiumUsers: 0,
    recentArchivals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Check admin status first
        await checkAdminStatus();
        
        const db = getDatabase();
        const auth = getAuth();

        // Fetch listings data
        const listingsSnapshot = await get(ref(db, 'listings'));
        const listings = listingsSnapshot.val() || {};
        
        // Fetch users data
        const usersSnapshot = await get(ref(db, 'users'));
        const users = usersSnapshot.val() || {};

        // Calculate statistics
        const listingsArray = Object.values(listings) as any[];
        const usersArray = Object.values(users) as any[];

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        setStats({
          totalListings: listingsArray.length,
          activeListings: listingsArray.filter((l: any) => l.status === 'active').length,
          archivedListings: listingsArray.filter((l: any) => l.status === 'archived').length,
          totalUsers: usersArray.length,
          premiumUsers: usersArray.filter((u: any) => u.tier === 'premium').length,
          recentArchivals: listingsArray.filter((l: any) => {
            const archiveDate = l.archivedAt ? new Date(l.archivedAt) : null;
            return archiveDate && archiveDate > sevenDaysAgo;
          }).length,
        });

        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchStats();
    // Set up periodic refresh (every 5 minutes)
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-8">Loading statistics...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Monitoring Dashboard</h1>
      
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">Total Listings</h3>
              <p className="text-3xl">{stats.totalListings}</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">Total Users</h3>
              <p className="text-3xl">{stats.totalUsers}</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">Premium Users</h3>
              <p className="text-3xl">{stats.premiumUsers}</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="listings">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">Active Listings</h3>
              <p className="text-3xl">{stats.activeListings}</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">Archived Listings</h3>
              <p className="text-3xl">{stats.archivedListings}</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">Recent Archivals (7d)</h3>
              <p className="text-3xl">{stats.recentArchivals}</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">Total Users</h3>
              <p className="text-3xl">{stats.totalUsers}</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">Premium Users</h3>
              <p className="text-3xl">{stats.premiumUsers}</p>
            </Card>
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-2">Free Users</h3>
              <p className="text-3xl">{stats.totalUsers - stats.premiumUsers}</p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}