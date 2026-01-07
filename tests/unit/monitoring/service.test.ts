/**
 * Monitoring Service Unit Tests
 * 
 * Tests for monitoring and metrics collection
 */

import { MonitoringService } from '../../../src/monitoring/service';

describe('Monitoring Service', () => {
    let monitoring: MonitoringService;

    beforeEach(() => {
        monitoring = MonitoringService.getInstance();
        jest.clearAllMocks();
    });

    describe('Span Management', () => {
        it('should create trace span', () => {
            const span = monitoring.startSpan('test-operation', {
                traceId: 'trace-123',
                metadata: { userId: 'user-123' },
            });

            expect(span).toBeDefined();
            expect(span.spanId).toBeDefined();
            expect(span.operation).toBe('test-operation');
        });

        it('should end span successfully', () => {
            const span = monitoring.startSpan('test-operation');

            monitoring.endSpan(span, 'success');

            expect(span.status).toBe('success');
            expect(span.endTime).toBeDefined();
            expect(span.duration).toBeGreaterThan(0);
        });

        it('should end span with error', () => {
            const span = monitoring.startSpan('test-operation');

            monitoring.endSpan(span, 'error', 'Test error');

            expect(span.status).toBe('error');
            expect(span.error).toBe('Test error');
        });

        it('should track nested spans', () => {
            const parentSpan = monitoring.startSpan('parent-operation');
            const childSpan = monitoring.startSpan('child-operation', {
                parentSpanId: parentSpan.spanId,
            });

            expect(childSpan.parentSpanId).toBe(parentSpan.spanId);
        });
    });

    describe('Metrics Recording', () => {
        it('should record counter metric', () => {
            monitoring.recordMetric('api.requests', 1, 'counter');

            const metrics = monitoring.getMetrics();
            expect(metrics).toHaveProperty('api.requests');
        });

        it('should record gauge metric', () => {
            monitoring.recordMetric('memory.usage', 1024, 'gauge');

            const metrics = monitoring.getMetrics();
            expect(metrics).toHaveProperty('memory.usage');
        });

        it('should record histogram metric', () => {
            monitoring.recordMetric('response.time', 150, 'histogram');

            const metrics = monitoring.getMetrics();
            expect(metrics).toHaveProperty('response.time');
        });

        it('should increment counter', () => {
            monitoring.recordMetric('api.requests', 1, 'counter');
            monitoring.recordMetric('api.requests', 1, 'counter');

            const metrics = monitoring.getMetrics();
            expect(metrics['api.requests'].value).toBe(2);
        });

        it('should track metric labels', () => {
            monitoring.recordMetric('api.requests', 1, 'counter', {
                method: 'GET',
                path: '/users',
            });

            const metrics = monitoring.getMetrics();
            expect(metrics['api.requests'].labels).toEqual({
                method: 'GET',
                path: '/users',
            });
        });
    });

    describe('Performance Tracking', () => {
        it('should track request duration', async () => {
            const startTime = Date.now();

            await new Promise(resolve => setTimeout(resolve, 100));

            const duration = Date.now() - startTime;
            monitoring.recordMetric('request.duration', duration, 'histogram');

            const metrics = monitoring.getMetrics();
            expect(metrics['request.duration'].value).toBeGreaterThanOrEqual(100);
        });

        it('should calculate percentiles', () => {
            // Record multiple values
            for (let i = 1; i <= 100; i++) {
                monitoring.recordMetric('response.time', i, 'histogram');
            }

            const stats = monitoring.getMetricStats('response.time');
            expect(stats.p50).toBeDefined();
            expect(stats.p95).toBeDefined();
            expect(stats.p99).toBeDefined();
        });
    });

    describe('Error Tracking', () => {
        it('should track error count', () => {
            monitoring.recordError('DatabaseError', 'Connection failed');
            monitoring.recordError('ValidationError', 'Invalid input');

            const errorStats = monitoring.getErrorStats();
            expect(errorStats.total).toBe(2);
        });

        it('should group errors by type', () => {
            monitoring.recordError('DatabaseError', 'Connection failed');
            monitoring.recordError('DatabaseError', 'Query timeout');
            monitoring.recordError('ValidationError', 'Invalid input');

            const errorStats = monitoring.getErrorStats();
            expect(errorStats.byType['DatabaseError']).toBe(2);
            expect(errorStats.byType['ValidationError']).toBe(1);
        });
    });

    describe('Statistics', () => {
        it('should return monitoring statistics', () => {
            monitoring.recordMetric('api.requests', 100, 'counter');
            monitoring.recordMetric('response.time', 150, 'histogram');

            const stats = monitoring.getStats();

            expect(stats).toHaveProperty('metrics');
            expect(stats).toHaveProperty('spans');
            expect(stats).toHaveProperty('errors');
        });

        it('should reset statistics', () => {
            monitoring.recordMetric('api.requests', 100, 'counter');

            monitoring.reset();

            const metrics = monitoring.getMetrics();
            expect(Object.keys(metrics)).toHaveLength(0);
        });
    });

    describe('Health Status', () => {
        it('should report healthy status', () => {
            const health = monitoring.getHealth();

            expect(health.status).toBe('healthy');
            expect(health.uptime).toBeGreaterThan(0);
        });

        it('should report degraded with high error rate', () => {
            // Simulate high error rate
            for (let i = 0; i < 100; i++) {
                monitoring.recordError('Error', 'Test error');
            }

            const health = monitoring.getHealth();

            expect(health.status).toBe('degraded');
        });
    });
});
