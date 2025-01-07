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
    const apiKey = process.env.NEXT_PUBLIC_POKEMON_TCG_API_KEY;
    const response = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(query)}*`,
      {
        headers: {
          "X-Api-Key": apiKey || "",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Pokemon TCG API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the data to match our standard format
    const transformedData = data.data.map((card: any) => ({
      id: card.id,
      name: card.name,
      set: {
        name: card.set.name,
      },
      number: card.number,
      identifier: card.id,
      images: {
        small: card.images.small,
        large: card.images.large,
      }
    }));

    res.status(200).json({ data: transformedData });
  } catch (error) {
    console.error("Pokemon TCG API Error:", error);
    res.status(500).json({ error: "Failed to fetch Pokemon cards" });
  }
}