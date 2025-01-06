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

    const rawData = await response.json();
    
    // Transform the API response to match expected format
    const transformedData = {
      data: Array.isArray(rawData) ? rawData.map((card: any) => ({
        id: card.id || `dbf-${Math.random().toString(36).substr(2, 9)}`,
        name: card.name || "Unknown Card",
        images: {
          small: card.imageUrl || card.image || "",
        },
        set: {
          name: card.setName || card.set?.name || "Unknown Set"
        }
      })) : []
    };

    res.status(200).json(transformedData);
  } catch (error) {
    console.error("Dragon Ball Fusion API Error:", error);
    res.status(500).json({ error: "Failed to fetch Dragon Ball Fusion cards" });
  }
}