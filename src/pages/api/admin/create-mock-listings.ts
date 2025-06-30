import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// Mock TCG data for different games with reliable placeholder images
const MOCK_CARD_DATA = {
  pokemon: [
    {
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      rarity: "Holo Rare",
      imageUrl: "https://via.placeholder.com/300x420/FF6B35/FFFFFF?text=Charizard+Pokemon+TCG"
    },
    {
      name: "Pikachu",
      set: "Base Set",
      number: "58/102",
      rarity: "Common",
      imageUrl: "https://via.placeholder.com/300x420/FFD23F/000000?text=Pikachu+Pokemon+TCG"
    },
    {
      name: "Blastoise",
      set: "Base Set",
      number: "2/102",
      rarity: "Holo Rare",
      imageUrl: "https://via.placeholder.com/300x420/4A90E2/FFFFFF?text=Blastoise+Pokemon+TCG"
    },
    {
      name: "Venusaur",
      set: "Base Set",
      number: "15/102",
      rarity: "Holo Rare",
      imageUrl: "https://via.placeholder.com/300x420/7ED321/FFFFFF?text=Venusaur+Pokemon+TCG"
    },
    {
      name: "Alakazam",
      set: "Base Set",
      number: "1/102",
      rarity: "Holo Rare",
      imageUrl: "https://via.placeholder.com/300x420/9013FE/FFFFFF?text=Alakazam+Pokemon+TCG"
    }
  ],
  yugioh: [
    {
      name: "Blue-Eyes White Dragon",
      set: "Legend of Blue Eyes White Dragon",
      number: "LOB-001",
      rarity: "Ultra Rare",
      imageUrl: "https://via.placeholder.com/300x420/4A90E2/FFFFFF?text=Blue-Eyes+White+Dragon+Yu-Gi-Oh"
    },
    {
      name: "Dark Magician",
      set: "Legend of Blue Eyes White Dragon",
      number: "LOB-005",
      rarity: "Ultra Rare",
      imageUrl: "https://via.placeholder.com/300x420/9013FE/FFFFFF?text=Dark+Magician+Yu-Gi-Oh"
    },
    {
      name: "Red-Eyes Black Dragon",
      set: "Legend of Blue Eyes White Dragon",
      number: "LOB-070",
      rarity: "Ultra Rare",
      imageUrl: "https://via.placeholder.com/300x420/D0021B/FFFFFF?text=Red-Eyes+Black+Dragon+Yu-Gi-Oh"
    },
    {
      name: "Exodia the Forbidden One",
      set: "Legend of Blue Eyes White Dragon",
      number: "LOB-124",
      rarity: "Ultra Rare",
      imageUrl: "https://via.placeholder.com/300x420/F5A623/000000?text=Exodia+the+Forbidden+One+Yu-Gi-Oh"
    },
    {
      name: "Time Wizard",
      set: "Legend of Blue Eyes White Dragon",
      number: "LOB-065",
      rarity: "Rare",
      imageUrl: "https://via.placeholder.com/300x420/50E3C2/000000?text=Time+Wizard+Yu-Gi-Oh"
    }
  ],
  mtg: [
    {
      name: "Black Lotus",
      set: "Alpha",
      number: "1/295",
      rarity: "Rare",
      imageUrl: "https://via.placeholder.com/300x420/000000/FFFFFF?text=Black+Lotus+MTG"
    },
    {
      name: "Lightning Bolt",
      set: "Alpha",
      number: "161/295",
      rarity: "Common",
      imageUrl: "https://via.placeholder.com/300x420/D0021B/FFFFFF?text=Lightning+Bolt+MTG"
    },
    {
      name: "Ancestral Recall",
      set: "Alpha",
      number: "48/295",
      rarity: "Rare",
      imageUrl: "https://via.placeholder.com/300x420/4A90E2/FFFFFF?text=Ancestral+Recall+MTG"
    },
    {
      name: "Mox Pearl",
      set: "Alpha",
      number: "264/295",
      rarity: "Rare",
      imageUrl: "https://via.placeholder.com/300x420/F8F8F8/000000?text=Mox+Pearl+MTG"
    },
    {
      name: "Serra Angel",
      set: "Alpha",
      number: "36/295",
      rarity: "Uncommon",
      imageUrl: "https://via.placeholder.com/300x420/F5A623/000000?text=Serra+Angel+MTG"
    }
  ],
  onepiece: [
    {
      name: "Monkey D. Luffy",
      set: "Romance Dawn",
      number: "OP01-001",
      rarity: "Leader",
      imageUrl: "https://via.placeholder.com/300x420/D0021B/FFFFFF?text=Monkey+D.+Luffy+One+Piece"
    },
    {
      name: "Roronoa Zoro",
      set: "Romance Dawn",
      number: "OP01-025",
      rarity: "Rare",
      imageUrl: "https://via.placeholder.com/300x420/7ED321/FFFFFF?text=Roronoa+Zoro+One+Piece"
    },
    {
      name: "Nami",
      set: "Romance Dawn",
      number: "OP01-016",
      rarity: "Common",
      imageUrl: "https://via.placeholder.com/300x420/FF6B35/FFFFFF?text=Nami+One+Piece"
    },
    {
      name: "Sanji",
      set: "Romance Dawn",
      number: "OP01-013",
      rarity: "Uncommon",
      imageUrl: "https://via.placeholder.com/300x420/FFD23F/000000?text=Sanji+One+Piece"
    },
    {
      name: "Portgas D. Ace",
      set: "Romance Dawn",
      number: "OP01-003",
      rarity: "Super Rare",
      imageUrl: "https://via.placeholder.com/300x420/FF6B35/FFFFFF?text=Portgas+D.+Ace+One+Piece"
    }
  ],
  dbs: [
    {
      name: "Son Goku",
      set: "Galactic Battle",
      number: "BT1-001",
      rarity: "Super Rare",
      imageUrl: "https://via.placeholder.com/300x420/FF6B35/FFFFFF?text=Son+Goku+Dragon+Ball+Super"
    },
    {
      name: "Vegeta",
      set: "Galactic Battle",
      number: "BT1-020",
      rarity: "Super Rare",
      imageUrl: "https://via.placeholder.com/300x420/4A90E2/FFFFFF?text=Vegeta+Dragon+Ball+Super"
    },
    {
      name: "Frieza",
      set: "Galactic Battle",
      number: "BT1-044",
      rarity: "Super Rare",
      imageUrl: "https://via.placeholder.com/300x420/9013FE/FFFFFF?text=Frieza+Dragon+Ball+Super"
    },
    {
      name: "Cell",
      set: "Galactic Battle",
      number: "BT1-054",
      rarity: "Rare",
      imageUrl: "https://via.placeholder.com/300x420/7ED321/FFFFFF?text=Cell+Dragon+Ball+Super"
    },
    {
      name: "Gohan",
      set: "Galactic Battle",
      number: "BT1-005",
      rarity: "Uncommon",
      imageUrl: "https://via.placeholder.com/300x420/F5A623/000000?text=Gohan+Dragon+Ball+Super"
    }
  ],
  lorcana: [
    {
      name: "Mickey Mouse - Brave Little Tailor",
      set: "The First Chapter",
      number: "001/204",
      rarity: "Legendary",
      imageUrl: "https://via.placeholder.com/300x420/000000/FFFFFF?text=Mickey+Mouse+Disney+Lorcana"
    },
    {
      name: "Elsa - Snow Queen",
      set: "The First Chapter",
      number: "004/204",
      rarity: "Super Rare",
      imageUrl: "https://via.placeholder.com/300x420/50E3C2/000000?text=Elsa+Disney+Lorcana"
    },
    {
      name: "Belle - Hidden Depths",
      set: "The First Chapter",
      number: "017/204",
      rarity: "Rare",
      imageUrl: "https://via.placeholder.com/300x420/F5A623/000000?text=Belle+Disney+Lorcana"
    },
    {
      name: "Simba - Rightful Heir",
      set: "The First Chapter",
      number: "114/204",
      rarity: "Super Rare",
      imageUrl: "https://via.placeholder.com/300x420/FF6B35/FFFFFF?text=Simba+Disney+Lorcana"
    },
    {
      name: "Ariel - On Human Legs",
      set: "The First Chapter",
      number: "045/204",
      rarity: "Uncommon",
      imageUrl: "https://via.placeholder.com/300x420/D0021B/FFFFFF?text=Ariel+Disney+Lorcana"
    }
  ]
};

// Fallback images for each game type using reliable placeholder service
const FALLBACK_IMAGES = {
  pokemon: "https://via.placeholder.com/300x420/FFD23F/000000?text=Pokemon+TCG+Card",
  yugioh: "https://via.placeholder.com/300x420/4A90E2/FFFFFF?text=Yu-Gi-Oh+Card",
  mtg: "https://via.placeholder.com/300x420/000000/FFFFFF?text=Magic+The+Gathering+Card",
  onepiece: "https://via.placeholder.com/300x420/D0021B/FFFFFF?text=One+Piece+TCG+Card",
  dbs: "https://via.placeholder.com/300x420/FF6B35/FFFFFF?text=Dragon+Ball+Super+Card",
  lorcana: "https://via.placeholder.com/300x420/9013FE/FFFFFF?text=Disney+Lorcana+Card"
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
  
  // Use fallback image if primary image is not available
  const imageUrl = cardData.imageUrl || FALLBACK_IMAGES[game as keyof typeof FALLBACK_IMAGES];
  
  const listing = {
    title: `${cardData.name} - ${cardData.set} ${cardData.number} - ${condition}`,
    description: `Beautiful ${condition.toLowerCase()} condition ${cardData.name} from ${cardData.set}. ${cardData.rarity} card in excellent shape. Perfect for collectors or players!`,
    price,
    game,
    condition,
    imageUrls: [imageUrl],
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
    finalSale: isFinalSale,
    isMockListing: true, // Tag to identify mock listings
    mockGeneratedAt: new Date() // Timestamp for when this mock was created
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

    const { db } = getFirebaseAdmin();
    const listingsRef = db.collection('listings');
    
    const createdListings = [];
    
    for (let i = 0; i < count; i++) {
      // Randomly select a game from the provided games
      const selectedGame = getRandomElement(games);
      const gameCards = MOCK_CARD_DATA[selectedGame as keyof typeof MOCK_CARD_DATA];
      const selectedCard = getRandomElement(gameCards);
      
      // Generate mock listing
      const mockListing = generateMockListing(selectedGame, selectedCard);
      
      // Add to Firestore using Admin SDK
      const docRef = await listingsRef.add(mockListing);
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