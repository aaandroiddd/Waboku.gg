import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowUpIcon, SearchIcon, InfoIcon, RefreshCwIcon, LockIcon } from "lucide-react"
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

  // Check if user is premium
  const isPremium = !profileLoading && user && profile?.tier === "premium"

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
    if (!isPremium) {
      toast({
        title: "Premium Feature",
        description: "Sign in as a premium user to refresh trending data.",
        variant: "default"
      })
      return
    }

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

  const handlePremiumAction = () => {
    if (!user) {
      router.push("/auth/sign-in")
    } else if (profile && profile.tier !== "premium") {
      router.push("/dashboard/account-status")
    }
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
                disabled={isRefreshDisabled || searchesLoading || !isPremium}
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
            Discover what other collectors are searching for right now.
            {!isPremium && " Preview data shown below."}
          </p>

          {!isPremium && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <LockIcon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-medium mb-1">Premium Analytics Feature</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    You're viewing a preview of trending searches. Premium users get full access to real-time analytics, 
                    unlimited searches, and the ability to refresh data on demand.
                  </p>
                  <Button onClick={handlePremiumAction}>
                    {!user ? "Sign in for full access" : "Upgrade to Premium"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {searchesLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {trendingSearches.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No trending searches available yet. Start searching to see trending results!</p>
                </div>
              ) : (
                // Show only 3 items for non-premium users
                trendingSearches.slice(0, isPremium ? 10 : 3).map((item, index) => (
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
              
              {!isPremium && trendingSearches.length > 3 && (
                <div className="text-center pt-4 pb-2">
                  <p className="text-muted-foreground mb-4">
                    {trendingSearches.length - 3} more trending searches available for premium users
                  </p>
                  <Button onClick={handlePremiumAction}>
                    {!user ? "Sign in for full access" : "Upgrade to Premium"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
      <Footer />
    </div>
  )
}