import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { path } = req.body;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({ error: 'Path is required' });
    }

    console.log(`Deleting all posts from path: ${path}`);
    
    // Get Firebase Admin instance
    const { database } = getFirebaseAdmin();
    
    if (!database) {
      return res.status(500).json({ 
        error: 'Database not initialized'
      });
    }

    // Get reference to the path
    const ref = database.ref(path);
    const snapshot = await ref.once('value');
    
    if (!snapshot.exists()) {
      return res.status(404).json({ 
        error: 'No data found at specified path',
        path 
      });
    }

    const data = snapshot.val();
    let deletedCount = 0;

    if (typeof data === 'object' && data !== null) {
      deletedCount = Object.keys(data).length;
    }

    // Delete all data at this path
    await ref.remove();
    
    console.log(`Successfully deleted ${deletedCount} posts from path: ${path}`);

    return res.status(200).json({
      success: true,
      deletedCount,
      path,
      message: `Successfully deleted ${deletedCount} posts from ${path}`
    });

  } catch (error) {
    console.error('Error deleting from path:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}