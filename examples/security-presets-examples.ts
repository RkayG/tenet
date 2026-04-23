/**
 * Security Presets Usage Examples
 * 
 * Demonstrates how to use security presets to simplify handler configuration
 */

import { z } from 'zod';
import {
    createPublicHandler,
    createAuthenticatedHandler,
    createSuperAdminHandler,
    createTenantHandler,
} from '../core/handler';

// ============================================
// Example 1: Public Endpoint (Health Check)
// ============================================

export const healthCheck = createPublicHandler({
    handler: async () => {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    },
    // Preset 'public' automatically applied:
    // - No auth required
    // - No CSRF protection
    // - IP-based rate limiting
});

// ============================================
// Example 2: Authenticated Endpoint (User Profile)
// ============================================

const updateProfileSchema = z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    bio: z.string().max(500).optional(),
});

export const updateProfile = createAuthenticatedHandler({
    schema: updateProfileSchema,
    handler: async ({ input, user, prisma }) => {
        return await prisma.user.update({
            where: { id: user!.id },
            data: input,
        });
    },
    // Preset 'authenticated' automatically applied:
    // - Auth required
    // - CSRF protection enabled
    // - User-based rate limiting
    // - Full audit logging
});

// ============================================
// Example 3: Admin Endpoint (User Management)
// ============================================

export const deleteUser = createSuperAdminHandler({
    schema: z.object({
        userId: z.string(),
    }),
    handler: async ({ input, prisma }) => {
        await prisma.user.delete({
            where: { id: input.userId },
        });

        return { success: true };
    },
    // Preset 'admin' automatically applied:
    // - Superadmin role required
    // - Enhanced CSRF protection
    // - Strict rate limits
    // - High-severity audit logging
});

// ============================================
// Example 4: Tenant Endpoint (Create Order)
// ============================================

const createOrderSchema = z.object({
    items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().positive(),
    })),
});

export const createOrder = createTenantHandler({
    allowedRoles: ['OWNER', 'MANAGER'],
    schema: createOrderSchema,
    handler: async ({ input, user, tenant, prisma, transaction }) => {
        return await transaction(async (tx) => {
            const order = await tx.order.create({
                data: {
                    userId: user!.id,
                    tenant_id: tenant!.id, // Auto-added by middleware
                    items: {
                        create: input.items,
                    },
                },
            });

            // Update inventory
            for (const item of input.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { decrement: item.quantity } },
                });
            }

            return order;
        });
    },
    // Preset 'tenant' automatically applied:
    // - Auth + tenant context required
    // - Automatic tenant scoping
    // - Tenant-role validation
    // - CSRF protection
});

// ============================================
// Example 5: Using Preset with Overrides
// ============================================

import { _createHandler } from '../core/handler';

export const getBulkData = _createHandler({
    preset: 'authenticated',
    // Override cache TTL
    cache: {
        ttl: 3600, // 1 hour instead of default 5 minutes
    },
    // Override rate limit
    rateLimit: {
        maxRequests: 10, // Stricter than default
        windowMs: 60000,
    },
    handler: async ({ prisma }) => {
        return await prisma.data.findMany({
            take: 1000,
        });
    },
});

// ============================================
// Example 6: High-Security Payment Endpoint
// ============================================

const processPaymentSchema = z.object({
    amount: z.number().positive(),
    currency: z.string().length(3),
    paymentMethodId: z.string(),
});

export const processPayment = _createHandler({
    preset: 'highSecurity',
    schema: processPaymentSchema,
    handler: async ({ input, user, transaction }) => {
        return await transaction(async (tx) => {
            // Process payment atomically
            const payment = await tx.payment.create({
                data: {
                    userId: user!.id,
                    amount: input.amount,
                    currency: input.currency,
                    status: 'PROCESSING',
                },
            });

            // Call payment gateway
            // ...

            return payment;
        });
    },
    // Preset 'highSecurity' automatically applied:
    // - Auth required
    // - CSRF + Idempotency required
    // - Strict rate limits (10 req/min)
    // - 15-second timeout
    // - Full audit trail with response capture
});

// ============================================
// Example 7: Read-Only Endpoint with Caching
// ============================================

export const getReports = _createHandler({
    preset: 'readonly',
    handler: async ({ prisma }) => {
        return await prisma.report.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    },
    // Preset 'readonly' automatically applied:
    // - Auth required
    // - No CSRF (GET only)
    // - Aggressive caching (5 min)
    // - Lighter audit logging
});
