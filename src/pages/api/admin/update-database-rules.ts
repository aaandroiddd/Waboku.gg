import { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { getApp } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

// Initialize Firebase Admin if not already initialized
try {
  getApp();
} catch {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Read database rules from file
    const rulesPath = path.join(process.cwd(), 'database.rules.json');
    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

    // Get database instance
    const database = admin.database();

    // Update database rules
    await database.setRules(rules);

    return res.status(200).json({ message: 'Database rules updated successfully' });
  } catch (error) {
    console.error('Error updating database rules:', error);
    return res.status(500).json({ error: 'Failed to update database rules' });
  }
}