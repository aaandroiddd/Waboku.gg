import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface SearchTerm {
  term: string;
  count: number;
}

export default function AnalyticsPage() {
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSearchTerms = async () => {
      try {
        const response = await fetch("/api/analytics/search-terms");
        if (!response.ok) throw new Error("Failed to fetch search terms");
        const data = await response.json();
        setSearchTerms(data);
      } catch (err) {
        setError("Failed to load search analytics");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchTerms();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchSearchTerms, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Popular Search Terms (Last 24 Hours)</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="text-red-500 mb-4">{error}</div>
            )}
            
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : searchTerms.length === 0 ? (
              <p className="text-muted-foreground">No search terms recorded in the last 24 hours.</p>
            ) : (
              <div className="space-y-4">
                {searchTerms.map((term, index) => (
                  <div
                    key={term.term}
                    className="flex items-center justify-between p-4 rounded-lg bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold min-w-[2rem]">
                        #{index + 1}
                      </span>
                      <span className="text-lg">{term.term}</span>
                    </div>
                    <Badge variant="secondary" className="ml-auto">
                      {term.count} searches
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}