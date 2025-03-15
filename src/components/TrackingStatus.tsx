import { useState } from 'react';
import { useTrackingStatus, TrackingStatus } from '@/hooks/useTrackingStatus';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, RefreshCw, Package, TruckIcon, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TrackingStatusComponentProps {
  carrier: string;
  trackingNumber: string;
}

export function TrackingStatusComponent({ carrier, trackingNumber }: TrackingStatusComponentProps) {
  const { status, loading, error, refetch } = useTrackingStatus(carrier, trackingNumber);
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>Loading tracking information...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
          <span className="text-red-600 dark:text-red-400">Error loading tracking information</span>
        </div>
        <p className="text-sm mt-2 text-red-600/80 dark:text-red-400/80">{error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3" 
          onClick={() => refetch()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <div className="flex items-center">
          <Package className="h-5 w-5 text-slate-600 dark:text-slate-400 mr-2" />
          <span className="text-slate-600 dark:text-slate-400">No tracking information available yet</span>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <Badge variant="success" className="px-2 py-1 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Delivered
          </Badge>
        );
      case 'out_for_delivery':
        return (
          <Badge variant="warning" className="px-2 py-1 flex items-center gap-1">
            <TruckIcon className="h-3 w-3" />
            Out for Delivery
          </Badge>
        );
      case 'in_transit':
        return (
          <Badge variant="info" className="px-2 py-1 flex items-center gap-1">
            <TruckIcon className="h-3 w-3" />
            In Transit
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="px-2 py-1 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="px-2 py-1 flex items-center gap-1">
            <Package className="h-3 w-3" />
            {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <Card className="border border-slate-200 dark:border-slate-800">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusBadge(status.status)}
              <span className="font-medium">{status.statusDescription}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()}
              className="h-8 px-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {status.estimatedDelivery && (
            <div className="text-sm">
              <span className="text-muted-foreground">Estimated Delivery:</span>{' '}
              <span className="font-medium">{formatDate(status.estimatedDelivery)}</span>
            </div>
          )}

          {status.lastUpdate && (
            <div className="text-sm">
              <span className="text-muted-foreground">Last Update:</span>{' '}
              <span>{formatDate(status.lastUpdate)}</span>
              {status.location && <span> • {status.location}</span>}
            </div>
          )}

          {status.events && status.events.length > 0 && (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setExpanded(!expanded)}
                className="w-full justify-between mt-2"
              >
                {expanded ? 'Hide Details' : 'Show Details'}
                <span className="text-xs text-muted-foreground">
                  {status.events.length} {status.events.length === 1 ? 'event' : 'events'}
                </span>
              </Button>

              {expanded && (
                <div className="space-y-3 mt-2 pt-2 border-t">
                  {status.events.map((event, index) => (
                    <div key={index} className="text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{event.description}</span>
                        <span className="text-muted-foreground">{formatDate(event.timestamp)}</span>
                      </div>
                      {event.location && (
                        <div className="text-muted-foreground">{event.location}</div>
                      )}
                      {index < status.events!.length - 1 && <Separator className="my-2" />}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}