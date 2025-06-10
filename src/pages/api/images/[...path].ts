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

    // Construct the Firebase Storage URL
    const firebaseStorageUrl = `https://firebasestorage.googleapis.com/v0/b/${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(imagePath)}?alt=media`;

    // Fetch the image from Firebase Storage
    const response = await fetch(firebaseStorageUrl);
    
    if (!response.ok) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Get the content type from the original response
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Stream the image data
    const imageBuffer = await response.arrayBuffer();
    res.send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}