import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { path } = req.query;
    
    if (!path || !Array.isArray(path)) {
      return res.status(400).json({ error: 'Invalid path' });
    }

    // Reconstruct the path
    const imagePath = path.join('/');
    
    // Validate that this is a legitimate image path (basic security)
    if (!imagePath.includes('listings/') && !imagePath.includes('wanted/')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Log the path for debugging
    console.log('Image proxy request for path:', imagePath);

    // Try multiple encoding strategies for Firebase Storage URLs
    const encodingStrategies = [
      // Strategy 1: Standard encodeURIComponent
      () => encodeURIComponent(imagePath),
      
      // Strategy 2: Encode each path segment separately
      () => imagePath.split('/').map(segment => encodeURIComponent(segment)).join('%2F'),
      
      // Strategy 3: Double encoding for complex filenames
      () => encodeURIComponent(encodeURIComponent(imagePath)),
      
      // Strategy 4: Manual encoding of special characters
      () => imagePath
        .replace(/\+/g, '%2B')
        .replace(/=/g, '%3D')
        .replace(/\//g, '%2F')
        .replace(/\./g, '%2E')
        .replace(/-/g, '%2D'),
      
      // Strategy 5: Try the path as-is (sometimes Firebase accepts unencoded paths)
      () => imagePath
    ];

    let lastError = null;
    
    for (let i = 0; i < encodingStrategies.length; i++) {
      try {
        const encodedPath = encodingStrategies[i]();
        const firebaseStorageUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/${encodedPath}?alt=media`;
        
        console.log(`Strategy ${i + 1} - Trying URL:`, firebaseStorageUrl);

        const response = await fetch(firebaseStorageUrl);
        
        if (response.ok) {
          console.log(`Strategy ${i + 1} succeeded!`);
          
          // Get the content type from the response
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          
          // Set appropriate headers
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Access-Control-Allow-Origin', '*');
          
          // Stream the image data
          const imageBuffer = await response.arrayBuffer();
          return res.send(Buffer.from(imageBuffer));
        } else {
          console.log(`Strategy ${i + 1} failed with status:`, response.status, response.statusText);
          lastError = `Status ${response.status}: ${response.statusText}`;
        }
      } catch (error) {
        console.error(`Strategy ${i + 1} threw error:`, error);
        lastError = error.message;
      }
    }

    // If all strategies failed, return 404
    console.error('All encoding strategies failed. Last error:', lastError);
    return res.status(404).json({ 
      error: 'Image not found', 
      details: `Tried ${encodingStrategies.length} encoding strategies. Last error: ${lastError}`,
      path: imagePath
    });

  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}