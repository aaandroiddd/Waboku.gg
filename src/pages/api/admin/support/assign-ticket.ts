import { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ticketId, assignedTo, assignedToName } = req.body;

    if (!ticketId) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // Verify admin/moderator authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Check if it's admin secret
    if (token === process.env.ADMIN_SECRET) {
      // Admin secret access - proceed
    } else {
      // Verify Firebase ID token
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();
        
        if (!userData?.isAdmin && !userData?.isModerator) {
          return res.status(403).json({ error: 'Access denied - Admin or moderator privileges required' });
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    // Update the ticket with assignment information
    const ticketRef = adminDb.collection('supportTickets').doc(ticketId);
    const updateData: any = {
      updatedAt: new Date()
    };

    if (assignedTo && assignedToName) {
      updateData.assignedTo = assignedTo;
      updateData.assignedToName = assignedToName;
      updateData.assignedAt = new Date();
    } else {
      // Unassign ticket
      updateData.assignedTo = null;
      updateData.assignedToName = null;
      updateData.assignedAt = null;
    }

    await ticketRef.update(updateData);

    res.status(200).json({ 
      success: true, 
      message: assignedTo ? 'Ticket assigned successfully' : 'Ticket unassigned successfully' 
    });

  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
}