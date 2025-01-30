import { getAuth } from 'firebase/auth';

export async function checkAdminStatus() {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('Authentication required');
    }

    const token = await user.getIdToken();
    const response = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Admin access required');
    }

    return true;
  } catch (error: any) {
    console.error('Admin verification error:', error);
    throw error;
  }
}