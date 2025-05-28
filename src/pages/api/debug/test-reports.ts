import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Testing reports collection...');
    
    // Initialize Firebase Admin
    const { admin, db } = getFirebaseAdmin();
    if (!admin || !db) {
      throw new Error('Firebase Admin not initialized');
    }

    // Get all reports from the collection
    const reportsSnapshot = await db.collection('reports').get();
    
    console.log(`Found ${reportsSnapshot.size} reports in the collection`);
    
    const reports = [];
    reportsSnapshot.forEach(doc => {
      const data = doc.data();
      reports.push({
        id: doc.id,
        ...data,
        reportedAt: data.reportedAt ? data.reportedAt.toDate() : null,
        moderatedAt: data.moderatedAt ? data.moderatedAt.toDate() : null
      });
    });

    // Also check if the collection exists and has proper structure
    const collectionInfo = {
      exists: reportsSnapshot.size > 0,
      totalReports: reportsSnapshot.size,
      sampleReport: reports.length > 0 ? {
        id: reports[0].id,
        fields: Object.keys(reports[0])
      } : null
    };

    return res.status(200).json({
      success: true,
      collectionInfo,
      reports: reports.slice(0, 5), // Return first 5 reports for debugging
      message: `Found ${reports.length} reports in the collection`
    });

  } catch (error: any) {
    console.error('Error testing reports:', error);
    return res.status(500).json({
      error: 'Failed to test reports',
      details: error.message,
      stack: error.stack
    });
  }
}