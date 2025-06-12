import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Archive, RotateCcw, Trash2, Eye, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { formatPrice } from '@/lib/price';
import { Listing } from '@/types/database';

interface ListingModerationToolProps {
  adminSecret?: string;
  userToken?: string;
  userId?: string;
}

interface ModerationAction {
  type: 'archive' | 'restore' | 'delete';
  listingId: string;
  listing: Listing;
}

export function ListingModerationTool({ adminSecret, userToken, userId }: ListingModerationToolProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [actionDialog, setActionDialog] = useState<ModerationAction | null>(null);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const searchListings = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }

    setLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (adminSecret) {
        headers['x-admin-secret'] = adminSecret;
      } else if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      const response = await fetch(`/api/admin/moderation/search-listings?q=${encodeURIComponent(searchQuery)}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error('Failed to search listings');
      }

      const data = await response.json();
      setSearchResults(data.listings || []);
      
      if (data.listings?.length === 0) {
        toast.info('No listings found matching your search');
      }
    } catch (error) {
      console.error('Error searching listings:', error);
      toast.error('Failed to search listings');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'archive' | 'restore' | 'delete', listing: Listing) => {
    setActionDialog({ type: action, listingId: listing.id, listing });
    setReason('');
    setCustomReason('');
  };

  const confirmAction = async () => {
    if (!actionDialog) return;

    const finalReason = reason === 'custom' ? customReason : reason;
    if (!finalReason.trim()) {
      toast.error('Please provide a reason for this action');
      return;
    }

    setSendingMessage(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (adminSecret) {
        headers['x-admin-secret'] = adminSecret;
      } else if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      // Perform the moderation action
      const response = await fetch('/api/admin/moderation/listing-action', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          listingId: actionDialog.listingId,
          action: actionDialog.type,
          reason: finalReason,
          moderatorId: userId || 'system'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${actionDialog.type} listing`);
      }

      // Update the search results to reflect the change
      setSearchResults(prev => 
        prev.map(listing => 
          listing.id === actionDialog.listingId 
            ? { 
                ...listing, 
                status: actionDialog.type === 'archive' ? 'archived' : 
                        actionDialog.type === 'restore' ? 'active' : 'deleted',
                moderatedAt: new Date().toISOString(),
                moderationDetails: {
                  moderatorId: userId || 'system',
                  actionTaken: actionDialog.type,
                  timestamp: new Date().toISOString(),
                  reason: finalReason
                }
              }
            : listing
        )
      );

      toast.success(`Listing ${actionDialog.type}d successfully and user notified`);
      setActionDialog(null);
    } catch (error) {
      console.error(`Error ${actionDialog.type}ing listing:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${actionDialog.type} listing`);
    } finally {
      setSendingMessage(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'archive': return 'bg-yellow-600 hover:bg-yellow-700';
      case 'restore': return 'bg-green-600 hover:bg-green-700';
      case 'delete': return 'bg-red-600 hover:bg-red-700';
      default: return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  const getStatusBadge = (listing: Listing) => {
    switch (listing.status) {
      case 'active':
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      case 'deleted':
        return <Badge variant="destructive">Deleted</Badge>;
      case 'sold':
        return <Badge variant="outline">Sold</Badge>;
      default:
        return <Badge variant="outline">{listing.status}</Badge>;
    }
  };

  const reasonOptions = [
    { value: 'policy_violation', label: 'Policy Violation' },
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'spam', label: 'Spam or Duplicate' },
    { value: 'counterfeit', label: 'Counterfeit Item' },
    { value: 'misleading_info', label: 'Misleading Information' },
    { value: 'user_request', label: 'User Request' },
    { value: 'maintenance', label: 'System Maintenance' },
    { value: 'custom', label: 'Other (specify)' }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Listing Search & Moderation
          </CardTitle>
          <CardDescription>
            Search for listings by title, description, username, or listing ID to perform moderation actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by title, description, username, or listing ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchListings()}
              className="flex-1"
            />
            <Button onClick={searchListings} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results ({searchResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((listing) => (
                <Card key={listing.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-video relative bg-muted">
                    {listing.imageUrls && listing.imageUrls.length > 0 ? (
                      <Image
                        src={listing.imageUrls[0]}
                        alt={listing.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-muted-foreground">No image</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(listing)}
                    </div>
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg truncate">{listing.title}</CardTitle>
                    <CardDescription>
                      <div className="flex justify-between">
                        <span>By {listing.username}</span>
                        <span className="font-medium">{formatPrice(listing.price)}</span>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge variant="outline">{listing.game}</Badge>
                      <Badge variant="outline">{listing.condition}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {listing.description || 'No description provided'}
                    </p>
                    {listing.moderationDetails && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <span className="font-semibold">Last Action:</span> {listing.moderationDetails.actionTaken} 
                        {listing.moderatedAt && (
                          <span className="ml-1">on {new Date(listing.moderatedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                  <CardContent className="pt-0">
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setSelectedListing(listing);
                          setViewDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      <div className="grid grid-cols-3 gap-1">
                        <Button 
                          variant="default" 
                          size="sm"
                          className={`${getActionColor('archive')} text-white`}
                          onClick={() => handleAction('archive', listing)}
                          disabled={listing.status === 'archived' || listing.status === 'deleted'}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          className={`${getActionColor('restore')} text-white`}
                          onClick={() => handleAction('restore', listing)}
                          disabled={listing.status === 'active'}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          className={`${getActionColor('delete')} text-white`}
                          onClick={() => handleAction('delete', listing)}
                          disabled={listing.status === 'deleted'}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Listing Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Listing Details</DialogTitle>
            <DialogDescription>
              Complete listing information and moderation history
            </DialogDescription>
          </DialogHeader>
          
          {selectedListing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Images</h3>
                <div className="grid grid-cols-2 gap-2">
                  {selectedListing.imageUrls && selectedListing.imageUrls.map((url, index) => (
                    <div 
                      key={index} 
                      className="aspect-square relative bg-muted rounded-md overflow-hidden"
                    >
                      <Image
                        src={url}
                        alt={`Image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-1">Title</h3>
                  <p>{selectedListing.title}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-1">Description</h3>
                  <ScrollArea className="h-[100px] rounded-md border p-2">
                    <p className="text-sm">{selectedListing.description || 'No description provided'}</p>
                  </ScrollArea>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-1">Price</h3>
                    <p>{formatPrice(selectedListing.price)}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Status</h3>
                    {getStatusBadge(selectedListing)}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Game</h3>
                    <p>{selectedListing.game}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Condition</h3>
                    <p>{selectedListing.condition}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-1">Seller Information</h3>
                  <p>Username: {selectedListing.username}</p>
                  <p>User ID: {selectedListing.userId}</p>
                  <p>Location: {selectedListing.city}, {selectedListing.state}</p>
                </div>
                
                {selectedListing.moderationDetails && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <h3 className="font-semibold mb-1">Moderation History</h3>
                    <p className="text-sm">Action: {selectedListing.moderationDetails.actionTaken}</p>
                    <p className="text-sm">Date: {new Date(selectedListing.moderationDetails.timestamp).toLocaleString()}</p>
                    <p className="text-sm">Moderator: {selectedListing.moderationDetails.moderatorId}</p>
                    {selectedListing.moderationDetails.reason && (
                      <p className="text-sm">Reason: {selectedListing.moderationDetails.reason}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog?.type === 'archive' && 'Archive Listing'}
              {actionDialog?.type === 'restore' && 'Restore Listing'}
              {actionDialog?.type === 'delete' && 'Delete Listing'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionDialog?.type === 'archive' && 'This will hide the listing from public view but keep it in the system. The user will be notified.'}
              {actionDialog?.type === 'restore' && 'This will make the listing visible to users again. The user will be notified.'}
              {actionDialog?.type === 'delete' && 'This will permanently remove the listing from the system. This action cannot be undone. The user will be notified.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for action</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasonOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {reason === 'custom' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom reason</label>
                <Textarea
                  placeholder="Please specify the reason for this action..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                />
              </div>
            )}
            
            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertDescription>
                A system message will be automatically sent to the listing owner explaining this action.
              </AlertDescription>
            </Alert>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={sendingMessage || !reason || (reason === 'custom' && !customReason.trim())}
              className={actionDialog ? getActionColor(actionDialog.type) : ''}
            >
              {sendingMessage && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionDialog?.type === 'archive' && 'Archive Listing'}
              {actionDialog?.type === 'restore' && 'Restore Listing'}
              {actionDialog?.type === 'delete' && 'Delete Listing'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}