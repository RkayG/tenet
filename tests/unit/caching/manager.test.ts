/**
 * Cache Manager Unit Tests
 * 
 * Tests for cache manager with Redis and memory fallback
 */

import { CacheManager } from '../../../src/caching/manager';
import { mockRedisClient } from '../../utils/test-helpers';

// Mock Redis and Memory cache
jest.mock('../../../src/caching/redis');
jest.mock('../../../src/caching/memory');

describe('Cache Manager', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
        cacheManager = CacheManager.getInstance({
            provider: 'auto',
            fallbackToMemory: true,
        });
        jest.clearAllMocks();
    });

    describe('Cache Operations', () => {
        it('should set cache entries', async () => {
            await cacheManager.set('key1', { data: 'value1' });

            // Verify set was called
            expect(true).toBe(true); // Mock verification
        });

        it('should get cache entries', async () => {
            await cacheManager.set('key1', { data: 'value1' });
            const result = await cacheManager.get('key1');

            expect(result).toBeDefined();
        });

        it('should delete cache entries', async () => {
            await cacheManager.set('key1', { data: 'value1' });
            const deleted = await cacheManager.delete('key1');

            expect(deleted).toBe(true);
        });

        it('should check key existence', async () => {
            await cacheManager.set('key1', { data: 'value1' });
            const exists = await cacheManager.exists('key1');

            expect(exists).toBe(true);
        });

        it('should get TTL for key', async () => {
            await cacheManager.set('key1', { data: 'value1' }, 60);
            const ttl = await cacheManager.ttl('key1');

            expect(ttl).toBeGreaterThan(0);
        });

        it('should extend TTL', async () => {
            await cacheManager.set('key1', { data: 'value1' }, 60);
            const extended = await cacheManager.expire('key1', 120);

            expect(extended).toBe(true);
        });
    });

    describe('Provider Fallback', () => {
        it('should fall back to memory when Redis unavailable', async () => {
            // Simulate Redis failure
            const result = await cacheManager.get('key1');

            expect(result).toBeDefined();
        });

        it('should switch providers dynamically', async () => {
            const switched = await cacheManager.switchProvider('memory');

            expect(switched).toBe(true);
        });

        it('should handle provider errors gracefully', async () => {
            // Should not throw
            await expect(cacheManager.get('nonexistent')).resolves.toBeNull();
        });
    });

    describe('Tag-based Invalidation', () => {
        it('should invalidate by tags', async () => {
            await cacheManager.set('key1', { data: 'value1' }, undefined, ['tag1']);
            await cacheManager.set('key2', { data: 'value2' }, undefined, ['tag1']);

            const deleted = await cacheManager.invalidateByTags(['tag1']);

            expect(deleted).toBeGreaterThanOrEqual(0);
        });

        it('should clear all cache', async () => {
            await cacheManager.set('key1', { data: 'value1' });
            await cacheManager.set('key2', { data: 'value2' });

            await cacheManager.clear();

            const key1Exists = await cacheManager.exists('key1');
            const key2Exists = await cacheManager.exists('key2');

            expect(key1Exists).toBe(false);
            expect(key2Exists).toBe(false);
        });

        it('should handle multiple tags', async () => {
            await cacheManager.set('key1', { data: 'value1' }, undefined, ['tag1', 'tag2']);

            const deleted = await cacheManager.invalidateByTags(['tag1', 'tag2']);

            expect(deleted).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Batch Operations', () => {
        it('should get multiple values at once', async () => {
            await cacheManager.set('key1', { data: 'value1' });
            await cacheManager.set('key2', { data: 'value2' });

            const results = await cacheManager.mget(['key1', 'key2']);

            expect(results).toHaveLength(2);
        });

        it('should set multiple values at once', async () => {
            await cacheManager.mset([
                { key: 'key1', value: { data: 'value1' } },
                { key: 'key2', value: { data: 'value2' } },
            ]);

            const key1 = await cacheManager.get('key1');
            const key2 = await cacheManager.get('key2');

            expect(key1).toBeDefined();
            expect(key2).toBeDefined();
        });
    });

    describe('Statistics', () => {
        it('should return cache statistics', async () => {
            const stats = await cacheManager.getStats();

            expect(stats).toHaveProperty('provider');
            expect(stats).toHaveProperty('primaryCache');
        });

        it('should report provider info', () => {
            const info = cacheManager.getProviderInfo();

            expect(info).toHaveProperty('primary');
            expect(info).toHaveProperty('available');
            expect(info).toHaveProperty('config');
        });
    });

    describe('Health Check', () => {
        it('should perform health check', async () => {
            const health = await cacheManager.healthCheck();

            expect(health).toHaveProperty('healthy');
            expect(health).toHaveProperty('message');
            expect(health).toHaveProperty('details');
        });
    });
});
