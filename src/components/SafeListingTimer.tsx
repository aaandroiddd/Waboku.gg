import React from 'react';
import { ListingTimer } from './ListingTimer';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface SafeListingTimerProps {
  createdAt: Date | number | string;
  archivedAt?: Date | number | string;
  accountTier: 'free' | 'premium';
  status: 'active' | 'archived' | 'inactive';
  listingId?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ListingTimerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ListingTimer Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col gap-2">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Unable to load listing timer
            </AlertDescription>
          </Alert>
          <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      );
    }

    return this.props.children;
  }
}

export function SafeListingTimer(props: SafeListingTimerProps) {
  // Validate props before rendering
  if (!props.createdAt || !props.accountTier || !props.status) {
    return (
      <div className="flex flex-col gap-2">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Listing information unavailable
          </AlertDescription>
        </Alert>
        <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
    );
  }

  return (
    <ListingTimerErrorBoundary>
      <ListingTimer {...props} />
    </ListingTimerErrorBoundary>
  );
}