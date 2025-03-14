// Game categories mapping to ensure consistent values
export const GAME_MAPPING = {
  "Pokemon": "pokemon",
  "Magic: The Gathering": "mtg",
  "Yu-Gi-Oh!": "yugioh",
  "One Piece": "onepiece",
  "Disney Lorcana": "lorcana",
  "Digimon": "digimon",
} as const;

export const OTHER_GAME_MAPPING = {
  "Dragon Ball Super": "dbs",
  "Flesh and Blood": "flesh-and-blood",
  "Star Wars: Unlimited": "star-wars",
  "Union Arena": "union-arena",
  "Universus": "universus",
  "Vanguard": "vanguard",
  "Weiss Schwarz": "weiss",
  "Accessories": "accessories",
  "Other": "other",
} as const;

export const MAIN_GAME_CATEGORIES = Object.keys(GAME_MAPPING) as (keyof typeof GAME_MAPPING)[];
export const OTHER_GAME_CATEGORIES = Object.keys(OTHER_GAME_MAPPING) as (keyof typeof OTHER_GAME_MAPPING)[];

export type GameCategory = keyof typeof GAME_MAPPING | keyof typeof OTHER_GAME_MAPPING;

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
  "weiss": ["weiss", "Weiss Schwarz", "Weiss"],
  "accessories": ["accessories", "Accessories", "ACCESSORIES", "TCG Accessories"],
  "other": ["other", "Other", "OTHER", "Miscellaneous", "Other TCG"]
};

// Game category icons
export const GAME_ICONS: Record<string, string> = {
  "pokemon": "⚡",
  "mtg": "🔮",
  "yugioh": "👁️",
  "onepiece": "☠️",
  "lorcana": "🏰",
  "digimon": "🦖",
  "dbs": "🐉",
  "flesh-and-blood": "⚔️",
  "star-wars": "🚀",
  "union-arena": "🎮",
  "universus": "🌌",
  "vanguard": "🛡️",
  "weiss": "🎭",
  "accessories": "🎒",
  "other": "🃏",
};