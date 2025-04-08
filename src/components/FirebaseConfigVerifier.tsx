import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getFirebaseServices } from '@/lib/firebase';

type ConfigStatus = 'unknown' | 'valid' | 'invalid' | 'missing';

interface ConfigItem {
  name: string;
  value: string | null;
  status: ConfigStatus;
  description: string;
}

export function FirebaseConfigVerifier() {
  const [isLoading, setIsLoading] = useState(true);
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);
  const [overallStatus, setOverallStatus] = useState<'valid' | 'invalid' | 'partial' | 'unknown'>('unknown');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);

  useEffect(() => {
    checkFirebaseConfig();
  }, []);

  const checkFirebaseConfig = () => {
    setIsLoading(true);
    
    try {
      // Get the environment variables used for Firebase config
      const configItems: ConfigItem[] = [
        {
          name: 'API Key',
          value: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 
            `${process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5)}...` : null,
          status: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'valid' : 'missing',
          description: 'Used for authentication and API access'
        },
        {
          name: 'Auth Domain',
          value: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || null,
          status: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'valid' : 'missing',
          description: 'Used for authentication flows'
        },
        {
          name: 'Project ID',
          value: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
          status: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'valid' : 'missing',
          description: 'Identifies your Firebase project'
        },
        {
          name: 'Storage Bucket',
          value: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || null,
          status: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? 'valid' : 'missing',
          description: 'Used for Firebase Storage'
        },
        {
          name: 'Messaging Sender ID',
          value: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || null,
          status: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? 'valid' : 'missing',
          description: 'Used for Firebase Cloud Messaging'
        },
        {
          name: 'App ID',
          value: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 
            `${process.env.NEXT_PUBLIC_FIREBASE_APP_ID.substring(0, 5)}...` : null,
          status: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 'valid' : 'missing',
          description: 'Identifies your Firebase app'
        },
        {
          name: 'Database URL',
          value: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || null,
          status: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? 'valid' : 'missing',
          description: 'URL for Realtime Database access'
        }
      ];
      
      setConfigItems(configItems);
      
      // Determine overall status
      const missingCount = configItems.filter(item => item.status === 'missing').length;
      const invalidCount = configItems.filter(item => item.status === 'invalid').length;
      
      if (missingCount === 0 && invalidCount === 0) {
        setOverallStatus('valid');
      } else if (missingCount === configItems.length) {
        setOverallStatus('invalid');
      } else {
        setOverallStatus('partial');
      }
    } catch (error) {
      console.error('Error checking Firebase config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyFirebaseConnection = async () => {
    setIsVerifying(true);
    setVerificationResult(null);
    
    try {
      // Get Firebase services
      const { app, auth, db, database } = getFirebaseServices();
      
      if (!app) {
        setVerificationResult('Firebase app initialization failed. Check your API key and configuration.');
        return;
      }
      
      // Check if critical services are available
      const servicesStatus = {
        app: !!app,
        auth: !!auth,
        firestore: !!db,
        database: !!database
      };
      
      if (!servicesStatus.auth || !servicesStatus.firestore || !servicesStatus.database) {
        setVerificationResult(`Firebase services partially initialized. Available services: ${
          Object.entries(servicesStatus)
            .filter(([_, available]) => available)
            .map(([name]) => name)
            .join(', ')
        }`);
        return;
      }
      
      // All services are available
      setVerificationResult('Firebase configuration is valid and all services are initialized correctly.');
    } catch (error) {
      console.error('Error verifying Firebase connection:', error);
      setVerificationResult(`Error verifying Firebase connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (status: ConfigStatus) => {
    switch (status) {
      case 'valid':
        return <Badge variant="default" className="ml-2">Valid</Badge>;
      case 'invalid':
        return <Badge variant="destructive" className="ml-2">Invalid</Badge>;
      case 'missing':
        return <Badge variant="outline" className="ml-2">Missing</Badge>;
      default:
        return <Badge variant="secondary" className="ml-2">Unknown</Badge>;
    }
  };

  const getOverallStatusBadge = () => {
    switch (overallStatus) {
      case 'valid':
        return <Badge variant="default" className="ml-2">All Valid</Badge>;
      case 'invalid':
        return <Badge variant="destructive" className="ml-2">Invalid Configuration</Badge>;
      case 'partial':
        return <Badge variant="secondary" className="ml-2">Partially Configured</Badge>;
      default:
        return <Badge variant="outline" className="ml-2">Unknown</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Firebase Configuration Verification
          {getOverallStatusBadge()}
        </CardTitle>
        <CardDescription>
          Verify the Firebase API key and configuration settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {configItems.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{item.name}</div>
                    {getStatusBadge(item.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                  <div className="flex items-center space-x-2">
                    <code className="bg-muted p-1 rounded text-xs">
                      {item.value || 'Not configured'}
                    </code>
                    {item.status === 'valid' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : item.status === 'invalid' ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  {index < configItems.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>

            {verificationResult && (
              <Alert variant={verificationResult.includes('valid') ? "default" : "destructive"}>
                <AlertTitle>Verification Result</AlertTitle>
                <AlertDescription>{verificationResult}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={checkFirebaseConfig} variant="outline" disabled={isLoading}>
          Refresh Configuration
        </Button>
        <Button 
          onClick={verifyFirebaseConnection} 
          disabled={isVerifying || isLoading}
          className="flex items-center gap-2"
        >
          {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
          {isVerifying ? 'Verifying...' : 'Verify Connection'}
        </Button>
      </CardFooter>
    </Card>
  );
}</function_results>

Now, let's update the Firebase connection debug page to include our new component:

<function_calls>
<invoke name="edit_file">
<parameter name="file_path">src/pages/admin/firebase-connection-debug.tsx