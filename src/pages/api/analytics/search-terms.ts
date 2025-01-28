import { database } from "@/lib/firebase-admin";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const ref = database.ref("searchTerms");
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

    // Get all search terms from the last 24 hours
    const snapshot = await ref
      .orderByChild("timestamp")
      .startAt(twentyFourHoursAgo)
      .get();

    if (!snapshot.exists()) {
      return res.status(200).json([]);
    }

    const searchData = snapshot.val();
    
    // Process the data to count occurrences
    const termCounts: { [key: string]: number } = {};
    Object.values(searchData).forEach((entry: any) => {
      const term = entry.term.toLowerCase();
      termCounts[term] = (termCounts[term] || 0) + 1;
    });

    // Convert to array and sort by count
    const sortedTerms = Object.entries(termCounts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.status(200).json(sortedTerms);
  } catch (error) {
    console.error("Error fetching search terms:", error);
    res.status(500).json({ error: "Failed to fetch search terms" });
  }
}