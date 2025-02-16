import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from './firebase-admin';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 searches per minute

export async function checkRateLimit(ip: string): Promise<boolean> {
  try {
    // Ensure Firebase Admin is initialized
    await getFirebaseAdmin();
    const database = getDatabase();
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    // Clean up old entries first
    const cleanupRef = database.ref(`rateLimits/${ip}`).orderByChild('timestamp').endAt(windowStart);
    await cleanupRef.once('value', async (snapshot) => {
      if (snapshot.exists()) {
        const updates = {};
        snapshot.forEach((child) => {
          updates[child.key] = null;
        });
        await database.ref(`rateLimits/${ip}`).update(updates);
      }
    });

    // Get current requests in window
    const snapshot = await database
      .ref(`rateLimits/${ip}`)
      .orderByChild('timestamp')
      .startAt(windowStart)
      .once('value');

    const requests = [];
    snapshot.forEach((childSnapshot) => {
      requests.push(childSnapshot.val());
      return false;
    });

    if (requests.length >= MAX_REQUESTS_PER_WINDOW) {
      console.warn(`Rate limit exceeded for IP: ${ip}`);
      return false;
    }

    // Add new request
    const newRequestRef = database.ref(`rateLimits/${ip}`).push();
    await newRequestRef.set({
      timestamp: now
    });

    return true;
  } catch (error) {
    console.error('Rate limit check error:', error);
    // In case of error, allow the request but log it
    return true;
  }
}