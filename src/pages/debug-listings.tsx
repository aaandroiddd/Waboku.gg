import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ListingsGridDebugger } from '@/components/ListingsGridDebugger';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function DebugListingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <>
      <Head>
        <title>Debug Listings | Waboku.gg</title>
        <meta name="description" content="Debug listings display issues" />
      </Head>

      <div className="min-h-screen flex flex-col">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Listings Debug Tool</CardTitle>
                <CardDescription>
                  This tool helps diagnose issues with listings not appearing on the page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  If you're experiencing issues with listings not showing up, this tool can help identify the problem.
                  Click the button below to fetch listings directly from Firestore and analyze why they might not be visible.
                </p>
                
                <div className="flex gap-2">
                  <Button onClick={() => router.push('/')}>
                    Return to Home
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            <ListingsGridDebugger />
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
}