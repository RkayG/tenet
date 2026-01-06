/**
 * Express Server Setup for Secure API Handler Framework
 *
 * This file demonstrates how to set up an Express server with the secure API handler framework.
 */

import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { PrismaClient } from '@prisma/client';

// Import framework components
import { ConfigManager } from './config/manager';
import { EnvironmentConfig } from './config/providers/environment';
import { MonitoringService } from './monitoring/service';
import { HealthChecker } from './monitoring/health';
import { healthCheckResponse } from './core/response';
import { TenantManager } from './multitenancy/manager';
import { SharedSchemaStrategy } from './multitenancy/strategies/shared-schema';
import testRoutes from './test-routes';

const app: Express = express();
const prisma = new PrismaClient();

// Set global Prisma instance for handlers
(global as any).prisma = prisma;

// Initialize configuration
const configManager = ConfigManager.getInstance();
configManager.addProvider(new EnvironmentConfig());
configManager.load();

// Initialize monitoring
const monitoring = MonitoringService.getInstance();

// Initialize health checker
const healthChecker = HealthChecker.getInstance();

// Initialize multitenancy (optional - can be disabled)
const tenantManager = TenantManager.getInstance({
  enabled: false, // Set to true to enable multitenancy
  strategy: 'shared_schema',
  tenantHeader: 'x-tenant-id',
  defaultTenant: 'default',
});

// Set tenant strategy if enabled
if (tenantManager.isEnabled()) {
  tenantManager.setStrategy(new SharedSchemaStrategy({
    prismaClient: prisma,
  }));
}

// Middleware setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  monitoring.recordMetric('http.request', 1, {
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent')?.substring(0, 100)!,
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    monitoring.recordMetric('http.response', 1, {
      method: req.method,
      path: req.path,
      status: res.statusCode.toString(),
      duration: duration.toString(),
    });
  });

  next();
});

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await healthChecker.getOverallHealth();
    return healthCheckResponse(res, health.status, {
      checks: health.details,
      timestamp: health.timestamp,
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error: any) {
    return healthCheckResponse(res, 'unhealthy', {
      error: error.message,
    });
  }
});

// API routes setup
// Import and use your route handlers here
// Example:
// import userRoutes from './routes/users';
// app.use('/api/users', userRoutes);

// Test routes
app.use(testRoutes);

// Example route
app.get('/api/test', (_req: Request, res: Response) => {
  res.json({
    message: 'Secure API Handler Framework is running!',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// 404 handler
app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

// Global error handler
app.use((error: any, req: Request, res: Response, _next: NextFunction) => {
  monitoring.recordError(error, {
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
  });

  console.error('Unhandled error:', error);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
    },
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  await prisma.$disconnect();

  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');

  await prisma.$disconnect();

  process.exit(0);
});

// Start server
const port = configManager.getConfig().port;
const host = configManager.getConfig().host;

app.listen(port, host, () => {
  console.log(`🚀 Secure API Handler Framework running on http://${host}:${port}`);
  console.log(`📊 Health check available at http://${host}:${port}/health`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
