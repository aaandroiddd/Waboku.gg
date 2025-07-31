import { User } from 'firebase/auth';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface DashboardData {
  listings: any[];
  offers: any[];
  orders: any[];
  messages: any[];
  notifications: any[];
  wantedPosts: any[];
  reviews: any[];
  favorites: any[];
  lastUpdated: number;
}

export interface DashboardLoadingState {
  listings: boolean;
  offers: boolean;
  orders: boolean;
  messages: boolean;
  notifications: boolean;
  wantedPosts: boolean;
  reviews: boolean;
  favorites: boolean;
  overall: boolean;
}

class DashboardPreloader {
  private cache: Map<string, DashboardData> = new Map();
  private listeners: Map<string, Unsubscribe[]> = new Map();
  private loadingStates: Map<string, DashboardLoadingState> = new Map();
  private callbacks: Map<string, ((data: DashboardData, loading: DashboardLoadingState) => void)[]> = new Map();

  // Cache keys for localStorage
  private getCacheKey(userId: string, section: string): string {
    return `dashboard_${section}_${userId}`;
  }

  private getTimestampKey(userId: string): string {
    return `dashboard_timestamp_${userId}`;
  }

  // Load cached data from localStorage
  private loadFromCache(userId: string): Partial<DashboardData> {
    const cached: Partial<DashboardData> = {};
    const sections = ['listings', 'offers', 'orders', 'messages', 'notifications', 'wantedPosts', 'reviews', 'favorites'];
    
    for (const section of sections) {
      try {
        const data = localStorage.getItem(this.getCacheKey(userId, section));
        if (data) {
          cached[section as keyof DashboardData] = JSON.parse(data);
        }
      } catch (error) {
        console.warn(`Failed to load cached ${section}:`, error);
      }
    }

    return cached;
  }

  // Save data to localStorage cache
  private saveToCache(userId: string, section: string, data: any): void {
    try {
      localStorage.setItem(this.getCacheKey(userId, section), JSON.stringify(data));
      localStorage.setItem(this.getTimestampKey(userId), Date.now().toString());
    } catch (error) {
      console.warn(`Failed to cache ${section}:`, error);
    }
  }

  // Check if cache is fresh (less than 5 minutes old)
  private isCacheFresh(userId: string): boolean {
    try {
      const timestamp = localStorage.getItem(this.getTimestampKey(userId));
      if (!timestamp) return false;
      
      const cacheAge = Date.now() - parseInt(timestamp);
      return cacheAge < 5 * 60 * 1000; // 5 minutes
    } catch {
      return false;
    }
  }

  // Initialize loading state
  private initLoadingState(userId: string): DashboardLoadingState {
    const loadingState: DashboardLoadingState = {
      listings: true,
      offers: true,
      orders: true,
      messages: true,
      notifications: true,
      wantedPosts: true,
      reviews: true,
      favorites: true,
      overall: true
    };
    
    this.loadingStates.set(userId, loadingState);
    return loadingState;
  }

  // Update loading state for a section
  private updateLoadingState(userId: string, section: keyof DashboardLoadingState, isLoading: boolean): void {
    const currentState = this.loadingStates.get(userId);
    if (!currentState) return;

    currentState[section] = isLoading;
    
    // Update overall loading state - only false when ALL sections are done loading
    const sectionsLoading = ['listings', 'offers', 'orders', 'messages', 'notifications', 'wantedPosts', 'reviews', 'favorites'];
    currentState.overall = sectionsLoading.some(key => currentState[key as keyof DashboardLoadingState] === true);
    
    this.loadingStates.set(userId, currentState);
    
    // Only notify callbacks when overall loading state changes or when all sections are done
    if (!currentState.overall || section === 'overall') {
      this.notifyCallbacks(userId);
    }
  }

  // Notify all callbacks for a user
  private notifyCallbacks(userId: string): void {
    const callbacks = this.callbacks.get(userId) || [];
    const data = this.cache.get(userId);
    const loading = this.loadingStates.get(userId);
    
    if (data && loading) {
      callbacks.forEach(callback => callback(data, loading));
    }
  }

  // Load listings data
  private async loadListings(user: User): Promise<any[]> {
    try {
      // Fetch both active and archived listings separately to ensure we get all user's listings
      const activeListingsQuery = query(
        collection(db, 'listings'),
        where('userId', '==', user.uid),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(25)
      );
      
      const archivedListingsQuery = query(
        collection(db, 'listings'),
        where('userId', '==', user.uid),
        where('status', '==', 'archived'),
        orderBy('createdAt', 'desc'),
        limit(25)
      );
      
      // Execute both queries concurrently
      const [activeSnapshot, archivedSnapshot] = await Promise.all([
        getDocs(activeListingsQuery),
        getDocs(archivedListingsQuery)
      ]);
      
      const processListing = (doc: any) => {
        const data = doc.data();
        
        // Process timestamps properly
        let createdAt = new Date();
        let expiresAt = new Date();
        let archivedAt = null;
        let updatedAt = null;
        
        try {
          if (data.createdAt?.toDate) {
            createdAt = data.createdAt.toDate();
          } else if (data.createdAt) {
            createdAt = new Date(data.createdAt);
          }
          
          if (data.expiresAt?.toDate) {
            expiresAt = data.expiresAt.toDate();
          } else if (data.expiresAt) {
            expiresAt = new Date(data.expiresAt);
          }
          
          if (data.archivedAt?.toDate) {
            archivedAt = data.archivedAt.toDate();
          } else if (data.archivedAt) {
            archivedAt = new Date(data.archivedAt);
          }
          
          if (data.updatedAt?.toDate) {
            updatedAt = data.updatedAt.toDate();
          } else if (data.updatedAt) {
            updatedAt = new Date(data.updatedAt);
          }
        } catch (e) {
          console.error(`Error processing timestamps for listing ${doc.id}:`, e);
        }
        
        return {
          id: doc.id,
          ...data,
          createdAt,
          expiresAt,
          archivedAt,
          updatedAt,
          price: Number(data.price) || 0,
          imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
          isGraded: Boolean(data.isGraded),
          offersOnly: Boolean(data.offersOnly),
          gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
          status: data.status || 'active',
          condition: data.condition || 'Not specified',
          game: data.game || 'Not specified',
          city: data.city || 'Unknown',
          state: data.state || 'Unknown',
          gradingCompany: data.gradingCompany || undefined,
          distance: 0 // Default distance
        };
      };
      
      const activeListings = activeSnapshot.docs.map(processListing);
      const archivedListings = archivedSnapshot.docs.map(processListing);
      
      // Combine both arrays and sort by creation date
      const allListings = [...activeListings, ...archivedListings].sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      console.log(`Dashboard preloader loaded ${activeListings.length} active listings and ${archivedListings.length} archived listings`);
      
      this.saveToCache(user.uid, 'listings', allListings);
      return allListings;
    } catch (error) {
      console.error('Failed to load listings:', error);
      return [];
    }
  }

  // Load offers data
  private async loadOffers(user: User): Promise<any[]> {
    try {
      // Fetch both received offers (where user is seller) and sent offers (where user is buyer)
      // Remove orderBy to avoid index requirements, we'll sort in memory
      const receivedOffersQuery = query(
        collection(db, 'offers'),
        where('sellerId', '==', user.uid),
        limit(50)
      );
      
      const sentOffersQuery = query(
        collection(db, 'offers'),
        where('buyerId', '==', user.uid),
        limit(50)
      );
      
      // Execute both queries concurrently
      const [receivedSnapshot, sentSnapshot] = await Promise.all([
        getDocs(receivedOffersQuery),
        getDocs(sentOffersQuery)
      ]);
      
      const receivedOffers = receivedSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        expiresAt: doc.data().expiresAt?.toDate() || null,
        cleared: doc.data().cleared === true
      })).filter(offer => !offer.cleared);
      
      const sentOffers = sentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        expiresAt: doc.data().expiresAt?.toDate() || null,
        cleared: doc.data().cleared === true
      })).filter(offer => !offer.cleared);
      
      // Combine both arrays and sort by creation date
      const allOffers = [...receivedOffers, ...sentOffers].sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      console.log(`Dashboard preloader loaded ${receivedOffers.length} received offers and ${sentOffers.length} sent offers`);
      
      this.saveToCache(user.uid, 'offers', allOffers);
      return allOffers;
    } catch (error) {
      console.error('Failed to load offers:', error);
      return [];
    }
  }

  // Load orders data - fetch both purchases and sales
  private async loadOrders(user: User): Promise<any[]> {
    try {
      // Fetch both purchases (where user is buyer) and sales (where user is seller)
      // Remove orderBy to avoid index requirements, we'll sort in memory
      const purchasesQuery = query(
        collection(db, 'orders'),
        where('buyerId', '==', user.uid),
        limit(50)
      );
      
      const salesQuery = query(
        collection(db, 'orders'),
        where('sellerId', '==', user.uid),
        limit(50)
      );
      
      // Execute both queries concurrently
      const [purchasesSnapshot, salesSnapshot] = await Promise.all([
        getDocs(purchasesQuery),
        getDocs(salesQuery)
      ]);
      
      const purchases = purchasesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          _orderType: 'purchase' // Add type for easier filtering
        };
      });
      
      const sales = salesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          _orderType: 'sale' // Add type for easier filtering
        };
      });
      
      // Combine both arrays and sort by creation date
      const allOrders = [...purchases, ...sales].sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      console.log(`Dashboard preloader loaded ${purchases.length} purchases and ${sales.length} sales`);
      
      this.saveToCache(user.uid, 'orders', allOrders);
      return allOrders;
    } catch (error) {
      console.error('Failed to load orders:', error);
      return [];
    }
  }

  // Load messages data
  private async loadMessages(user: User): Promise<any[]> {
    try {
      const messagesQuery = query(
        collection(db, 'messageThreads'),
        where('participants', 'array-contains', user.uid),
        orderBy('lastMessageAt', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(messagesQuery);
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.saveToCache(user.uid, 'messages', messages);
      return messages;
    } catch (error) {
      console.error('Failed to load messages:', error);
      return [];
    }
  }

  // Load notifications data
  private async loadNotifications(user: User): Promise<any[]> {
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(notificationsQuery);
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.saveToCache(user.uid, 'notifications', notifications);
      return notifications;
    } catch (error) {
      console.error('Failed to load notifications:', error);
      return [];
    }
  }

  // Load wanted posts data
  private async loadWantedPosts(user: User): Promise<any[]> {
    try {
      const wantedQuery = query(
        collection(db, 'wantedPosts'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(wantedQuery);
      const wantedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.saveToCache(user.uid, 'wantedPosts', wantedPosts);
      return wantedPosts;
    } catch (error) {
      console.error('Failed to load wanted posts:', error);
      return [];
    }
  }

  // Load reviews data
  private async loadReviews(user: User): Promise<any[]> {
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('sellerId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(reviewsQuery);
      const reviews = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.saveToCache(user.uid, 'reviews', reviews);
      return reviews;
    } catch (error) {
      console.error('Failed to load reviews:', error);
      return [];
    }
  }

  // Load favorites data
  private async loadFavorites(user: User): Promise<any[]> {
    try {
      const favoritesQuery = query(
        collection(db, 'favorites'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(favoritesQuery);
      const favorites = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.saveToCache(user.uid, 'favorites', favorites);
      return favorites;
    } catch (error) {
      console.error('Failed to load favorites:', error);
      return [];
    }
  }

  // Set up real-time listeners
  private setupRealtimeListeners(user: User): void {
    const userId = user.uid;
    const listeners: Unsubscribe[] = [];

    // Listings listeners - both active and archived
    const activeListingsQuery = query(
      collection(db, 'listings'),
      where('userId', '==', userId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    
    const archivedListingsQuery = query(
      collection(db, 'listings'),
      where('userId', '==', userId),
      where('status', '==', 'archived'),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    
    // Function to update listings data from both listeners
    const updateListingsData = () => {
      Promise.all([
        getDocs(activeListingsQuery),
        getDocs(archivedListingsQuery)
      ]).then(([activeSnapshot, archivedSnapshot]) => {
        const processListing = (doc: any) => {
          const data = doc.data();
          
          // Process timestamps properly
          let createdAt = new Date();
          let expiresAt = new Date();
          let archivedAt = null;
          let updatedAt = null;
          
          try {
            if (data.createdAt?.toDate) {
              createdAt = data.createdAt.toDate();
            } else if (data.createdAt) {
              createdAt = new Date(data.createdAt);
            }
            
            if (data.expiresAt?.toDate) {
              expiresAt = data.expiresAt.toDate();
            } else if (data.expiresAt) {
              expiresAt = new Date(data.expiresAt);
            }
            
            if (data.archivedAt?.toDate) {
              archivedAt = data.archivedAt.toDate();
            } else if (data.archivedAt) {
              archivedAt = new Date(data.archivedAt);
            }
            
            if (data.updatedAt?.toDate) {
              updatedAt = data.updatedAt.toDate();
            } else if (data.updatedAt) {
              updatedAt = new Date(data.updatedAt);
            }
          } catch (e) {
            console.error(`Error processing timestamps for listing ${doc.id}:`, e);
          }
          
          return {
            id: doc.id,
            ...data,
            createdAt,
            expiresAt,
            archivedAt,
            updatedAt,
            price: Number(data.price) || 0,
            imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
            isGraded: Boolean(data.isGraded),
            offersOnly: Boolean(data.offersOnly),
            gradeLevel: data.gradeLevel ? Number(data.gradeLevel) : undefined,
            status: data.status || 'active',
            condition: data.condition || 'Not specified',
            game: data.game || 'Not specified',
            city: data.city || 'Unknown',
            state: data.state || 'Unknown',
            gradingCompany: data.gradingCompany || undefined,
            distance: 0 // Default distance
          };
        };
        
        const activeListings = activeSnapshot.docs.map(processListing);
        const archivedListings = archivedSnapshot.docs.map(processListing);
        
        // Combine both arrays and sort by creation date
        const allListings = [...activeListings, ...archivedListings].sort((a, b) => 
          b.createdAt.getTime() - a.createdAt.getTime()
        );
        
        const currentData = this.cache.get(userId);
        if (currentData) {
          currentData.listings = allListings;
          currentData.lastUpdated = Date.now();
          this.cache.set(userId, currentData);
          this.saveToCache(userId, 'listings', allListings);
          this.notifyCallbacks(userId);
        }
      }).catch(error => {
        console.error('Error updating listings data from listeners:', error);
      });
    };
    
    // Set up listeners for both active and archived listings
    listeners.push(onSnapshot(activeListingsQuery, updateListingsData));
    listeners.push(onSnapshot(archivedListingsQuery, updateListingsData));

    // Offers listeners - both received and sent
    // Remove orderBy to avoid index requirements
    const receivedOffersQuery = query(
      collection(db, 'offers'),
      where('sellerId', '==', userId),
      limit(50)
    );
    
    const sentOffersQuery = query(
      collection(db, 'offers'),
      where('buyerId', '==', userId),
      limit(50)
    );
    
    // Function to update offers data from both listeners
    const updateOffersData = () => {
      // We need to refetch both queries to get the complete picture
      Promise.all([
        getDocs(receivedOffersQuery),
        getDocs(sentOffersQuery)
      ]).then(([receivedSnapshot, sentSnapshot]) => {
        const receivedOffers = receivedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          expiresAt: doc.data().expiresAt?.toDate() || null,
          cleared: doc.data().cleared === true
        })).filter(offer => !offer.cleared);
        
        const sentOffers = sentSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          expiresAt: doc.data().expiresAt?.toDate() || null,
          cleared: doc.data().cleared === true
        })).filter(offer => !offer.cleared);
        
        // Combine both arrays and sort by creation date
        const allOffers = [...receivedOffers, ...sentOffers].sort((a, b) => 
          b.createdAt.getTime() - a.createdAt.getTime()
        );
        
        const currentData = this.cache.get(userId);
        if (currentData) {
          currentData.offers = allOffers;
          currentData.lastUpdated = Date.now();
          this.cache.set(userId, currentData);
          this.saveToCache(userId, 'offers', allOffers);
          this.notifyCallbacks(userId);
        }
      }).catch(error => {
        console.error('Error updating offers data from listeners:', error);
      });
    };
    
    // Set up listeners for both received and sent offers
    listeners.push(onSnapshot(receivedOffersQuery, updateOffersData));
    listeners.push(onSnapshot(sentOffersQuery, updateOffersData));

    // Orders listeners - both purchases and sales
    // Remove orderBy to avoid index requirements
    const purchasesQuery = query(
      collection(db, 'orders'),
      where('buyerId', '==', userId),
      limit(50)
    );
    
    const salesQuery = query(
      collection(db, 'orders'),
      where('sellerId', '==', userId),
      limit(50)
    );
    
    // Function to update orders data from both listeners
    const updateOrdersData = () => {
      Promise.all([
        getDocs(purchasesQuery),
        getDocs(salesQuery)
      ]).then(([purchasesSnapshot, salesSnapshot]) => {
        const purchases = purchasesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            _orderType: 'purchase'
          };
        });
        
        const sales = salesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            _orderType: 'sale'
          };
        });
        
        // Combine both arrays and sort by creation date
        const allOrders = [...purchases, ...sales].sort((a, b) => 
          b.createdAt.getTime() - a.createdAt.getTime()
        );
        
        const currentData = this.cache.get(userId);
        if (currentData) {
          currentData.orders = allOrders;
          currentData.lastUpdated = Date.now();
          this.cache.set(userId, currentData);
          this.saveToCache(userId, 'orders', allOrders);
          this.notifyCallbacks(userId);
        }
      }).catch(error => {
        console.error('Error updating orders data from listeners:', error);
      });
    };
    
    // Set up listeners for both purchases and sales
    listeners.push(onSnapshot(purchasesQuery, updateOrdersData));
    listeners.push(onSnapshot(salesQuery, updateOrdersData));

    // Store listeners for cleanup
    this.listeners.set(userId, listeners);
  }

  // Main preload function
  async preloadDashboard(user: User, forceRefresh: boolean = false): Promise<DashboardData> {
    const userId = user.uid;
    
    // Initialize loading state
    const loadingState = this.initLoadingState(userId);
    
    // Check if we have fresh cached data and not forcing refresh
    if (!forceRefresh && this.isCacheFresh(userId)) {
      const cachedData = this.loadFromCache(userId);
      if (Object.keys(cachedData).length > 0) {
        const dashboardData: DashboardData = {
          listings: cachedData.listings || [],
          offers: cachedData.offers || [],
          orders: cachedData.orders || [],
          messages: cachedData.messages || [],
          notifications: cachedData.notifications || [],
          wantedPosts: cachedData.wantedPosts || [],
          reviews: cachedData.reviews || [],
          favorites: cachedData.favorites || [],
          lastUpdated: Date.now()
        };
        
        this.cache.set(userId, dashboardData);
        
        // Set all loading states to false
        Object.keys(loadingState).forEach(key => {
          loadingState[key as keyof DashboardLoadingState] = false;
        });
        this.loadingStates.set(userId, loadingState);
        
        // Set up real-time listeners for updates
        this.setupRealtimeListeners(user);
        
        return dashboardData;
      }
    }

    // Load all data concurrently
    const dataPromises = [
      this.loadListings(user).then(data => {
        this.updateLoadingState(userId, 'listings', false);
        return { key: 'listings', data };
      }),
      this.loadOffers(user).then(data => {
        this.updateLoadingState(userId, 'offers', false);
        return { key: 'offers', data };
      }),
      this.loadOrders(user).then(data => {
        this.updateLoadingState(userId, 'orders', false);
        return { key: 'orders', data };
      }),
      this.loadMessages(user).then(data => {
        this.updateLoadingState(userId, 'messages', false);
        return { key: 'messages', data };
      }),
      this.loadNotifications(user).then(data => {
        this.updateLoadingState(userId, 'notifications', false);
        return { key: 'notifications', data };
      }),
      this.loadWantedPosts(user).then(data => {
        this.updateLoadingState(userId, 'wantedPosts', false);
        return { key: 'wantedPosts', data };
      }),
      this.loadReviews(user).then(data => {
        this.updateLoadingState(userId, 'reviews', false);
        return { key: 'reviews', data };
      }),
      this.loadFavorites(user).then(data => {
        this.updateLoadingState(userId, 'favorites', false);
        return { key: 'favorites', data };
      })
    ];

    // Wait for all data to load
    const results = await Promise.all(dataPromises);
    
    // Combine results into dashboard data
    const dashboardData: DashboardData = {
      listings: [],
      offers: [],
      orders: [],
      messages: [],
      notifications: [],
      wantedPosts: [],
      reviews: [],
      favorites: [],
      lastUpdated: Date.now()
    };

    results.forEach(result => {
      dashboardData[result.key as keyof DashboardData] = result.data;
    });

    // Cache the complete data
    this.cache.set(userId, dashboardData);
    
    // Update loading state
    this.updateLoadingState(userId, 'overall', false);
    
    // Set up real-time listeners
    this.setupRealtimeListeners(user);

    return dashboardData;
  }

  // Subscribe to dashboard updates
  subscribe(userId: string, callback: (data: DashboardData, loading: DashboardLoadingState) => void): () => void {
    const callbacks = this.callbacks.get(userId) || [];
    callbacks.push(callback);
    this.callbacks.set(userId, callbacks);

    // Return unsubscribe function
    return () => {
      const currentCallbacks = this.callbacks.get(userId) || [];
      const index = currentCallbacks.indexOf(callback);
      if (index > -1) {
        currentCallbacks.splice(index, 1);
        this.callbacks.set(userId, currentCallbacks);
      }
    };
  }

  // Get cached data
  getCachedData(userId: string): DashboardData | null {
    return this.cache.get(userId) || null;
  }

  // Get loading state
  getLoadingState(userId: string): DashboardLoadingState | null {
    return this.loadingStates.get(userId) || null;
  }

  // Clear cache for user
  clearCache(userId: string): void {
    this.cache.delete(userId);
    this.loadingStates.delete(userId);
    
    // Clear localStorage cache
    const sections = ['listings', 'offers', 'orders', 'messages', 'notifications', 'wantedPosts', 'reviews', 'favorites'];
    sections.forEach(section => {
      localStorage.removeItem(this.getCacheKey(userId, section));
    });
    localStorage.removeItem(this.getTimestampKey(userId));
    
    // Clean up listeners
    const listeners = this.listeners.get(userId);
    if (listeners) {
      listeners.forEach(unsubscribe => unsubscribe());
      this.listeners.delete(userId);
    }
    
    // Clear callbacks
    this.callbacks.delete(userId);
  }

  // Refresh specific section
  async refreshSection(user: User, section: keyof DashboardData): Promise<void> {
    const userId = user.uid;
    this.updateLoadingState(userId, section as keyof DashboardLoadingState, true);
    
    let data: any[] = [];
    
    switch (section) {
      case 'listings':
        data = await this.loadListings(user);
        break;
      case 'offers':
        data = await this.loadOffers(user);
        break;
      case 'orders':
        data = await this.loadOrders(user);
        break;
      case 'messages':
        data = await this.loadMessages(user);
        break;
      case 'notifications':
        data = await this.loadNotifications(user);
        break;
      case 'wantedPosts':
        data = await this.loadWantedPosts(user);
        break;
      case 'reviews':
        data = await this.loadReviews(user);
        break;
      case 'favorites':
        data = await this.loadFavorites(user);
        break;
    }
    
    const currentData = this.cache.get(userId);
    if (currentData) {
      currentData[section] = data;
      currentData.lastUpdated = Date.now();
      this.cache.set(userId, currentData);
    }
    
    this.updateLoadingState(userId, section as keyof DashboardLoadingState, false);
  }
}

// Export singleton instance
export const dashboardPreloader = new DashboardPreloader();