import { getDatabase, ref, get, set, remove, onValue, DatabaseReference } from 'firebase/database';
import { database as firebaseDatabase, getFirebaseServices } from './firebase';

interface ConnectionTestResult {
  success: boolean;
  stage: string;
  error?: string;
  details?: any;
  timestamp: number;
}

interface ConnectionTestSummary {
  overallSuccess: boolean;
  tests: ConnectionTestResult[];
  environmentInfo: {
    browserInfo: string;
    networkType?: string;
    isOnline: boolean;
    timestamp: number;
  };
  configInfo: {
    databaseUrl?: string;
    apiKeyPresent: boolean;
    projectIdPresent: boolean;
  };
}

/**
 * Comprehensive Firebase Realtime Database connection tester
 * This utility performs a series of tests to diagnose connection issues
 */
export class FirebaseConnectionTester {
  private testResults: ConnectionTestResult[] = [];
  private testPath: string;
  private database: ReturnType<typeof getDatabase> | null = null;
  private testRef: DatabaseReference | null = null;
  private connectionRef: DatabaseReference | null = null;
  private connectionListener: (() => void) | null = null;
  
  constructor(testPath = 'connection_tests') {
    this.testPath = testPath;
  }
  
  /**
   * Run all connection tests in sequence
   */
  async runAllTests(): Promise<ConnectionTestSummary> {
    this.testResults = [];
    
    // Get environment info
    const environmentInfo = this.getEnvironmentInfo();
    
    // Get config info
    const configInfo = this.getConfigInfo();
    
    try {
      // Test 1: Initialize database
      await this.testDatabaseInitialization();
      
      // Test 2: Check connection status
      await this.testConnectionStatus();
      
      // Test 3: Test write operation
      await this.testWriteOperation();
      
      // Test 4: Test read operation
      await this.testReadOperation();
      
      // Test 5: Test delete operation
      await this.testDeleteOperation();
      
      // Test 6: Test real-time updates
      await this.testRealtimeUpdates();
      
      // Cleanup
      this.cleanup();
      
      // Determine overall success
      const overallSuccess = this.testResults.every(result => result.success);
      
      return {
        overallSuccess,
        tests: this.testResults,
        environmentInfo,
        configInfo
      };
    } catch (error) {
      // If any test throws an uncaught error, add it to results
      this.testResults.push({
        success: false,
        stage: 'Uncaught error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
      
      // Cleanup
      this.cleanup();
      
      return {
        overallSuccess: false,
        tests: this.testResults,
        environmentInfo,
        configInfo
      };
    }
  }
  
  /**
   * Get environment information for diagnostics
   */
  private getEnvironmentInfo() {
    if (typeof window === 'undefined') {
      return {
        browserInfo: 'Server-side environment',
        isOnline: true,
        timestamp: Date.now()
      };
    }
    
    // Get browser info
    const userAgent = window.navigator.userAgent;
    const browserInfo = userAgent;
    
    // Get network type if available
    let networkType: string | undefined = undefined;
    if ('connection' in navigator) {
      // @ts-ignore - Connection API might not be available in all browsers
      networkType = navigator.connection?.effectiveType;
    }
    
    return {
      browserInfo,
      networkType,
      isOnline: navigator.onLine,
      timestamp: Date.now()
    };
  }
  
  /**
   * Get Firebase configuration information
   */
  private getConfigInfo() {
    return {
      databaseUrl: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '') || undefined,
      apiKeyPresent: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      projectIdPresent: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    };
  }
  
  /**
   * Test 1: Initialize database
   */
  private async testDatabaseInitialization(): Promise<void> {
    try {
      console.log('[FirebaseConnectionTester] Testing database initialization...');
      
      // First try to use the imported database instance
      if (firebaseDatabase) {
        console.log('[FirebaseConnectionTester] Using pre-initialized Firebase Realtime Database');
        this.database = firebaseDatabase;
        this.testResults.push({
          success: true,
          stage: 'Database initialization',
          details: 'Used pre-initialized database instance',
          timestamp: Date.now()
        });
        return;
      }
      
      // Fallback to getting it from services
      try {
        const { database: dbFromServices } = getFirebaseServices();
        if (dbFromServices) {
          console.log('[FirebaseConnectionTester] Using Firebase Realtime Database from services');
          this.database = dbFromServices;
          this.testResults.push({
            success: true,
            stage: 'Database initialization',
            details: 'Used database from Firebase services',
            timestamp: Date.now()
          });
          return;
        }
      } catch (servicesError) {
        console.error('[FirebaseConnectionTester] Error getting database from services:', servicesError);
      }
      
      // Last resort: try to initialize directly
      try {
        console.log('[FirebaseConnectionTester] Attempting direct database initialization');
        this.database = getDatabase();
        if (this.database) {
          console.log('[FirebaseConnectionTester] Direct database initialization successful');
          this.testResults.push({
            success: true,
            stage: 'Database initialization',
            details: 'Used direct database initialization',
            timestamp: Date.now()
          });
          return;
        }
      } catch (directError) {
        console.error('[FirebaseConnectionTester] Direct database initialization failed:', directError);
        throw directError;
      }
      
      // If we get here, all initialization attempts failed
      throw new Error('All database initialization methods failed');
    } catch (error) {
      console.error('[FirebaseConnectionTester] Database initialization error:', error);
      this.testResults.push({
        success: false,
        stage: 'Database initialization',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
      throw error;
    }
  }
  
  /**
   * Test 2: Check connection status
   */
  private async testConnectionStatus(): Promise<void> {
    if (!this.database) {
      this.testResults.push({
        success: false,
        stage: 'Connection status check',
        error: 'Database not initialized',
        timestamp: Date.now()
      });
      return;
    }
    
    try {
      console.log('[FirebaseConnectionTester] Testing connection status...');
      this.connectionRef = ref(this.database, '.info/connected');
      
      // Use Promise to get connection status
      const connectionStatus = await new Promise<boolean>((resolve, reject) => {
        try {
          const timeout = setTimeout(() => {
            reject(new Error('Connection status check timed out after 5 seconds'));
          }, 5000);
          
          const unsubscribe = onValue(this.connectionRef!, (snapshot) => {
            clearTimeout(timeout);
            unsubscribe();
            resolve(!!snapshot.val());
          }, (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        } catch (error) {
          reject(error);
        }
      });
      
      this.testResults.push({
        success: true,
        stage: 'Connection status check',
        details: { connected: connectionStatus },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[FirebaseConnectionTester] Connection status check error:', error);
      this.testResults.push({
        success: false,
        stage: 'Connection status check',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Test 3: Test write operation
   */
  private async testWriteOperation(): Promise<void> {
    if (!this.database) {
      this.testResults.push({
        success: false,
        stage: 'Write operation',
        error: 'Database not initialized',
        timestamp: Date.now()
      });
      return;
    }
    
    try {
      console.log('[FirebaseConnectionTester] Testing write operation...');
      const testId = `test_${Date.now()}`;
      this.testRef = ref(this.database, `${this.testPath}/${testId}`);
      
      const testData = {
        timestamp: Date.now(),
        value: 'test_value',
        browser: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
      };
      
      await set(this.testRef, testData);
      
      this.testResults.push({
        success: true,
        stage: 'Write operation',
        details: { path: `${this.testPath}/${testId}` },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[FirebaseConnectionTester] Write operation error:', error);
      this.testResults.push({
        success: false,
        stage: 'Write operation',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Test 4: Test read operation
   */
  private async testReadOperation(): Promise<void> {
    if (!this.database || !this.testRef) {
      this.testResults.push({
        success: false,
        stage: 'Read operation',
        error: 'Database not initialized or test reference not created',
        timestamp: Date.now()
      });
      return;
    }
    
    try {
      console.log('[FirebaseConnectionTester] Testing read operation...');
      const snapshot = await get(this.testRef);
      
      if (snapshot.exists()) {
        this.testResults.push({
          success: true,
          stage: 'Read operation',
          details: { dataExists: true },
          timestamp: Date.now()
        });
      } else {
        this.testResults.push({
          success: false,
          stage: 'Read operation',
          error: 'Data does not exist at test reference',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('[FirebaseConnectionTester] Read operation error:', error);
      this.testResults.push({
        success: false,
        stage: 'Read operation',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Test 5: Test delete operation
   */
  private async testDeleteOperation(): Promise<void> {
    if (!this.database || !this.testRef) {
      this.testResults.push({
        success: false,
        stage: 'Delete operation',
        error: 'Database not initialized or test reference not created',
        timestamp: Date.now()
      });
      return;
    }
    
    try {
      console.log('[FirebaseConnectionTester] Testing delete operation...');
      await remove(this.testRef);
      
      // Verify deletion
      const snapshot = await get(this.testRef);
      
      if (!snapshot.exists()) {
        this.testResults.push({
          success: true,
          stage: 'Delete operation',
          timestamp: Date.now()
        });
      } else {
        this.testResults.push({
          success: false,
          stage: 'Delete operation',
          error: 'Data still exists after deletion',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('[FirebaseConnectionTester] Delete operation error:', error);
      this.testResults.push({
        success: false,
        stage: 'Delete operation',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Test 6: Test real-time updates
   */
  private async testRealtimeUpdates(): Promise<void> {
    if (!this.database) {
      this.testResults.push({
        success: false,
        stage: 'Realtime updates',
        error: 'Database not initialized',
        timestamp: Date.now()
      });
      return;
    }
    
    try {
      console.log('[FirebaseConnectionTester] Testing realtime updates...');
      const testId = `realtime_test_${Date.now()}`;
      const realtimeRef = ref(this.database, `${this.testPath}/${testId}`);
      
      // Use Promise to test realtime updates
      const realtimeUpdateReceived = await new Promise<boolean>((resolve, reject) => {
        try {
          const timeout = setTimeout(() => {
            reject(new Error('Realtime update test timed out after 5 seconds'));
          }, 5000);
          
          // Set up listener
          const unsubscribe = onValue(realtimeRef, (snapshot) => {
            if (snapshot.exists()) {
              clearTimeout(timeout);
              unsubscribe();
              
              // Clean up test data
              remove(realtimeRef).catch(error => {
                console.error('[FirebaseConnectionTester] Error cleaning up realtime test data:', error);
              });
              
              resolve(true);
            }
          }, (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          
          // Write data to trigger the listener
          set(realtimeRef, {
            timestamp: Date.now(),
            value: 'realtime_test_value'
          }).catch(error => {
            clearTimeout(timeout);
            reject(error);
          });
        } catch (error) {
          reject(error);
        }
      });
      
      this.testResults.push({
        success: true,
        stage: 'Realtime updates',
        details: { updateReceived: realtimeUpdateReceived },
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[FirebaseConnectionTester] Realtime updates error:', error);
      this.testResults.push({
        success: false,
        stage: 'Realtime updates',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Clean up test resources
   */
  private cleanup(): void {
    if (this.connectionListener) {
      this.connectionListener();
      this.connectionListener = null;
    }
    
    // Clean up test data
    if (this.database && this.testRef) {
      remove(this.testRef).catch(error => {
        console.error('[FirebaseConnectionTester] Error cleaning up test data:', error);
      });
    }
  }
}

// Singleton instance for easy access
let testerInstance: FirebaseConnectionTester | null = null;

export function getConnectionTester(): FirebaseConnectionTester {
  if (!testerInstance) {
    testerInstance = new FirebaseConnectionTester();
  }
  return testerInstance;
}