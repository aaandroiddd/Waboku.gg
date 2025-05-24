import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { clearFirestoreCaches, fixFirestoreListenChannel } from '@/lib/firebase-connection-fix';
import { getFirebaseServices } from '@/lib/firebase';
import Header from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function ConnectionTroubleshoot() {
  const [isFixingConnection, setIsFixingConnection] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [firestoreStatus, setFirestoreStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [cacheStatus, setCacheStatus] = useState<{
    localStorage: number;
    sessionStorage: number;
    indexedDB: boolean;
  }>({
    localStorage: 0,
    sessionStorage: 0,
    indexedDB: false
  });

  // Check connection status
  useEffect(() => {
    // Check browser online status
    setConnectionStatus(navigator.onLine ? 'online' : 'offline');

    // Add event listeners for online/offline events
    const handleOnline = () => setConnectionStatus('online');
    const handleOffline = () => setConnectionStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check Firestore connection
    const checkFirestore = async () => {
      try {
        const { db } = await getFirebaseServices();
        if (db) {
          setFirestoreStatus('connected');
        } else {
          setFirestoreStatus('disconnected');
        }
      } catch (error) {
        console.error('Error checking Firestore:', error);
        setFirestoreStatus('disconnected');
      }
    };

    checkFirestore();

    // Check cache status
    const checkCacheStatus = () => {
      try {
        // Count localStorage items related to listings
        const localStorageItems = Object.keys(localStorage).filter(key => 
          key.startsWith('listings_') || key.includes('firestore') || key.includes('firebase')
        ).length;

        // Count sessionStorage items related to listings
        const sessionStorageItems = Object.keys(sessionStorage).filter(key => 
          key.startsWith('listings_') || key.includes('firestore') || key.includes('firebase')
        ).length;

        // Check if IndexedDB is available
        const indexedDBAvailable = 'indexedDB' in window;

        setCacheStatus({
          localStorage: localStorageItems,
          sessionStorage: sessionStorageItems,
          indexedDB: indexedDBAvailable
        });
      } catch (error) {
        console.error('Error checking cache status:', error);
      }
    };

    checkCacheStatus();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleFixConnection = async () => {
    setIsFixingConnection(true);
    try {
      await fixFirestoreListenChannel();
      alert('Connection fix completed. Please try browsing the site again.');
    } catch (error) {
      console.error('Error fixing connection:', error);
      alert('Error fixing connection. Please try the other troubleshooting options.');
    } finally {
      setIsFixingConnection(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      // Clear Firestore caches
      await clearFirestoreCaches();
      
      // Clear all listing-related localStorage items
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('listings_') || key.includes('firestore') || key.includes('firebase')) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear all listing-related sessionStorage items
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('listings_') || key.includes('firestore') || key.includes('firebase')) {
          sessionStorage.removeItem(key);
        }
      });
      
      alert('Cache cleared successfully. The page will now reload.');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Error clearing cache. Please try refreshing the page manually.');
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  const handleFullReset = async () => {
    if (confirm('This will clear ALL browser data for this site and reload the page. Continue?')) {
      try {
        // Clear all localStorage
        localStorage.clear();
        
        // Clear all sessionStorage
        sessionStorage.clear();
        
        // Clear IndexedDB if available
        if (window.indexedDB) {
          // Try to delete common Firestore IndexedDB databases
          const dbNames = ['firestore/[DEFAULT]/main', 'firestore/[DEFAULT]/metadata'];
          
          for (const dbName of dbNames) {
            try {
              const request = window.indexedDB.deleteDatabase(dbName);
              request.onerror = (event) => {
                console.error(`Error deleting IndexedDB database ${dbName}:`, event);
              };
            } catch (error) {
              console.error(`Error deleting IndexedDB database ${dbName}:`, error);
            }
          }
        }
        
        alert('All site data has been cleared. The page will now reload.');
        window.location.reload();
      } catch (error) {
        console.error('Error performing full reset:', error);
        alert('Error performing full reset. Please try refreshing the page manually.');
      }
    }
  };

  return (
    <>
      <Head>
        <title>Connection Troubleshooter - Waboku.gg</title>
        <meta name="description" content="Troubleshoot connection issues with Waboku.gg" />
      </Head>

      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">Connection Troubleshooter</h1>
          
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>Current status of your connection to our services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Internet Connection:</span>
                  <span className={`font-medium ${connectionStatus === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                    {connectionStatus === 'checking' ? 'Checking...' : connectionStatus === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Firestore Connection:</span>
                  <span className={`font-medium ${firestoreStatus === 'connected' ? 'text-green-500' : 'text-red-500'}`}>
                    {firestoreStatus === 'checking' ? 'Checking...' : firestoreStatus === 'connected' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="font-medium">Browser Cache:</h3>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>LocalStorage Items:</span>
                      <span>{cacheStatus.localStorage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SessionStorage Items:</span>
                      <span>{cacheStatus.sessionStorage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IndexedDB Available:</span>
                      <span>{cacheStatus.indexedDB ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Troubleshooting Steps</CardTitle>
                <CardDescription>Try these steps in order to resolve connection issues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">1. Refresh the page</h3>
                  <p className="text-sm text-muted-foreground">
                    Sometimes a simple refresh can resolve temporary issues.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh Page
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-medium">2. Fix Connection</h3>
                  <p className="text-sm text-muted-foreground">
                    Attempt to fix Firestore connection issues.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleFixConnection}
                    disabled={isFixingConnection}
                  >
                    {isFixingConnection ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Fixing Connection...
                      </>
                    ) : (
                      <>
                        <WifiOff className="mr-2 h-4 w-4" />
                        Fix Connection
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-medium">3. Clear Cache</h3>
                  <p className="text-sm text-muted-foreground">
                    Clear browser cache related to listings and Firestore.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleClearCache}
                    disabled={isClearingCache}
                  >
                    {isClearingCache ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Clearing Cache...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Cache
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={handleFullReset}
                >
                  Full Reset (Clear All Site Data)
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="mt-8 bg-muted p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Still having issues?</h2>
            <p>
              If you're still experiencing problems after trying these steps, try:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Using an incognito/private browsing window</li>
              <li>Trying a different browser</li>
              <li>Clearing your browser's cache and cookies</li>
              <li>Disabling browser extensions that might interfere with the site</li>
              <li>Checking your internet connection</li>
            </ul>
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
}