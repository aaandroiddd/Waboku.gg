import { useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, RefreshCw, WrenchIcon } from "lucide-react";
import { checkAdminStatus } from '@/middleware/adminAuth';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Inconsistency {
  userId: string;
  actualTier: string;
  expectedTier: string;
  subscription: {
    status: string;
    stripeSubscriptionId: string;
    startDate: string;
    endDate: string;
  };
  reason: string;
}

interface CheckResponse {
  totalUsers: number;
  inconsistenciesFound: number;
  inconsistencies: Inconsistency[];
}

export default function AccountStatusManager() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CheckResponse | null>(null);
  const [fixingUser, setFixingUser] = useState<string | null>(null);

  const checkAccountStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      // Check admin status first
      await checkAdminStatus();

      const response = await fetch('/api/admin/check-account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch account status');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fixAccountStatus = async (userId: string) => {
    setFixingUser(userId);
    try {
      const response = await fetch('/api/admin/fix-account-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to fix account status');
      }

      // Refresh the data after fixing
      await checkAccountStatus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFixingUser(null);
    }
  };

  useEffect(() => {
    checkAccountStatus();
  }, []);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Account Status Manager</h1>
        <Button
          onClick={checkAccountStatus}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <h3 className="font-semibold text-lg mb-2">Total Users</h3>
            <p className="text-3xl">{data.totalUsers}</p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold text-lg mb-2">Inconsistencies Found</h3>
            <p className="text-3xl">{data.inconsistenciesFound}</p>
          </Card>
          <Card className="p-4">
            <h3 className="font-semibold text-lg mb-2">Status</h3>
            <Badge variant={data.inconsistenciesFound > 0 ? "destructive" : "success"}>
              {data.inconsistenciesFound > 0 ? 'Issues Found' : 'All Good'}
            </Badge>
          </Card>
        </div>
      )}

      {data?.inconsistencies.length > 0 && (
        <Card className="mt-6">
          <ScrollArea className="h-[600px] w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Current Tier</TableHead>
                  <TableHead>Expected Tier</TableHead>
                  <TableHead>Subscription Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.inconsistencies.map((item) => (
                  <TableRow key={item.userId}>
                    <TableCell className="font-mono">{item.userId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.actualTier}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.expectedTier}</Badge>
                    </TableCell>
                    <TableCell>{item.subscription.status}</TableCell>
                    <TableCell className="max-w-[300px] truncate" title={item.reason}>
                      {item.reason}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => fixAccountStatus(item.userId)}
                        disabled={fixingUser === item.userId}
                      >
                        <WrenchIcon className="h-4 w-4 mr-2" />
                        Fix
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}

      {data?.inconsistencies.length === 0 && (
        <Alert className="mt-6">
          <AlertTitle>All Clear!</AlertTitle>
          <AlertDescription>
            No account status inconsistencies were found in the system.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}