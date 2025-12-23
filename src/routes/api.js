/**
 * API Routes
 * Main API endpoint setup
 */

const SessionPersistence = require('../sessionPersistence');

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

    // Get current authenticated user (Supabase Auth) - REGISTER FIRST to avoid route conflicts
    // This endpoint works with or without a token (returns authenticated: false if no token)
    app.get('/api/auth/me', async (req, res) => {
        console.log('[API] /api/auth/me endpoint hit');
        try {
            // Get token from Authorization header
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                // No token provided - return unauthenticated
                return res.json({ authenticated: false });
            }

            const token = authHeader.replace('Bearer ', '').trim();
            
            if (!token) {
                return res.json({ authenticated: false });
            }
            
            // Verify Supabase token
            const { createClient } = require('@supabase/supabase-js');
            const config = require('../config');
            
            if (!config.supabase?.url || !config.supabase?.anonKey) {
                return res.json({ authenticated: false });
            }
            
            const supabase = createClient(config.supabase.url, config.supabase.anonKey);
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error || !user) {
                return res.json({ authenticated: false });
            }
            
            return res.json({
                authenticated: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
                    provider: 'supabase'
                }
            });
        } catch (err) {
            console.error('[API] Auth check error:', err);
            return res.json({ authenticated: false });
        }
    });

    // API Gateway - System Architecture Expert - 2025-01-15
    // Register routes with API Gateway
    let apiGateway = null;
    let serviceRegistryAPI = null;
    try {
        apiGateway = require('../services/apiGateway');
        serviceRegistryAPI = require('../services/serviceRegistryAPI');
        
        // Register Service Registry API routes with API Gateway
        apiGateway.registerRoute(
            '/api/services',
            'serviceRegistryAPI',
            'listAll',
            {
                requireAuth: false,
                rateLimit: 120, // 120 requests per minute
                cacheTTL: 30, // Cache for 30 seconds
                description: 'List all registered services'
            }
        );
        
        apiGateway.registerRoute(
            '/api/services/dependencies',
            'serviceRegistryAPI',
            'getDependencyGraph',
            {
                requireAuth: false,
                rateLimit: 60, // 60 requests per minute
                cacheTTL: 60, // Cache for 60 seconds (dependency graph changes less frequently)
                description: 'Get complete service dependency graph'
            }
        );
        
        apiGateway.registerRoute(
            '/api/services/discover/:capability',
            'serviceRegistryAPI',
            'discoverByCapability',
            {
                requireAuth: false,
                rateLimit: 120,
                cacheTTL: 30,
                description: 'Discover services by capability'
            }
        );
        
        apiGateway.registerRoute(
            '/api/services/dependencies/:serviceName',
            'serviceRegistryAPI',
            'getServiceDependenciesByParam',
            {
                requireAuth: false,
                rateLimit: 120,
                cacheTTL: 30,
                description: 'Get dependencies for a specific service'
            }
        );
        
        // Routes migrated to API Gateway - handlers added below
        
        // API Gateway routes endpoint
        app.get('/api/gateway/routes', (req, res) => {
            try {
                const routes = apiGateway.listRoutes();
                const stats = apiGateway.getStats();
                res.json({
                    routes,
                    stats,
                    timestamp: Date.now()
                });
            } catch (err) {
                res.status(500).json({
                    error: 'Failed to get gateway routes',
                    message: err.message
                });
            }
        });
        
        // API Gateway stats endpoint
        app.get('/api/gateway/stats', (req, res) => {
            try {
                const stats = apiGateway.getStats();
                res.json(stats);
            } catch (err) {
                res.status(500).json({
                    error: 'Failed to get gateway stats',
                    message: err.message
                });
            }
        });
    } catch (err) {
        console.warn('⚠️ API Gateway not available:', err.message);
    }

    // Performance & Cost Tracking API - Performance & Scale Expert
    try {
        const performanceRoutes = require('./apiPerformance');
        app.use('/api/performance', performanceRoutes);
    } catch (err) {
        console.warn('⚠️ Performance API routes not available:', err.message);
    }

    // Enhanced health check endpoint for 99.99% uptime monitoring
    app.get('/api/health', async (req, res) => {
        try {
            const healthCheckService = require('../services/healthCheckService');
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
    // Simplified to always return 200 - if server is running, it's ready
    // Full health checks are available at /api/health
    app.get('/api/health/ready', (req, res) => {
        // Immediately return 200 - server is ready if it can respond
        res.status(200).json({ 
            ready: true, 
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    });

    // Service Registry Health Monitoring - System Architecture Expert - 2025-01-15
    app.get('/api/services/health', async (req, res) => {
        try {
            const serviceRegistry = require('../services/serviceRegistry');
            const eventBus = require('../services/eventBus');
            const gameSystemsIntegration = require('../services/gameSystemsIntegration');
            const healthHistoryService = require('../services/healthHistoryService');
            
            const services = serviceRegistry.listAll();
            const registryStats = serviceRegistry.getStats();
            const eventBusStats = eventBus.getStats();
            const integrationStats = gameSystemsIntegration.getStats();
            
            // Calculate overall health
            const healthyServices = services.filter(s => 
                s.health.status === 'healthy' || s.health.status === 'degraded'
            ).length;
            const totalServices = services.length;
            const healthPercentage = totalServices > 0 ? (healthyServices / totalServices) * 100 : 100;
            
            const overallHealth = healthPercentage >= 80 ? 'healthy' : 
                                 healthPercentage >= 50 ? 'degraded' : 'unhealthy';
            
            const healthData = {
                status: overallHealth,
                healthPercentage: Math.round(healthPercentage),
                services: {
                    total: totalServices,
                    healthy: healthyServices,
                    degraded: services.filter(s => s.health.status === 'degraded').length,
                    unhealthy: services.filter(s => s.health.status === 'unhealthy').length,
                    unknown: services.filter(s => s.health.status === 'unknown').length
                },
                registry: registryStats,
                eventBus: eventBusStats,
                gameSystems: integrationStats,
                timestamp: new Date().toISOString(),
                serviceDetails: services.map(s => ({
                    name: s.name,
                    health: s.health
                }))
            };
            
            // Record health snapshot for history
            try {
                await healthHistoryService.recordHealth(healthData);
            } catch (err) {
                // History recording is optional, don't fail the request
                console.warn('[Health API] Failed to record health history:', err.message);
            }
            
            res.json(healthData);
        } catch (err) {
            res.status(500).json({
                status: 'error',
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Health History API - System Architecture Expert - 2025-01-15
    app.get('/api/services/health/history', async (req, res) => {
        try {
            const healthHistoryService = require('../services/healthHistoryService');
            const hours = parseInt(req.query.hours) || 24;
            const limit = parseInt(req.query.limit) || 1000;
            
            const history = await healthHistoryService.getHistory({ hours, limit });
            const statistics = await healthHistoryService.getStatistics({ hours });
            const trends = await healthHistoryService.getTrends({ hours });
            
            res.json({
                history,
                statistics,
                trends,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                error: 'Failed to get health history',
                message: err.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Service Registry List - System Architecture Expert - 2025-01-15
    app.get('/api/services', (req, res) => {
        try {
            const serviceRegistry = require('../services/serviceRegistry');
            const services = serviceRegistry.listAll();
            
            res.json({
                services: services,
                count: services.length,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
                error: err.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Service Dependency Graph - Migrated to API Gateway - System Architecture Expert - 2025-01-15
    if (apiGateway) {
        app.get('/api/services/dependencies', (req, res) => {
            apiGateway.handleRequest(req, res, '/api/services/dependencies');
        });
    } else {
        // Fallback if API Gateway not available
        app.get('/api/services/dependencies', (req, res) => {
        try {
            const serviceRegistry = require('../services/serviceRegistry');
            const services = serviceRegistry.listAll();
            
            // Build dependency graph
            const graph = {
                nodes: services.map(s => ({
                    id: s.name,
                    label: s.name,
                    category: s.category || 'general',
                    version: s.version,
                    capabilities: s.capabilities || [],
                    health: s.health.status,
                    metadata: {
                        description: s.description,
                        registeredAt: s.registeredAt
                    }
                })),
                edges: [],
                metadata: {
                    totalServices: services.length,
                    totalDependencies: 0,
                    timestamp: Date.now()
                }
            };
            
            // Add edges for dependencies
            services.forEach(service => {
                const dependencies = serviceRegistry.getDependencies(service.name);
                dependencies.forEach(dep => {
                    graph.edges.push({
                        from: service.name,
                        to: dep,
                        type: 'depends-on',
                        label: 'depends on'
                    });
                    graph.metadata.totalDependencies++;
                });
            });
            
            res.json(graph);
        } catch (err) {
            console.error('[API] Error getting dependency graph:', err);
            res.status(500).json({
                error: 'Failed to get dependency graph',
                message: err.message
            });
        }
    });

    // Service Dependencies for Specific Service - System Architecture Expert - 2025-01-15
    app.get('/api/services/dependencies/:serviceName', (req, res) => {
        try {
            const serviceRegistry = require('../services/serviceRegistry');
            const serviceName = req.params.serviceName;
            
            const dependencies = serviceRegistry.getDependencies(serviceName);
            const dependents = serviceRegistry.getDependents(serviceName);
            const metadata = serviceRegistry.getMetadata(serviceName);
            
            if (!metadata) {
                return res.status(404).json({
                    error: 'Service not found',
                    serviceName
                });
            }
            
            // Get full dependency tree (recursive)
            const getDependencyTree = (name, visited = new Set()) => {
                if (visited.has(name)) return []; // Avoid cycles
                visited.add(name);
                
                const deps = serviceRegistry.getDependencies(name);
                const tree = [];
                
                deps.forEach(dep => {
                    tree.push({
                        name: dep,
                        metadata: serviceRegistry.getMetadata(dep),
                        health: serviceRegistry.getHealth(dep),
                        dependencies: getDependencyTree(dep, visited)
                    });
                });
                
                return tree;
            };
            
            res.json({
                service: {
                    name: serviceName,
                    metadata,
                    health: serviceRegistry.getHealth(serviceName)
                },
                dependencies: dependencies.map(dep => ({
                    name: dep,
                    metadata: serviceRegistry.getMetadata(dep),
                    health: serviceRegistry.getHealth(dep)
                })),
                dependents: dependents.map(dep => ({
                    name: dep,
                    metadata: serviceRegistry.getMetadata(dep),
                    health: serviceRegistry.getHealth(dep)
                })),
                dependencyTree: getDependencyTree(serviceName),
                timestamp: Date.now()
            });
        } catch (err) {
            console.error('[API] Error getting service dependencies:', err);
            res.status(500).json({
                error: 'Failed to get service dependencies',
                message: err.message
            });
        }
        });
    }

    // Service Discovery by Capability - Migrated to API Gateway - System Architecture Expert - 2025-01-15
    if (apiGateway) {
        app.get('/api/services/discover/:capability', (req, res) => {
            apiGateway.handleRequest(req, res, '/api/services/discover/:capability');
        });
    } else {
        // Fallback if API Gateway not available
        app.get('/api/services/discover/:capability', (req, res) => {
        try {
            const serviceRegistry = require('../services/serviceRegistry');
            const capability = req.params.capability;
            const services = serviceRegistry.discoverWithMetadata(capability);
            
            res.json({
                capability,
                services: services,
                count: services.length,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            res.status(500).json({
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
                // SECURITY: Use standardized error handling to prevent information disclosure
                const { formatErrorResponse } = require('../utils/errors');
                const errorResponse = formatErrorResponse(err);
                res.status(errorResponse.statusCode).json(errorResponse);
            }
        });
    }

    // Get session by code
    // SECURITY: Session codes are public identifiers, but we should validate access
    app.get('/api/sessions/:code', (req, res) => {
        const { code } = req.params;
        
        // SECURITY: Validate session code format (prevent injection)
        if (!code || typeof code !== 'string' || code.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(code)) {
            return res.status(400).json({ error: 'Invalid session code format' });
        }
        
        const session = sessions[code];
        if (session) {
            // SECURITY: Don't expose sensitive session data
            const publicSession = {
                code: session.code,
                status: session.status,
                playerCount: session.playerCount || 0,
                maxPlayers: session.maxPlayers || 0,
                scenario: session.scenario,
                // Exclude sensitive data like tokens, passwords, etc.
            };
            res.json(publicSession);
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    });

    // Save session
    app.post('/api/sessions/:sessionCode/save', async (req, res) => {
        try {
            const { sessionCode } = req.params;
            const session = sessions[sessionCode];
            
            if (!session) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Session not found' 
                });
            }

            // Use SessionPersistence to save
            const result = await SessionPersistence.saveSession(session);
            
            if (result.success) {
                res.json({ success: true, sessionCode: result.sessionCode });
            } else {
                res.status(500).json({ 
                    success: false, 
                    error: result.error || 'Failed to save session' 
                });
            }
        } catch (err) {
            console.error('Error saving session:', err);
            res.status(500).json({ 
                success: false, 
                error: err.message || 'Internal server error' 
            });
        }
    });

    // Load session
    app.post('/api/sessions/:sessionCode/load', async (req, res) => {
        try {
            const { sessionCode } = req.params;
            
            // Use SessionPersistence to load
            const result = await SessionPersistence.loadSession(sessionCode);
            
            if (result.success && result.data) {
                // Restore session to memory
                sessions[sessionCode] = result.data;
                
                res.json({ 
                    success: true, 
                    session: result.data 
                });
            } else {
                res.status(404).json({ 
                    success: false, 
                    error: result.error || 'Session not found' 
                });
            }
        } catch (err) {
            console.error('Error loading session:', err);
            res.status(500).json({ 
                success: false, 
                error: err.message || 'Internal server error' 
            });
        }
    });

    // List saved sessions
    app.get('/api/sessions/saved', async (req, res) => {
        try {
            const savedSessions = await SessionPersistence.listSavedSessions();
            res.json({ 
                success: true, 
                sessions: savedSessions 
            });
        } catch (err) {
            console.error('Error listing saved sessions:', err);
            res.status(500).json({ 
                success: false, 
                error: err.message || 'Internal server error' 
            });
        }
    });

    // Async Mode API endpoints
    // Enable/disable async mode for a session
    app.post('/api/sessions/:sessionCode/async-mode', (req, res) => {
        try {
            const { sessionCode } = req.params;
            const { enabled, turnOrder } = req.body;
            const session = sessions[sessionCode];
            
            if (!session) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Session not found' 
                });
            }

            // Initialize async mode if not exists
            if (!session.asyncMode) {
                session.asyncMode = {
                    enabled: false,
                    turnOrder: [],
                    currentTurn: 0,
                    pendingActions: {}
                };
            }

            // Update async mode
            session.asyncMode.enabled = enabled === true;
            if (turnOrder && Array.isArray(turnOrder)) {
                session.asyncMode.turnOrder = turnOrder;
            }

            res.json({ 
                success: true, 
                asyncMode: session.asyncMode.enabled 
            });
        } catch (err) {
            console.error('Error setting async mode:', err);
            res.status(500).json({ 
                success: false, 
                error: err.message || 'Internal server error' 
            });
        }
    });

    // Get async mode status
    app.get('/api/sessions/:sessionCode/async-mode', (req, res) => {
        try {
            const { sessionCode } = req.params;
            const session = sessions[sessionCode];
            
            if (!session) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Session not found' 
                });
            }

            const asyncMode = session.asyncMode || { enabled: false };
            res.json({ 
                success: true, 
                asyncMode: asyncMode.enabled 
            });
        } catch (err) {
            console.error('Error getting async mode:', err);
            res.status(500).json({ 
                success: false, 
                error: err.message || 'Internal server error' 
            });
        }
    });

    // Submit async action
    app.post('/api/sessions/:sessionCode/async-action', (req, res) => {
        try {
            const { sessionCode } = req.params;
            const { playerId, action } = req.body;
            const session = sessions[sessionCode];
            
            if (!session) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Session not found' 
                });
            }

            if (!session.asyncMode || !session.asyncMode.enabled) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Async mode is not enabled for this session' 
                });
            }

            const { turnOrder, currentTurn, pendingActions } = session.asyncMode;
            const currentPlayerId = turnOrder[currentTurn];

            // Check if it's this player's turn
            if (playerId !== currentPlayerId) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Not your turn. Current turn: ${currentPlayerId || 'none'}` 
                });
            }

            // Store pending action
            if (!pendingActions[playerId]) {
                pendingActions[playerId] = [];
            }
            pendingActions[playerId].push(action);

            // Advance turn (simple round-robin)
            session.asyncMode.currentTurn = (currentTurn + 1) % turnOrder.length;

            res.json({ 
                success: true, 
                message: 'Action queued',
                nextTurn: turnOrder[session.asyncMode.currentTurn]
            });
        } catch (err) {
            console.error('Error submitting async action:', err);
            res.status(500).json({ 
                success: false, 
                error: err.message || 'Internal server error' 
            });
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
                // SECURITY: Use standardized error handling to prevent information disclosure
                const { formatErrorResponse } = require('../utils/errors');
                const errorResponse = formatErrorResponse(err);
                res.status(errorResponse.statusCode).json(errorResponse);
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
}

    // ============================================
    // ENGAGEMENT ANALYTICS (Sprint 2)
    // ============================================
    
    // In-memory engagement metrics storage (for aggregation)
    const engagementMetrics = {
        reports: [],
        aggregated: {
            totalSessions: 0,
            avgScore: 0,
            avgDuration: 0,
            totalActions: 0,
            avgAPM: 0
        }
    };
    
    // POST endpoint for receiving engagement reports
    app.post('/api/analytics/engagement', (req, res) => {
        try {
            const report = req.body;
            
            // Validate basic structure
            if (!report || typeof report.score !== 'number') {
                return res.status(400).json({ error: 'Invalid report format' });
            }
            
            // Add timestamp if not present
            if (!report.timestamp) {
                report.timestamp = Date.now();
            }
            
            // Store report (keep last 1000)
            engagementMetrics.reports.push(report);
            if (engagementMetrics.reports.length > 1000) {
                engagementMetrics.reports.shift();
            }
            
            // Update aggregated metrics
            const agg = engagementMetrics.aggregated;
            agg.totalSessions++;
            agg.avgScore = ((agg.avgScore * (agg.totalSessions - 1)) + report.score) / agg.totalSessions;
            agg.avgDuration = ((agg.avgDuration * (agg.totalSessions - 1)) + (report.sessionDuration || 0)) / agg.totalSessions;
            agg.totalActions += report.totalActions || 0;
            if (report.actionsPerMinute) {
                agg.avgAPM = ((agg.avgAPM * (agg.totalSessions - 1)) + report.actionsPerMinute) / agg.totalSessions;
            }
            
            res.json({ success: true, sessionCount: agg.totalSessions });
        } catch (err) {
            console.error('Engagement analytics error:', err);
            res.status(500).json({ error: err.message });
        }
    });
    
    // GET endpoint for retrieving aggregated engagement metrics (admin only)
    app.get('/api/analytics/engagement', (req, res) => {
        try {
            // Calculate recent metrics (last hour)
            const oneHourAgo = Date.now() - 3600000;
            const recentReports = engagementMetrics.reports.filter(r => r.timestamp >= oneHourAgo);
            
            const recent = {
                count: recentReports.length,
                avgScore: recentReports.length > 0 
                    ? recentReports.reduce((sum, r) => sum + r.score, 0) / recentReports.length 
                    : 0,
                avgAPM: recentReports.length > 0 
                    ? recentReports.reduce((sum, r) => sum + (r.actionsPerMinute || 0), 0) / recentReports.length 
                    : 0
            };
            
            res.json({
                aggregated: engagementMetrics.aggregated,
                recent,
                target: 7.0,
                atTarget: recent.avgScore >= 7.0
            });
        } catch (err) {
            console.error('Engagement analytics error:', err);
            res.status(500).json({ error: err.message });
        }
    });

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

    // Hybrid Storage API - Database & Data Architecture Expert - 2025-01-15
    try {
        const hybridStorageService = require('../services/hybridStorageService');
        
        app.post('/api/storage/save', async (req, res) => {
            try {
                const { key, data, userId } = req.body;
                if (!key || !data || !userId) {
                    return res.status(400).json({ error: 'Missing required fields: key, data, userId' });
                }
                
                await hybridStorageService.saveToSupabase(key, data, userId);
                res.json({ success: true });
            } catch (err) {
                log.error('Storage save error:', err);
                res.status(500).json({ error: err.message });
            }
        });

        app.get('/api/storage/load', async (req, res) => {
            try {
                const { key, userId } = req.query;
                if (!key || !userId) {
                    return res.status(400).json({ error: 'Missing required fields: key, userId' });
                }
                
                const data = await hybridStorageService.loadFromSupabase(key, userId);
                res.json({ data });
            } catch (err) {
                log.error('Storage load error:', err);
                res.status(500).json({ error: err.message });
            }
        });

        app.get('/api/storage/sync', async (req, res) => {
            try {
                const { key, userId } = req.query;
                if (!key || !userId) {
                    return res.status(400).json({ error: 'Missing required fields: key, userId' });
                }
                
                const localData = req.query.localData ? JSON.parse(req.query.localData) : null;
                const supabaseData = await hybridStorageService.loadFromSupabase(key, userId);
                
                if (!supabaseData) {
                    return res.json({ data: localData, isNewer: false });
                }
                
                // Compare timestamps
                const localTimestamp = localData?.updated_at || localData?.timestamp || 0;
                const supabaseTimestamp = supabaseData?.updated_at || supabaseData?.timestamp || 0;
                const isNewer = supabaseTimestamp > localTimestamp;
                
                res.json({ 
                    data: isNewer ? supabaseData : localData, 
                    isNewer 
                });
            } catch (err) {
                log.error('Storage sync error:', err);
                res.status(500).json({ error: err.message });
            }
        });

        app.post('/api/storage/remove', async (req, res) => {
            try {
                const { key, userId } = req.body;
                if (!key || !userId) {
                    return res.status(400).json({ error: 'Missing required fields: key, userId' });
                }
                
                // Remove from Supabase (implementation depends on table structure)
                res.json({ success: true });
            } catch (err) {
                log.error('Storage remove error:', err);
                res.status(500).json({ error: err.message });
            }
        });

        console.log('✅ Hybrid Storage API routes registered');
    } catch (err) {
        console.warn('⚠️ Hybrid Storage routes not available:', err.message);
    }

    // AI/ML Lead - AI GM Metrics API
    try {
        const aiGMMetricsService = require('../services/aiGMMetricsService');
        
        app.get('/api/ai-gm/metrics', async (req, res) => {
            try {
                const metrics = aiGMMetricsService.getMetrics();
                res.json({
                    success: true,
                    data: metrics
                });
            } catch (err) {
                log.error('AI GM metrics error:', err);
                res.status(500).json({ error: err.message });
            }
        });
        
        app.get('/api/ai-gm/metrics/period', async (req, res) => {
            try {
                const startTime = req.query.start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Default: last 24 hours
                const endTime = req.query.end || new Date().toISOString();
                
                const metrics = await aiGMMetricsService.getMetricsForPeriod(startTime, endTime);
                res.json({
                    success: true,
                    data: metrics,
                    period: { start: startTime, end: endTime }
                });
            } catch (err) {
                log.error('AI GM metrics period error:', err);
                res.status(500).json({ error: err.message });
            }
        });
        
        console.log('✅ AI GM Metrics API routes registered');
    } catch (err) {
        console.warn('⚠️ AI GM Metrics routes not available:', err.message);
    }

    // AI GM Explainability API Endpoints - HEAD OF AI - Short-Term Enhancements
    try {
        const aiGMExplainabilityService = require('../services/aiGMExplainabilityService');
        
        // Get explanation for specific response ID
        app.get('/api/ai-gm/explain/:responseId', async (req, res) => {
            try {
                const { responseId } = req.params;
                const explanation = aiGMExplainabilityService.getExplanation(responseId);
                
                if (!explanation) {
                    return res.status(404).json({
                        success: false,
                        error: 'Explanation not found for response ID'
                    });
                }
                
                res.json({
                    success: true,
                    data: explanation
                });
            } catch (err) {
                log.error('AI GM explain error:', err);
                res.status(500).json({ error: err.message });
            }
        });
        
        // Get explanation for most recent response
        app.get('/api/ai-gm/explain/latest', async (req, res) => {
            try {
                // Get latest explanation from cache (most recent timestamp)
                const explanations = aiGMExplainabilityService.getAllExplanations();
                
                if (!explanations || explanations.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'No explanations available'
                    });
                }
                
                // Sort by timestamp (most recent first)
                const sorted = explanations.sort((a, b) => 
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
                
                res.json({
                    success: true,
                    data: sorted[0],
                    totalAvailable: explanations.length,
                    timestamp: sorted[0].timestamp
                });
            } catch (err) {
                log.error('AI GM explain latest error:', err);
                res.status(500).json({ error: err.message });
            }
        });
        
        console.log('✅ AI GM Explainability API routes registered');
    } catch (err) {
        console.warn('⚠️ AI GM Explainability routes not available:', err.message);
    }

    // AI GM Calibration API Endpoint - HEAD OF AI - Short-Term Enhancements
    try {
        const aiGMConfidenceCalibrationService = require('../services/aiGMConfidenceCalibrationService');
        
        // Get calibration dashboard data
        app.get('/api/ai-gm/calibration', async (req, res) => {
            try {
                // Get all calibration data
                const allData = await aiGMConfidenceCalibrationService.queryCalibrationData(null, null);
                
                if (!allData || allData.length === 0) {
                    return res.json({
                        success: true,
                        data: {
                            totalPredictions: 0,
                            calibrationAccuracy: 0,
                            overconfident: 0,
                            underconfident: 0,
                            wellCalibrated: 0,
                            trend: 'stable',
                            scatterData: [],
                            calibrationCurve: [],
                            errorByBucket: [],
                            historicalTrend: []
                        }
                    });
                }
                
                // Calculate metrics
                const metrics = calculateCalibrationMetrics(allData);
                
                // Generate scatter plot data
                const scatterData = allData.map(d => ({
                    predicted: parseFloat(d.predicted_quality),
                    actual: parseFloat(d.actual_quality)
                }));
                
                // Generate calibration curve (bucketed)
                const calibrationCurve = generateCalibrationCurve(allData);
                
                // Generate error by bucket
                const errorByBucket = generateErrorByBucket(allData);
                
                // Generate historical trend (last 30 days)
                const historicalTrend = await generateHistoricalTrend(aiGMConfidenceCalibrationService);
                
                res.json({
                    success: true,
                    data: {
                        ...metrics,
                        scatterData: scatterData,
                        calibrationCurve: calibrationCurve,
                        errorByBucket: errorByBucket,
                        historicalTrend: historicalTrend
                    }
                });
            } catch (err) {
                log.error('AI GM calibration error:', err);
                res.status(500).json({ error: err.message });
            }
        });
        
        // Helper function to calculate calibration metrics
        function calculateCalibrationMetrics(data) {
            const total = data.length;
            let overconfident = 0;
            let underconfident = 0;
            let wellCalibrated = 0;
            let totalError = 0;
            
            data.forEach(d => {
                const predicted = parseFloat(d.predicted_quality);
                const actual = parseFloat(d.actual_quality);
                const error = Math.abs(predicted - actual);
                totalError += error;
                
                // Tolerance for "well calibrated" (±0.1)
                if (error <= 0.1) {
                    wellCalibrated++;
                } else if (predicted > actual) {
                    overconfident++;
                } else {
                    underconfident++;
                }
            });
            
            const avgError = totalError / total;
            const calibrationAccuracy = 1 - avgError; // Higher is better
            
            // Determine trend (simplified - would need historical data)
            const trend = 'stable';
            
            return {
                totalPredictions: total,
                calibrationAccuracy: Math.max(0, Math.min(1, calibrationAccuracy)),
                overconfident: overconfident,
                underconfident: underconfident,
                wellCalibrated: wellCalibrated,
                trend: trend
            };
        }
        
        // Helper function to generate calibration curve
        function generateCalibrationCurve(data) {
            const buckets = 10;
            const bucketSize = 1 / buckets;
            const curve = [];
            
            for (let i = 0; i < buckets; i++) {
                const min = i * bucketSize;
                const max = (i + 1) * bucketSize;
                
                const bucketData = data.filter(d => {
                    const pred = parseFloat(d.predicted_quality);
                    return pred >= min && pred < max;
                });
                
                if (bucketData.length > 0) {
                    const avgPredicted = bucketData.reduce((sum, d) => sum + parseFloat(d.predicted_quality), 0) / bucketData.length;
                    const avgActual = bucketData.reduce((sum, d) => sum + parseFloat(d.actual_quality), 0) / bucketData.length;
                    
                    curve.push({
                        bucket: `${(min * 100).toFixed(0)}-${(max * 100).toFixed(0)}%`,
                        predicted: avgPredicted,
                        actual: avgActual,
                        count: bucketData.length
                    });
                }
            }
            
            return curve;
        }
        
        // Helper function to generate error by bucket
        function generateErrorByBucket(data) {
            const buckets = 10;
            const bucketSize = 1 / buckets;
            const errors = [];
            
            for (let i = 0; i < buckets; i++) {
                const min = i * bucketSize;
                const max = (i + 1) * bucketSize;
                
                const bucketData = data.filter(d => {
                    const pred = parseFloat(d.predicted_quality);
                    return pred >= min && pred < max;
                });
                
                if (bucketData.length > 0) {
                    const avgError = bucketData.reduce((sum, d) => {
                        return sum + Math.abs(parseFloat(d.predicted_quality) - parseFloat(d.actual_quality));
                    }, 0) / bucketData.length;
                    
                    errors.push({
                        bucket: `${(min * 100).toFixed(0)}-${(max * 100).toFixed(0)}%`,
                        error: avgError,
                        count: bucketData.length
                    });
                }
            }
            
            return errors;
        }
        
        // Helper function to generate historical trend
        async function generateHistoricalTrend(service) {
            try {
                if (!service.supabase) {
                    return [];
                }
                
                // Get last 30 days of data grouped by date
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                
                const { data, error } = await service.supabase
                    .from('ai_gm_quality_learning')
                    .select('predicted_quality, actual_quality, created_at')
                    .not('predicted_quality', 'is', null)
                    .not('actual_quality', 'is', null)
                    .gte('created_at', thirtyDaysAgo.toISOString())
                    .order('created_at', { ascending: true });
                
                if (error || !data) return [];
                
                // Group by date and calculate daily accuracy
                const dailyData = {};
                data.forEach(d => {
                    const date = new Date(d.created_at).toISOString().split('T')[0];
                    if (!dailyData[date]) {
                        dailyData[date] = { predictions: [], errors: [] };
                    }
                    const error = Math.abs(parseFloat(d.predicted_quality) - parseFloat(d.actual_quality));
                    dailyData[date].errors.push(error);
                });
                
                return Object.keys(dailyData).sort().map(date => {
                    const errors = dailyData[date].errors;
                    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
                    return {
                        date: date,
                        accuracy: Math.max(0, Math.min(1, 1 - avgError))
                    };
                });
            } catch (err) {
                console.warn('[Calibration API] Error generating historical trend:', err);
                return [];
            }
        }
        
        console.log('✅ AI GM Calibration API route registered');
    } catch (err) {
        console.warn('⚠️ AI GM Calibration route not available:', err.message);
    }

    // AI GM Engagement Events API - HEAD OF AI - Optional Enhancement
    try {
        const aiGMEngagementEventsService = require('../services/aiGMEngagementEventsService');
        
        // Track engagement event
        app.post('/api/ai-gm/engagement/track', async (req, res) => {
            try {
                const { eventType, eventData, context } = req.body;
                
                if (!eventType) {
                    return res.status(400).json({ error: 'eventType is required' });
                }
                
                await aiGMEngagementEventsService.trackEvent(eventType, eventData || {}, context || {});
                
                res.json({ success: true });
            } catch (err) {
                log.error('AI GM engagement tracking error:', err);
                res.status(500).json({ error: err.message });
            }
        });
        
        // Get engagement events
        app.get('/api/ai-gm/engagement/events', async (req, res) => {
            try {
                const filters = {
                    sessionId: req.query.sessionId,
                    userId: req.query.userId,
                    eventType: req.query.eventType,
                    startDate: req.query.startDate,
                    endDate: req.query.endDate
                };
                
                const events = await aiGMEngagementEventsService.getEngagementEvents(filters);
                
                res.json({
                    success: true,
                    data: events,
                    count: events.length
                });
            } catch (err) {
                log.error('AI GM engagement events error:', err);
                res.status(500).json({ error: err.message });
            }
        });
        
        console.log('✅ AI GM Engagement Events API routes registered');
    } catch (err) {
        console.warn('⚠️ AI GM Engagement Events routes not available:', err.message);
    }

    // AI GM Quality Feedback API - HEAD OF AI - Optional Enhancement
    try {
        const aiGMQualityFeedbackService = require('../services/aiGMQualityFeedbackService');
        
        // Submit quality feedback
        app.post('/api/ai-gm/quality/feedback', async (req, res) => {
            try {
                const { responseId, qualityRating, feedback } = req.body;
                
                if (!responseId || qualityRating === undefined) {
                    return res.status(400).json({ 
                        error: 'responseId and qualityRating are required' 
                    });
                }
                
                if (qualityRating < 0 || qualityRating > 1) {
                    return res.status(400).json({ 
                        error: 'qualityRating must be between 0 and 1' 
                    });
                }
                
                const result = await aiGMQualityFeedbackService.submitFeedback(
                    responseId, 
                    qualityRating, 
                    feedback || {}
                );
                
                // HEAD OF AI: Record CSAT when feedback is submitted
                if (result.success) {
                    try {
                        const aiGMCSATOptimizationService = require('../services/aiGMCSATOptimizationService');
                        await aiGMCSATOptimizationService.recordCSAT({
                            responseId: responseId,
                            qualityRating: qualityRating,
                            feedbackText: feedback?.feedbackText || feedback?.feedback_text,
                            sessionId: feedback?.sessionId || feedback?.session_id,
                            userId: feedback?.userId || feedback?.user_id,
                            provider: feedback?.provider || result.feedback?.provider || null, // Sprint 8.1: Provider tracking
                            model: feedback?.model || result.feedback?.model || null // Sprint 8.2: Model tracking
                        });
                    } catch (csatErr) {
                        console.warn('[API] Error recording CSAT (non-fatal):', csatErr.message);
                    }
                }
                
                res.json(result);
            } catch (err) {
                log.error('AI GM quality feedback error:', err);
                res.status(500).json({ error: err.message });
            }
        });
        
        // Get feedback for a response
        app.get('/api/ai-gm/quality/feedback/:responseId', async (req, res) => {
            try {
                const { responseId } = req.params;
                const feedback = await aiGMQualityFeedbackService.getFeedbackForResponse(responseId);
                
                res.json({
                    success: true,
                    data: feedback,
                    count: feedback.length
                });
            } catch (err) {
                log.error('AI GM quality feedback get error:', err);
                res.status(500).json({ error: err.message });
            }
        });
        
        // Get feedback statistics
        app.get('/api/ai-gm/quality/feedback-stats', async (req, res) => {
            try {
                const filters = {
                    scenarioId: req.query.scenarioId,
                    startDate: req.query.startDate,
                    endDate: req.query.endDate
                };
                
                const stats = await aiGMQualityFeedbackService.getFeedbackStats(filters);
                
                res.json({
                    success: true,
                    data: stats
                });
            } catch (err) {
                log.error('AI GM quality feedback stats error:', err);
                res.status(500).json({ error: err.message });
            }
        });
        
        console.log('✅ AI GM Quality Feedback API routes registered');
    } catch (err) {
        console.warn('⚠️ AI GM Quality Feedback routes not available:', err.message);
    }

    // HEAD OF AI: A/B Testing API endpoints
    try {
        const aiGMABTestingService = require('../services/aiGMABTestingService');
        
        // Create new experiment
        app.post('/api/ai-gm/ab-tests', async (req, res) => {
            try {
                const result = await aiGMABTestingService.createExperiment(req.body);
                res.json(result);
            } catch (err) {
                console.error('[API] Error creating A/B test:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });
        
        // Get all experiments
        app.get('/api/ai-gm/ab-tests', async (req, res) => {
            try {
                const status = req.query.status || null;
                const experiments = await aiGMABTestingService.getAllExperiments(status);
                res.json({ success: true, experiments });
            } catch (err) {
                console.error('[API] Error getting A/B tests:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });
        
        // Get experiment results
        app.get('/api/ai-gm/ab-tests/:experimentName/results', async (req, res) => {
            try {
                const { experimentName } = req.params;
                const filters = {
                    variant: req.query.variant || null,
                    startDate: req.query.startDate || null,
                    endDate: req.query.endDate || null
                };
                const results = await aiGMABTestingService.getExperimentResults(experimentName, filters);
                res.json({ success: true, results });
            } catch (err) {
                console.error('[API] Error getting A/B test results:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });
        
        console.log('✅ AI GM A/B Testing API routes registered');
    } catch (err) {
        console.warn('[API] AI GM A/B Testing service not available:', err.message);
    }

    // HEAD OF AI: Quality Prediction API endpoints
    try {
        const aiGMQualityPredictionService = require('../services/aiGMQualityPredictionService');
        
        // Get prediction statistics
        app.get('/api/ai-gm/quality/prediction/stats', async (req, res) => {
            try {
                const stats = aiGMQualityPredictionService.getPredictionStats();
                res.json({ success: true, stats });
            } catch (err) {
                console.error('[API] Error getting prediction stats:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });
        
        // Predict quality for a context
        app.post('/api/ai-gm/quality/prediction', async (req, res) => {
            try {
                const prediction = aiGMQualityPredictionService.predictQuality(req.body);
                res.json({ success: true, prediction });
            } catch (err) {
                console.error('[API] Error predicting quality:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });
        
        console.log('✅ AI GM Quality Prediction API routes registered');
    } catch (err) {
        console.warn('[API] AI GM Quality Prediction service not available:', err.message);
    }

    // HEAD OF AI: Multi-Model Ensemble API endpoints
    try {
        const aiGMMultiModelEnsembleService = require('../services/aiGMMultiModelEnsembleService');
        
        // Get ensemble statistics
        app.get('/api/ai-gm/ensemble/stats', async (req, res) => {
            try {
                const stats = aiGMMultiModelEnsembleService.getStats();
                res.json({ success: true, stats });
            } catch (err) {
                console.error('[API] Error getting ensemble stats:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });
        
        console.log('✅ AI GM Multi-Model Ensemble API routes registered');
    } catch (err) {
        console.warn('[API] AI GM Multi-Model Ensemble service not available:', err.message);
    }

    // HEAD OF AI: CSAT Optimization API endpoints
    try {
        const aiGMCSATOptimizationService = require('../services/aiGMCSATOptimizationService');
        const aiGMQualityFeedbackService = require('../services/aiGMQualityFeedbackService');
        
        // Get CSAT optimization stats
        app.get('/api/ai-gm/csat/stats', async (req, res) => {
            try {
                const stats = await aiGMCSATOptimizationService.getStats();
                res.json({ success: true, stats });
            } catch (err) {
                console.error('[API] Error getting CSAT stats:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });
        
        // Record CSAT from quality feedback (called when feedback is submitted)
        app.post('/api/ai-gm/csat/record', async (req, res) => {
            try {
                const { responseId, qualityRating, feedbackText, sessionId, userId, provider, model } = req.body;
                await aiGMCSATOptimizationService.recordCSAT({
                    responseId,
                    qualityRating,
                    feedbackText,
                    sessionId,
                    userId,
                    provider: provider || null, // Sprint 8.1: Provider tracking
                    model: model || null // Sprint 8.2: Model tracking
                });
                res.json({ success: true });
            } catch (err) {
                console.error('[API] Error recording CSAT:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });
        
        // Get CSAT optimization recommendations
        app.get('/api/ai-gm/csat/recommendations', async (req, res) => {
            try {
                const stats = aiGMCSATOptimizationService.getStats();
                res.json({ success: true, recommendations: stats.recommendations });
            } catch (err) {
                console.error('[API] Error getting CSAT recommendations:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });
        
        // Get A/B test recommendation based on CSAT
        app.get('/api/ai-gm/csat/ab-test-recommendation/:experimentName', async (req, res) => {
            try {
                const { experimentName } = req.params;
                const aiGMABTestingService = require('../services/aiGMABTestingService');
                const results = await aiGMABTestingService.getExperimentResults(experimentName);
                const recommendation = aiGMCSATOptimizationService.getABTestRecommendation(results);
                res.json({ success: true, recommendation, results });
            } catch (err) {
                console.error('[API] Error getting CSAT A/B test recommendation:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });
        
        console.log('✅ AI GM CSAT Optimization API routes registered');
    } catch (err) {
        console.warn('[API] AI GM CSAT Optimization service not available:', err.message);
    }

    // HEAD OF AI: Admin Hub Overview API
    try {
        app.get('/api/admin/overview', async (req, res) => {
            try {
                const overview = {
                    aiGM: {},
                    experiments: {},
                    system: {},
                    services: {}
                };

                // AI GM Metrics
                try {
                    const aiGMMetricsService = require('../services/aiGMMetricsService');
                    const metrics = aiGMMetricsService.getMetrics();
                    
                    // Extract quality (handle both number and object)
                    let quality = 0;
                    if (metrics.quality) {
                        if (typeof metrics.quality === 'object') {
                            quality = metrics.quality.average || 0;
                        } else {
                            quality = metrics.quality;
                        }
                    }
                    
                    // Extract response rate (handle both number and object)
                    // Note: percentage is 0-100, convert to 0-1
                    let responseRate = 0;
                    if (metrics.responseRate) {
                        if (typeof metrics.responseRate === 'object') {
                            responseRate = (metrics.responseRate.percentage || 0) / 100;
                        } else {
                            responseRate = metrics.responseRate;
                        }
                    }
                    
                    overview.aiGM = {
                        quality: quality,
                        responseRate: responseRate,
                        avgResponseTime: metrics.avgResponseTime || 0,
                        totalResponses: metrics.totalResponses || 0
                    };
                } catch (err) {
                    console.warn('[Admin Hub] Error loading AI GM metrics:', err.message);
                }

                // A/B Tests
                try {
                    const aiGMABTestingService = require('../services/aiGMABTestingService');
                    const experiments = await aiGMABTestingService.getAllExperiments('active');
                    overview.experiments = {
                        active: experiments.length || 0,
                        total: (await aiGMABTestingService.getAllExperiments()).length || 0
                    };
                } catch (err) {
                    console.warn('[Admin Hub] Error loading experiments:', err.message);
                }

                // Quality Prediction
                try {
                    const aiGMQualityPredictionService = require('../services/aiGMQualityPredictionService');
                    const stats = aiGMQualityPredictionService.getPredictionStats();
                    overview.aiGM.predictionConfidence = stats.confidence || 0;
                    overview.aiGM.predictionSamples = stats.sampleCount || 0;
                } catch (err) {
                    console.warn('[Admin Hub] Error loading prediction stats:', err.message);
                }

                // System Health
                try {
                    const serviceRegistry = require('../services/serviceRegistry');
                    const services = serviceRegistry.getAllServices();
                    const operational = Object.values(services).filter(s => s.status === 'operational').length;
                    overview.system = {
                        totalServices: Object.keys(services).length,
                        operational: operational,
                        healthPercentage: Object.keys(services).length > 0 
                            ? (operational / Object.keys(services).length * 100) 
                            : 100
                    };
                } catch (err) {
                    console.warn('[Admin Hub] Error loading system health:', err.message);
                }

                res.json({ success: true, overview });
            } catch (err) {
                console.error('[API] Error getting admin overview:', err);
                res.status(500).json({ success: false, error: err.message });
            }
        });

        console.log('✅ Admin Hub Overview API route registered');
    } catch (err) {
        console.warn('[API] Admin Hub Overview route not available:', err.message);
    }

    // AI GM Services Health Endpoints - AI GM Team - Phase 1 - 2025-01-15
    try {
        const serviceRegistry = require('../services/serviceRegistry');
        
        // Get health status for all AI GM services
        // AI GM Health Endpoint - Phase 1
        app.get('/api/ai-gm/health', async (req, res) => {
            try {
                const aiGMServices = [
                    'fallbackResponseService',
                    'responseTimeoutService',
                    'scenarioKnowledgeService',
                    'eventHandlerAuditService',
                    'narrativeQualityService',
                    'proactiveNarrativeService',
                    'playerSentimentService',
                    'adaptiveDifficultyService',
                    'deepPersonalizationService',
                    'emotionalIntelligenceService',
                    'predictiveAnticipationService',
                    'multiAgentGMService',
                    'surpriseAndDelightService',
                    'collaborativeStorytellingService',
                    'personalityVariationService',
                    'llmService',
                    'aiGMMemoryService',
                    'enhancedContextAwarenessService'
                ];
                
                const health = {};
                let allHealthy = true;
                
                for (const serviceName of aiGMServices) {
                    const service = serviceRegistry.get(serviceName);
                    if (service && typeof service.getHealth === 'function') {
                        try {
                            health[serviceName] = await service.getHealth();
                            if (health[serviceName].status !== 'healthy') {
                                allHealthy = false;
                            }
                        } catch (error) {
                            health[serviceName] = {
                                status: 'error',
                                error: error.message
                            };
                            allHealthy = false;
                        }
                    } else {
                        health[serviceName] = {
                            status: 'not_registered',
                            message: 'Service not found in registry'
                        };
                    }
                }
                
                const statusCode = allHealthy ? 200 : 503;
                res.status(statusCode).json({
                    status: allHealthy ? 'healthy' : 'degraded',
                    services: health,
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                res.status(500).json({
                    status: 'error',
                    error: err.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Get coverage report from event handler audit service
        app.get('/api/ai-gm/coverage', async (req, res) => {
            try {
                const eventHandlerAuditService = serviceRegistry.get('eventHandlerAuditService');
                if (!eventHandlerAuditService) {
                    return res.status(404).json({
                        error: 'Event Handler Audit Service not found'
                    });
                }
                
                const report = eventHandlerAuditService.getCoverageReport();
                res.json(report);
            } catch (err) {
                res.status(500).json({
                    error: err.message
                });
            }
        });
        
        // Trigger event handler audit
        app.post('/api/ai-gm/audit', async (req, res) => {
            try {
                const eventHandlerAuditService = serviceRegistry.get('eventHandlerAuditService');
                if (!eventHandlerAuditService) {
                    return res.status(404).json({
                        error: 'Event Handler Audit Service not found'
                    });
                }
                
                const report = await eventHandlerAuditService.auditEventHandlers();
                res.json({
                    success: true,
                    report,
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    error: err.message
                });
            }
        });
        
        // Auto-fix missing handlers
        app.post('/api/ai-gm/auto-fix', async (req, res) => {
            try {
                const eventHandlerAuditService = serviceRegistry.get('eventHandlerAuditService');
                if (!eventHandlerAuditService) {
                    return res.status(404).json({
                        error: 'Event Handler Audit Service not found'
                    });
                }
                
                const results = await eventHandlerAuditService.autoFixMissingHandlers();
                res.json({
                    success: true,
                    results,
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    error: err.message
                });
            }
        });
        
        console.log('✅ AI GM Services Health API routes registered');
    } catch (err) {
        console.warn('⚠️ AI GM Services Health routes not available:', err.message);
    }

    // Event Bus API Endpoints - System Architecture Expert - 2025-01-15
    // Event-Driven Architecture Enhancement
    try {
        const eventBus = require('../services/eventBus');
        const eventBusEnhancements = require('../services/eventBusEnhancements');

        // Get event bus statistics
        app.get('/api/events/stats', (req, res) => {
            try {
                const stats = eventBus.getStats();
                const enhancements = eventBusEnhancements.getMetrics();
                res.json({
                    success: true,
                    eventBus: stats,
                    enhancements: enhancements,
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    error: err.message
                });
            }
        });

        // Get event history
        app.get('/api/events/history', (req, res) => {
            try {
                const eventType = req.query.type || null;
                const limit = parseInt(req.query.limit) || 100;
                const since = req.query.since ? parseInt(req.query.since) : null;
                
                const history = eventBus.getHistory({
                    eventType,
                    limit,
                    since
                });
                
                res.json({
                    success: true,
                    events: history,
                    count: history.length,
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    error: err.message
                });
            }
        });

        // Get registered event types
        app.get('/api/events/types', (req, res) => {
            try {
                const eventTypes = eventBus.getEventTypes();
                const registeredEvents = eventBusEnhancements.getRegisteredEvents();
                
                res.json({
                    success: true,
                    eventTypes: eventTypes,
                    registeredEvents: registeredEvents,
                    count: eventTypes.length,
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    error: err.message
                });
            }
        });

        // Get subscribers for an event type
        app.get('/api/events/subscribers/:eventType', (req, res) => {
            try {
                const eventType = req.params.eventType;
                const subscribers = eventBus.getSubscribers(eventType);
                
                res.json({
                    success: true,
                    eventType: eventType,
                    subscribers: subscribers,
                    count: subscribers.length,
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                res.status(500).json({
                    success: false,
                    error: err.message
                });
            }
        });

        console.log('✅ Event Bus API routes registered');
    } catch (err) {
        console.warn('⚠️ Event Bus API routes not available:', err.message);
    }

    console.log('✅ API routes registered');
};