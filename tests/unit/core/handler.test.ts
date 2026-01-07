/**
 * Core Handler Unit Tests
 * 
 * Comprehensive test suite for the main handler factory and convenience wrappers
 */

import { z } from 'zod';
import { mockRequest, mockResponse, mockUser, mockTenant } from '../utils/test-helpers';
import { createHandler, createAuthenticatedHandler, createPublicHandler, createSuperAdminHandler, createTenantHandler } from '../../src/core/handler';

// Mock all external dependencies
jest.mock('../../src/core/service-initializer');
jest.mock('@prisma/client');

describe('Core Handler', () => {
    let req: any;
    let res: any;

    beforeEach(() => {
        req = mockRequest();
        res = mockResponse();
        jest.clearAllMocks();
    });

    describe('Handler Creation', () => {
        it('should create handler with default config', async () => {
            const handler = createHandler({
                handler: async () => ({ message: 'success' }),
            });

            expect(handler).toBeDefined();
            expect(typeof handler).toBe('function');
        });

        it('should create handler with custom config', async () => {
            const handler = createHandler({
                handler: async () => ({ message: 'success' }),
                requireAuth: true,
                allowedRoles: ['admin'],
                rateLimit: { max: 100, windowMs: 60000 },
            });

            expect(handler).toBeDefined();
        });

        it('should validate required handler function', () => {
            expect(() => {
                createHandler({} as any);
            }).toThrow();
        });
    });

    describe('Authentication & Authorization', () => {
        it('should allow authenticated requests with valid user', async () => {
            req.user = mockUser();

            const handler = createHandler({
                handler: async ({ user }) => ({ userId: user?.id }),
                requireAuth: true,
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: { userId: 'user-123' },
                })
            );
        });

        it('should reject unauthenticated requests when auth required', async () => {
            const handler = createHandler({
                handler: async () => ({ message: 'success' }),
                requireAuth: true,
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.objectContaining({
                        code: 'UNAUTHORIZED',
                    }),
                })
            );
        });

        it('should validate user roles correctly', async () => {
            req.user = mockUser({ role: 'user' });

            const handler = createHandler({
                handler: async () => ({ message: 'success' }),
                requireAuth: true,
                allowedRoles: ['admin'],
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.objectContaining({
                        code: 'FORBIDDEN',
                    }),
                })
            );
        });

        it('should allow access with correct role', async () => {
            req.user = mockUser({ role: 'admin' });

            const handler = createHandler({
                handler: async () => ({ message: 'success' }),
                requireAuth: true,
                allowedRoles: ['admin'],
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should enforce permission checks', async () => {
            req.user = mockUser({ permissions: ['read'] });

            const handler = createHandler({
                handler: async () => ({ message: 'success' }),
                requireAuth: true,
                requiredPermissions: ['write'],
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('Request Validation', () => {
        it('should validate request body with Zod schema', async () => {
            req.body = { name: 'Test', age: 25 };

            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });

            const handler = createHandler({
                handler: async ({ input }) => input,
                validation: { body: schema },
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: { name: 'Test', age: 25 },
                })
            );
        });

        it('should return validation errors with field details', async () => {
            req.body = { name: 'Test', age: 'invalid' };

            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });

            const handler = createHandler({
                handler: async ({ input }) => input,
                validation: { body: schema },
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.objectContaining({
                        code: 'VALIDATION_ERROR',
                    }),
                })
            );
        });

        it('should validate query parameters', async () => {
            req.query = { page: '1', limit: '10' };

            const schema = z.object({
                page: z.string(),
                limit: z.string(),
            });

            const handler = createHandler({
                handler: async ({ query }) => query,
                validation: { query: schema },
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should validate path parameters', async () => {
            req.params = { id: '123' };

            const schema = z.object({
                id: z.string(),
            });

            const handler = createHandler({
                handler: async ({ params }) => params,
                validation: { params: schema },
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should handle nested validation schemas', async () => {
            req.body = {
                user: {
                    name: 'Test',
                    email: 'test@example.com',
                },
            };

            const schema = z.object({
                user: z.object({
                    name: z.string(),
                    email: z.string().email(),
                }),
            });

            const handler = createHandler({
                handler: async ({ input }) => input,
                validation: { body: schema },
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('Ownership Verification', () => {
        it('should verify resource ownership when enabled', async () => {
            req.user = mockUser({ id: 'user-123' });
            req.params = { id: 'resource-123' };

            const ownershipCheck = jest.fn().mockResolvedValue(true);

            const handler = createHandler({
                handler: async () => ({ message: 'success' }),
                requireAuth: true,
                ownershipCheck,
            });

            await handler(req, res);

            expect(ownershipCheck).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('should deny access to non-owned resources', async () => {
            req.user = mockUser({ id: 'user-123' });
            req.params = { id: 'resource-123' };

            const ownershipCheck = jest.fn().mockResolvedValue(false);

            const handler = createHandler({
                handler: async () => ({ message: 'success' }),
                requireAuth: true,
                ownershipCheck,
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    describe('Error Handling', () => {
        it('should catch and format errors', async () => {
            const handler = createHandler({
                handler: async () => {
                    throw new Error('Test error');
                },
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: expect.any(Object),
                })
            );
        });

        it('should return appropriate status codes', async () => {
            const handler = createHandler({
                handler: async () => {
                    const error: any = new Error('Not found');
                    error.statusCode = 404;
                    throw error;
                },
            });

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('should hide internal errors in production', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const handler = createHandler({
                handler: async () => {
                    throw new Error('Internal database error');
                },
            });

            await handler(req, res);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        message: expect.not.stringContaining('database'),
                    }),
                })
            );

            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('Convenience Wrappers', () => {
        describe('createAuthenticatedHandler', () => {
            it('should require authentication', async () => {
                const handler = createAuthenticatedHandler({
                    handler: async () => ({ message: 'success' }),
                });

                await handler(req, res);

                expect(res.status).toHaveBeenCalledWith(401);
            });

            it('should allow authenticated users', async () => {
                req.user = mockUser();

                const handler = createAuthenticatedHandler({
                    handler: async ({ user }) => ({ userId: user?.id }),
                });

                await handler(req, res);

                expect(res.status).toHaveBeenCalledWith(200);
            });
        });

        describe('createPublicHandler', () => {
            it('should allow anonymous access', async () => {
                const handler = createPublicHandler({
                    handler: async () => ({ message: 'public' }),
                });

                await handler(req, res);

                expect(res.status).toHaveBeenCalledWith(200);
                expect(res.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        success: true,
                        data: { message: 'public' },
                    })
                );
            });
        });

        describe('createSuperAdminHandler', () => {
            it('should require superadmin role', async () => {
                req.user = mockUser({ role: 'admin' });

                const handler = createSuperAdminHandler({
                    handler: async () => ({ message: 'admin only' }),
                });

                await handler(req, res);

                expect(res.status).toHaveBeenCalledWith(403);
            });

            it('should allow superadmin access', async () => {
                req.user = mockUser({ role: 'superadmin' });

                const handler = createSuperAdminHandler({
                    handler: async () => ({ message: 'admin only' }),
                });

                await handler(req, res);

                expect(res.status).toHaveBeenCalledWith(200);
            });
        });

        describe('createTenantHandler', () => {
            it('should enable multi-tenancy', async () => {
                req.user = mockUser({ tenant_id: 'tenant-123' });
                req.headers['x-tenant-id'] = 'tenant-123';

                const handler = createTenantHandler({
                    handler: async ({ tenant }) => ({ tenantId: tenant?.id }),
                });

                await handler(req, res);

                expect(res.status).toHaveBeenCalledWith(200);
            });
        });
    });
});
