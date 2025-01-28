import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = 'PlXySPUa5QM0hc0jpWu2N3hECgm1';
  const adminSecret = process.env.ADMIN_SECRET;

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/set-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        adminSecret,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error setting admin status:', data.error);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error making request:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}