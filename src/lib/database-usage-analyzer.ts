import { ref, query, limitToLast, orderByChild, get, DataSnapshot } from 'firebase/database';
import { database } from './firebase';

/**
 * Analyzes a database path for potential high usage patterns
 */
export const analyzeDatabasePath = async (path: string): Promise<{
  issues: string[];
  recommendations: string[];
  dataSize: number;
  childCount: number;
  hasIndexes: boolean;
}> => {
  try {
    // Get data at the specified path
    const snapshot = await get(ref(database, path));
    
    if (!snapshot.exists()) {
      return {
        issues: ['Path does not exist'],
        recommendations: ['Verify the path is correct'],
        dataSize: 0,
        childCount: 0,
        hasIndexes: false
      };
    }
    
    // Calculate data size
    const data = snapshot.val();
    const dataSize = JSON.stringify(data).length;
    
    // Count children
    const childCount = snapshot.hasChildren() ? Object.keys(data).length : 0;
    
    // Check for indexes (simplified)
    const hasIndexes = checkForIndexes(snapshot);
    
    // Identify issues and recommendations
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check data size
    if (dataSize > 1024 * 1024) { // > 1MB
      issues.push('Large data size (> 1MB)');
      recommendations.push('Consider pagination or breaking data into smaller chunks');
    }
    
    // Check child count
    if (childCount > 1000) {
      issues.push('Large number of children (> 1000)');
      recommendations.push('Use limitToFirst() or limitToLast() to limit data retrieval');
    }
    
    // Check for deep nesting
    if (hasDeepNesting(data)) {
      issues.push('Deep nesting detected');
      recommendations.push('Flatten data structure to improve query performance');
    }
    
    // Check for missing indexes
    if (!hasIndexes && childCount > 100) {
      issues.push('Missing indexes for large collection');
      recommendations.push('Add .indexOn rules in your database rules for frequently queried fields');
    }
    
    return {
      issues,
      recommendations,
      dataSize,
      childCount,
      hasIndexes
    };
  } catch (error) {
    console.error('Error analyzing database path:', error);
    return {
      issues: ['Error analyzing path'],
      recommendations: ['Check console for details'],
      dataSize: 0,
      childCount: 0,
      hasIndexes: false
    };
  }
};

/**
 * Check if data has deep nesting (more than 3 levels)
 */
const hasDeepNesting = (data: any, currentDepth = 0, maxDepth = 3): boolean => {
  if (currentDepth > maxDepth) return true;
  
  if (typeof data === 'object' && data !== null) {
    for (const key in data) {
      if (hasDeepNesting(data[key], currentDepth + 1, maxDepth)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Check if the data appears to have indexes
 * This is a simplified check - in a real implementation you would
 * need to check the actual database rules
 */
const checkForIndexes = (snapshot: DataSnapshot): boolean => {
  // This is a simplified implementation
  // In a real app, you would check the database rules
  return false;
};

/**
 * Identify potential high-usage patterns in the database
 */
export const identifyHighUsagePatterns = async (): Promise<{
  path: string;
  issue: string;
  recommendation: string;
}[]> => {
  const patterns: {
    path: string;
    issue: string;
    recommendation: string;
  }[] = [];
  
  // Check common paths that might cause high usage
  const pathsToCheck = [
    '/messages',
    '/users',
    '/listings',
    '/chat',
    '/notifications'
  ];
  
  for (const path of pathsToCheck) {
    try {
      const analysis = await analyzeDatabasePath(path);
      
      if (analysis.issues.length > 0) {
        patterns.push({
          path,
          issue: analysis.issues[0],
          recommendation: analysis.recommendations[0]
        });
      }
    } catch (error) {
      console.error(`Error checking path ${path}:`, error);
    }
  }
  
  return patterns;
};

/**
 * Get a list of recommended optimizations for the database
 */
export const getRecommendedOptimizations = async (): Promise<{
  path: string;
  currentUsage: string;
  optimizedUsage: string;
  potentialSavings: string;
  implementation: string;
}[]> => {
  // This would be based on actual usage patterns in a real implementation
  // For now, we'll return some example recommendations
  
  return [
    {
      path: '/messages',
      currentUsage: 'Unlimited listener without pagination',
      optimizedUsage: 'Paginated queries with limitToLast(50)',
      potentialSavings: '~80% reduction in data transfer',
      implementation: 'Replace onValue(ref(db, "/messages")) with onValue(query(ref(db, "/messages"), limitToLast(50)))'
    },
    {
      path: '/users/online',
      currentUsage: 'Full document listeners',
      optimizedUsage: 'Shallow listeners',
      potentialSavings: '~60% reduction in data transfer',
      implementation: 'Use {shallow: true} option in database queries'
    },
    {
      path: '/listings/active',
      currentUsage: 'Multiple redundant listeners',
      optimizedUsage: 'Consolidated listeners with state management',
      potentialSavings: '~50% reduction in connection overhead',
      implementation: 'Use a central service to manage listeners and share data through state management'
    }
  ];
};