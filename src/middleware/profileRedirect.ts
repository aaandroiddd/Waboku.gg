// This middleware is no longer needed as we handle both ID and username in the same component
// We're keeping this file as a placeholder in case we need to implement additional middleware logic in the future

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // No redirects needed anymore
  return NextResponse.next();
}

export const config = {
  matcher: '/profile/:path*',
};