import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// Initialize Firestore using Firebase Admin
const { db } = getFirebaseAdmin();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin access
  const adminSecret = req.headers['x-admin-secret'] as string;
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    console.log('Unauthorized: Invalid admin secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get user ID and action from request body
  const { userId, action } = req.body;
  console.log(`Processing request: userId=${userId}, action=${action}`);

  if (!userId) {
    console.log('Bad request: User ID is required');
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (action !== 'add' && action !== 'remove') {
    console.log('Bad request: Invalid action', action);
    return res.status(400).json({ error: 'Invalid action. Must be "add" or "remove"' });
  }

  try {
    // Get reference to the user document
    const userRef = db.collection('users').doc(userId);
    
    // Check if user exists
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userSnap.data() || {};
    const currentRoles = userData.roles || [];
    console.log('Current user roles:', currentRoles);

    // Update the user's roles based on the action
    if (action === 'add') {
      // Handle different role formats
      if (Array.isArray(currentRoles)) {
        // Only add moderator role if it doesn't already exist in the array
        if (!currentRoles.includes('moderator')) {
          const newRoles = [...currentRoles, 'moderator'];
          console.log('Updating roles array to:', newRoles);
          
          // Add moderator role to the user while preserving existing roles
          await userRef.update({
            roles: newRoles,
            // Also set the isModerator flag for backward compatibility
            isModerator: true
          });
        } else {
          console.log('User already has moderator role in roles array');
        }
      } else if (typeof currentRoles === 'string') {
        // If roles is a string, convert it to an array
        if (currentRoles !== 'moderator') {
          const newRoles = [currentRoles, 'moderator'];
          console.log('Converting string role to array:', newRoles);
          
          await userRef.update({
            roles: newRoles,
            isModerator: true
          });
        } else {
          console.log('User already has moderator role as string');
        }
      } else {
        // If roles doesn't exist or is not in a recognized format, set it as an array
        console.log('Setting new roles array with moderator');
        await userRef.update({
          roles: ['moderator'],
          isModerator: true
        });
      }
      
      console.log('Moderator role assigned successfully');
      return res.status(200).json({ 
        success: true,
        message: 'Moderator role assigned successfully'
      });
    } else {
      // Remove moderator role
      if (Array.isArray(currentRoles) && currentRoles.includes('moderator')) {
        const newRoles = currentRoles.filter(role => role !== 'moderator');
        console.log('Updating roles to:', newRoles);
        
        // Update with new roles array (without moderator)
        await userRef.update({
          roles: newRoles,
          isModerator: false
        });
      } else if (typeof currentRoles === 'string' && currentRoles === 'moderator') {
        // If roles is just the string 'moderator', remove it
        console.log('Removing moderator string role');
        await userRef.update({
          roles: [],
          isModerator: false
        });
      } else {
        // Ensure isModerator is false even if roles didn't need updating
        await userRef.update({
          isModerator: false
        });
      }

      console.log('Moderator role removed successfully');
      return res.status(200).json({ 
        success: true,
        message: 'Moderator role removed successfully'
      });
    }
  } catch (error) {
    console.error(`Error ${action === 'add' ? 'assigning' : 'removing'} moderator role:`, error);
    return res.status(500).json({ error: `Failed to ${action === 'add' ? 'assign' : 'remove'} moderator role` });
  }
}