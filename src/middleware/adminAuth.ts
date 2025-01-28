import { getDatabase, ref, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';

export async function checkAdminStatus() {
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('Authentication required');
    }

    const db = getDatabase();
    const userRef = ref(db, `users/${user.uid}`);
    const snapshot = await get(userRef);
    const userData = snapshot.val();

    if (!userData?.isAdmin) {
      throw new Error('Admin access required');
    }

    return true;
  } catch (error) {
    throw error;
  }
}