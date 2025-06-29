import { NextApiRequest, NextApiResponse } from 'next';
import { collection, addDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase-admin';

// Mock TCG data for different games
const MOCK_CARD_DATA = {
  pokemon: [
    {
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      rarity: "Holo Rare",
      imageUrl: "https://images.pokemontcg.io/base1/4_hires.png"
    },
    {
      name: "Pikachu",
      set: "Base Set",
      number: "58/102",
      rarity: "Common",
      imageUrl: "https://images.pokemontcg.io/base1/58_hires.png"
    },
    {
      name: "Blastoise",
      set: "Base Set",
      number: "2/102",
      rarity: "Holo Rare",
      imageUrl: "https://images.pokemontcg.io/base1/2_hires.png"
    },
    {
      name: "Venusaur",
      set: "Base Set",
      number: "15/102",
      rarity: "Holo Rare",
      imageUrl: "https://images.pokemontcg.io/base1/15_hires.png"
    },
    {
      name: "Alakazam",
      set: "Base Set",
      number: "1/102",
      rarity: "Holo Rare",
      imageUrl: "https://images.pokemontcg.io/base1/1_hires.png"
    }
  ],
  yugioh: [
    {
      name: "Blue-Eyes White Dragon",
      set: "Legend of Blue Eyes White Dragon",
      number: "LOB-001",
      rarity: "Ultra Rare",
      imageUrl: "https://images.ygoprodeck.com/images/cards/89631139.jpg"
    },
    {
      name: "Dark Magician",
      set: "Legend of Blue Eyes White Dragon",
      number: "LOB-005",
      rarity: "Ultra Rare",
      imageUrl: "https://images.ygoprodeck.com/images/cards/46986414.jpg"
    },
    {
      name: "Red-Eyes Black Dragon",
      set: "Legend of Blue Eyes White Dragon",
      number: "LOB-070",
      rarity: "Ultra Rare",
      imageUrl: "https://images.ygoprodeck.com/images/cards/74677422.jpg"
    },
    {
      name: "Exodia the Forbidden One",
      set: "Legend of Blue Eyes White Dragon",
      number: "LOB-124",
      rarity: "Ultra Rare",
      imageUrl: "https://images.ygoprodeck.com/images/cards/33396948.jpg"
    },
    {
      name: "Time Wizard",
      set: "Legend of Blue Eyes White Dragon",
      number: "LOB-065",
      rarity: "Rare",
      imageUrl: "https://images.ygoprodeck.com/images/cards/71625222.jpg"
    }
  ],
  mtg: [
    {
      name: "Black Lotus",
      set: "Alpha",
      number: "1/295",
      rarity: "Rare",
      imageUrl: "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=3&type=card"
    },
    {
      name: "Lightning Bolt",
      set: "Alpha",
      number: "161/295",
      rarity: "Common",
      imageUrl: "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=209&type=card"
    },
    {
      name: "Ancestral Recall",
      set: "Alpha",
      number: "48/295",
      rarity: "Rare",
      imageUrl: "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=95&type=card"
    },
    {
      name: "Mox Pearl",
      set: "Alpha",
      number: "264/295",
      rarity: "Rare",
      imageUrl: "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=31&type=card"
    },
    {
      name: "Serra Angel",
      set: "Alpha",
      number: "36/295",
      rarity: "Uncommon",
      imageUrl: "https://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=83&type=card"
    }
  ],
  onepiece: [
    {
      name: "Monkey D. Luffy",
      set: "Romance Dawn",
      number: "OP01-001",
      rarity: "Leader",
      imageUrl: "https://en.onepiece-cardgame.com/images/cardlist/card/OP01-001.png"
    },
    {
      name: "Roronoa Zoro",
      set: "Romance Dawn",
      number: "OP01-025",
      rarity: "Rare",
      imageUrl: "https://en.onepiece-cardgame.com/images/cardlist/card/OP01-025.png"
    },
    {
      name: "Nami",
      set: "Romance Dawn",
      number: "OP01-016",
      rarity: "Common",
      imageUrl: "https://en.onepiece-cardgame.com/images/cardlist/card/OP01-016.png"
    },
    {
      name: "Sanji",
      set: "Romance Dawn",
      number: "OP01-013",
      rarity: "Uncommon",
      imageUrl: "https://en.onepiece-cardgame.com/images/cardlist/card/OP01-013.png"
    },
    {
      name: "Portgas D. Ace",
      set: "Romance Dawn",
      number: "OP01-003",
      rarity: "Super Rare",
      imageUrl: "https://en.onepiece-cardgame.com/images/cardlist/card/OP01-003.png"
    }
  ],
  dbs: [
    {
      name: "Son Goku",
      set: "Galactic Battle",
      number: "BT1-001",
      rarity: "Super Rare",
      imageUrl: "https://www.dbs-cardgame.com/images/cardlist/series1/BT1-001.png"
    },
    {
      name: "Vegeta",
      set: "Galactic Battle",
      number: "BT1-020",
      rarity: "Super Rare",
      imageUrl: "https://www.dbs-cardgame.com/images/cardlist/series1/BT1-020.png"
    },
    {
      name: "Frieza",
      set: "Galactic Battle",
      number: "BT1-044",
      rarity: "Super Rare",
      imageUrl: "https://www.dbs-cardgame.com/images/cardlist/series1/BT1-044.png"
    },
    {
      name: "Cell",
      set: "Galactic Battle",
      number: "BT1-054",
      rarity: "Rare",
      imageUrl: "https://www.dbs-cardgame.com/images/cardlist/series1/BT1-054.png"
    },
    {
      name: "Gohan",
      set: "Galactic Battle",
      number: "BT1-005",
      rarity: "Uncommon",
      imageUrl: "https://www.dbs-cardgame.com/images/cardlist/series1/BT1-005.png"
    }
  ],
  lorcana: [
    {
      name: "Mickey Mouse - Brave Little Tailor",
      set: "The First Chapter",
      number: "001/204",
      rarity: "Legendary",
      imageUrl: "https://cdn.lorcana.com/images/cards/001-204.png"
    },
    {
      name: "Elsa - Snow Queen",
      set: "The First Chapter",
      number: "004/204",
      rarity: "Super Rare",
      imageUrl: "https://cdn.lorcana.com/images/cards/004-204.png"
    },
    {
      name: "Belle - Hidden Depths",
      set: "The First Chapter",
      number: "017/204",
      rarity: "Rare",
      imageUrl: "https://cdn.lorcana.com/images/cards/017-204.png"
    },
    {
      name: "Simba - Rightful Heir",
      set: "The First Chapter",
      number: "114/204",
      rarity: "Super Rare",
      imageUrl: "https://cdn.lorcana.com/images/cards/114-204.png"
    },
    {
      name: "Ariel - On Human Legs",
      set: "The First Chapter",
      number: "045/204",
      rarity: "Uncommon",
      imageUrl: "https://cdn.lorcana.com/images/cards/045-204.png"
    }
  ]
};

const CONDITIONS = ['mint', 'near mint', 'excellent', 'good', 'light played', 'played'];
const CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis',
  'Seattle', 'Denver', 'Washington', 'Boston', 'El Paso', 'Nashville',
  'Detroit', 'Oklahoma City', 'Portland', 'Las Vegas', 'Memphis', 'Louisville',
  'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento',
  'Kansas City', 'Mesa', 'Atlanta', 'Omaha', 'Colorado Springs', 'Raleigh',
  'Miami', 'Virginia Beach', 'Oakland', 'Minneapolis', 'Tulsa', 'Arlington',
  'Tampa', 'New Orleans', 'Wichita', 'Cleveland'
];

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Mock usernames for variety
const MOCK_USERNAMES = [
  'CardCollector2024', 'TCGMaster', 'PokemonTrainer', 'YugiohDuelist', 'MTGPlayer',
  'OnePieceFan', 'DBSCollector', 'LorcanaPlayer', 'CardHunter', 'TradingCardPro',
  'DeckBuilder', 'CardShark', 'CollectorKing', 'TCGExpert', 'CardMaster',
  'GameCardGuru', 'TradingAce', 'CardEnthusiast', 'DuelMaster', 'CardWizard'
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomPrice(): number {
  const priceRanges = [
    { min: 1, max: 10, weight: 40 },    // Common cards
    { min: 10, max: 50, weight: 30 },   // Uncommon/Rare
    { min: 50, max: 200, weight: 20 },  // Super Rare
    { min: 200, max: 1000, weight: 8 }, // Ultra Rare
    { min: 1000, max: 5000, weight: 2 } // Legendary/Vintage
  ];
  
  const totalWeight = priceRanges.reduce((sum, range) => sum + range.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const range of priceRanges) {
    random -= range.weight;
    if (random <= 0) {
      return Math.round((Math.random() * (range.max - range.min) + range.min) * 100) / 100;
    }
  }
  
  return 25; // fallback
}

function generateMockUserId(): string {
  return 'mock_user_' + Math.random().toString(36).substr(2, 9);
}

function generateMockListing(game: string, cardData: any): any {
  const isGraded = Math.random() < 0.3; // 30% chance of being graded
  const isFinalSale = Math.random() < 0.2; // 20% chance of final sale
  const isOffersOnly = Math.random() < 0.15; // 15% chance of offers only
  
  const price = isOffersOnly ? 0 : getRandomPrice();
  const condition = getRandomElement(CONDITIONS);
  const city = getRandomElement(CITIES);
  const state = getRandomElement(STATES);
  const username = getRandomElement(MOCK_USERNAMES);
  
  // Create expiration date (48 hours for free tier mock listings)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);
  
  const listing = {
    title: `${cardData.name} - ${cardData.set} ${cardData.number} - ${condition}`,
    description: `Beautiful ${condition.toLowerCase()} condition ${cardData.name} from ${cardData.set}. ${cardData.rarity} card in excellent shape. Perfect for collectors or players!`,
    price,
    game,
    condition,
    imageUrls: [cardData.imageUrl],
    coverImageIndex: 0,
    city,
    state,
    isGraded,
    cardName: cardData.name,
    quantity: Math.floor(Math.random() * 3) + 1, // 1-3 quantity
    userId: generateMockUserId(),
    username,
    createdAt: new Date(),
    expiresAt,
    status: 'active',
    accountTier: 'free',
    offersOnly: isOffersOnly,
    finalSale: isFinalSale
  };
  
  // Add grading info if graded
  if (isGraded) {
    listing.gradeLevel = Math.floor(Math.random() * 6) + 5; // Grade 5-10
    listing.gradingCompany = getRandomElement(['PSA', 'BGS', 'CGC']);
    listing.title += ` - ${listing.gradingCompany} ${listing.gradeLevel}`;
  }
  
  return listing;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin access
    const adminSecret = req.headers['x-admin-secret'] as string;
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { count, games } = req.body;

    if (!count || count < 1 || count > 100) {
      return res.status(400).json({ error: 'Count must be between 1 and 100' });
    }

    if (!games || !Array.isArray(games) || games.length === 0) {
      return res.status(400).json({ error: 'At least one game must be selected' });
    }

    // Validate games
    const validGames = Object.keys(MOCK_CARD_DATA);
    const invalidGames = games.filter(game => !validGames.includes(game));
    if (invalidGames.length > 0) {
      return res.status(400).json({ error: `Invalid games: ${invalidGames.join(', ')}` });
    }

    const { db } = await getFirebaseServices();
    const listingsRef = collection(db, 'listings');
    
    const createdListings = [];
    
    for (let i = 0; i < count; i++) {
      // Randomly select a game from the provided games
      const selectedGame = getRandomElement(games);
      const gameCards = MOCK_CARD_DATA[selectedGame as keyof typeof MOCK_CARD_DATA];
      const selectedCard = getRandomElement(gameCards);
      
      // Generate mock listing
      const mockListing = generateMockListing(selectedGame, selectedCard);
      
      // Add to Firestore
      const docRef = await addDoc(listingsRef, mockListing);
      createdListings.push({
        id: docRef.id,
        ...mockListing
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully created ${count} mock listings`,
      listings: createdListings.map(listing => ({
        id: listing.id,
        title: listing.title,
        game: listing.game,
        price: listing.price,
        condition: listing.condition
      }))
    });

  } catch (error: any) {
    console.error('Error creating mock listings:', error);
    res.status(500).json({ 
      error: 'Failed to create mock listings',
      details: error.message 
    });
  }
}