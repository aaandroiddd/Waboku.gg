import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { query } = req.query;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_APITCG_API_KEY;
    const response = await fetch(
      `https://apitcg.com/api/one-piece/cards?property=name&value=${encodeURIComponent(query)}`,
      {
        headers: {
          "x-api-key": apiKey || "",
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the data to match our standard format
    const transformedData = data.data.map((card: any) => ({
      id: card.id,
      name: card.name,
      set: {
        name: card.set_name || card.setName || 'One Piece',
      },
      number: card.card_number || card.number || '',
      identifier: card.id || `op-${card.name.toLowerCase().replace(/\s+/g, '-')}`,
      images: {
        small: card.image_url || card.imageUrl || '',
        large: card.image_url || card.imageUrl || '',
      }
    }));

    res.status(200).json({ data: transformedData });
  } catch (error) {
    console.error("One Piece API Error:", error);
    res.status(500).json({ error: "Failed to fetch One Piece cards" });
  }
}