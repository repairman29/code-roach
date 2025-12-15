/**
 * Code Roach API Routes
 * Endpoints for codebase crawling, fixing, and analytics
 */

const express = require('express');
const router = express.Router();
const log = console;

// Codebase Crawler
let codebaseCrawler = null;
try {
    // codebaseCrawler.js exports an instance, so we can use it directly
    codebaseCrawler = require('../services/codebaseCrawler');
    if (codebaseCrawler && typeof codebaseCrawler.getStatus === 'function') {
        log.log('✅ Codebase crawler loaded successfully');
    } else {
        log.warn('⚠️ Codebase crawler loaded but not properly initialized');
        codebaseCrawler = null;
    }
} catch (err) {
    log.warn('⚠️ Codebase crawler not available:', err.message);
    codebaseCrawler = null;
}

// Start crawl (non-blocking - starts in background)
router.post('/crawl', async (req, res) => {
    try {
        if (!codebaseCrawler) {
            return res.status(503).json({ error: 'Codebase crawler not available' });
        }
        
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
router.get('/crawl/status', async (req, res) => {
    try {
        if (!codebaseCrawler) {
            return res.json({
                status: 'idle',
                isRunning: false,
                stats: {
                    filesScanned: 0,
                    issuesFound: 0,
                    issuesAutoFixed: 0,
                    issuesNeedingReview: 0,
                    errors: 0
                }
            });
        }
        const status = await codebaseCrawler.getStatus();
        res.json(status);
    } catch (err) {
        log.error('Status error:', err);
        // Return default status instead of error
        res.json({
            status: 'error',
            isRunning: false,
            error: err.message,
            stats: {
                filesScanned: 0,
                issuesFound: 0,
                issuesAutoFixed: 0,
                issuesNeedingReview: 0,
                errors: 1
            }
        });
    }
});

// Parallel crawl endpoints
let parallelCrawlManager = null;
try {
    parallelCrawlManager = require('../services/parallelCrawlManager');
} catch (err) {
    // Parallel crawl manager not available - skip
}

if (parallelCrawlManager) {
    router.post('/crawl/parallel', async (req, res) => {
        try {
            const { numCrawls = 3, options = {} } = req.body;
            const crawlIds = await parallelCrawlManager.startParallelCrawls(numCrawls, options);
            res.json({ success: true, crawlIds });
        } catch (err) {
            log.error('Parallel crawl error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/crawl/parallel/status', (req, res) => {
        try {
            const status = parallelCrawlManager.getStatus();
            res.json(status);
        } catch (err) {
            log.error('Parallel crawl status error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Extreme issue router status
let extremeIssueRouter = null;
try {
    extremeIssueRouter = require('../services/extremeIssueRouter');
} catch (err) {
    // Extreme issue router not available - skip
}

if (extremeIssueRouter) {
    router.get('/extreme-issues/status', (req, res) => {
        try {
            const status = extremeIssueRouter.getStatus();
            res.json(status);
        } catch (err) {
            log.error('Extreme issue router status error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Analytics endpoints
let codeRoachAnalytics = null;
try {
    codeRoachAnalytics = require('../services/codeRoachAnalytics');
} catch (err) {
    // Analytics not available - skip
}

if (codeRoachAnalytics) {
    router.get('/analytics', (req, res) => {
        try {
            const analytics = codeRoachAnalytics.getAnalytics();
            res.json(analytics);
        } catch (err) {
            log.error('Analytics error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/analytics/trends', async (req, res) => {
        try {
            const trends = await codeRoachAnalytics.getTrends();
            res.json(trends);
        } catch (err) {
            log.error('Trends error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/analytics/insights', async (req, res) => {
        try {
            const insights = await codeRoachAnalytics.getInsights();
            res.json(insights);
        } catch (err) {
            log.error('Insights error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Error history endpoints (for dashboard compatibility)
router.get('/error-history/stats', (req, res) => {
    res.json({
        totalErrors: 0,
        errorsByType: {},
        recentErrors: [],
        errorTrends: []
    });
});

router.get('/error-history/patterns', (req, res) => {
    res.json({
        patterns: [],
        topPatterns: []
    });
});

// Fix learning stats (for dashboard compatibility)
// This is registered at /api/fix-learning/* via api.js
router.get('/stats', (req, res) => {
    res.json({
        totalFixes: 0,
        successfulFixes: 0,
        failedFixes: 0,
        fixRate: 0,
        learningPatterns: []
    });
});

// IP analytics endpoints (for dashboard compatibility)
router.get('/ip-analytics', (req, res) => {
    res.json({
        totalIPs: 0,
        activeIPs: 0,
        ipActivity: []
    });
});

router.get('/ip-analytics/roi', (req, res) => {
    res.json({
        roi: 0,
        costSavings: 0,
        timeSaved: 0
    });
});

// Issues endpoints
const issueStorageService = require('../services/issueStorageService');
// Auth middleware - optional for Code Roach standalone
const optionalAuth = (req, res, next) => next(); // No-op for now
const authenticate = (req, res, next) => next(); // No-op for now

// Get issues
router.get('/issues', optionalAuth, async (req, res) => {
    try {
        const filters = {
            projectId: req.query.projectId || null,
            status: req.query.status || null,
            severity: req.query.severity || null,
            type: req.query.type || null,
            filePath: req.query.filePath || null,
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        };

        // Use issueStorageService which now has resilience built-in
        const issues = filters.projectId 
            ? await issueStorageService.getProjectIssues(filters.projectId, filters)
            : [];

        // Get total count (for pagination) - would need to add count method to service
        // For now, use issues length as approximation
        const total = issues.length;

        const stats = filters.projectId ? await issueStorageService.getProjectStatistics(filters.projectId) : null;

        res.json({
            issues: issues || [],
            total: total,
            statistics: stats
        });
    } catch (err) {
        log.error('Get issues error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get single issue
router.get('/issues/:id', optionalAuth, async (req, res) => {
    try {
        // Use issueStorageService which now has resilience built-in
        const issue = await issueStorageService.getIssue(req.params.id);

        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        res.json({ issue });
    } catch (err) {
        log.error('Get issue error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update issue
router.put('/issues/:id', authenticate, async (req, res) => {
    try {
        const updates = req.body;
        const updated = await issueStorageService.updateIssue(req.params.id, updates);
        
        if (!updated) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        res.json({ success: true, issue: updated });
    } catch (err) {
        log.error('Update issue error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Statistics endpoint
router.get('/stats', optionalAuth, async (req, res) => {
    try {
        const projectId = req.query.projectId || null;
        
        if (projectId) {
            const stats = await issueStorageService.getProjectStatistics(projectId);
            res.json({ statistics: stats });
        } else {
            // Overall stats
            res.json({
                statistics: {
                    totalIssues: 0,
                    byStatus: {},
                    bySeverity: {},
                    byType: {}
                }
            });
        }
    } catch (err) {
        log.error('Stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

