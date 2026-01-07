/**
 * Database Connection Pool Unit Tests
 * 
 * Tests for connection pool management
 */

import { ConnectionPool } from '../../../src/database/pool';
import { mockPrismaClient } from '../../utils/test-helpers';

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaClient()),
}));

describe('Connection Pool', () => {
    let pool: ConnectionPool;

    beforeEach(() => {
        pool = new ConnectionPool({
            size: 5,
            databaseUrl: 'postgresql://test:test@localhost:5432/test',
            timeout: 5000,
            idleTimeout: 30000,
        });
    });

    afterEach(async () => {
        if (pool.isInitialized()) {
            await pool.close();
        }
    });

    describe('Pool Initialization', () => {
        it('should initialize pool with configured size', async () => {
            await pool.initialize();

            const status = pool.getStatus();
            expect(status.total).toBe(5);
            expect(pool.isInitialized()).toBe(true);
        });

        it('should not reinitialize if already initialized', async () => {
            await pool.initialize();
            await pool.initialize(); // Should not throw

            expect(pool.isInitialized()).toBe(true);
        });

        it('should handle initialization errors', async () => {
            // Mock connection failure
            const badPool = new ConnectionPool({
                size: 1,
                databaseUrl: 'invalid://url',
            });

            await expect(badPool.initialize()).rejects.toThrow();
        });
    });

    describe('Connection Acquisition', () => {
        beforeEach(async () => {
            await pool.initialize();
        });

        it('should acquire connection from pool', async () => {
            const client = await pool.acquire();

            expect(client).toBeDefined();
            expect(client.$connect).toBeDefined();
        });

        it('should track active connections', async () => {
            const client1 = await pool.acquire();
            const client2 = await pool.acquire();

            const status = pool.getStatus();
            expect(status.active).toBe(2);
            expect(status.idle).toBe(3);
        });

        it('should handle pool exhaustion', async () => {
            // Acquire all connections
            const clients = await Promise.all([
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
            ]);

            expect(clients).toHaveLength(5);

            const status = pool.getStatus();
            expect(status.active).toBe(5);
            expect(status.idle).toBe(0);
        });

        it('should timeout when pool exhausted', async () => {
            // Acquire all connections
            await Promise.all([
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
            ]);

            // Try to acquire one more (should timeout)
            await expect(pool.acquire()).rejects.toThrow('Connection pool timeout');
        }, 10000);
    });

    describe('Connection Release', () => {
        beforeEach(async () => {
            await pool.initialize();
        });

        it('should release connection back to pool', async () => {
            const client = await pool.acquire();
            await pool.release(client);

            const status = pool.getStatus();
            expect(status.active).toBe(0);
            expect(status.idle).toBe(5);
        });

        it('should process wait queue on release', async () => {
            // Acquire all connections
            const clients = await Promise.all([
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
            ]);

            // Start waiting for connection
            const waitingPromise = pool.acquire();

            // Release one connection
            await pool.release(clients[0]);

            // Waiting request should be fulfilled
            const client = await waitingPromise;
            expect(client).toBeDefined();
        });

        it('should handle release of unknown connection', async () => {
            const unknownClient = mockPrismaClient();

            // Should not throw
            await expect(pool.release(unknownClient as any)).resolves.not.toThrow();
        });
    });

    describe('Execute with Auto-Release', () => {
        beforeEach(async () => {
            await pool.initialize();
        });

        it('should execute query and auto-release', async () => {
            const result = await pool.execute(async (client) => {
                return { data: 'test' };
            });

            expect(result).toEqual({ data: 'test' });

            const status = pool.getStatus();
            expect(status.active).toBe(0);
        });

        it('should release connection even on error', async () => {
            await expect(
                pool.execute(async () => {
                    throw new Error('Query failed');
                })
            ).rejects.toThrow('Query failed');

            const status = pool.getStatus();
            expect(status.active).toBe(0);
        });
    });

    describe('Pool Resizing', () => {
        beforeEach(async () => {
            await pool.initialize();
        });

        it('should increase pool size', async () => {
            await pool.resize(10);

            const status = pool.getStatus();
            expect(status.total).toBe(10);
        });

        it('should decrease pool size', async () => {
            await pool.resize(3);

            const status = pool.getStatus();
            expect(status.total).toBe(3);
        });

        it('should only remove idle connections when shrinking', async () => {
            // Acquire 2 connections
            await pool.acquire();
            await pool.acquire();

            // Try to resize to 1 (should keep active connections)
            await pool.resize(1);

            const status = pool.getStatus();
            expect(status.active).toBe(2);
        });
    });

    describe('Health Check', () => {
        beforeEach(async () => {
            await pool.initialize();
        });

        it('should report healthy status', async () => {
            const health = await pool.healthCheck();

            expect(health.status).toBe('healthy');
            expect(health.details.total).toBe(5);
        });

        it('should report unhealthy when not initialized', async () => {
            const uninitializedPool = new ConnectionPool({
                size: 5,
                databaseUrl: 'postgresql://test:test@localhost:5432/test',
            });

            const health = await uninitializedPool.healthCheck();

            expect(health.status).toBe('unhealthy');
            expect(health.details.errors).toContain('Pool not initialized');
        });

        it('should report degraded with high wait queue', async () => {
            // Acquire all connections
            await Promise.all([
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
            ]);

            // Create wait queue
            const waitPromises = [
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
            ];

            const health = await pool.healthCheck();

            expect(health.status).toBe('degraded');
            expect(health.details.errors).toContain('High wait queue');

            // Cleanup
            await pool.close();
        }, 10000);
    });

    describe('Pool Closure', () => {
        beforeEach(async () => {
            await pool.initialize();
        });

        it('should close all connections', async () => {
            await pool.close();

            const status = pool.getStatus();
            expect(status.total).toBe(0);
            expect(pool.isInitialized()).toBe(false);
        });

        it('should reject waiting requests on close', async () => {
            // Acquire all connections
            await Promise.all([
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
                pool.acquire(),
            ]);

            // Start waiting
            const waitPromise = pool.acquire();

            // Close pool
            await pool.close();

            // Wait should be rejected
            await expect(waitPromise).rejects.toThrow('Connection pool is closing');
        });
    });
});
