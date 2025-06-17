import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

interface EmailNotificationTesterProps {
  adminSecret: string;
}

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

export function EmailNotificationTester({ adminSecret }: EmailNotificationTesterProps) {
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [emailType, setEmailType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTestEmail = async () => {
    if (!userEmail || !userName || !emailType) {
      setResult({
        success: false,
        message: 'Please fill in all fields'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/notifications/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        },
        body: JSON.stringify({
          userEmail,
          userName,
          type: emailType
        })
      });

      const data = await response.json();
      
      setResult({
        success: response.ok && data.success,
        message: data.message || (response.ok ? 'Email sent successfully' : 'Failed to send email'),
        details: data
      });
    } catch (error) {
      setResult({
        success: false,
        message: 'Error testing email notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    setLoading(false);
  };

  const clearForm = () => {
    setUserEmail('');
    setUserName('');
    setEmailType('');
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="userEmail">User Email</Label>
          <Input
            id="userEmail"
            type="email"
            placeholder="user@example.com"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="userName">User Name</Label>
          <Input
            id="userName"
            placeholder="John Doe"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emailType">Email Type</Label>
        <Select value={emailType} onValueChange={setEmailType}>
          <SelectTrigger>
            <SelectValue placeholder="Select email type to test" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="welcome">Welcome Email</SelectItem>
            <SelectItem value="notification">Test Notification Email</SelectItem>
            <SelectItem value="full-notification">Full Notification System Test</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={handleTestEmail}
          disabled={loading || !userEmail || !userName || !emailType}
          className="flex-1"
        >
          {loading ? 'Sending...' : 'Send Test Email'}
        </Button>
        <Button 
          onClick={clearForm}
          variant="outline"
          disabled={loading}
        >
          Clear
        </Button>
      </div>

      {result && (
        <Alert className={result.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
          <AlertDescription>
            <div className="space-y-2">
              <div className={result.success ? 'text-green-700' : 'text-red-700'}>
                {result.success ? '✅' : '❌'} {result.message}
              </div>
              {result.details && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">View Details</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">Email Type Descriptions:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Welcome Email:</strong> Sends a welcome email with platform features and getting started information</li>
          <li><strong>Test Notification Email:</strong> Sends a simple test notification email to verify email delivery</li>
          <li><strong>Full Notification System Test:</strong> Creates an in-app notification and attempts to send an email (tests the complete flow)</li>
        </ul>
      </Card>

      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <h4 className="font-medium text-yellow-900 mb-2">Important Notes:</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Make sure the RESEND_API_KEY environment variable is properly configured</li>
          <li>• Email delivery may take a few moments</li>
          <li>• Check spam/junk folders if emails don't appear in inbox</li>
          <li>• The "from" address is configured as notifications@waboku.gg</li>
        </ul>
      </Card>
    </div>
  );
}