/**
 * In-Memory Cache Implementation
 *
 * Provides simple in-memory caching as a fallback when Redis is unavailable
 */

import { CacheEntry } from '../core/types';

export interface MemoryCacheConfig {
  maxSize?: number;
  defaultTtl?: number;
  cleanupInterval?: number;
}

export class MemoryCache {
  private static instance: MemoryCache;
  private store = new Map<string, CacheEntry>();
  private config: Required<MemoryCacheConfig>;
  private cleanupTimer?: NodeJS.Timeout | undefined;

  private constructor(config: MemoryCacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTtl: config.defaultTtl || 300, // 5 minutes
      cleanupInterval: config.cleanupInterval || 60000, // 1 minute
    };

    this.startCleanupTimer();
  }

  public static getInstance(config?: MemoryCacheConfig): MemoryCache {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache(config);
    }
    return MemoryCache.instance;
  }

  /**
   * Get a value from cache
   */
  public async get<T = any>(key: string): Promise<T | null> {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
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
    // Evict entries if we're at max size
    if (this.store.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      ttl: ttl || this.config.defaultTtl,
      createdAt: new Date(),
      tags: tags || [],
    };

    this.store.set(key, entry);
  }

  /**
   * Delete a value from cache
   */
  public async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  /**
   * Check if key exists
   */
  public async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get time to live for a key
   */
  public async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -1;

    if (this.isExpired(entry)) {
      this.store.delete(key);
      return -1;
    }

    const expiresAt = entry.createdAt.getTime() + (entry.ttl * 1000);
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    return remaining;
  }

  /**
   * Extend TTL for a key
   */
  public async expire(key: string, ttl: number): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;

    entry.ttl = ttl;
    entry.createdAt = new Date();
    return true;
  }

  /**
   * Invalidate cache by tags
   */
  public async invalidateByTags(tags: string[]): Promise<number> {
    let deleted = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
        this.store.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    size: number;
    maxSize: number;
    hitRate?: number;
  }> {
    return {
      size: this.store.size,
      maxSize: this.config.maxSize,
    };
  }

  /**
   * Get multiple values at once
   */
  public async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  /**
   * Set multiple values at once
   */
  public async mset(entries: Array<{ key: string; value: any; ttl?: number; tags?: string[] }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl, entry.tags);
    }
  }

  // Private helper methods

  private isExpired(entry: CacheEntry): boolean {
    const now = new Date();
    const expiresAt = new Date(entry.createdAt.getTime() + (entry.ttl * 1000));
    return now > expiresAt;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.createdAt.getTime() < oldestTime) {
        oldestTime = entry.createdAt.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      const expiresAt = entry.createdAt.getTime() + (entry.ttl * 1000);
      if (now > expiresAt) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.store.delete(key));
  }

  /**
   * Stop cleanup timer (useful for testing)
   */
  public stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Get all keys (for debugging)
   */
  public getKeys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get all entries (for debugging)
   */
  public getEntries(): CacheEntry[] {
    return Array.from(this.store.values());
  }
}
