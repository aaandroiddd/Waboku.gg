import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

interface UpdateStatusData {
  ticketId: string;
  status: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ADMIN SUPPORT UPDATE STATUS API DEBUG START ===');
    
    // Initialize Firebase Admin
    const { db, auth } = getFirebaseAdmin();

    // Check admin authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token and check admin status
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
      console.log('Token verified for admin user:', decodedToken.uid);
    } catch (tokenError: any) {
      console.error('Token verification failed:', tokenError.message);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Check if user is admin or moderator
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    const isAdmin = userData?.isAdmin === true;
    const isModerator = userData?.isModerator === true;
    const hasModeratorRole = Array.isArray(userData?.roles) && userData.roles.includes('moderator');
    
    if (!isAdmin && !isModerator && !hasModeratorRole) {
      console.error('User is not admin or moderator:', decodedToken.uid);
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    // Validate request body
    const { ticketId, status }: UpdateStatusData = req.body;

    if (!ticketId?.trim()) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    if (!status?.trim()) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Validate status
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get the ticket to verify it exists
    const ticketDoc = await db.collection('supportTickets').doc(ticketId).get();
    
    if (!ticketDoc.exists) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Update the ticket status
    await db.collection('supportTickets').doc(ticketId).update({
      status,
      updatedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Ticket status updated successfully'
    });

  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ 
      error: 'Failed to update ticket status. Please try again.' 
    });
  }
}