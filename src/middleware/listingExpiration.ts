import { NextRequest, NextResponse } from 'next/server';
import { checkAndArchiveExpiredListing } from '@/lib/listing-expiration';

// Re-export the function from the library
export { checkAndArchiveExpiredListing };