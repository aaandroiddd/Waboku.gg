# Firebase Realtime Database Optimization Guide

This guide provides instructions on how to optimize Firebase Realtime Database usage to reduce quota issues and improve performance.

## Recent Issues

We've observed significant spikes in Realtime Database usage, exceeding the no-cost quota by approximately 4GB. This has resulted in additional charges and potential performance issues.

## Monitoring Tools

### Database Usage Monitor

A new admin page has been added at `/admin/database-usage` that provides:

- Real-time monitoring of database usage
- Identification of high-usage database paths
- Component-level analysis of database operations
- Connection status monitoring
- Optimization recommendations

## Common Causes of High Database Usage

1. **Unlimited Listeners**: Listeners without query constraints that download entire collections
2. **Missing Pagination**: Loading large datasets without pagination
3. **Listeners Not Detached**: Failing to detach listeners when components unmount
4. **Redundant Queries**: Multiple components querying the same data
5. **Deep Nesting**: Deeply nested data structures that require downloading entire trees
6. **Missing Indexes**: Large collections without proper indexing

## Optimization Strategies

### 1. Use Query Constraints

Always use query constraints like `limitToFirst()` or `limitToLast()` when querying large collections:

```javascript
// Before
const messagesRef = ref(database, '/messages');
onValue(messagesRef, (snapshot) => {
  // This downloads ALL messages
});

// After
const messagesRef = query(
  ref(database, '/messages'),
  orderByChild('timestamp'),
  limitToLast(50)
);
onValue(messagesRef, (snapshot) => {
  // This downloads only the last 50 messages
});
```

### 2. Implement Pagination

For large datasets, implement pagination to load data in chunks:

```javascript
// Use the getPaginatedData utility from database-query-optimizer.ts
const { items, hasMore, lastItem } = await getPaginatedData(
  '/listings/active',
  20,  // pageSize
  'createdAt'  // orderBy
);

// Load next page
if (hasMore && lastItem) {
  const nextPage = await getPaginatedData(
    '/listings/active',
    20,
    'createdAt',
    lastItem.createdAt
  );
}
```

### 3. Properly Detach Listeners

Always detach listeners when components unmount:

```javascript
useEffect(() => {
  const messagesRef = ref(database, '/messages');
  const unsubscribe = onValue(messagesRef, (snapshot) => {
    // Handle data
  });
  
  // Return cleanup function
  return () => {
    unsubscribe();
  };
}, []);
```

### 4. Use Optimized Components

We've created optimized versions of high-usage components:

- `OptimizedChat.tsx`: Replaces `Chat.tsx` with pagination and proper cleanup
- `OptimizedListingCard.tsx`: Replaces `ListingCard.tsx` with efficient data loading

### 5. Implement Caching

Use the `DatabaseCache` utility to cache frequently accessed data:

```javascript
import { databaseCache } from '@/lib/database-query-optimizer';

// Get data with caching
const userData = await databaseCache.getOrFetch(
  `/users/profiles/${userId}`,
  async () => {
    const snapshot = await get(ref(database, `/users/profiles/${userId}`));
    return snapshot.exists() ? snapshot.val() : null;
  }
);
```

### 6. Use Shallow Queries

For large objects where you only need the keys or a subset of data:

```javascript
// This downloads only the keys, not the values
const listingsRef = ref(database, '/listings');
get(listingsRef, { shallow: true })
  .then((snapshot) => {
    const keys = Object.keys(snapshot.val() || {});
    // Now you can fetch only the listings you need
  });
```

## High-Priority Components to Optimize

Based on our analysis, these components have the highest database usage:

1. `Chat.tsx` - Replace with `OptimizedChat.tsx`
2. `ListingCard.tsx` - Replace with `OptimizedListingCard.tsx`
3. `MessagesPageInitializer.tsx` - Implement pagination and caching
4. `FirebaseConnectionHandler.tsx` - Reduce connection status check frequency

## Monitoring Ongoing Usage

1. Regularly check the Database Usage Monitor at `/admin/database-usage`
2. Enable detailed logging during development to identify high-usage patterns
3. Use the Component Database Usage Analyzer to identify problematic components
4. Monitor connection status to detect potential issues

## Additional Resources

- [Firebase Documentation: Best Practices](https://firebase.google.com/docs/database/usage/optimize)
- [Firebase Documentation: Query Limitations](https://firebase.google.com/docs/database/usage/limits)
- [Firebase Documentation: Offline Capabilities](https://firebase.google.com/docs/database/web/offline-capabilities)

For any questions or assistance with implementing these optimizations, please contact the development team.