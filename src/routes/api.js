/**
 * API Routes
 * Main API endpoint setup
 */

module.exports = function setupAPIRoutes(app, options = {}) {
    const {
        sessions = {},
        sessionCode = null,
        createSession = null,
        gameStateManager = null,
        io = null,
        findPlayerSocket = null,
        sessionManager = null
    } = options;

    // Enhanced health check endpoint for 99.99% uptime monitoring
    app.get('/api/health', async (req, res) => {
        try {
            const healthCheckService = require('../src/services/healthCheckService');
            const health = await healthCheckService.getHealth();
            
            // Return 503 if degraded, 200 if healthy
            const statusCode = health.status === 'healthy' ? 200 : 503;
            res.status(statusCode).json(health);
        } catch (err) {
            // If health check itself fails, return 503
            res.status(503).json({
                status: 'error',
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Liveness probe (for Kubernetes/Railway) - simple check
    app.get('/api/health/live', (req, res) => {
        res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
    });

    // Readiness probe - checks if ready to serve traffic
    app.get('/api/health/ready', async (req, res) => {
        try {
            const healthCheckService = require('../src/services/healthCheckService');
            const isReady = await healthCheckService.isHealthy();
            const statusCode = isReady ? 200 : 503;
            res.status(statusCode).json({ 
                ready: isReady, 
                timestamp: new Date().toISOString() 
            });
        } catch (err) {
            res.status(503).json({ 
                ready: false, 
                error: err.message,
                timestamp: new Date().toISOString() 
            });
        }
    });

    // Circuit breaker states endpoint
    app.get('/api/health/circuit-breakers', (req, res) => {
        try {
            const { circuitBreakerManager } = require('../services/circuitBreaker');
            const states = circuitBreakerManager.getAllStates();
            res.json({
                circuit_breakers: states,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Metrics endpoint
    app.get('/api/metrics', (req, res) => {
        try {
            const monitoringService = require('../services/monitoringService');
            const metrics = monitoringService.getMetrics();
            res.json(metrics);
        } catch (err) {
            res.status(500).json({
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Health summary endpoint
    app.get('/api/health/summary', (req, res) => {
        try {
            const monitoringService = require('../services/monitoringService');
            const summary = monitoringService.getHealthSummary();
            const statusCode = summary.healthy ? 200 : 503;
            res.status(statusCode).json(summary);
        } catch (err) {
            res.status(500).json({
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Session endpoints
    if (createSession) {
        app.post('/api/sessions', (req, res) => {
            try {
                const session = createSession();
                res.json({ sessionCode: session.code, session });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
    }

    // Get session by code
    app.get('/api/sessions/:code', (req, res) => {
        const { code } = req.params;
        const session = sessions[code];
        if (session) {
            res.json(session);
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    });

    // Game state endpoints
    if (gameStateManager) {
        app.get('/api/game-state/:sessionCode', (req, res) => {
            const { sessionCode } = req.params;
            const state = gameStateManager.getState(sessionCode);
            if (state) {
                res.json(state);
            } else {
                res.status(404).json({ error: 'Game state not found' });
            }
        });

        app.post('/api/game-state/:sessionCode', (req, res) => {
            const { sessionCode } = req.params;
            try {
                gameStateManager.setState(sessionCode, req.body);
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
    }

    // Player socket lookup
    if (findPlayerSocket) {
        app.get('/api/player-socket/:playerId', (req, res) => {
            const { playerId } = req.params;
            const socket = findPlayerSocket(playerId);
            if (socket) {
                res.json({ connected: true, socketId: socket.id });
            } else {
                res.json({ connected: false });
            }
        });
    }

    // Supabase config endpoint
    app.get('/api/supabase/config', (req, res) => {
        try {
            const config = {
                url: process.env.SUPABASE_URL || '',
                anonKey: process.env.SUPABASE_ANON_KEY || '',
                SUPABASE_URL: process.env.SUPABASE_URL || '',
                SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
            };
            res.json(config);
        } catch (err) {
            res.status(500).json({ error: 'Failed to load Supabase config' });
        }
    });

    // A/B testing active tests endpoint
    app.get('/api/ab-testing/active', (req, res) => {
        try {
            // Return empty array if A/B testing is not implemented
            res.json([]);
        } catch (err) {
            res.status(500).json({ error: 'Failed to load A/B tests' });
        }
    });

    // Code Roach API routes
    try {
        const codeRoachAPI = require('./codeRoachAPI');
        app.use('/api/code-roach', codeRoachAPI);
        console.log('✅ Code Roach API routes registered');
    } catch (err) {
        console.warn('⚠️ Code Roach API routes not available:', err.message);
    }

    // Code Roach API routes
    try {
        const codeRoachAPI = require('./codeRoachAPI');
        app.use('/api/code-roach', codeRoachAPI);
        console.log('✅ Code Roach API routes registered');
    } catch (err) {
        console.warn('⚠️ Code Roach API routes not available:', err.message);
    }

    // Autonomous Mode API routes
    try {
        const autonomousModeAPI = require('./autonomousModeAPI');
        app.use('/api/autonomous', autonomousModeAPI);
        console.log('✅ Autonomous Mode API routes registered');
    } catch (err) {
        console.warn('⚠️ Autonomous Mode API routes not available:', err.message);
    }

    // Legacy Code Roach routes (keep for backwards compatibility)
    try {
        const codebaseCrawler = require('../services/codebaseCrawler');
        const log = console;

        // Start crawl (non-blocking - starts in background)
        app.post('/api/code-roach/crawl', async (req, res) => {
            try {
                // Check if already running
                const status = await codebaseCrawler.getStatus();
                if (status.isRunning) {
                    return res.json({ 
                        success: true, 
                        message: 'Crawl already in progress',
                        status: status
                    });
                }
                
                // Start crawl in background (don't await)
                const options = req.body.options || {};
                codebaseCrawler.crawlCodebase(options).catch(err => {
                    log.error('Background crawl error:', err);
                });
                
                // Return immediately
                res.json({ 
                    success: true, 
                    message: 'Crawl started in background',
                    status: await codebaseCrawler.getStatus()
                });
            } catch (err) {
                log.error('Crawl start error:', err);
                res.status(500).json({ error: err.message });
            }
        });

        // Get crawl status
        app.get('/api/code-roach/crawl/status', async (req, res) => {
            try {
                const status = await codebaseCrawler.getStatus();
                res.json(status);
            } catch (err) {
                log.error('Status error:', err);
                res.status(500).json({ error: err.message });
            }
        });

        // Parallel crawl endpoints
        try {
            const parallelCrawlManager = require('../services/parallelCrawlManager');
            
            app.post('/api/code-roach/crawl/parallel', async (req, res) => {
                try {
                    const { numCrawls = 3, options = {} } = req.body;
                    const crawlIds = await parallelCrawlManager.startParallelCrawls(numCrawls, options);
                    res.json({ success: true, crawlIds });
                } catch (err) {
                    log.error('Parallel crawl error:', err);
                    res.status(500).json({ error: err.message });
                }
            });

            app.get('/api/code-roach/crawl/parallel/status', (req, res) => {
                try {
                    const status = parallelCrawlManager.getStatus();
                    res.json(status);
                } catch (err) {
                    log.error('Parallel crawl status error:', err);
                    res.status(500).json({ error: err.message });
                }
            });
        } catch (err) {
            // Parallel crawl manager not available - skip
        }

        // Extreme issue router status
        try {
            const extremeIssueRouter = require('../services/extremeIssueRouter');
            
            app.get('/api/code-roach/extreme-issues/status', (req, res) => {
                try {
                    const status = extremeIssueRouter.getStatus();
                    res.json(status);
                } catch (err) {
                    log.error('Extreme issue router status error:', err);
                    res.status(500).json({ error: err.message });
                }
            });
        } catch (err) {
            // Extreme issue router not available - skip
        }

        // Analytics endpoints
        try {
            const codeRoachAnalytics = require('../services/codeRoachAnalytics');
            
            app.get('/api/code-roach/analytics', (req, res) => {
                try {
                    const analytics = codeRoachAnalytics.getAnalytics();
                    res.json(analytics);
                } catch (err) {
                    log.error('Analytics error:', err);
                    res.status(500).json({ error: err.message });
                }
            });

            app.get('/api/code-roach/analytics/trends', async (req, res) => {
                try {
                    const trends = await codeRoachAnalytics.getTrends();
                    res.json(trends);
                } catch (err) {
                    log.error('Trends error:', err);
                    res.status(500).json({ error: err.message });
                }
            });

            app.get('/api/code-roach/analytics/insights', async (req, res) => {
                try {
                    const insights = await codeRoachAnalytics.getInsights();
                    res.json(insights);
                } catch (err) {
                    log.error('Insights error:', err);
                    res.status(500).json({ error: err.message });
                }
            });
        } catch (err) {
            // Analytics not available - skip
        }

        console.log('✅ Code Roach API routes registered');
    } catch (err) {
        console.log('⚠️  Code Roach routes not available:', err.message);
    }

    // Dashboard compatibility endpoints (at root level)
    app.get('/api/error-history/stats', (req, res) => {
        res.json({
            totalErrors: 0,
            errorsByType: {},
            recentErrors: [],
            errorTrends: []
        });
    });
    
    app.get('/api/error-history/patterns', (req, res) => {
        res.json({
            patterns: [],
            topPatterns: []
        });
    });
    
    app.get('/api/fix-learning/stats', (req, res) => {
        res.json({
            totalFixes: 0,
            successfulFixes: 0,
            failedFixes: 0,
            fixRate: 0,
            learningPatterns: []
        });
    });

    // GitHub webhooks (for Code Roach)
    try {
        const githubWebhooks = require('./githubWebhooks');
        app.use('/api/github', githubWebhooks);
        console.log('✅ GitHub webhook routes registered');
    } catch (err) {
        console.warn('⚠️ GitHub webhook routes not available:', err.message);
    }

    console.log('✅ API routes registered');
};