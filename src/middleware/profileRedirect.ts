import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';

// Initialize Firebase Admin
initAdmin();

export async function middleware(request: NextRequest) {
  // Check if this is a profile page with a UID format
  const pathname = request.nextUrl.pathname;
  
  // Only process /profile/[id] routes where [id] looks like a Firebase UID (alphanumeric, typically 28 chars)
  if (pathname.startsWith('/profile/') && pathname.split('/').length === 3) {
    const userId = pathname.split('/')[2];
    
    // Check if this looks like a Firebase UID (alphanumeric, typically 28 chars)
    // Firebase UIDs are typically 28 characters, but we'll be flexible
    if (userId.length > 20 && /^[a-zA-Z0-9]+$/.test(userId)) {
      try {
        // Get the user's username from Firestore
        const db = getFirestore();
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          const username = userData?.username;
          
          if (username) {
            // Redirect to the username-based profile URL
            const url = request.nextUrl.clone();
            url.pathname = `/profile/${username}`;
            return NextResponse.redirect(url);
          }
        }
      } catch (error) {
        console.error('Error in profile redirect middleware:', error);
        // Continue with the request if there's an error
      }
    }
  }
  
  // Continue with the request for all other cases
  return NextResponse.next();
}

// Only run this middleware on profile pages
export const config = {
  matcher: '/profile/:path*',
};