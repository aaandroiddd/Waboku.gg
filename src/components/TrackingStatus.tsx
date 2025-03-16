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
  
  // If the carrier was auto-detected, show the detected carrier
  const displayCarrier = status?.carrier || carrier;

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
      <div className="bg-background border border-border rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-destructive mr-2" />
          <span className="text-destructive">Error loading tracking information</span>
        </div>
        <p className="text-sm mt-2 text-muted-foreground">{error}</p>
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
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center">
          <Package className="h-5 w-5 text-muted-foreground mr-2" />
          <span className="text-muted-foreground">No tracking information available yet</span>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return (
          <Badge variant="success" className="px-2 py-1 flex items-center gap-1 bg-green-100 hover:bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/40 border-green-200 dark:border-green-800">
            <CheckCircle className="h-3 w-3" />
            Delivered
          </Badge>
        );
      case 'out_for_delivery':
        return (
          <Badge variant="warning" className="px-2 py-1 flex items-center gap-1 bg-yellow-100 hover:bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/40 border-yellow-200 dark:border-yellow-800">
            <TruckIcon className="h-3 w-3" />
            Out for Delivery
          </Badge>
        );
      case 'in_transit':
        return (
          <Badge variant="info" className="px-2 py-1 flex items-center gap-1 bg-blue-100 hover:bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/40 border-blue-200 dark:border-blue-800">
            <TruckIcon className="h-3 w-3" />
            In Transit
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="px-2 py-1 flex items-center gap-1 bg-slate-100 hover:bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-700">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="px-2 py-1 flex items-center gap-1 bg-slate-50 hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/90">
            <Package className="h-3 w-3" />
            {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    try {
      // First check if it's a valid ISO string
      if (dateString && typeof dateString === 'string') {
        // Validate the date string before parsing
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return format(date, 'MMM d, yyyy h:mm a');
        }
      }
      return 'Unknown date';
    } catch (e) {
      console.error('Error formatting date:', e, dateString);
      return 'Unknown date';
    }
  };

  return (
    <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge(status.status)}
              <span className="font-medium text-sm sm:text-base">{status.statusDescription}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()}
              className="h-8 px-2 self-end sm:self-auto"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Show detected carrier if it was auto-detected */}
          {carrier === 'auto-detect' && status.carrier && status.carrier !== 'auto-detect' && (
            <div className="text-sm">
              <span className="text-muted-foreground">Detected Carrier:</span>{' '}
              <Badge variant="outline" className="ml-1">
                {status.carrier.toUpperCase()}
              </Badge>
            </div>
          )}

          {status.estimatedDelivery && (
            <div className="text-sm break-words">
              <span className="text-muted-foreground">Estimated Delivery:</span>{' '}
              <span className="font-medium">{formatDate(status.estimatedDelivery)}</span>
            </div>
          )}

          {status.lastUpdate && (
            <div className="text-sm break-words">
              <span className="text-muted-foreground">Last Update:</span>{' '}
              <span>{formatDate(status.lastUpdate)}</span>
              {status.location && <span className="block sm:inline sm:before:content-['_•_']">{status.location}</span>}
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