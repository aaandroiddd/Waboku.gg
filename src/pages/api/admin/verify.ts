import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header');
    }

    const token = authHeader.split('Bearer ')[1];
    const admin = getFirebaseAdmin();
    const decodedToken = await admin.auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const snapshot = await admin.rtdb.ref(`users/${uid}`).get();
    const userData = snapshot.val();

    if (!userData?.isAdmin) {
      throw new Error('Admin access required');
    }

    return res.status(200).json({ isAdmin: true });
  } catch (error: any) {
    console.error('Admin verification error:', error);
    return res.status(403).json({ error: error.message || 'Admin access required' });
  }
}