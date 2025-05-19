import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListingsFetchDebugger } from "@/components/ListingsFetchDebugger";
import { ListingRestorationTool } from "./ListingRestorationTool";
import { ChevronDown, ChevronUp, Settings } from "lucide-react";

export function AdvancedTools() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="mb-6">
      <CardHeader 
        className="pb-3 cursor-pointer flex flex-row items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg font-medium">Advanced Tools</CardTitle>
            <CardDescription>
              Debugging and troubleshooting tools
            </CardDescription>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-6">
          <ListingsFetchDebugger />
          <ListingRestorationTool />
        </CardContent>
      )}
    </Card>
  );
}