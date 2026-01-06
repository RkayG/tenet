/**
 * Test Routes for API Framework
 */

import { Router } from 'express';
import { z } from 'zod';
import { createHandler, createPublicHandler } from './core/handler';
import { TenantManager } from './multitenancy/manager';
import { AuthManager } from './auth/manager';
import { JWTStrategy } from './auth/strategies/jwt';
import { User } from './core/types';

const router: Router = Router();

// Test 1: Simple public endpoint
router.get('/test/hello', createPublicHandler({
  schema: z.object({
    name: z.string().optional().default('World'),
  }),
  handler: async ({ input }) => {
    return {
      message: `Hello, ${input.name}!`,
      timestamp: new Date().toISOString(),
      framework: 'Secure API Handler',
    };
  },
}));

// Test 2: Echo endpoint with validation
router.post('/test/echo', createPublicHandler({
  schema: z.object({
    message: z.string().min(1).max(200),
    metadata: z.record(z.any()).optional(),
  }),
  handler: async ({ input }) => {
    return {
      echo: input.message,
      metadata: input.metadata,
      receivedAt: new Date().toISOString(),
    };
  },
}));

// Test 3: Multitenancy info
router.get('/test/tenant-info', createPublicHandler({
  handler: async ({ request }) => {
    const tenantManager = TenantManager.getInstance({
      enabled: true,
      strategy: 'shared_schema',
      tenantHeader: 'x-tenant-id',
    });

    let tenantId = null;
    let tenantContext = null;

    try {
      tenantId = await tenantManager.resolveTenantId(request);
      if (tenantId) {
        tenantContext = await tenantManager.getTenantContext(tenantId);
      }
    } catch (error) {
      // Expected if no strategy is set
    }

    return {
      multitenancyEnabled: tenantManager.isEnabled(),
      tenantId: tenantId,
      tenantContext: tenantContext,
      headers: {
        'x-tenant-id': request.headers['x-tenant-id'],
        host: request.headers.host,
      },
      config: tenantManager.getConfig(),
    };
  },
}));

// Test 4: JWT token generation (for testing)
router.post('/test/generate-token', createPublicHandler({
  schema: z.object({
    userId: z.string(),
    email: z.string().email(),
    role: z.string().optional().default('USER'),
  }),
  sanitizeResponse: false, // Skip sanitization for this endpoint
  handler: async ({ input }) => {
    const jwtStrategy = new JWTStrategy({
      secret: process.env.JWT_SECRET || 'test-secret-key-change-in-production',
      issuer: 'secure-api-handler',
      audience: 'secure-api-client',
      expiresIn: '1h',
      refreshExpiresIn: '7d',
    });

    const user: User = {
      id: input.userId,
      email: input.email,
      tenant_id: input.userId,
      role: input.role,
    };

    const token = jwtStrategy.generateToken(user);
    const refreshToken = jwtStrategy.generateRefreshToken(user);

    return {
      accessToken: token,
      refreshToken: refreshToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  },
}));

// Test 5: Authentication test (protected route)
router.get('/test/protected', createHandler({
  requireAuth: true,
  handler: async ({ user }) => {
    return {
      message: 'You are authenticated!',
      user: {
        id: user?.id,
        email: user?.email,
        role: user?.role,
        tenant_id: user?.tenant_id,
      },
      timestamp: new Date().toISOString(),
    };
  },
}));

// Test 6: Framework features info
router.get('/test/features', createPublicHandler({
  handler: async () => {
    return {
      framework: 'Secure API Handler Template',
      version: '1.0.0',
      features: {
        authentication: {
          strategies: ['JWT', 'API Key'],
          description: 'Multiple authentication strategies supported',
        },
        multitenancy: {
          strategies: ['Shared Schema', 'Separate Schema', 'Separate Database'],
          description: 'Flexible tenant isolation strategies',
        },
        security: {
          features: ['Encryption', 'Sanitization', 'Rate Limiting'],
          description: 'Comprehensive security features',
        },
        caching: {
          providers: ['Redis', 'Memory'],
          description: 'Multi-layer caching support',
        },
        monitoring: {
          features: ['Health Checks', 'Metrics', 'Tracing'],
          description: 'Built-in observability',
        },
      },
      endpoints: {
        health: 'GET /health',
        config: 'GET /api/config',
        tests: {
          hello: 'GET /test/hello?name=YourName',
          echo: 'POST /test/echo',
          tenantInfo: 'GET /test/tenant-info',
          generateToken: 'POST /test/generate-token',
          protected: 'GET /test/protected (requires auth)',
          features: 'GET /test/features',
        },
      },
    };
  },
}));

// Test 7: Database connectivity (if Prisma is configured)
router.get('/test/database', createPublicHandler({
  handler: async ({ prisma }) => {
    try {
      // Try a simple query
      await prisma.$queryRaw`SELECT 1 as result`;

      return {
        database: 'connected',
        status: 'healthy',
        message: 'Database connection is working',
      };
    } catch (error) {
      return {
        database: 'disconnected',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
}));

export default router;

