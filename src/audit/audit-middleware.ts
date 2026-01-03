/**
 * Audit Middleware
 * 
 * Express middleware for automatic audit logging of HTTP requests
 */

import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit-service';
import { AuditEventType, AuditCategory, AuditStatus, AuditSeverity } from './audit-types';

export interface AuditMiddlewareConfig {
    // Enable/disable middleware
    enabled?: boolean;

    // Skip certain paths
    skipPaths?: string[];
    skipPathPatterns?: RegExp[];

    // Skip certain methods
    skipMethods?: string[];

    // Capture options
    captureRequestBody?: boolean;
    captureResponseBody?: boolean;
    captureQueryParams?: boolean;
    captureHeaders?: boolean;

    // Custom action generator
    actionGenerator?: (req: Request) => string;
}

/**
 * Create audit middleware
 */
export function createAuditMiddleware(config: AuditMiddlewareConfig = {}) {
    const auditService = AuditService.getInstance();

    return async (req: Request, res: Response, next: NextFunction) => {
        // Skip if disabled
        if (config.enabled === false) {
            return next();
        }

        // Skip certain paths
        if (config.skipPaths?.includes(req.path)) {
            return next();
        }

        // Skip path patterns (e.g., health checks)
        if (config.skipPathPatterns?.some(pattern => pattern.test(req.path))) {
            return next();
        }

        // Skip certain methods
        if (config.skipMethods?.includes(req.method)) {
            return next();
        }

        const startTime = Date.now();

        // Capture original response methods
        const originalSend = res.send;
        const originalJson = res.json;
        let responseBody: any;

        // Intercept response body if needed
        if (config.captureResponseBody) {
            res.send = function (body: any) {
                responseBody = body;
                return originalSend.call(this, body);
            };

            res.json = function (body: any) {
                responseBody = body;
                return originalJson.call(this, body);
            };
        }

        // Log after response is sent
        res.on('finish', async () => {
            try {
                const executionTimeMs = Date.now() - startTime;
                const user = (req as any).user;
                const tenant = (req as any).tenant;

                // Determine event type based on HTTP method
                const eventType = mapMethodToEventType(req.method);

                // Generate action
                const action = config.actionGenerator
                    ? config.actionGenerator(req)
                    : `${req.method.toLowerCase()}.${req.path.replace(/\//g, '.')}`;

                // Determine status
                const status = res.statusCode >= 200 && res.statusCode < 300
                    ? AuditStatus.SUCCESS
                    : AuditStatus.FAILURE;

                // Determine severity
                const severity = res.statusCode >= 500
                    ? AuditSeverity.ERROR
                    : res.statusCode >= 400
                        ? AuditSeverity.WARNING
                        : AuditSeverity.INFO;

                // Build metadata
                const metadata: any = {};

                if (config.captureQueryParams && Object.keys(req.query).length > 0) {
                    metadata.queryParams = req.query;
                }

                if (config.captureRequestBody && req.body) {
                    metadata.requestBody = req.body;
                }

                if (config.captureResponseBody && responseBody) {
                    metadata.responseBody = responseBody;
                }

                if (config.captureHeaders) {
                    metadata.headers = req.headers;
                }

                // Log the audit event
                await auditService.logEvent(
                    {
                        eventType,
                        category: AuditCategory.DATA,
                        action,
                        description: `${req.method} ${req.path}`,
                        status,
                        statusCode: res.statusCode,
                        severity,
                        executionTimeMs,
                        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
                    },
                    {
                        user,
                        tenant,
                        request: req,
                    }
                );
            } catch (error) {
                // Silently fail - don't break the request
                console.error('Audit middleware error:', error);
            }
        });

        next();
    };
}

/**
 * Map HTTP method to audit event type
 */
function mapMethodToEventType(method: string): AuditEventType {
    switch (method.toUpperCase()) {
        case 'POST':
            return AuditEventType.CREATE;
        case 'GET':
            return AuditEventType.READ;
        case 'PUT':
        case 'PATCH':
            return AuditEventType.UPDATE;
        case 'DELETE':
            return AuditEventType.DELETE;
        default:
            return AuditEventType.CUSTOM;
    }
}

/**
 * Predefined middleware configurations
 */

// Skip health checks and metrics
export const skipHealthChecks: RegExp[] = [
    /^\/health$/,
    /^\/healthz$/,
    /^\/metrics$/,
    /^\/ping$/,
];

// Default configuration for API audit logging
export const defaultAuditConfig: AuditMiddlewareConfig = {
    enabled: true,
    skipPathPatterns: skipHealthChecks,
    captureRequestBody: false,
    captureResponseBody: false,
    captureQueryParams: true,
    captureHeaders: false,
};
