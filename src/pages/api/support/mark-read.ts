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
    // Initialize Firebase Admin
    const { db, auth } = getFirebaseAdmin();

    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    // Validate request body
    const { ticketId }: MarkReadData = req.body;

    if (!ticketId?.trim()) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // Get the ticket to verify ownership
    const ticketDoc = await db.collection('supportTickets').doc(ticketId).get();
    
    if (!ticketDoc.exists) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticketData = ticketDoc.data();
    
    if (ticketData?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied - Not your ticket' });
    }

    // Mark all support responses as read by user
    const responses = ticketData?.responses || [];
    const updatedResponses = responses.map((response: any) => ({
      ...response,
      readByUser: response.isFromSupport ? true : (response.readByUser || false)
    }));

    // Update the ticket
    await db.collection('supportTickets').doc(ticketId).update({
      responses: updatedResponses,
      updatedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Ticket marked as read'
    });

  } catch (error) {
    console.error('Error marking ticket as read:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ error: 'Invalid token. Please sign in again.' });
    }

    res.status(500).json({ 
      error: 'Failed to mark ticket as read. Please try again.' 
    });
  }
}