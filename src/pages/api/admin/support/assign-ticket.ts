import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

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
        const { auth, db } = getFirebaseAdmin();
        const decodedToken = await auth.verifyIdToken(token);
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
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
    const { db } = getFirebaseAdmin();
    const ticketRef = db.collection('supportTickets').doc(ticketId);
    const updateData: any = {
      updatedAt: new Date()
    };

    if (assignedTo && assignedToName) {
      updateData.assignedTo = assignedTo;
      updateData.assignedToName = assignedToName;
      updateData.assignedAt = new Date();
    } else {
      // Unassign ticket - use FieldValue.delete() to properly remove fields
      const { FieldValue } = require('firebase-admin/firestore');
      updateData.assignedTo = FieldValue.delete();
      updateData.assignedToName = FieldValue.delete();
      updateData.assignedAt = FieldValue.delete();
    }

    await ticketRef.update(updateData);

    // Verify the update was successful by reading the document back
    const updatedDoc = await ticketRef.get();
    const updatedData = updatedDoc.data();
    
    console.log('Ticket assignment update completed:', {
      ticketId,
      assignedTo: updatedData?.assignedTo,
      assignedToName: updatedData?.assignedToName,
      assignedAt: updatedData?.assignedAt,
      updatedAt: updatedData?.updatedAt
    });

    res.status(200).json({ 
      success: true, 
      message: assignedTo ? 'Ticket assigned successfully' : 'Ticket unassigned successfully',
      updatedTicket: {
        ticketId,
        assignedTo: updatedData?.assignedTo,
        assignedToName: updatedData?.assignedToName,
        assignedAt: updatedData?.assignedAt,
        updatedAt: updatedData?.updatedAt
      }
    });

  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
}