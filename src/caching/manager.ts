/**
 * Cache Manager
 *
 * Orchestrates caching between Redis and memory cache with fallback strategies
 */

import { RedisCache, RedisCacheConfig } from './redis';
import { MemoryCache, MemoryCacheConfig } from './memory';

export interface CacheManagerConfig {
  provider?: 'redis' | 'memory' | 'auto';
  redis?: RedisCacheConfig;
  memory?: MemoryCacheConfig;
  fallbackToMemory?: boolean;
}

export class CacheManager {
  private static instance: CacheManager;
  private config: CacheManagerConfig & { provider: 'redis' | 'memory' | 'auto'; fallbackToMemory: boolean };
  private redisCache?: RedisCache;
  private memoryCache?: MemoryCache;
  private primaryCache: 'redis' | 'memory' = 'memory';

  private constructor(config: CacheManagerConfig = {}) {
    this.config = {
      provider: config.provider || 'auto',
      ...(config.redis && { redis: config.redis }),
      ...(config.memory && { memory: config.memory }),
      fallbackToMemory: config.fallbackToMemory !== false,
    };

    this.initializeCaches();
  }

  public static getInstance(config?: CacheManagerConfig): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  private initializeCaches(): void {
    // Initialize Redis cache
    if (this.config.provider === 'redis' || this.config.provider === 'auto') {
      try {
        this.redisCache = RedisCache.getInstance(this.config.redis);
        this.primaryCache = 'redis';
      } catch (error) {
        console.warn('Failed to initialize Redis cache:', error);
        if (!this.config.fallbackToMemory) {
          throw error;
        }
      }
    }

    // Initialize memory cache (as fallback or primary)
    if (!this.redisCache || this.config.provider === 'memory') {
      this.memoryCache = MemoryCache.getInstance(this.config.memory);
      this.primaryCache = 'memory';
    } else if (this.config.fallbackToMemory) {
      this.memoryCache = MemoryCache.getInstance(this.config.memory);
    }
  }

  /**
   * Get a value from cache
   */
  public async get<T = any>(key: string): Promise<T | null> {
    // Try primary cache first
    if (this.primaryCache === 'redis' && this.redisCache) {
      const value = await this.redisCache.get<T>(key);
      if (value !== null) return value;
    }

    // Try memory cache as fallback
    if (this.memoryCache) {
      const value = await this.memoryCache.get<T>(key);
      if (value !== null) return value;
    }

    return null;
  }

  /**
   * Set a value in cache
   */
  public async set<T = any>(
    key: string,
    value: T,
    ttl?: number,
    tags?: string[]
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // Set in primary cache
    if (this.primaryCache === 'redis' && this.redisCache) {
      promises.push(this.redisCache.set(key, value, ttl, tags));
    }

    // Set in memory cache if available
    if (this.memoryCache) {
      promises.push(this.memoryCache.set(key, value, ttl, tags));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Delete a value from cache
   */
  public async delete(key: string): Promise<boolean> {
    const promises: Promise<boolean>[] = [];

    if (this.redisCache) {
      promises.push(this.redisCache.delete(key));
    }

    if (this.memoryCache) {
      promises.push(this.memoryCache.delete(key));
    }

    const results = await Promise.allSettled(promises);
    return results.some(result => result.status === 'fulfilled' && result.value);
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    if (this.primaryCache === 'redis' && this.redisCache) {
      const exists = await this.redisCache.exists(key);
      if (exists) return true;
    }

    if (this.memoryCache) {
      return await this.memoryCache.exists(key);
    }

    return false;
  }

  /**
   * Get time to live for a key
   */
  public async ttl(key: string): Promise<number> {
    if (this.primaryCache === 'redis' && this.redisCache) {
      const ttl = await this.redisCache.ttl(key);
      if (ttl > 0) return ttl;
    }

    if (this.memoryCache) {
      return await this.memoryCache.ttl(key);
    }

    return -1;
  }

  /**
   * Extend TTL for a key
   */
  public async expire(key: string, ttl: number): Promise<boolean> {
    const promises: Promise<boolean>[] = [];

    if (this.redisCache) {
      promises.push(this.redisCache.expire(key, ttl));
    }

    if (this.memoryCache) {
      promises.push(this.memoryCache.expire(key, ttl));
    }

    const results = await Promise.allSettled(promises);
    return results.some(result => result.status === 'fulfilled' && result.value);
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    let totalDeleted = 0;

    if (this.redisCache) {
      const deleted = await this.redisCache.invalidateByTags(tags);
      totalDeleted += deleted;
    }

    if (this.memoryCache) {
      const deleted = await this.memoryCache.invalidateByTags(tags);
      totalDeleted += deleted;
    }

    return totalDeleted;
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.redisCache) {
      promises.push(this.redisCache.clear());
    }

    if (this.memoryCache) {
      promises.push(this.memoryCache.clear());
    }

    await Promise.allSettled(promises);
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    provider: string;
    primaryCache: string;
    redis?: any;
    memory?: any;
  }> {
    const stats = {
      provider: this.config.provider,
      primaryCache: this.primaryCache,
    };

    if (this.redisCache) {
      (stats as any).redis = await this.redisCache.getStats();
    }

    if (this.memoryCache) {
      (stats as any).memory = await this.memoryCache.getStats();
    }

    return stats;
  }

  /**
   * Get multiple values at once
   */
  public async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (this.primaryCache === 'redis' && this.redisCache) {
      return await this.redisCache.mget<T>(keys);
    }

    if (this.memoryCache) {
      return await this.memoryCache.mget<T>(keys);
    }

    return new Array(keys.length).fill(null);
  }

  /**
   * Set multiple values at once
   */
  public async mset(entries: Array<{ key: string; value: any; ttl?: number; tags?: string[] }>): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.redisCache) {
      promises.push(this.redisCache.mset(entries));
    }

    if (this.memoryCache) {
      promises.push(this.memoryCache.mset(entries));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Warm up cache with initial data
   */
  public async warmup(entries: Array<{ key: string; value: any; ttl?: number; tags?: string[] }>): Promise<void> {
    console.log(`Warming up cache with ${entries.length} entries...`);
    await this.mset(entries);
    console.log('Cache warmup completed');
  }

  /**
   * Health check for cache
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    message: string;
    details: Record<string, any>;
  }> {
    const details: Record<string, any> = {};

    let healthy = false;
    let message = 'Cache unavailable';

    if (this.redisCache) {
      try {
        const redisStats = await this.redisCache.getStats();
        details.redis = redisStats;

        if (redisStats.connected) {
          healthy = true;
          message = 'Redis cache healthy';
        } else if (this.memoryCache) {
          const memoryStats = await this.memoryCache.getStats();
          details.memory = memoryStats;
          healthy = true;
          message = 'Memory cache fallback healthy';
        }
      } catch (error: any) {
        details.redis_error = error.message;
      }
    }

    if (!healthy && this.memoryCache) {
      try {
        const memoryStats = await this.memoryCache.getStats();
        details.memory = memoryStats;
        healthy = true;
        message = 'Memory cache healthy';
      } catch (error: any) {
        details.memory_error = error.message;
      }
    }

    return {
      healthy,
      message,
      details,
    };
  }

  /**
   * Switch primary cache provider
   */
  public async switchProvider(provider: 'redis' | 'memory'): Promise<boolean> {
    if (provider === 'redis' && !this.redisCache) {
      try {
        this.redisCache = RedisCache.getInstance(this.config.redis);
        this.primaryCache = 'redis';
        return true;
      } catch (error) {
        console.error('Failed to switch to Redis:', error);
        return false;
      }
    }

    if (provider === 'memory' && this.memoryCache) {
      this.primaryCache = 'memory';
      return true;
    }

    return false;
  }

  /**
   * Get current cache provider info
   */
  public getProviderInfo(): {
    primary: string;
    available: string[];
    config: CacheManagerConfig;
  } {
    const available = [];
    if (this.redisCache) available.push('redis');
    if (this.memoryCache) available.push('memory');

    return {
      primary: this.primaryCache,
      available,
      config: this.config,
    };
  }

  /**
   * Force cleanup of expired entries
   */
  public async cleanup(): Promise<void> {
    // Redis handles expiration automatically
    // Memory cache has its own cleanup
    if (this.memoryCache) {
      // Trigger cleanup by accessing a non-existent key
      await this.memoryCache.get('__cleanup__');
    }
  }
}
