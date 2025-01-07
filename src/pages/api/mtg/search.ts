import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { query } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ message: 'Query parameter is required' });
  }

  try {
    const response = await fetch(
      `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Scryfall API');
    }

    const data = await response.json();

    // Transform the data to match our standard format
    const transformedData = data.data.map((card: any) => ({
      id: card.id,
      name: card.name,
      set: {
        name: card.set_name,
      },
      number: card.collector_number,
      identifier: card.id,
      images: {
        small: card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small,
        large: card.image_uris?.large || card.card_faces?.[0]?.image_uris?.large,
      }
    }));

    return res.status(200).json({ data: transformedData });
  } catch (error) {
    console.error('Error fetching from Scryfall:', error);
    return res.status(500).json({ message: 'Failed to fetch MTG cards' });
  }
}