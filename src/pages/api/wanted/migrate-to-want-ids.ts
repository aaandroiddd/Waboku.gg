import { NextApiRequest, NextApiResponse } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import { generateUniqueWantedPostId } from '@/lib/wanted-posts-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Starting wanted posts migration to WANT IDs...');
    
    // Get all wanted posts from the database
    const wantedPostsRef = adminDb.ref('wantedPosts');
    const snapshot = await wantedPostsRef.once('value');
    
    if (!snapshot.exists()) {
      return res.status(200).json({
        success: true,
        migrated: 0,
        errors: [],
        message: 'No wanted posts found to migrate'
      });
    }

    const posts = snapshot.val();
    const errors: string[] = [];
    let migrated = 0;
    let skipped = 0;

    console.log(`Found ${Object.keys(posts).length} posts to process`);

    // Process each post
    for (const [oldId, postData] of Object.entries(posts)) {
      try {
        // Skip if already using WANT format
        if (oldId.startsWith('WANT')) {
          console.log(`Skipping ${oldId} - already using WANT format`);
          skipped++;
          continue;
        }

        console.log(`Migrating post ${oldId}...`);

        // Generate new WANT ID
        const newId = await generateUniqueWantedPostId();
        console.log(`Generated new ID: ${newId} for old ID: ${oldId}`);

        // Create the post with the new ID
        const newPostRef = adminDb.ref(`wantedPosts/${newId}`);
        await newPostRef.set(postData);
        console.log(`Created post with new ID: ${newId}`);

        // Update any existing short ID mappings to point to the new ID
        try {
          const shortIdMappingsRef = adminDb.ref('wantedPostShortIds');
          const mappingsSnapshot = await shortIdMappingsRef.once('value');
          
          if (mappingsSnapshot.exists()) {
            const mappings = mappingsSnapshot.val();
            
            // Find mappings that point to the old ID and update them
            for (const [shortId, mappedId] of Object.entries(mappings)) {
              if (mappedId === oldId) {
                console.log(`Updating short ID mapping ${shortId}: ${oldId} -> ${newId}`);
                await shortIdMappingsRef.child(shortId).set(newId);
              }
            }
          }
        } catch (mappingError) {
          console.error(`Error updating short ID mappings for ${oldId}:`, mappingError);
          errors.push(`Failed to update short ID mappings for ${oldId}: ${mappingError instanceof Error ? mappingError.message : 'Unknown error'}`);
        }

        // Remove the old post
        const oldPostRef = adminDb.ref(`wantedPosts/${oldId}`);
        await oldPostRef.remove();
        console.log(`Removed old post: ${oldId}`);

        migrated++;
        console.log(`Successfully migrated ${oldId} -> ${newId}`);

      } catch (error) {
        console.error(`Error migrating post ${oldId}:`, error);
        errors.push(`Failed to migrate ${oldId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`Migration completed. Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors.length}`);

    return res.status(200).json({
      success: true,
      migrated,
      skipped,
      errors,
      message: `Migration completed. ${migrated} posts migrated, ${skipped} posts skipped (already using WANT format).`
    });

  } catch (error) {
    console.error('Error during wanted posts migration:', error);
    return res.status(500).json({
      success: false,
      migrated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      message: 'Migration failed'
    });
  }
}