import { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';
import { getApp } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

// Initialize Firebase Admin if not already initialized
let adminApp;
try {
  adminApp = getApp();
} catch {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  adminApp = admin.initializeApp({
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
  if (adminSecret !== process.env.ADMIN_SECRET && adminSecret !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    console.error('Unauthorized access attempt with secret:', adminSecret);
    return res.status(401).json({ error: 'Unauthorized - Invalid admin secret' });
  }

  try {
    console.log('Starting database rules update process');
    
    // Read database rules from file
    const rulesPath = path.join(process.cwd(), 'database.rules.json');
    console.log('Reading rules from path:', rulesPath);
    
    if (!fs.existsSync(rulesPath)) {
      console.error('Rules file not found at path:', rulesPath);
      return res.status(500).json({ error: 'Database rules file not found' });
    }
    
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    console.log('Rules file content length:', rulesContent.length);
    
    let rules;
    try {
      rules = JSON.parse(rulesContent);
      console.log('Rules parsed successfully');
    } catch (parseError) {
      console.error('Error parsing rules JSON:', parseError);
      return res.status(500).json({ error: 'Invalid database rules JSON format' });
    }

    // Get database instance
    const database = admin.database();
    if (!database) {
      console.error('Failed to get database instance');
      return res.status(500).json({ error: 'Failed to get database instance' });
    }

    // Update database rules
    console.log('Updating database rules...');
    await database.setRules(rules);
    console.log('Database rules updated successfully');

    return res.status(200).json({ message: 'Database rules updated successfully' });
  } catch (error) {
    console.error('Error updating database rules:', error);
    return res.status(500).json({ 
      error: 'Failed to update database rules', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}