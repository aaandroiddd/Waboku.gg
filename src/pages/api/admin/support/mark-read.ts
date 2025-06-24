import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = getFirestore();

interface MarkReadData {
  ticketId: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check admin authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify admin token
    if (token !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized - Invalid admin token' });
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