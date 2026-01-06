/**
 * Redis Cache Implementation
 *
 * Provides Redis-based caching with TTL, tags, and invalidation strategies
 */

import { createClient, RedisClientType } from 'redis';
import { CacheEntry } from '../core/types';

export interface RedisCacheConfig {
  url?: string;
  password?: string;
  database?: number;
  keyPrefix?: string;
  defaultTtl?: number;
  enableCompression?: boolean;
}

export class RedisCache {
  private static instance: RedisCache;
  private redis: RedisClientType;
  private config: RedisCacheConfig & { url: string; database: number; keyPrefix: string; defaultTtl: number; enableCompression: boolean };
  private isConnected: boolean = false;

  private constructor(config: RedisCacheConfig = {}) {
    this.config = {
      url: config.url || process.env.REDIS_URL || 'redis://localhost:6379',
      ...(config.password || process.env.REDIS_PASSWORD ? { password: config.password || process.env.REDIS_PASSWORD } : {}),
      database: config.database || 0,
      keyPrefix: config.keyPrefix || 'cache:',
      defaultTtl: config.defaultTtl || 300, // 5 minutes
      enableCompression: config.enableCompression || false,
    } as Omit<Required<RedisCacheConfig>, 'password'> & { password?: string };

    this.redis = createClient({
      url: this.config.url,
      ...(this.config.password && { password: this.config.password }),
      database: this.config.database,
    });

    this.redis.on('error', (err) => {
      console.error('Redis cache connection error:', err);
      this.isConnected = false;
    });

    this.redis.on('connect', () => {
      console.log('Connected to Redis for caching');
      this.isConnected = true;
    });
  }

  public static getInstance(config?: RedisCacheConfig): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache(config);
    }
    return RedisCache.instance;
  }

  /**
   * Get a value from cache
   */
  public async get<T = any>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const fullKey = this.getFullKey(key);
      const data = await this.redis.get(fullKey);

      if (!data) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(data);

      // Check if entry has expired
      if (this.isExpired(entry)) {
        await this.delete(key);
        return null;
      }

      return entry.value;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
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
    if (!this.isConnected) {
      return;
    }

    try {
      const fullKey = this.getFullKey(key);
      const entry: CacheEntry<T> = {
        key,
        value,
        ttl: ttl || this.config.defaultTtl,
        createdAt: new Date(),
        tags: tags || [],
      };

      const serialized = JSON.stringify(entry);

      // Set with TTL
      await this.redis.setEx(fullKey, entry.ttl, serialized);

      // Add to tag sets for invalidation
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          await this.redis.sAdd(this.getTagKey(tag), fullKey);
        }
      }

    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete a value from cache
   */
  public async delete(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.del(fullKey);

      // Remove from tag sets
      const entry = await this.getEntry(key);
      if (entry?.tags) {
        for (const tag of entry.tags) {
          await this.redis.sRem(this.getTagKey(tag), fullKey);
        }
      }

      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.exists(fullKey);
      return result > 0;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get time to live for a key
   */
  public async ttl(key: string): Promise<number> {
    if (!this.isConnected) {
      return -1;
    }

    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }

  /**
   * Extend TTL for a key
   */
  public async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.expire(fullKey, ttl);
    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      let totalDeleted = 0;

      for (const tag of tags) {
        const tagKey = this.getTagKey(tag);
        const keys = await this.redis.sMembers(tagKey);

        if (keys.length > 0) {
          // Delete all keys with this tag
          const deleted = await this.redis.del(keys);
          totalDeleted += deleted;

          // Delete the tag set
          await this.redis.del(tagKey);
        }
      }

      return totalDeleted;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const pattern = `${this.config.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(keys);
      }

      // Also clear tag sets
      const tagKeys = await this.redis.keys(`${this.config.keyPrefix}tag:*`);
      if (tagKeys.length > 0) {
        await this.redis.del(tagKeys);
      }

    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    connected: boolean;
    keys: number;
    memory?: any;
    info?: any;
  }> {
    const stats = {
      connected: this.isConnected,
      keys: 0,
    };

    if (!this.isConnected) {
      return stats;
    }

    try {
      // Count keys with our prefix
      const pattern = `${this.config.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);
      stats.keys = keys.length;

      // Get Redis info
      const info = await this.redis.info();
      (stats as any).info = this.parseRedisInfo(info);

    } catch (error) {
      console.error('Cache stats error:', error);
    }

    return stats;
  }

  /**
   * Get multiple values at once
   */
  public async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    if (!this.isConnected || keys.length === 0) {
      return new Array(keys.length).fill(null);
    }

    try {
      const fullKeys = keys.map(key => this.getFullKey(key));
      const values = await this.redis.mGet(fullKeys);

      return values.map((value, _index) => {
        if (!value) return null;

        try {
          const entry: CacheEntry<T> = JSON.parse(value);
          return this.isExpired(entry) ? null : entry.value;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }

  /**
   * Set multiple values at once
   */
  public async mset(entries: Array<{ key: string; value: any; ttl?: number; tags?: string[] }>): Promise<void> {
    if (!this.isConnected || entries.length === 0) {
      return;
    }

    try {
      const pipeline = this.redis.multi();

      for (const entry of entries) {
        const fullKey = this.getFullKey(entry.key);
        const cacheEntry: CacheEntry = {
          key: entry.key,
          value: entry.value,
          ttl: entry.ttl || this.config.defaultTtl,
          createdAt: new Date(),
          tags: entry.tags || [],
        };

        pipeline.setEx(fullKey, cacheEntry.ttl, JSON.stringify(cacheEntry));

        // Add to tag sets
        if (entry.tags) {
          for (const tag of entry.tags) {
            pipeline.sAdd(this.getTagKey(tag), fullKey);
          }
        }
      }

      await pipeline.exec();
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }

  // Private helper methods

  private getFullKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private getTagKey(tag: string): string {
    return `${this.config.keyPrefix}tag:${tag}`;
  }

  private async getEntry(key: string): Promise<CacheEntry | null> {
    try {
      const fullKey = this.getFullKey(key);
      const data = await this.redis.get(fullKey);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    const now = new Date();
    const expiresAt = new Date(entry.createdAt.getTime() + (entry.ttl * 1000));
    return now > expiresAt;
  }

  private parseRedisInfo(info: string): Record<string, any> {
    const lines = info.split('\r\n');
    const parsed: Record<string, any> = {};

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key as string] = value;
      }
    }

    return parsed;
  }

  /**
   * Connect to Redis
   */
  public async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.redis.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.disconnect();
    }
  }
}
