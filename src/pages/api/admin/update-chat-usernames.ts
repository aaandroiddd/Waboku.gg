import { NextApiRequest, NextApiResponse } from 'next';
import { updateChatsWithUsernames } from '@/lib/user-profile-sync';

/**
 * API endpoint to update chat participant names in the Realtime Database
 * This ensures chat UI can display user names without additional lookups
 * 
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret for security
  const { adminSecret } = req.body;
  if (adminSecret !== process.env.ADMIN_SECRET) {
    console.error('[API] Unauthorized attempt to update chat usernames');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[API] Starting chat participant names update');
    await updateChatsWithUsernames();
    console.log('[API] Chat participant names update completed successfully');
    return res.status(200).json({ success: true, message: 'Chat participant names updated successfully' });
  } catch (error) {
    console.error('[API] Error during chat participant names update:', error);
    return res.status(500).json({ 
      error: 'Failed to update chat participant names',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}