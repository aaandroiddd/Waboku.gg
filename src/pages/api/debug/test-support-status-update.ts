import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ticketId, newStatus } = req.body;
    
    if (!ticketId || !newStatus) {
      return res.status(400).json({ error: 'ticketId and newStatus are required' });
    }

    console.log('=== DEBUG SUPPORT STATUS UPDATE TEST ===');
    console.log('Ticket ID:', ticketId);
    console.log('New Status:', newStatus);

    // Initialize Firebase Admin
    const { db } = getFirebaseAdmin();

    // First, get the current ticket data
    const ticketRef = db.collection('supportTickets').doc(ticketId);
    const ticketDoc = await ticketRef.get();
    
    if (!ticketDoc.exists) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const currentData = ticketDoc.data();
    console.log('Current ticket data:', {
      id: ticketId,
      currentStatus: currentData?.status,
      createdAt: currentData?.createdAt,
      updatedAt: currentData?.updatedAt
    });

    // Update the status
    const updateData = {
      status: newStatus,
      updatedAt: new Date(),
      lastModifiedAt: new Date(),
      debugUpdate: true
    };

    console.log('Updating with data:', updateData);
    
    await ticketRef.update(updateData);
    console.log('Update completed');

    // Verify the update
    const updatedDoc = await ticketRef.get();
    const updatedData = updatedDoc.data();
    
    console.log('Verified updated data:', {
      id: ticketId,
      newStatus: updatedData?.status,
      updatedAt: updatedData?.updatedAt,
      debugUpdate: updatedData?.debugUpdate
    });

    // Also try to fetch all tickets to see if the change is reflected
    const allTicketsSnapshot = await db.collection('supportTickets').get();
    const targetTicket = allTicketsSnapshot.docs.find(doc => doc.id === ticketId);
    
    if (targetTicket) {
      const targetData = targetTicket.data();
      console.log('Ticket found in collection query:', {
        id: ticketId,
        status: targetData?.status,
        updatedAt: targetData?.updatedAt
      });
    } else {
      console.log('Ticket NOT found in collection query');
    }

    res.status(200).json({
      success: true,
      message: 'Status update test completed',
      before: {
        status: currentData?.status,
        updatedAt: currentData?.updatedAt
      },
      after: {
        status: updatedData?.status,
        updatedAt: updatedData?.updatedAt,
        debugUpdate: updatedData?.debugUpdate
      },
      foundInCollection: !!targetTicket
    });

  } catch (error) {
    console.error('Error in status update test:', error);
    res.status(500).json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}