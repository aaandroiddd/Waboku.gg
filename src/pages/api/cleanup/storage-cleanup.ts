import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Verify the request is authorized using CRON_SECRET
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Unauthorized attempt to access storage cleanup');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const storage = admin.storage;
    const bucket = storage.bucket();

    // Calculate the date 60 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);

    console.log(`Starting cleanup of files older than ${cutoffDate.toISOString()}`);

    // Get all files in the listings directory
    const [files] = await bucket.getFiles({
      prefix: 'listings/',
    });

    let deletedCount = 0;
    const deletePromises = files.map(async (file) => {
      try {
        const [metadata] = await file.getMetadata();
        const createTime = new Date(metadata.timeCreated);

        if (createTime < cutoffDate) {
          await file.delete();
          console.log(`Deleted file: ${file.name}`);
          deletedCount++;
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    });

    await Promise.all(deletePromises);

    console.log(`Cleanup completed. Deleted ${deletedCount} files.`);
    return res.status(200).json({
      success: true,
      deletedFiles: deletedCount,
      message: `Successfully cleaned up ${deletedCount} files older than ${cutoffDate.toISOString()}`
    });

  } catch (error) {
    console.error('Error in storage cleanup:', error);
    return res.status(500).json({ error: 'Internal server error during cleanup' });
  }
}