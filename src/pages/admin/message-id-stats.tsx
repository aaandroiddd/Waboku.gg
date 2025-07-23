import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Calendar, MessageSquare, TrendingUp, Database } from 'lucide-react';
import { getMessageIdStats, getCurrentCounter, resetCounter } from '@/lib/message-id-generator';

interface MessageIdStats {
  todayCount: number;
  yesterdayCount: number;
  totalDays: number;
  oldestDate: string | null;
  newestDate: string | null;
}

export default function MessageIdStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<MessageIdStats | null>(null);
  const [currentCounter, setCurrentCounter] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setError(null);
      const [statsData, counter] = await Promise.all([
        getMessageIdStats(),
        getCurrentCounter()
      ]);
      
      setStats(statsData);
      setCurrentCounter(counter);
    } catch (error) {
      console.error('Error loading message ID stats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
  };

  const handleResetCounter = async () => {
    if (!confirm('Are you sure you want to reset today\'s counter to 0? This should only be done for testing purposes.')) {
      return;
    }

    try {
      const success = await resetCounter(new Date(), 0);
      if (success) {
        alert('Counter reset successfully');
        await loadStats();
      } else {
        alert('Failed to reset counter');
      }
    } catch (error) {
      console.error('Error resetting counter:', error);
      alert('Error resetting counter: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    
    try {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      
      const date = new Date(year, month, day);
      return date.toLocaleDateString();
    } catch (error) {
      return dateStr;
    }
  };

  const generateSampleMessageId = () => {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    const sampleCounter = (currentCounter + 1).toString().padStart(7, '0');
    return `MSG${dateStr}${sampleCounter}`;
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading message ID statistics...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Message ID Statistics</h1>
          <p className="text-muted-foreground">
            Monitor the new message ID generation system
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => router.push('/admin')}
            variant="outline"
            size="sm"
          >
            Back to Admin
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {stats && (
        <>
          {/* Current Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todayCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Current counter: {currentCounter}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Yesterday's Messages</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.yesterdayCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.todayCount > stats.yesterdayCount ? (
                    <span className="text-green-600">
                      +{((stats.todayCount - stats.yesterdayCount) / Math.max(stats.yesterdayCount, 1) * 100).toFixed(1)}%
                    </span>
                  ) : stats.todayCount < stats.yesterdayCount ? (
                    <span className="text-red-600">
                      {((stats.todayCount - stats.yesterdayCount) / Math.max(stats.yesterdayCount, 1) * 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-600">No change</span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Days</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDays}</div>
                <p className="text-xs text-muted-foreground">
                  Days with messages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Message ID generation
                </p>
              </CardContent>
            </Card>
          </div>

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>
                Details about the message ID generation system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Date Range</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Oldest date:</span>{' '}
                      <span className="font-mono">{formatDate(stats.oldestDate)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Newest date:</span>{' '}
                      <span className="font-mono">{formatDate(stats.newestDate)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Message ID Format</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Format:</span>{' '}
                      <code className="bg-muted px-1 rounded">MSG{'{YYYYMMDD}'}{'{7-digit-counter}'}</code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Next ID:</span>{' '}
                      <code className="bg-muted px-1 rounded">{generateSampleMessageId()}</code>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Scaling Information</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Daily counters reset automatically at midnight</p>
                  <p>• Maximum messages per day: 9,999,999 (7-digit counter)</p>
                  <p>• Legacy message IDs (Firebase format) are still supported</p>
                  <p>• Counter storage path: <code className="bg-muted px-1 rounded">system/messageIdCounters</code></p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Admin Actions</h4>
                  <p className="text-sm text-muted-foreground">
                    Use with caution - these actions affect the production system
                  </p>
                </div>
                <Button
                  onClick={handleResetCounter}
                  variant="destructive"
                  size="sm"
                >
                  Reset Today's Counter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage Examples */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Examples</CardTitle>
              <CardDescription>
                Examples of the new message ID format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium mb-2">Sample Message IDs</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Today's first message:</span>
                      <br />
                      <code className="bg-muted px-2 py-1 rounded">
                        MSG{new Date().getFullYear()}{(new Date().getMonth() + 1).toString().padStart(2, '0')}{new Date().getDate().toString().padStart(2, '0')}0000001
                      </code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Legacy format (still supported):</span>
                      <br />
                      <code className="bg-muted px-2 py-1 rounded">-OGB7uLz_vVrrhCqpXu4</code>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}