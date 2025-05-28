import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, CheckCircle, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';

interface ReportListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  listingTitle: string;
}

const reportReasons = [
  { value: 'counterfeit', label: 'Counterfeit or fake item' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'misleading', label: 'Misleading information' },
  { value: 'prohibited', label: 'Prohibited item' },
  { value: 'scam', label: 'Potential scam' },
  { value: 'other', label: 'Other issue' },
];

export function ReportListingDialog({ open, onOpenChange, listingId, listingTitle }: ReportListingDialogProps) {
  const [reason, setReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);
  const [reportNumber, setReportNumber] = useState<string>('');
  const { user } = useAuth();
  const router = useRouter();

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open && !user) {
      onOpenChange(false);
      toast.error('Please sign in to report listings', {
        action: {
          label: 'Sign In',
          onClick: () => router.push('/auth/sign-in')
        }
      });
    }
    
    // Reset form when dialog opens
    if (open) {
      setReason('');
      setDescription('');
      setReportSubmitted(false);
      setReportNumber('');
    }
  }, [open, user, onOpenChange, router]);

  // If no user, don't render the dialog content
  if (!user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason) {
      toast.error('Please select a reason for reporting');
      return;
    }

    if (!description || description.trim().length < 10) {
      toast.error('Please provide a detailed description of the issue');
      return;
    }

    if (!user) {
      toast.error('You must be logged in to report a listing');
      router.push('/auth/sign-in');
      return;
    }

    setLoading(true);

    try {
      // Get the user's authentication token
      const token = await user.getIdToken();
      
      console.log('Submitting report with token:', token ? 'Token exists' : 'No token');
      
      const response = await fetch('/api/listings/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          listingId,
          reason,
          description,
          reportedBy: user.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Report submission error:', errorData);
        throw new Error(errorData.error || 'Failed to submit report');
      }

      const data = await response.json();
      
      // Set the report number and show success state
      setReportNumber(data.reportId || data.reportNumber || 'Unknown');
      setReportSubmitted(true);
      
      toast.success('Report submitted successfully', {
        description: `Report #${data.reportId || data.reportNumber || 'Unknown'} has been created`
      });
    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast.error(error.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyReportNumber = () => {
    navigator.clipboard.writeText(reportNumber);
    toast.success('Report number copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {reportSubmitted ? 'Report Submitted' : 'Report Listing'}
          </DialogTitle>
          <DialogDescription>
            {reportSubmitted 
              ? 'Your report has been successfully submitted and will be reviewed by our moderation team.'
              : 'Report this listing if you believe it violates our community guidelines or terms of service.'
            }
          </DialogDescription>
        </DialogHeader>
        
        {reportSubmitted ? (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <div className="space-y-2">
                  <p className="font-medium">Report submitted successfully!</p>
                  <p className="text-sm">
                    Your report has been received and assigned the following reference number:
                  </p>
                  <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 rounded border">
                    <code className="font-mono text-sm font-medium">#{reportNumber}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={copyReportNumber}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Please save this number for your records. Our moderation team will review your report within 24-48 hours.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <h4 className="font-medium text-sm">What happens next?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Our moderation team will review your report</li>
                <li>• We'll investigate the listing and take appropriate action</li>
                <li>• If the listing violates our policies, it will be removed</li>
                <li>• You may be contacted if we need additional information</li>
              </ul>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for reporting</Label>
              <Select value={reason} onValueChange={setReason} required>
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {reportReasons.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Please provide details about the issue"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px]"
                required
              />
            </div>
          </form>
        )}
        
        <DialogFooter>
          {reportSubmitted ? (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Close
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} onClick={handleSubmit}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Report
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}