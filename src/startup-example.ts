/**
 * Application Startup with Service Initialization
 * 
 * This file demonstrates how to properly initialize services before starting the Express server.
 * Copy this pattern to your main index.ts or server.ts file.
 */

import express from 'express';
import { ServiceInitializer } from './core/service-initializer';

async function startApplication() {
    console.log('[Startup] Initializing Tenet Framework...');

    // Initialize all services
    const initResult = await ServiceInitializer.initialize();

    if (!initResult.success) {
        console.error('[Startup] Service initialization completed with errors:');
        initResult.errors.forEach(({ service, error }) => {
            console.error(`  - ${service}: ${error.message}`);
        });

        // Check if critical services failed
        const criticalFailure = initResult.errors.some(e => e.service === 'AuthManager');
        if (criticalFailure) {
            console.error('[Startup] Critical service failed. Exiting...');
            process.exit(1);
        }

        console.warn('[Startup] Continuing with fallback services...');
    } else {
        console.log('[Startup] All services initialized successfully ✓');
    }

    // Create Express app
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Your routes here
    // app.use('/api', routes);

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: initResult.success ? 'all operational' : 'degraded mode',
        });
    });

    // Start server
    const server = app.listen(PORT, () => {
        console.log(`[Startup] Server running on port ${PORT}`);
        console.log(`[Startup] Health check: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
        console.log(`\n[Shutdown] Received ${signal}, starting graceful shutdown...`);

        // Stop accepting new connections
        server.close(() => {
            console.log('[Shutdown] HTTP server closed');
        });

        // Shutdown services
        await ServiceInitializer.shutdown();

        console.log('[Shutdown] Graceful shutdown complete');
        process.exit(0);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

// Start the application
startApplication().catch((error) => {
    console.error('[Startup] Fatal error during startup:', error);
    process.exit(1);
});
