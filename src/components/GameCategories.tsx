import { Button } from "@/components/ui/button"
import { useRouter } from "next/router"
import { motion } from "framer-motion"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"
import { 
  GAME_MAPPING, 
  OTHER_GAME_MAPPING, 
  MAIN_GAME_CATEGORIES, 
  OTHER_GAME_CATEGORIES,
  GameCategory
} from "@/lib/game-mappings"

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
  const currentGame = router.query.game as string | undefined

  const handleCategoryClick = (category?: GameCategory) => {
    const query = category 
      ? { game: category === "Magic: The Gathering" 
          ? "mtg" 
          : GAME_MAPPING[category as keyof typeof GAME_MAPPING] || 
            OTHER_GAME_MAPPING[category as keyof typeof OTHER_GAME_MAPPING] } 
      : {}
    
    router.push({
      pathname: "/listings",
      query,
    })
  }

  return (
    <motion.div 
      className="hidden md:block w-full max-w-7xl mx-auto px-4 py-1"
      initial="hidden"
      animate="show"
      variants={container}
    >
      <motion.div className="flex flex-wrap gap-2 justify-center">
        <motion.div variants={item}>
          <Button
            variant="outline"
            size="sm"
            className={`min-w-[120px] h-7 text-xs font-medium ${!currentGame ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
            onClick={() => handleCategoryClick()}
          >
            All Categories
          </Button>
        </motion.div>
        {MAIN_GAME_CATEGORIES.map((category) => (
          <motion.div key={category} variants={item}>
            <Button
              variant="outline"
              size="sm"
              className={`min-w-[120px] h-7 text-xs font-medium ${
                currentGame === GAME_MAPPING[category] ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''
              }`}
              onClick={() => handleCategoryClick(category)}
            >
              {category}
            </Button>
          </motion.div>
        ))}
        <motion.div variants={item}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="min-w-[120px] h-7 text-xs font-medium"
              >
                More <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {OTHER_GAME_CATEGORIES.map((category) => (
                <DropdownMenuItem
                  key={category}
                  className={`text-xs ${
                    currentGame === OTHER_GAME_MAPPING[category] ? 'bg-primary text-primary-foreground' : ''
                  }`}
                  onClick={() => handleCategoryClick(category)}
                >
                  {category}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}