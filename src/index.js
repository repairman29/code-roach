/**
 * Code Roach Standalone Server
 * Main entry point for Code Roach API server
 */

const express = require('express');
const http = require('http');
const path = require('path');

// Load configuration
const config = require('./config');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Health check endpoints (required for Railway)
try {
    const healthCheckService = require('./services/healthCheckService');
    
    // Liveness probe
    app.get('/api/health/live', (req, res) => {
        res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
    });
    
    // Readiness probe
    app.get('/api/health/ready', async (req, res) => {
        try {
            const isHealthy = await healthCheckService.isHealthy();
            if (isHealthy) {
                res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
            } else {
                res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
            }
        } catch (err) {
            res.status(503).json({ status: 'error', error: err.message });
        }
    });
    
    // Full health check
    app.get('/api/health', async (req, res) => {
        try {
            const health = await healthCheckService.getHealth();
            const statusCode = health.status === 'healthy' ? 200 : 503;
            res.status(statusCode).json(health);
        } catch (err) {
            res.status(503).json({ status: 'error', error: err.message });
        }
    });
    
    // Circuit breakers
    app.get('/api/health/circuit-breakers', (req, res) => {
        try {
            const { circuitBreakerManager } = require('./services/circuitBreaker');
            const states = circuitBreakerManager.getAllStates();
            res.json({ circuit_breakers: states });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    
    // Metrics
    app.get('/api/metrics', (req, res) => {
        try {
            const monitoringService = require('./services/monitoringService');
            const metrics = monitoringService.getMetrics();
            res.json(metrics);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    
    // Health summary
    app.get('/api/health/summary', (req, res) => {
        try {
            const monitoringService = require('./services/monitoringService');
            const summary = monitoringService.getHealthSummary();
            res.json(summary);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
} catch (err) {
    console.warn('⚠️ Health check service not available, using basic endpoints:', err.message);
    
    // Basic health endpoints if service not available
    app.get('/api/health/live', (req, res) => {
        res.status(200).json({ status: 'alive' });
    });
    
    app.get('/api/health/ready', (req, res) => {
        res.status(200).json({ status: 'ready' });
    });
    
    app.get('/api/health', (req, res) => {
        res.status(200).json({ status: 'healthy' });
    });
}

// API Routes
try {
    // Code Roach API routes - check if it's a function or router
    const apiRoutes = require('./routes/api');
    if (typeof apiRoutes === 'function') {
        // It's a setup function, call it with app
        apiRoutes(app, {});
        console.log('✅ Code Roach API routes loaded (function)');
    } else {
        // It's a router, use it directly
        app.use('/api', apiRoutes);
        console.log('✅ Code Roach API routes loaded (router)');
    }
    
    // Code Roach specific routes
    try {
        const codeRoachRoutes = require('./routes/codeRoachAPI');
        app.use('/api/code-roach', codeRoachRoutes);
        console.log('✅ Code Roach specific routes loaded');
    } catch (err) {
        console.warn('⚠️ Code Roach specific routes not available:', err.message);
    }
} catch (err) {
    console.warn('⚠️ Code Roach API routes not available:', err.message);
    console.error('Error details:', err);
}

// Serve static files (if public directory exists)
try {
    const publicPath = path.join(__dirname, '..', 'public');
    app.use(express.static(publicPath));
    console.log('✅ Static files served from:', publicPath);
} catch (err) {
    console.warn('⚠️ Static files not available:', err.message);
}

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Code Roach',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/api/health',
            api: '/api',
            codeRoach: '/api/code-roach'
        }
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        status: 'error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Start server
const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    const deploymentId = process.env.RAILWAY_DEPLOYMENT_ID || 'local';
    
    console.log(`
╔═══════════════════════════════════════╗
║         CODE ROACH API SERVER         ║
║                                       ║
║  Server running on port ${PORT}        ║
${isRailway ? `║  Platform: Railway.app              ║\n║  Deployment: ${deploymentId.substring(0, 8)}...      ║` : '║  Platform: Local Development        ║'}
║                                       ║
║  Health: http://localhost:${PORT}/api/health ║
║  API: http://localhost:${PORT}/api    ║
╚═══════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = app;
