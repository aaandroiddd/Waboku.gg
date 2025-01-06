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
      `https://apitcg.com/api/dragon-ball-fusion/cards?property=name&value=${encodeURIComponent(query)}`,
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
    res.status(200).json(data);
  } catch (error) {
    console.error("Dragon Ball Fusion API Error:", error);
    res.status(500).json({ error: "Failed to fetch Dragon Ball Fusion cards" });
  }
}