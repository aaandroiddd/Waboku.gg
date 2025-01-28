import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Make a POST request to the cleanup endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cleanup-inactive-listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error testing cleanup:', error);
    return res.status(500).json({ error: error.message });
  }
}