/**
 * Commercial Middleware - Shared across all tools
 * Authentication, Pricing, Monitoring
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Commercial configuration
const COMMERCIAL_CONFIG = {
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    stripeSecret: process.env.STRIPE_SECRET_KEY,
    monitoring: {
        enabled: process.env.MONITORING_ENABLED === 'true',
        endpoint: process.env.MONITORING_ENDPOINT
    }
};

// Pricing tiers (shared across all products)
const PRICING_TIERS = {
    starter: {
        name: 'Starter',
        price: 99,
        currency: 'USD',
        interval: 'month',
        limits: {
            requests: 1000,
            storage: '1GB',
            users: 5
        }
    },
    professional: {
        name: 'Professional',
        price: 499,
        currency: 'USD',
        interval: 'month',
        limits: {
            requests: 10000,
            storage: '10GB',
            users: 50
        }
    },
    enterprise: {
        name: 'Enterprise',
        price: null, // Custom pricing
        currency: 'USD',
        interval: 'month',
        limits: {
            requests: -1, // Unlimited
            storage: 'Unlimited',
            users: -1 // Unlimited
        }
    }
};

// User management (in-memory for demo - use database in production)
const users = new Map();
const sessions = new Map();

// Authentication middleware
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    if (apiKey) {
        // API key authentication
        const user = Array.from(users.values()).find(u => u.apiKey === apiKey);
        if (user) {
            req.user = user;
            return next();
        }
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, COMMERCIAL_CONFIG.jwtSecret);
            const user = users.get(decoded.userId);
            if (user) {
                req.user = user;
                return next();
            }
        } catch (error) {
            // Token invalid
        }
    }

    res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid API key or JWT token'
    });
}

// Usage tracking middleware
function trackUsage(req, res, next) {
    if (!req.user) return next();

    const user = req.user;
    const now = new Date();

    // Initialize usage tracking if not exists
    if (!user.usage) {
        user.usage = {
            requests: 0,
            storage: 0,
            lastReset: now
        };
    }

    // Increment request count
    user.usage.requests++;

    // Check limits
    const tier = PRICING_TIERS[user.tier];
    if (tier && tier.limits.requests > 0 && user.usage.requests > tier.limits.requests) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Monthly request limit of ${tier.limits.requests} reached`,
            upgrade: 'Consider upgrading your plan'
        });
    }

    // Add response monitoring
    const originalSend = res.send;
    res.send = function(data) {
        // Log usage
        if (COMMERCIAL_CONFIG.monitoring.enabled) {
            logUsage(user.id, req.path, req.method, res.statusCode, data.length);
        }

        originalSend.call(this, data);
    };

    next();
}

// Pricing middleware
function checkPricing(req, res, next) {
    if (!req.user) return next();

    const user = req.user;
    const tier = PRICING_TIERS[user.tier];

    if (!tier) {
        return res.status(402).json({
            error: 'Invalid subscription',
            message: 'Please check your subscription status'
        });
    }

    // Add pricing info to response headers
    res.set('X-Tier', user.tier);
    res.set('X-Requests-Used', user.usage?.requests || 0);
    res.set('X-Requests-Limit', tier.limits.requests);

    next();
}

// Admin middleware
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Admin access required',
            message: 'This endpoint requires administrative privileges'
        });
    }
    next();
}

// Authentication routes
function createAuthRoutes() {
    const express = require('express');
    const router = express.Router();

    // Register new user
    router.post('/register', (req, res) => {
        const { email, password, company, tier = 'starter' } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Check if user exists
        const existingUser = Array.from(users.values()).find(u => u.email === email);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Create user
        const userId = 'user_' + Date.now();
        const apiKey = crypto.randomBytes(32).toString('hex');

        const user = {
            id: userId,
            email,
            company,
            tier,
            apiKey,
            role: 'user',
            created: new Date().toISOString(),
            usage: {
                requests: 0,
                storage: 0,
                lastReset: new Date()
            }
        };

        users.set(userId, user);

        res.json({
            userId,
            apiKey,
            message: 'User registered successfully',
            tier: PRICING_TIERS[tier]
        });
    });

    // Login
    router.post('/login', (req, res) => {
        const { email, password } = req.body;

        const user = Array.from(users.values()).find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            COMMERCIAL_CONFIG.jwtSecret,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                tier: user.tier,
                company: user.company
            }
        });
    });

    // Get current user
    router.get('/me', authenticate, (req, res) => {
        const user = req.user;
        res.json({
            user: {
                id: user.id,
                email: user.email,
                tier: user.tier,
                company: user.company,
                usage: user.usage
            },
            tier: PRICING_TIERS[user.tier]
        });
    });

    // Pricing information
    router.get('/pricing', (req, res) => {
        res.json({
            tiers: PRICING_TIERS,
            currency: 'USD'
        });
    });

    return router;
}

// Monitoring functions
function logUsage(userId, endpoint, method, statusCode, responseSize) {
    if (!COMMERCIAL_CONFIG.monitoring.enabled) return;

    const logEntry = {
        timestamp: new Date().toISOString(),
        userId,
        endpoint,
        method,
        statusCode,
        responseSize
    };

    // In production, send to monitoring service
    console.log('📊 Usage:', JSON.stringify(logEntry));
}

// Health check with commercial info
function createHealthCheck(serviceName, version) {
    return (req, res) => {
        res.json({
            status: 'healthy',
            service: serviceName,
            version: version,
            commercial: {
                authentication: 'enabled',
                pricing: 'enabled',
                monitoring: COMMERCIAL_CONFIG.monitoring.enabled
            },
            timestamp: new Date().toISOString()
        });
    };
}

module.exports = {
    authenticate,
    trackUsage,
    checkPricing,
    requireAdmin,
    createAuthRoutes,
    createHealthCheck,
    PRICING_TIERS,
    COMMERCIAL_CONFIG
};
