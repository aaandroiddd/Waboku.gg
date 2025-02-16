import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpIcon, SearchIcon } from "lucide-react"
import { useRouter } from "next/router"
import { useTrendingSearches } from "@/hooks/useTrendingSearches"

export default function TrendingPage() {
  const router = useRouter()
  const { trendingSearches, isLoading, error } = useTrendingSearches()

  const handleSearchClick = (term: string) => {
    router.push(`/listings?search=${encodeURIComponent(term)}`)
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Error Loading Trending Searches</h1>
            <p className="text-muted-foreground">Please try again later.</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="p-6">
        <h1 className="text-3xl font-bold mb-6">Trending Searches</h1>
        <p className="text-muted-foreground mb-8">
          Discover what other collectors are searching for right now
        </p>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {trendingSearches.slice(0, 10).map((item, index) => (
              <Card
                key={item.term}
                className="p-4 hover:bg-accent transition-colors cursor-pointer"
                onClick={() => handleSearchClick(item.term)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl font-bold text-muted-foreground w-8">
                      {index + 1}
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold">{item.term}</h2>
                      <p className="text-sm text-muted-foreground">
                        {item.count} searches
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm">
                    <SearchIcon className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}