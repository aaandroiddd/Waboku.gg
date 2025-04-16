import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// Define types for component usage data
interface ComponentUsage {
  component: string;
  databasePaths: string[];
  estimatedUsage: number; // in bytes
  frequency: 'low' | 'medium' | 'high';
  lastActive: string;
  potentialIssues: string[];
}

const ComponentDatabaseUsageAnalyzer = () => {
  const [componentUsage, setComponentUsage] = useState<ComponentUsage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // Analyze component database usage
  const analyzeComponentUsage = () => {
    setIsAnalyzing(true);
    
    // This would be a real analysis in a production app
    // For now, we'll simulate finding components with high usage
    
    setTimeout(() => {
      setComponentUsage([
        {
          component: 'Chat.tsx',
          databasePaths: ['/messages', '/users/online', '/chat/threads'],
          estimatedUsage: 2500000, // 2.5MB
          frequency: 'high',
          lastActive: new Date().toLocaleString(),
          potentialIssues: [
            'Multiple listeners on the same path',
            'No pagination on message history',
            'Listeners not detached on unmount'
          ]
        },
        {
          component: 'ListingCard.tsx',
          databasePaths: ['/listings/active', '/users/profiles'],
          estimatedUsage: 1200000, // 1.2MB
          frequency: 'high',
          lastActive: new Date().toLocaleString(),
          potentialIssues: [
            'Fetches full listing data for preview',
            'No data caching implemented'
          ]
        },
        {
          component: 'MessagesPageInitializer.tsx',
          databasePaths: ['/messages', '/chat/threads'],
          estimatedUsage: 3500000, // 3.5MB
          frequency: 'medium',
          lastActive: new Date().toLocaleString(),
          potentialIssues: [
            'Loads all message history at once',
            'No limit on query size'
          ]
        },
        {
          component: 'FirebaseConnectionHandler.tsx',
          databasePaths: ['/.info/connected', '/users/status'],
          estimatedUsage: 50000, // 50KB
          frequency: 'high',
          lastActive: new Date().toLocaleString(),
          potentialIssues: [
            'Frequent connection status checks',
            'Redundant status updates'
          ]
        }
      ]);
      
      setIsAnalyzing(false);
    }, 2000);
  };

  // Format bytes to human-readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Get frequency badge
  const getFrequencyBadge = (frequency: 'low' | 'medium' | 'high') => {
    switch (frequency) {
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      case 'medium':
        return <Badge>Medium</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
    }
  };

  // Get optimization recommendations for a component
  const getOptimizationRecommendations = (component: string) => {
    switch (component) {
      case 'Chat.tsx':
        return [
          'Implement pagination with limitToLast(50) for message history',
          'Consolidate listeners to reduce connection overhead',
          'Add proper cleanup in useEffect return function',
          'Implement local caching for frequently accessed messages'
        ];
      case 'ListingCard.tsx':
        return [
          'Create a separate endpoint for listing previews with minimal data',
          'Implement client-side caching with React Query or SWR',
          'Use shallow queries to fetch only necessary fields'
        ];
      case 'MessagesPageInitializer.tsx':
        return [
          'Implement infinite scroll with pagination',
          'Load only the most recent messages initially',
          'Add data caching to prevent redundant fetches'
        ];
      case 'FirebaseConnectionHandler.tsx':
        return [
          'Reduce frequency of status updates',
          'Batch status updates to minimize writes',
          'Implement debouncing for connection status changes'
        ];
      default:
        return ['No specific recommendations available'];
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Component Database Usage Analyzer</CardTitle>
        <CardDescription>
          Identify components with high Firebase Realtime Database usage
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {componentUsage.length === 0 ? (
            <div className="flex justify-center">
              <Button 
                onClick={analyzeComponentUsage}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing Components...' : 'Analyze Component Usage'}
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Estimated Usage</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {componentUsage.map((item, index) => (
                    <TableRow key={index} className={selectedComponent === item.component ? 'bg-muted' : ''}>
                      <TableCell>{item.component}</TableCell>
                      <TableCell>{formatBytes(item.estimatedUsage)}</TableCell>
                      <TableCell>{getFrequencyBadge(item.frequency)}</TableCell>
                      <TableCell>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedComponent(selectedComponent === item.component ? null : item.component)}
                        >
                          {selectedComponent === item.component ? 'Hide Details' : 'View Details'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {selectedComponent && (
                <div className="mt-6 p-4 border rounded-md">
                  <h3 className="text-lg font-medium mb-4">{selectedComponent} Details</h3>
                  
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="database-paths">
                      <AccordionTrigger>Database Paths</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc pl-6 space-y-1">
                          {componentUsage.find(c => c.component === selectedComponent)?.databasePaths.map((path, i) => (
                            <li key={i} className="font-mono text-sm">{path}</li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="potential-issues">
                      <AccordionTrigger>Potential Issues</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc pl-6 space-y-1">
                          {componentUsage.find(c => c.component === selectedComponent)?.potentialIssues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="optimization-recommendations">
                      <AccordionTrigger>Optimization Recommendations</AccordionTrigger>
                      <AccordionContent>
                        <ul className="list-disc pl-6 space-y-1">
                          {getOptimizationRecommendations(selectedComponent).map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  
                  <div className="mt-4">
                    <Alert>
                      <AlertTitle>Implementation Tip</AlertTitle>
                      <AlertDescription>
                        Check the component source code and look for Firebase database calls. 
                        Apply the recommended optimizations to reduce data usage.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
      
      <CardFooter>
        {componentUsage.length > 0 && (
          <Button 
            variant="outline" 
            onClick={() => {
              setComponentUsage([]);
              setSelectedComponent(null);
            }}
          >
            Reset Analysis
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ComponentDatabaseUsageAnalyzer;