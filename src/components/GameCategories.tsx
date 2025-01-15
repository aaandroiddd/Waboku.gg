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

// Game categories mapping to ensure consistent values
export const GAME_MAPPING = {
  "Pokemon": "pokemon",
  "Magic: The Gathering": "mtg",
  "Yu-Gi-Oh!": "yugioh",
  "One Piece Card Game": "onepiece",
  "Disney Lorcana": "lorcana",
  "Digimon": "digimon",
} as const

// Mapping for game name variations to handle different formats and cases
export const GAME_NAME_MAPPING = {
  "pokemon": ["pokemon", "Pokemon", "POKEMON", "Pokemon TCG"],
  "mtg": ["mtg", "Magic: The Gathering", "MTG", "Magic", "magic the gathering"],
  "yugioh": ["yugioh", "Yu-Gi-Oh!", "Yu-Gi-Oh", "YuGiOh"],
  "onepiece": ["onepiece", "One Piece", "One Piece Card Game", "ONEPIECE"],
  "lorcana": ["lorcana", "Disney Lorcana", "Lorcana"],
  "digimon": ["digimon", "Digimon Card Game", "DIGIMON"],
  "dbs": ["dbs", "Dragon Ball Super", "Dragon Ball Super Card Game"],
  "flesh-and-blood": ["flesh-and-blood", "Flesh and Blood", "FAB"],
  "star-wars": ["star-wars", "Star Wars: Unlimited", "Star Wars"],
  "union-arena": ["union-arena", "Union Arena"],
  "universus": ["universus", "Universus"],
  "vanguard": ["vanguard", "Cardfight Vanguard", "Vanguard"],
  "weiss": ["weiss", "Weiss Schwarz", "Weiss"]
}

export const OTHER_GAME_MAPPING = {
  "Dragon Ball Super Card Game": "dbs",
  "Flesh and Blood": "flesh-and-blood",
  "Star Wars: Unlimited": "star-wars",
  "Union Arena": "union-arena",
  "Universus": "universus",
  "Vanguard": "vanguard",
  "Weiss Schwarz": "weiss",
  "Accessories": "accessories",
} as const

export const MAIN_GAME_CATEGORIES = Object.keys(GAME_MAPPING) as (keyof typeof GAME_MAPPING)[]
export const OTHER_GAME_CATEGORIES = Object.keys(OTHER_GAME_MAPPING) as (keyof typeof OTHER_GAME_MAPPING)[]

export type GameCategory = keyof typeof GAME_MAPPING | keyof typeof OTHER_GAME_MAPPING

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
      className="hidden md:block w-full max-w-7xl mx-auto px-4 py-2"
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
            All Games
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