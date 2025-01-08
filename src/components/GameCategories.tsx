import { Button } from "@/components/ui/button"
import { useRouter } from "next/router"

export const GAME_CATEGORIES = [
  "Pokemon",
  "Magic: The Gathering",
  "Yu-Gi-Oh",
  "One Piece Card Game",
  "Disney Lorcana",
  "Digimon",
] as const

export type GameCategory = (typeof GAME_CATEGORIES)[number]

export function GameCategories() {
  const router = useRouter()

  const handleCategoryClick = (category?: GameCategory) => {
    const query = category ? { category } : {}
    router.push({
      pathname: "/listings",
      query,
    })
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-wrap gap-4 justify-center">
        <Button
          variant="outline"
          className="min-w-[150px]"
          onClick={() => handleCategoryClick()}
        >
          All Games
        </Button>
        {GAME_CATEGORIES.map((category) => (
          <Button
            key={category}
            variant="outline"
            className="min-w-[150px]"
            onClick={() => handleCategoryClick(category)}
          >
            {category}
          </Button>
        ))}
      </div>
    </div>
  )
}