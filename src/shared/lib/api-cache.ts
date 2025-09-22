// API Cache Service for Football Data API
// Helps manage rate limits by caching frequently accessed data
// Enhanced for multiple simultaneous users

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class ApiCacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, PendingRequest<any>>();

  // Cache TTL constants (in milliseconds)
  private static readonly TTL = {
    STANDINGS: 5 * 60 * 1000,      // 5 minutes
    TEAM_DETAILS: 10 * 60 * 1000,  // 10 minutes
    TEAM_MATCHES: 2 * 60 * 1000,   // 2 minutes
    COMPETITIONS: 30 * 60 * 1000,  // 30 minutes
  };

  // Maximum pending request age (prevent stale pending requests)
  private static readonly MAX_PENDING_AGE = 30 * 1000; // 30 seconds

  set<T>(key: string, data: T, ttl: number = ApiCacheService.TTL.STANDINGS): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // Enhanced get method that handles concurrent requests
  async getOrFetch<T>(
    key: string, 
    fetchFn: () => Promise<T>, 
    ttl: number = ApiCacheService.TTL.STANDINGS
  ): Promise<T> {
    // Check cache first
    const cachedData = this.get<T>(key);
    if (cachedData) {
      // Cache hit - removed logging for security
      return cachedData;
    }

    // Check if there's already a pending request
    const pending = this.pendingRequests.get(key);
    if (pending) {
      const now = Date.now();
      if (now - pending.timestamp < ApiCacheService.MAX_PENDING_AGE) {
        // Waiting for pending request - removed logging for security
        return pending.promise;
      } else {
        // Remove stale pending request
        this.pendingRequests.delete(key);
      }
    }

    // Create new request
    // Cache miss - removed logging for security
    const promise = fetchFn().then(data => {
      // Cache the result
      this.set(key, data, ttl);
      // Remove from pending requests
      this.pendingRequests.delete(key);
      return data;
    }).catch(error => {
      // Remove from pending requests on error
      this.pendingRequests.delete(key);
      throw error;
    });

    // Store pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  // Clean up expired entries and stale pending requests
  cleanup(): void {
    const now = Date.now();
    
    // Clean expired cache entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }

    // Clean stale pending requests
    for (const [key, pending] of this.pendingRequests.entries()) {
      if (now - pending.timestamp > ApiCacheService.MAX_PENDING_AGE) {
        this.pendingRequests.delete(key);
      }
    }
  }

  // Specific cache keys
  static getKey = {
    standings: (season?: number) => `standings_${season || 2024}`,
    teamDetails: (teamId: number) => `team_details_${teamId}`,
    teamMatches: (teamId: number, season?: number) => `team_matches_${teamId}_${season || 2024}`,
    competition: (competitionId: string, season?: number) => `competition_${competitionId}_${season || 2024}`,
  };

  // Get cache statistics
  getStats(): { 
    cacheSize: number; 
    pendingRequests: number; 
    cacheKeys: string[];
    pendingKeys: string[];
  } {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheKeys: Array.from(this.cache.keys()),
      pendingKeys: Array.from(this.pendingRequests.keys())
    };
  }
}

// Export singleton instance
export const apiCache = new ApiCacheService();
export { ApiCacheService };

// Auto-cleanup every 5 minutes
setInterval(() => {
  apiCache.cleanup();
}, 5 * 60 * 1000);
