/**
 * Standardized API Response Utilities for Express.js
 */

import { Response } from 'express';
import { ApiResponse, ApiError, ApiMeta, ErrorCode } from './types';

// ============================================
// Response Creation Helpers
// ============================================

/**
 * Create a successful API response
 */
export function successResponse<T = any>(
  res: Response,
  data: T,
  _message?: string,
  status: number = 200,
  meta?: Partial<ApiMeta>
): Response<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
      requestId: generateRequestId(),
      ...meta,
    },
  };

  return res.status(status).json(response);
}

/**
 * Create an error API response
 */
export function errorResponse(
  res: Response,
  code: ErrorCode,
  message: string,
  status: number = 500,
  details?: Record<string, any>,
  traceId?: string
): Response<ApiResponse> {
  const error: ApiError = {
    code,
    message,
    ...(details && { details }),
    ...(traceId && { traceId }),
  };

  const response: ApiResponse = {
    success: false,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
      requestId: generateRequestId(),
    },
  };

  return res.status(status).json(response);
}

// ============================================
// Specific Error Response Helpers
// ============================================

/**
 * Create a validation error response
 */
export function validationErrorResponse(
  res: Response,
  message: string = 'Validation failed',
  details?: Record<string, any>
): Response<ApiResponse> {
  return errorResponse(res, 'VALIDATION_ERROR', message, 400, details);
}

/**
 * Create an authentication error response
 */
export function unauthorizedResponse(
  res: Response,
  message: string = 'Authentication required'
): Response<ApiResponse> {
  return errorResponse(res, 'AUTHENTICATION_ERROR', message, 401);
}

/**
 * Create an authorization error response
 */
export function forbiddenResponse(
  res: Response,
  message: string = 'Insufficient permissions'
): Response<ApiResponse> {
  return errorResponse(res, 'AUTHORIZATION_ERROR', message, 403);
}

/**
 * Create a not found error response
 */
export function notFoundResponse(
  res: Response,
  message: string = 'Resource not found'
): Response<ApiResponse> {
  return errorResponse(res, 'RESOURCE_NOT_FOUND', message, 404);
}

/**
 * Create a rate limit exceeded response
 */
export function rateLimitResponse(
  res: Response,
  message: string = 'Rate limit exceeded',
  retryAfter?: number
): Response<ApiResponse> {
  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter.toString());
  }

  return errorResponse(res, 'RATE_LIMIT_EXCEEDED', message, 429);
}

/**
 * Create an internal server error response
 */
export function internalErrorResponse(
  res: Response,
  message: string = 'An unexpected error occurred'
): Response<ApiResponse> {
  return errorResponse(res, 'INTERNAL_ERROR', message, 500);
}

/**
 * Create a service unavailable response
 */
export function serviceUnavailableResponse(
  res: Response,
  message: string = 'Service temporarily unavailable'
): Response<ApiResponse> {
  return errorResponse(res, 'SERVICE_UNAVAILABLE', message, 503);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// Health Check Responses
// ============================================

/**
 * Create a health check response
 */
export function healthCheckResponse(
  res: Response,
  status: 'healthy' | 'unhealthy' | 'degraded',
  checks: Record<string, any> = {}
): Response {
  const isHealthy = status === 'healthy';
  const response = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.API_VERSION || '1.0.0',
    checks,
  };

  return res.status(isHealthy ? 200 : 503).json(response);
}
