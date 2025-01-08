import { Button } from "@/components/ui/button"
import { useRouter } from "next/router"
import { motion } from "framer-motion"

export const GAME_CATEGORIES = [
  "Pokemon",
  "Magic: The Gathering",
  "Yu-Gi-Oh",
  "One Piece Card Game",
  "Disney Lorcana",
  "Digimon",
] as const

export type GameCategory = (typeof GAME_CATEGORIES)[number]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30
    }
  }
}

export function GameCategories() {
  const router = useRouter()
  const currentCategory = router.query.category as GameCategory | undefined

  const handleCategoryClick = (category?: GameCategory) => {
    const query = category ? { category } : {}
    router.push({
      pathname: "/listings",
      query,
    })
  }

  return (
    <motion.div 
      className="w-full max-w-7xl mx-auto px-4 py-2"
      initial="hidden"
      animate="show"
      variants={container}
    >
      <motion.div className="flex flex-wrap gap-2 justify-center">
        <motion.div variants={item}>
          <Button
            variant="outline"
            size="sm"
            className={`min-w-[120px] h-7 text-xs font-medium ${!currentCategory ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
            onClick={() => handleCategoryClick()}
          >
            All Games
          </Button>
        </motion.div>
        {GAME_CATEGORIES.map((category) => (
          <motion.div key={category} variants={item}>
            <Button
              variant="outline"
              size="sm"
              className={`min-w-[120px] h-7 text-xs font-medium ${currentCategory === category ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
              onClick={() => handleCategoryClick(category)}
            >
              {category}
            </Button>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}