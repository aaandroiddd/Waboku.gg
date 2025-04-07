import { NextApiRequest, NextApiResponse } from 'next';
import { migrateUserProfiles } from '@/lib/user-profile-sync';

/**
 * API endpoint to migrate user profiles from Firestore to Realtime Database
 * This should be run once to populate the RTDB with existing user data
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
    console.error('[API] Unauthorized attempt to migrate user profiles');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[API] Starting user profile migration');
    await migrateUserProfiles();
    console.log('[API] User profile migration completed successfully');
    return res.status(200).json({ success: true, message: 'User profiles migrated successfully' });
  } catch (error) {
    console.error('[API] Error during user profile migration:', error);
    return res.status(500).json({ 
      error: 'Failed to migrate user profiles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}