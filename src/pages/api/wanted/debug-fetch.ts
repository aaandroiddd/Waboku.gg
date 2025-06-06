import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('Starting debug fetch for wanted posts...');
    
    const { database } = getFirebaseAdmin();
    
    if (!database) {
      return res.status(500).json({ 
        error: 'Database not initialized',
        databaseExists: !!database
      });
    }

    const results: any = {
      paths: {},
      summary: {}
    };

    // Check all possible paths
    const pathsToCheck = [
      'wanted/posts',
      'wantedPosts', 
      'wanted'
    ];

    for (const path of pathsToCheck) {
      try {
        console.log(`Checking path: ${path}`);
        const snapshot = await database.ref(path).once('value');
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          const keys = Object.keys(data);
          
          results.paths[path] = {
            exists: true,
            count: keys.length,
            firstKey: keys[0] || null,
            samplePost: data[keys[0]] || null
          };
          
          console.log(`Path ${path}: Found ${keys.length} items`);
        } else {
          results.paths[path] = {
            exists: false,
            count: 0,
            firstKey: null,
            samplePost: null
          };
          
          console.log(`Path ${path}: No data found`);
        }
      } catch (pathError) {
        console.error(`Error checking path ${path}:`, pathError);
        results.paths[path] = {
          error: pathError instanceof Error ? pathError.message : 'Unknown error'
        };
      }
    }

    // Determine which path has the most posts
    let bestPath = null;
    let maxCount = 0;
    
    for (const [path, data] of Object.entries(results.paths)) {
      if ((data as any).exists && (data as any).count > maxCount) {
        maxCount = (data as any).count;
        bestPath = path;
      }
    }

    results.summary = {
      bestPath,
      maxCount,
      recommendation: bestPath ? `Use path: ${bestPath}` : 'No posts found in any path'
    };

    console.log('Debug fetch complete:', results.summary);
    
    return res.status(200).json(results);
  } catch (error) {
    console.error('Error in debug fetch:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}