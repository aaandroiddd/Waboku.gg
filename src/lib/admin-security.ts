import { NextApiRequest } from 'next';
import { User } from 'firebase/auth';
import { getFirebaseServices } from '@/lib/firebase';

// Types for admin security
export interface AdminSecurityConfig {
  requireMfa: boolean;
  allowedIPs: string[];
  sessionTimeout: number; // in minutes
  maxFailedAttempts: number;
  lockoutDuration: number; // in minutes
}

export interface AdminSession {
  userId?: string;
  isAdmin: boolean;
  isModerator: boolean;
  method: 'admin_secret' | 'user_auth' | 'ip_whitelist';
  mfaVerified: boolean;
  createdAt: number;
  lastActivity: number;
  ipAddress: string;
}

export interface BackupCode {
  code: string;
  used: boolean;
  usedAt?: number;
}

export interface AdminMfaData {
  enabled: boolean;
  backupCodes: BackupCode[];
  lastBackupGenerated: number;
}

// Default admin security configuration
export const DEFAULT_ADMIN_CONFIG: AdminSecurityConfig = {
  requireMfa: true,
  allowedIPs: [],
  sessionTimeout: 60, // 1 hour
  maxFailedAttempts: 5,
  lockoutDuration: 30, // 30 minutes
};

// Get client IP address from request
export function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const remoteAddress = req.socket.remoteAddress;
  
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  
  if (typeof realIP === 'string') {
    return realIP;
  }
  
  return remoteAddress || 'unknown';
}

// Check if IP is whitelisted
export function isIPWhitelisted(ip: string): boolean {
  const allowedIPs = process.env.ADMIN_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || [];
  
  if (allowedIPs.length === 0) {
    return false;
  }
  
  // Check for exact match
  if (allowedIPs.includes(ip)) {
    return true;
  }
  
  // Check for CIDR ranges (basic implementation)
  for (const allowedIP of allowedIPs) {
    if (allowedIP.includes('/')) {
      // This is a CIDR range - for now, we'll do a simple prefix match
      const [network, prefixLength] = allowedIP.split('/');
      const prefix = parseInt(prefixLength);
      
      if (prefix >= 24) {
        // For /24 and higher, check if the first 3 octets match
        const ipParts = ip.split('.');
        const networkParts = network.split('.');
        
        if (ipParts.slice(0, 3).join('.') === networkParts.slice(0, 3).join('.')) {
          return true;
        }
      }
    }
  }
  
  return false;
}

// Generate backup codes
export function generateBackupCodes(count: number = 10): BackupCode[] {
  const codes: BackupCode[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push({
      code,
      used: false
    });
  }
  
  return codes;
}

// Validate backup code format
export function isValidBackupCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code);
}

// Get admin MFA data from Firestore
export async function getAdminMfaData(userId: string): Promise<AdminMfaData | null> {
  try {
    const { db } = getFirebaseServices();
    const { doc, getDoc } = await import('firebase/firestore');
    
    const docRef = doc(db, 'adminMfa', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as AdminMfaData;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting admin MFA data:', error);
    return null;
  }
}

// Save admin MFA data to Firestore
export async function saveAdminMfaData(userId: string, data: AdminMfaData): Promise<void> {
  try {
    const { db } = getFirebaseServices();
    const { doc, setDoc } = await import('firebase/firestore');
    
    const docRef = doc(db, 'adminMfa', userId);
    await setDoc(docRef, data);
  } catch (error) {
    console.error('Error saving admin MFA data:', error);
    throw error;
  }
}

// Verify backup code
export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  try {
    const mfaData = await getAdminMfaData(userId);
    
    if (!mfaData || !mfaData.enabled) {
      return false;
    }
    
    // Find the backup code
    const backupCode = mfaData.backupCodes.find(bc => bc.code === code && !bc.used);
    
    if (!backupCode) {
      return false;
    }
    
    // Mark the code as used
    backupCode.used = true;
    backupCode.usedAt = Date.now();
    
    // Save the updated data
    await saveAdminMfaData(userId, mfaData);
    
    return true;
  } catch (error) {
    console.error('Error verifying backup code:', error);
    return false;
  }
}

// Check if user needs to regenerate backup codes (less than 3 unused codes)
export function needsBackupCodeRegeneration(mfaData: AdminMfaData): boolean {
  if (!mfaData.enabled) {
    return false;
  }
  
  const unusedCodes = mfaData.backupCodes.filter(code => !code.used);
  return unusedCodes.length < 3;
}

// Get admin session from localStorage (client-side)
export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const sessionData = localStorage.getItem('adminSession');
    if (!sessionData) {
      return null;
    }
    
    const session: AdminSession = JSON.parse(sessionData);
    
    // Check if session is expired
    const now = Date.now();
    const sessionAge = now - session.lastActivity;
    const maxAge = DEFAULT_ADMIN_CONFIG.sessionTimeout * 60 * 1000; // Convert to milliseconds
    
    if (sessionAge > maxAge) {
      localStorage.removeItem('adminSession');
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Error getting admin session:', error);
    localStorage.removeItem('adminSession');
    return null;
  }
}

// Save admin session to localStorage (client-side)
export function saveAdminSession(session: AdminSession): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    session.lastActivity = Date.now();
    localStorage.setItem('adminSession', JSON.stringify(session));
  } catch (error) {
    console.error('Error saving admin session:', error);
  }
}

// Clear admin session (client-side)
export function clearAdminSession(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.removeItem('adminSession');
  localStorage.removeItem('adminSecret');
}

// Update session activity (client-side)
export function updateSessionActivity(): void {
  const session = getAdminSession();
  if (session) {
    saveAdminSession(session);
  }
}

// Check if admin session is valid and not expired
export function isAdminSessionValid(): boolean {
  const session = getAdminSession();
  return session !== null;
}

// Get failed login attempts from localStorage
export function getFailedLoginAttempts(identifier: string): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  
  try {
    const attempts = localStorage.getItem(`adminFailedAttempts_${identifier}`);
    return attempts ? parseInt(attempts) : 0;
  } catch (error) {
    return 0;
  }
}

// Increment failed login attempts
export function incrementFailedLoginAttempts(identifier: string): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  
  try {
    const current = getFailedLoginAttempts(identifier);
    const newCount = current + 1;
    localStorage.setItem(`adminFailedAttempts_${identifier}`, newCount.toString());
    
    // Set lockout timestamp if max attempts reached
    if (newCount >= DEFAULT_ADMIN_CONFIG.maxFailedAttempts) {
      const lockoutUntil = Date.now() + (DEFAULT_ADMIN_CONFIG.lockoutDuration * 60 * 1000);
      localStorage.setItem(`adminLockout_${identifier}`, lockoutUntil.toString());
    }
    
    return newCount;
  } catch (error) {
    return 0;
  }
}

// Clear failed login attempts
export function clearFailedLoginAttempts(identifier: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.removeItem(`adminFailedAttempts_${identifier}`);
    localStorage.removeItem(`adminLockout_${identifier}`);
  } catch (error) {
    // Ignore errors
  }
}

// Check if user is locked out
export function isUserLockedOut(identifier: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    const lockoutUntil = localStorage.getItem(`adminLockout_${identifier}`);
    if (!lockoutUntil) {
      return false;
    }
    
    const lockoutTime = parseInt(lockoutUntil);
    const now = Date.now();
    
    if (now < lockoutTime) {
      return true;
    } else {
      // Lockout expired, clear it
      clearFailedLoginAttempts(identifier);
      return false;
    }
  } catch (error) {
    return false;
  }
}

// Get remaining lockout time in minutes
export function getRemainingLockoutTime(identifier: string): number {
  if (typeof window === 'undefined') {
    return 0;
  }
  
  try {
    const lockoutUntil = localStorage.getItem(`adminLockout_${identifier}`);
    if (!lockoutUntil) {
      return 0;
    }
    
    const lockoutTime = parseInt(lockoutUntil);
    const now = Date.now();
    const remaining = lockoutTime - now;
    
    return Math.max(0, Math.ceil(remaining / (60 * 1000))); // Convert to minutes
  } catch (error) {
    return 0;
  }
}