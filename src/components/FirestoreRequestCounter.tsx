import React, { useState, useEffect } from 'react';
import { getActiveListenersCount, getActiveListeners } from '@/lib/firebaseConnectionManager';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X, Activity, RefreshCw } from 'lucide-react';

/**
 * A debug component that displays the number of active Firestore listeners
 * and provides tools to inspect and manage them.
 */
export function FirestoreRequestCounter() {
  const [listenerCount, setListenerCount] = useState(0);
  const [listeners, setListeners] = useState<Array<{ id: string; path: string; timestamp: number }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showCounter, setShowCounter] = useState(true);

  // Update the listener count periodically
  useEffect(() => {
    const updateCount = () => {
      const count = getActiveListenersCount();
      setListenerCount(count);
    };

    // Initial update
    updateCount();

    // Set up interval for updates
    const interval = setInterval(updateCount, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Fetch detailed listener information when dialog is opened
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      refreshListeners();
    }
  };

  // Refresh the listeners list
  const refreshListeners = () => {
    const activeListeners = getActiveListeners();
    setListeners(activeListeners);
  };

  // Format timestamp to readable time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Calculate how long ago a listener was created
  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  // Clean up a specific listener
  const cleanupListener = async (id: string) => {
    try {
      const { removeListener } = await import('@/lib/firebaseConnectionManager');
      removeListener(id);
      refreshListeners();
    } catch (error) {
      console.error('Error cleaning up listener:', error);
    }
  };

  // Clean up all listeners
  const cleanupAllListeners = async () => {
    try {
      const { removeAllListeners } = await import('@/lib/firebaseConnectionManager');
      removeAllListeners();
      refreshListeners();
    } catch (error) {
      console.error('Error cleaning up all listeners:', error);
    }
  };

  // Clean up listeners by prefix
  const cleanupListenersByPrefix = async (prefix: string) => {
    try {
      const { removeListenersByPrefix } = await import('@/lib/firebaseConnectionManager');
      removeListenersByPrefix(prefix);
      refreshListeners();
    } catch (error) {
      console.error(`Error cleaning up listeners with prefix ${prefix}:`, error);
    }
  };

  // Group listeners by prefix for easier management
  const getListenerGroups = () => {
    const groups: Record<string, number> = {};
    
    listeners.forEach(listener => {
      // Extract prefix (everything before the last hyphen)
      const parts = listener.id.split('-');
      let prefix = parts.slice(0, -1).join('-');
      
      // If no hyphen, use the whole ID
      if (prefix === '') {
        prefix = listener.id;
      }
      
      groups[prefix] = (groups[prefix] || 0) + 1;
    });
    
    return Object.entries(groups)
      .map(([prefix, count]) => ({ prefix, count }))
      .sort((a, b) => b.count - a.count);
  };

  return (
    <>
      {/* Floating counter button */}
      {showCounter && (
        <div className="fixed bottom-4 right-4 z-50">
          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className={`rounded-full shadow-md flex items-center gap-1 ${
                  listenerCount > 10 ? 'bg-amber-100 hover:bg-amber-200 border-amber-300' : 
                  listenerCount > 20 ? 'bg-red-100 hover:bg-red-200 border-red-300' : 
                  'bg-white hover:bg-gray-100'
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>{listenerCount}</span>
              </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle className="flex justify-between items-center">
                  <span>Active Firestore Listeners ({listenerCount})</span>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={refreshListeners}
                      title="Refresh"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={cleanupAllListeners}
                      title="Clean up all listeners"
                    >
                      Clean Up All
                    </Button>
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <div className="py-2">
                <h3 className="font-medium mb-2">Listener Groups</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {getListenerGroups().map(({ prefix, count }) => (
                    <Badge 
                      key={prefix} 
                      variant="outline" 
                      className="flex items-center gap-1 cursor-pointer hover:bg-gray-100"
                      onClick={() => cleanupListenersByPrefix(prefix)}
                    >
                      {prefix} ({count})
                      <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              </div>
              
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listeners.map((listener) => (
                      <TableRow key={listener.id}>
                        <TableCell className="font-mono text-xs">{listener.id}</TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[200px]" title={listener.path}>
                          {listener.path}
                        </TableCell>
                        <TableCell className="text-xs">
                          {getTimeAgo(listener.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => cleanupListener(listener.id)}
                            title="Remove listener"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {listeners.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                          No active listeners
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </>
  );
}