import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

type ResponseData = {
  success: boolean;
  message: string;
  path?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed', error: 'Only POST requests are allowed' });
  }

  try {
    // Initialize Firebase Admin if not already initialized
    const { database } = initializeFirebaseAdmin();
    
    // Extract data from request body
    const { postId, userId, updates } = req.body;
    
    // Validate required fields
    if (!postId || !userId || !updates) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        error: 'postId, userId, and updates are required'
      });
    }
    
    console.log(`API: Attempting to update wanted post with ID: ${postId} for user: ${userId}`);
    
    // Try all possible paths where the post might be stored
    const paths = [
      `wanted/posts/${postId}`,
      `wantedPosts/${postId}`,
      `wanted/${postId}`
    ];
    
    let postRef;
    let postData;
    let foundPath;
    
    // Check each path until we find the post
    for (const path of paths) {
      console.log(`API: Checking path: ${path}`);
      postRef = database.ref(path);
      const snapshot = await postRef.once('value');
      
      if (snapshot.exists()) {
        postData = snapshot.val();
        foundPath = path;
        console.log(`API: Found post at path: ${path}`);
        break;
      }
    }
    
    // If post not found in any path
    if (!postData) {
      console.error(`API: Post not found with ID: ${postId} in any path`);
      return res.status(404).json({
        success: false,
        message: 'Post not found',
        error: 'The wanted post could not be found in any database path'
      });
    }
    
    // Verify the user owns this post
    if (postData.userId !== userId) {
      console.error(`API: User ${userId} does not own post ${postId}`);
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
        error: 'You do not have permission to update this post'
      });
    }
    
    // Update the post
    console.log(`API: Updating post at path: ${foundPath}`);
    await postRef.update(updates);
    console.log('API: Post updated successfully');
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      path: foundPath
    });
    
  } catch (error) {
    console.error('API Error updating wanted post:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update wanted post',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}