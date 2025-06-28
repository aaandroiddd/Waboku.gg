import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== SUPPORT TICKETS API DEBUG START ===');
    console.log('Request method:', req.method);
    console.log('Has authorization header:', !!req.headers.authorization);
    
    // Initialize Firebase Admin
    let db, auth;
    try {
      const firebaseAdmin = getFirebaseAdmin();
      db = firebaseAdmin.db;
      auth = firebaseAdmin.auth;
      console.log('Firebase Admin initialized successfully');
    } catch (initError: any) {
      console.error('Firebase Admin initialization failed:', initError.message);
      return res.status(500).json({ 
        error: 'Internal server error', 
        details: 'Firebase initialization failed: ' + initError.message 
      });
    }

    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No valid authorization header provided');
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('Token length:', token.length);
    
    // Verify the token
    let decodedToken;
    let userId;
    try {
      console.log('Verifying token...');
      decodedToken = await auth.verifyIdToken(token);
      userId = decodedToken.uid;
      console.log('Token verified successfully for user:', userId);
      console.log('Decoded token details:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        iss: decodedToken.iss,
        aud: decodedToken.aud,
        auth_time: decodedToken.auth_time,
        iat: decodedToken.iat,
        exp: decodedToken.exp
      });
    } catch (tokenError: any) {
      console.error('Token verification failed:', {
        error: tokenError.message,
        code: tokenError.code,
        stack: tokenError.stack
      });
      
      if (tokenError.code === 'auth/id-token-expired') {
        return res.status(401).json({ error: 'Token expired. Please sign in again.' });
      }
      
      if (tokenError.code === 'auth/invalid-id-token') {
        return res.status(401).json({ error: 'Invalid token. Please sign in again.' });
      }
      
      return res.status(500).json({ 
        error: 'Authentication failed', 
        details: tokenError.message 
      });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    // Get user's support tickets
    console.log('Attempting to fetch support tickets for user:', userId);
    let ticketsSnapshot;
    try {
      console.log('Querying supportTickets collection with userId filter and ordering...');
      ticketsSnapshot = await db
        .collection('supportTickets')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      console.log('Query successful, found', ticketsSnapshot.docs.length, 'tickets');
    } catch (firestoreError: any) {
      console.error('Firestore query error:', {
        message: firestoreError.message,
        code: firestoreError.code,
        details: firestoreError.details
      });
      
      // If ordering fails (missing index), try without ordering
      if (firestoreError.code === 9 || firestoreError.message?.includes('index')) {
        console.log('Retrying query without ordering due to missing index');
        try {
          ticketsSnapshot = await db
            .collection('supportTickets')
            .where('userId', '==', userId)
            .get();
          console.log('Retry successful, found', ticketsSnapshot.docs.length, 'tickets');
        } catch (retryError: any) {
          console.error('Retry query also failed:', retryError);
          throw retryError;
        }
      } else {
        throw firestoreError;
      }
    }

    console.log('Processing tickets data...');
    console.log('Current user ID:', userId);
    console.log('Found tickets for user:', ticketsSnapshot.docs.map(doc => ({
      id: doc.id,
      userId: doc.data().userId,
      userEmail: doc.data().userEmail,
      subject: doc.data().subject
    })));
    
    const tickets = ticketsSnapshot.docs.map((doc, index) => {
      try {
        const data = doc.data();
        console.log(`Processing ticket ${index + 1}:`, {
          id: doc.id,
          userId: data.userId,
          userEmail: data.userEmail,
          subject: data.subject,
          hasCreatedAt: !!data.createdAt,
          hasUpdatedAt: !!data.updatedAt,
          responsesCount: (data.responses || []).length
        });
        
        // Convert Firestore timestamps to Date objects
        const ticket = {
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastResponseAt: data.lastResponseAt?.toDate() || null,
          responses: (data.responses || []).map((response: any, responseIndex: number) => {
            try {
              return {
                ...response,
                createdAt: response.createdAt?.toDate() || new Date()
              };
            } catch (responseError) {
              console.error(`Error processing response ${responseIndex} for ticket ${doc.id}:`, responseError);
              return {
                ...response,
                createdAt: new Date()
              };
            }
          })
        };

        // Check if there are unread responses from support
        const hasUnreadResponses = ticket.responses.some((response: any) => 
          response.isFromSupport && !response.readByUser
        );

        return {
          ...ticket,
          hasUnreadResponses
        };
      } catch (ticketError) {
        console.error(`Error processing ticket ${doc.id}:`, ticketError);
        // Return a minimal ticket object to prevent complete failure
        return {
          ticketId: doc.id,
          error: 'Failed to process ticket data',
          createdAt: new Date(),
          updatedAt: new Date(),
          responses: [],
          hasUnreadResponses: false
        };
      }
    });

    console.log('Successfully processed', tickets.length, 'tickets');
    console.log('=== SUPPORT TICKETS API DEBUG END ===');

    res.status(200).json({
      success: true,
      tickets
    });

  } catch (error) {
    console.error('Error fetching support tickets:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ error: 'Invalid token. Please sign in again.' });
    }

    res.status(500).json({ 
      error: 'Failed to fetch support tickets. Please try again.' 
    });
  }
}