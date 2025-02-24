import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowUpIcon, SearchIcon, InfoIcon, RefreshCwIcon } from "lucide-react"
import { useRouter } from "next/router"
import { useTrendingSearches } from "@/hooks/useTrendingSearches"
import { useToast } from "@/components/ui/use-toast"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { useAuth } from "@/contexts/AuthContext"
import { useProfile } from "@/hooks/useProfile"
import { Footer } from "@/components/Footer"

export default function TrendingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { profile, isLoading: profileLoading } = useProfile(user?.uid)
  const { trendingSearches, isLoading: searchesLoading, error, refreshTrending } = useTrendingSearches()
  const [maxCount, setMaxCount] = useState(0)
  const [isRefreshDisabled, setIsRefreshDisabled] = useState(false)

  useEffect(() => {
    if (!user) {
      toast({
        title: "Premium Feature",
        description: "Please sign in to access trending searches.",
        variant: "default"
      })
      router.push("/auth/sign-in")
      return
    }

    if (!profileLoading && profile && profile.tier !== "premium") {
      toast({
        title: "Premium Feature",
        description: "Upgrade to Premium to access trending searches and analytics.",
        variant: "default"
      })
      router.push("/dashboard/account-status")
      return
    }
  }, [user, profile, profileLoading, router, toast])

  useEffect(() => {
    if (trendingSearches.length > 0) {
      setMaxCount(Math.max(...trendingSearches.map(item => item.count)))
    }
  }, [trendingSearches])

  const getProgressValue = (count: number) => {
    return maxCount > 0 ? (count / maxCount) * 100 : 0
  }

  const handleSearchClick = (term: string) => {
    router.push(`/listings?search=${encodeURIComponent(term)}`)
  }

  const handleRefresh = async () => {
    setIsRefreshDisabled(true)
    await refreshTrending()
    
    // Enable the refresh button after 10 seconds
    setTimeout(() => {
      setIsRefreshDisabled(false)
    }, 10000)

    toast({
      title: "Refreshed",
      description: "Trending searches have been updated.",
      variant: "default"
    })
  }

  // Show loading state while checking authentication and profile
  if (profileLoading || !user || (profile && profile.tier !== "premium")) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Card>
      </div>
    )
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
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-grow">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">Trending Searches</h1>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshDisabled || searchesLoading}
            >
              <RefreshCwIcon className={`h-5 w-5 ${searchesLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="ghost" size="icon">
                <InfoIcon className="h-5 w-5" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">How Trending Searches Work</h4>
                <p className="text-sm text-muted-foreground">
                  This page shows the most popular search terms in the last 24 hours. 
                  The data updates hourly and displays:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Search term popularity ranking</li>
                  <li>Number of times each term was searched</li>
                  <li>Visual representation of search volume</li>
                </ul>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        
        <p className="text-muted-foreground mb-8">
          Discover what other collectors are searching for right now. Click the refresh button to get the latest data.
        </p>

        {searchesLoading ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {trendingSearches.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No trending searches yet today. Be the first to search!</p>
              </div>
            ) : (
              trendingSearches.slice(0, 10).map((item, index) => (
                <Card
                  key={item.term}
                  className="p-4 hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => handleSearchClick(item.term)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="text-2xl font-bold text-muted-foreground w-8">
                          {index + 1}
                        </span>
                        <div>
                          <h2 className="text-lg font-semibold">{item.term}</h2>
                          <p className="text-sm text-muted-foreground">
                            {item.count} {item.count === 1 ? 'search' : 'searches'} today
                          </p>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm">
                        <SearchIcon className="w-4 h-4 mr-2" />
                        Search
                      </Button>
                    </div>
                    <Progress value={getProgressValue(item.count)} className="h-2" />
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
      <Footer />
    </div>
  )
}