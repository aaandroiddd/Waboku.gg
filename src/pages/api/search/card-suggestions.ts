import { NextApiRequest, NextApiResponse } from 'next';

// This would be populated from your card APIs or a pre-built database
const POPULAR_CARDS = [
  // Pokemon
  'Charizard', 'Pikachu', 'Blastoise', 'Venusaur', 'Mewtwo', 'Mew', 'Lugia', 'Ho-Oh',
  'Rayquaza', 'Dialga', 'Palkia', 'Giratina', 'Arceus', 'Reshiram', 'Zekrom',
  
  // Magic: The Gathering
  'Black Lotus', 'Mox Ruby', 'Mox Sapphire', 'Mox Pearl', 'Mox Emerald', 'Mox Jet',
  'Lightning Bolt', 'Counterspell', 'Sol Ring', 'Demonic Tutor', 'Ancestral Recall',
  
  // Yu-Gi-Oh
  'Blue-Eyes White Dragon', 'Dark Magician', 'Red-Eyes Black Dragon', 'Exodia',
  'Mirror Force', 'Pot of Greed', 'Raigeki', 'Change of Heart',
  
  // One Piece
  'Monkey D. Luffy', 'Roronoa Zoro', 'Nami', 'Usopp', 'Sanji', 'Tony Tony Chopper',
  'Nico Robin', 'Franky', 'Brook', 'Jinbe', 'Portgas D. Ace', 'Sabo'
];

const CARD_SETS = [
  // Pokemon sets
  'Base Set', 'Jungle', 'Fossil', 'Team Rocket', 'Gym Heroes', 'Gym Challenge',
  'Neo Genesis', 'Neo Discovery', 'Neo Destiny', 'Neo Revelation',
  
  // MTG sets
  'Alpha', 'Beta', 'Unlimited', 'Revised', 'Fourth Edition', 'Chronicles',
  'Ice Age', 'Alliances', 'Coldsnap', 'Tempest', 'Stronghold', 'Exodus',
  
  // Yu-Gi-Oh sets
  'Legend of Blue Eyes White Dragon', 'Metal Raiders', 'Spell Ruler',
  'Pharaohs Servant', 'Labyrinth of Nightmare', 'Legacy of Darkness'
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { q, type = 'all' } = req.query;
  const query = (q as string)?.toLowerCase().trim();

  if (!query || query.length < 2) {
    return res.status(200).json([]);
  }

  try {
    let suggestions: string[] = [];

    // Search card names
    if (type === 'all' || type === 'cards') {
      const cardMatches = POPULAR_CARDS
        .filter(card => card.toLowerCase().includes(query))
        .slice(0, 5);
      suggestions.push(...cardMatches);
    }

    // Search set names
    if (type === 'all' || type === 'sets') {
      const setMatches = CARD_SETS
        .filter(set => set.toLowerCase().includes(query))
        .slice(0, 3);
      suggestions.push(...setMatches);
    }

    // Remove duplicates and limit results
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 8);

    res.status(200).json(uniqueSuggestions);
  } catch (error) {
    console.error('Error fetching card suggestions:', error);
    res.status(200).json([]);
  }
}