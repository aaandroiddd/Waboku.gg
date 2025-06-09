import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { extractWantedPostIdFromSlug } from "@/lib/wanted-posts-slug";

export default function DebugFrontendPage() {
  const router = useRouter();
  const [debugInfo, setDebugInfo] = useState<any[]>([]);

  const addDebugInfo = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    setDebugInfo(prev => [...prev, { timestamp, message, data }]);
    console.log(`[DEBUG ${timestamp}] ${message}`, data || '');
  };

  useEffect(() => {
    addDebugInfo("Component mounted");
    addDebugInfo("Router ready", router.isReady);
    addDebugInfo("Router query", router.query);
  }, [router.isReady, router.query]);

  const testSlugParsing = () => {
    const testSlug = "need-absol-cards-599756";
    addDebugInfo("Testing slug parsing", testSlug);
    
    const extractedId = extractWantedPostIdFromSlug(testSlug);
    addDebugInfo("Extracted ID", extractedId);
    
    // Test the API call
    const testApiCall = async () => {
      try {
        addDebugInfo("Making API call to resolve short ID", extractedId);
        const response = await fetch(`/api/wanted/resolve-short-id?shortId=${extractedId}`);
        addDebugInfo("API response status", response.status);
        
        const data = await response.json();
        addDebugInfo("API response data", data);
      } catch (error) {
        addDebugInfo("API call error", error);
      }
    };
    
    if (extractedId) {
      testApiCall();
    }
  };

  const testDirectNavigation = () => {
    addDebugInfo("Testing direct navigation to wanted post");
    router.push("/wanted/pokemon/need-absol-cards-599756");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Frontend Debug Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={testSlugParsing}>Test Slug Parsing</Button>
            <Button onClick={testDirectNavigation}>Test Navigation</Button>
            <Button onClick={() => setDebugInfo([])}>Clear Debug</Button>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg max-h-96 overflow-y-auto">
            <h3 className="font-semibold mb-2">Debug Output:</h3>
            {debugInfo.length === 0 ? (
              <p className="text-gray-500">No debug info yet...</p>
            ) : (
              <div className="space-y-2">
                {debugInfo.map((info, index) => (
                  <div key={index} className="text-sm">
                    <span className="text-blue-600 dark:text-blue-400">[{info.timestamp}]</span>
                    <span className="ml-2">{info.message}</span>
                    {info.data && (
                      <pre className="ml-4 text-xs bg-gray-200 dark:bg-gray-700 p-2 rounded mt-1 overflow-x-auto">
                        {typeof info.data === 'object' ? JSON.stringify(info.data, null, 2) : String(info.data)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}