import { NextApiRequest, NextApiResponse } from 'next'

// Module cache to prevent repeated imports
const moduleCache = new Map();

async function getModule(modulePath: string) {
  if (moduleCache.has(modulePath)) {
    return moduleCache.get(modulePath);
  }
  
  try {
    const module = await import(modulePath);
    moduleCache.set(modulePath, module);
    return module;
  } catch (error) {
    console.error(`Failed to import module ${modulePath}:`, error);
    throw new Error(`Module ${modulePath} not available`);
  }
}

async function getFirebaseAdminInstance() {
  const { getFirebaseAdmin } = await getModule('@/lib/firebase-admin');
  return getFirebaseAdmin();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = authHeader.split('Bearer ')[1]
    
    // Dynamic import to handle module resolution
    const { admin, auth, database } = await getFirebaseAdminInstance()
    
    const decodedToken = await auth.verifyIdToken(token)
    const userId = decodedToken.uid

    const { blockedUserId } = req.body
    if (!blockedUserId) {
      return res.status(400).json({ error: 'Missing blockedUserId' })
    }

    if (userId === blockedUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' })
    }

    // Verify that the blocked user exists
    try {
      await auth.getUser(blockedUserId)
    } catch (error) {
      return res.status(400).json({ error: 'User not found' })
    }

    const db = database
    
    // Add to blocked users list with timestamp
    await db.ref(`users/${userId}/blockedUsers/${blockedUserId}`).set(Date.now())
    
    // Also add the reverse blocking to prevent the blocked user from messaging back
    await db.ref(`users/${blockedUserId}/blockedBy/${userId}`).set(Date.now())
    
    // Mark any existing chats as blocked for both users
    const chatsRef = db.ref('chats')
    const chatsSnapshot = await chatsRef.get()

    const updates: { [key: string]: any } = {}
    
    chatsSnapshot.forEach((chat) => {
      const chatData = chat.val()
      const participants = chatData.participants || {}
      if (participants[userId] && participants[blockedUserId]) {
        const chatId = chat.key as string
        updates[`${chatId}/blockedBy/${userId}`] = Date.now()
        updates[`${chatId}/blockedBy/${blockedUserId}`] = Date.now()
      }
    })

    if (Object.keys(updates).length > 0) {
      await chatsRef.update(updates)
    }

    console.log(`User ${userId} blocked user ${blockedUserId}`)
    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error blocking user:', error)
    return res.status(500).json({ error: 'Failed to block user' })
  }
}