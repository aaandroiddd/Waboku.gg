import { useState, useEffect } from 'react';
import { ReCaptcha, useReCaptcha } from '@/components/ReCaptcha';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RecaptchaTestPage() {
  const [configData, setConfigData] = useState<any>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  
  const {
    isVerified,
    token,
    error: recaptchaError,
    handleVerify,
    handleExpire,
    handleError,
    reset
  } = useReCaptcha();

  useEffect(() => {
    // Test the reCAPTCHA configuration
    fetch('/api/debug/test-recaptcha-config')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.success) {
          setConfigData(data.config);
        } else {
          setConfigError(data.message);
        }
      })
      .catch(err => {
        console.error('API call failed:', err);
        // Fallback: show client-side config info
        const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
        setConfigData({
          hasSiteKey: !!siteKey,
          hasSecretKey: true, // We can't check this client-side
          siteKeyLength: siteKey ? siteKey.length : 0,
          secretKeyLength: 40, // Assume it's set
          siteKeyPrefix: siteKey ? siteKey.substring(0, 10) + '...' : 'not set',
        });
        setConfigError(`API unavailable (${err.message}), showing client-side data`);
      });
  }, []);

  const testRecaptchaVerification = async () => {
    if (!token) {
      alert('Please complete the reCAPTCHA first');
      return;
    }

    try {
      const response = await fetch('/api/auth/verify-recaptcha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          action: 'test'
        }),
      });

      const result = await response.json();
      alert(`Verification result: ${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      alert(`Verification error: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>reCAPTCHA Configuration Test</CardTitle>
            <CardDescription>
              Testing reCAPTCHA setup and configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {configError ? (
              <div className="text-red-500">
                <strong>Configuration Error:</strong> {configError}
              </div>
            ) : configData ? (
              <div className="space-y-2">
                <div><strong>Has Site Key:</strong> {configData.hasSiteKey ? 'Yes' : 'No'}</div>
                <div><strong>Has Secret Key:</strong> {configData.hasSecretKey ? 'Yes' : 'No'}</div>
                <div><strong>Site Key Length:</strong> {configData.siteKeyLength}</div>
                <div><strong>Secret Key Length:</strong> {configData.secretKeyLength}</div>
                <div><strong>Site Key Prefix:</strong> {configData.siteKeyPrefix}</div>
              </div>
            ) : (
              <div>Loading configuration...</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>reCAPTCHA Component Test</CardTitle>
            <CardDescription>
              Testing the actual reCAPTCHA component
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div><strong>Is Verified:</strong> {isVerified ? 'Yes' : 'No'}</div>
              <div><strong>Has Token:</strong> {token ? 'Yes' : 'No'}</div>
              <div><strong>Token Length:</strong> {token ? token.length : 0}</div>
              {recaptchaError && (
                <div className="text-red-500">
                  <strong>reCAPTCHA Error:</strong> {recaptchaError}
                </div>
              )}
            </div>

            <div className="border p-4 rounded">
              <ReCaptcha
                onVerify={handleVerify}
                onExpire={handleExpire}
                onError={handleError}
                className="flex justify-center"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={testRecaptchaVerification} disabled={!token}>
                Test Verification
              </Button>
              <Button onClick={reset} variant="outline">
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment Variables</CardTitle>
            <CardDescription>
              Client-side environment variable check
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <strong>NEXT_PUBLIC_RECAPTCHA_SITE_KEY:</strong>{' '}
                {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ? 
                  `${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY.substring(0, 10)}...` : 
                  'Not set'
                }
              </div>
              <div>
                <strong>Key Length:</strong>{' '}
                {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.length || 0}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}