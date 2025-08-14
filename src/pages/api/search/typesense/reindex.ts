import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { 
  getTypesenseClient, 
  LISTINGS_COLLECTION_NAME, 
  listingsCollectionSchema,
  TypesenseListingDocument 
} from '@/lib/typesense';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic security check - require admin secret
  const adminSecret = req.headers.authorization?.replace('Bearer ', '');
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const typesenseClient = getTypesenseClient();
  if (!typesenseClient) {
    return res.status(500).json({ 
      error: 'Typesense not configured. Please set TYPESENSE_HOST and TYPESENSE_API_KEY_ADMIN environment variables.' 
    });
  }

  try {
    console.log('Starting Typesense reindex process...');

    // Step 1: Delete existing collection if it exists
    try {
      await typesenseClient.collections(LISTINGS_COLLECTION_NAME).delete();
      console.log('Deleted existing collection');
    } catch (error: any) {
      if (error.httpStatus !== 404) {
        console.error('Error deleting collection:', error);
      }
    }

    // Step 2: Create new collection
    await typesenseClient.collections().create(listingsCollectionSchema);
    console.log('Created new collection with schema');

    // Step 3: Fetch active listings from Firestore
    await getFirebaseAdmin();
    const db = getFirestore();
    const now = new Date();

    console.log('Fetching active listings from Firestore...');
    const listingsSnapshot = await db.collection('listings')
      .where('status', '==', 'active')
      .get();

    const documents: TypesenseListingDocument[] = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (const doc of listingsSnapshot.docs) {
      const data = doc.data();
      
      // Skip expired listings
      const expiresAtDate = data.expiresAt?.toDate ? data.expiresAt.toDate() : data.expiresAt;
      if (expiresAtDate && expiresAtDate <= now) {
        skippedCount++;
        continue;
      }

      // Convert Firestore document to Typesense document
      const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt || now;
      const expiresAtTimestamp = expiresAtDate ? Math.floor(expiresAtDate.getTime() / 1000) : Math.floor((now.getTime() + 30 * 24 * 60 * 60 * 1000) / 1000); // Default 30 days

      const typesenseDoc: TypesenseListingDocument = {
        id: doc.id,
        title: data.title || 'Untitled',
        cardName: data.cardName || '',
        description: data.description || '',
        game: data.game || 'Unknown',
        condition: data.condition || 'Not specified',
        price: Number(data.price) || 0,
        city: data.city || 'Unknown',
        state: data.state || 'Unknown',
        status: data.status || 'active',
        createdAt: Math.floor(createdAtDate.getTime() / 1000),
        expiresAt: expiresAtTimestamp,
        userId: data.userId || '',
        username: data.username || 'Unknown',
      };

      // Add image URL if available
      if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
        typesenseDoc.imageUrl = data.imageUrls[data.coverImageIndex || 0] || data.imageUrls[0];
      }

      documents.push(typesenseDoc);
      processedCount++;
    }

    console.log(`Processed ${processedCount} listings, skipped ${skippedCount} expired listings`);

    // Step 4: Bulk import documents to Typesense
    if (documents.length > 0) {
      console.log(`Importing ${documents.length} documents to Typesense...`);
      
      // Import in batches of 100
      const batchSize = 100;
      let importedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        try {
          const importResults = await typesenseClient
            .collections(LISTINGS_COLLECTION_NAME)
            .documents()
            .import(batch, { action: 'create' });

          // Count successful imports
          const results = importResults.split('\n').filter(line => line.trim());
          for (const result of results) {
            try {
              const parsed = JSON.parse(result);
              if (parsed.success) {
                importedCount++;
              } else {
                failedCount++;
                console.error('Import failed for document:', parsed);
              }
            } catch (parseError) {
              failedCount++;
              console.error('Failed to parse import result:', result);
            }
          }
        } catch (error) {
          console.error(`Batch import failed for batch starting at ${i}:`, error);
          failedCount += batch.length;
        }
      }

      console.log(`Import completed: ${importedCount} successful, ${failedCount} failed`);

      return res.status(200).json({
        success: true,
        message: 'Typesense reindex completed successfully',
        stats: {
          totalProcessed: processedCount,
          totalSkipped: skippedCount,
          totalImported: importedCount,
          totalFailed: failedCount,
        }
      });
    } else {
      return res.status(200).json({
        success: true,
        message: 'No active listings found to index',
        stats: {
          totalProcessed: 0,
          totalSkipped: skippedCount,
          totalImported: 0,
          totalFailed: 0,
        }
      });
    }

  } catch (error) {
    console.error('Typesense reindex failed:', error);
    return res.status(500).json({
      error: 'Reindex failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}