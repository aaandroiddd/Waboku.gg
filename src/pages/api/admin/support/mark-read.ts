import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

interface MarkReadData {
  ticketId: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ADMIN SUPPORT MARK READ API DEBUG START ===');
    
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

    // Check if user is admin
    if (!decodedToken.admin) {
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    // Validate request body
    const { ticketId }: MarkReadData = req.body;

    if (!ticketId?.trim()) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // Get the ticket to verify it exists
    const ticketDoc = await db.collection('supportTickets').doc(ticketId).get();
    
    if (!ticketDoc.exists) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticketData = ticketDoc.data();

    // Mark all user responses as read by support
    const responses = ticketData?.responses || [];
    const updatedResponses = responses.map((response: any) => ({
      ...response,
      readBySupport: response.isFromSupport ? (response.readBySupport || true) : true
    }));

    // Update the ticket
    await db.collection('supportTickets').doc(ticketId).update({
      responses: updatedResponses,
      updatedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Ticket marked as read by support'
    });

  } catch (error) {
    console.error('Error marking ticket as read by support:', error);
    res.status(500).json({ 
      error: 'Failed to mark ticket as read. Please try again.' 
    });
  }
}