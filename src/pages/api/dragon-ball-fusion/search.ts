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
    if (!apiKey) {
      throw new Error("API key is not configured");
    }

    const response = await fetch(
      `https://apitcg.com/api/dragon-ball-fusion/cards?property=name&value=${encodeURIComponent(query)}`,
      {
        headers: {
          "x-api-key": apiKey,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Dragon Ball Fusion API Error Response:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // The API already returns the correct structure with data array
    // We just need to ensure it matches our frontend expectations
    if (data && Array.isArray(data.data)) {
      res.status(200).json({
        data: data.data.map((card: any) => ({
          id: card.id,
          name: card.name,
          set: {
            name: card.set?.name || 'Dragon Ball Fusion'
          },
          number: card.number || '',
          identifier: card.id || `dbf-${card.name.toLowerCase().replace(/\s+/g, '-')}`,
          images: {
            small: card.images?.small || card.image_url || '',
            large: card.images?.large || card.image_url || ''
          }
        }))
      });
    } else {
      res.status(200).json({ data: [] });
    }
  } catch (error) {
    console.error("Dragon Ball Fusion API Error:", error);
    res.status(500).json({ error: "Failed to fetch Dragon Ball Fusion cards" });
  }
}