/**
 * Code Roach API Routes
 * Endpoints for codebase crawling, fixing, and analytics
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const log = console;

// Supabase client for database operations
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
let supabase = null;

try {
    supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    log.log('✅ Supabase client initialized for Code Roach API');
} catch (err) {
    log.warn('⚠️ Supabase client not available:', err.message);
    // Fallback to in-memory storage if Supabase is not available
}

// Fallback in-memory storage (only used if Supabase is unavailable)
const inMemoryStore = {
    organizations: [],
    projects: []
};

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
        
        // Get options and projectId from request
        const options = req.body.options || {};
        const projectId = req.body.projectId || options.projectId || null;
        
        // If projectId is provided, add it to options
        if (projectId) {
            options.projectId = projectId;
            log.log(`[Code Roach API] Starting crawl for project: ${projectId}`);
        } else {
            log.log('[Code Roach API] Starting crawl without project (issues will not be associated with a project)');
        }
        
        // SECURITY: Validate and sanitize rootDir to prevent path traversal
        let rootDir = options.rootDir || process.cwd();
        if (rootDir) {
            // Normalize path and resolve to absolute path
            rootDir = path.resolve(rootDir);
            const allowedRoot = path.resolve(process.cwd());
            
            // SECURITY: Ensure rootDir is within allowed directory (prevent path traversal)
            if (!rootDir.startsWith(allowedRoot)) {
                log.warn('[Security] Attempted path traversal in rootDir:', rootDir);
                rootDir = allowedRoot; // Fallback to safe default
            }
            
            // SECURITY: Prevent directory traversal patterns
            if (rootDir.includes('..') || rootDir.includes('~')) {
                log.warn('[Security] Suspicious path pattern detected:', rootDir);
                rootDir = allowedRoot; // Fallback to safe default
            }
            
            options.rootDir = rootDir;
        } else if (!options.files) {
            options.rootDir = process.cwd();
        }
        
        // Start crawl in background (don't await)
        codebaseCrawler.crawlCodebase(options.rootDir || process.cwd(), options).catch(err => {
            log.error('Background crawl error:', err);
        });
        
        // Return immediately
        res.json({ 
            success: true, 
            message: projectId ? `Crawl started for project ${projectId}` : 'Crawl started in background',
            projectId: projectId,
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
const { authenticate, optionalAuth } = require('../middleware/auth');

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

        let issues = [];
        let total = 0;
        
        // If projectId is provided, get issues for that project
        if (filters.projectId) {
            issues = await issueStorageService.getProjectIssues(filters.projectId, filters);
            total = issues._count || issues.length;
        } else {
            // If no projectId, get all issues (including those with null project_id)
            issues = await issueStorageService.getAllIssues(filters);
            total = issues._count || issues.length;
        }
        
        // Remove _count from issues array (it's metadata)
        if (Array.isArray(issues) && issues._count !== undefined) {
            delete issues._count;
        }

        // Transform database format to API format for frontend compatibility
        // Frontend expects both camelCase and snake_case formats
        const transformedIssues = (issues || []).map(issue => ({
            // Core fields (both formats for compatibility)
            id: issue.id,
            projectId: issue.project_id,
            project_id: issue.project_id, // Keep original for compatibility
            
            // File paths
            file: issue.file_path,
            filePath: issue.file_path,
            file_path: issue.file_path, // Keep original for frontend
            
            // Line numbers
            line: issue.error_line || issue.line,
            error_line: issue.error_line || issue.line, // Keep original for frontend
            endLine: issue.end_line,
            end_line: issue.end_line,
            column: issue.column,
            
            // Error details
            type: issue.error_type,
            error_type: issue.error_type, // Keep original for frontend
            message: issue.error_message,
            error_message: issue.error_message, // Keep original for frontend
            severity: issue.error_severity,
            error_severity: issue.error_severity, // Keep original for frontend
            code: issue.error_code,
            error_code: issue.error_code,
            
            // Review status
            reviewStatus: issue.review_status || 'pending',
            review_status: issue.review_status || 'pending', // Keep original for frontend
            
            // Fix information
            fixApplied: issue.fix_applied,
            fix_applied: issue.fix_applied,
            fixMethod: issue.fix_method,
            fix_method: issue.fix_method,
            fixConfidence: issue.fix_confidence,
            fix_confidence: issue.fix_confidence,
            
            // Resolution
            resolvedAt: issue.resolved_at,
            resolved_at: issue.resolved_at,
            resolvedBy: issue.resolved_by,
            resolved_by: issue.resolved_by,
            
            // Timestamps
            createdAt: issue.created_at,
            created_at: issue.created_at,
            updatedAt: issue.updated_at,
            updated_at: issue.updated_at,
            
            // Include all original fields for full backward compatibility
            ...issue
        }));

        // Use the total count from database query (already set above)

        const stats = filters.projectId ? await issueStorageService.getProjectStatistics(filters.projectId) : null;

        res.json({
            issues: transformedIssues,
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
        // SECURITY: Validate issue ID format (prevent injection)
        const issueId = req.params.id;
        if (!issueId || typeof issueId !== 'string' || issueId.length > 100) {
            return res.status(400).json({ error: 'Invalid issue ID format' });
        }
        
        // Use issueStorageService which now has resilience built-in
        const issue = await issueStorageService.getIssue(issueId);

        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        // SECURITY: If user is authenticated, verify project access
        if (req.userId && issue.project_id) {
            try {
                const projectService = require('../services/projectService');
                const hasAccess = await projectService.hasProjectAccess(issue.project_id, req.userId);
                if (!hasAccess) {
                    // Don't reveal that issue exists, just return 404
                    return res.status(404).json({ error: 'Issue not found' });
                }
            } catch (err) {
                // If project service unavailable, allow access (development mode)
                // In production, this should fail securely
                if (config.isProduction()) {
                    log.warn('[Security] Project service unavailable in production for issue access check');
                }
            }
        }

        res.json({ issue });
    } catch (err) {
        log.error('Get issue error:', err);
        // SECURITY: Use standardized error handling
        const { formatErrorResponse } = require('../utils/errors');
        const errorResponse = formatErrorResponse(err);
        res.status(errorResponse.statusCode).json(errorResponse);
    }
});

// Update issue
router.put('/issues/:id', authenticate, async (req, res) => {
    try {
        // SECURITY: Validate issue ID format (prevent injection)
        const issueId = req.params.id;
        if (!issueId || typeof issueId !== 'string' || issueId.length > 100) {
            return res.status(400).json({ error: 'Invalid issue ID format' });
        }
        
        // SECURITY: Get issue first to verify project access
        const issue = await issueStorageService.getIssue(issueId);
        if (!issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        
        // SECURITY: Verify user has access to the project
        if (issue.project_id) {
            try {
                const projectService = require('../services/projectService');
                const hasAccess = await projectService.hasProjectAccess(issue.project_id, req.userId);
                if (!hasAccess) {
                    // Don't reveal that issue exists, just return 404
                    return res.status(404).json({ error: 'Issue not found' });
                }
            } catch (err) {
                // If project service unavailable, fail securely in production
                if (config.isProduction()) {
                    log.error('[Security] Project service unavailable in production for issue update');
                    return res.status(500).json({ error: 'Authorization service unavailable' });
                }
            }
        }
        
        const updates = req.body;
        const updated = await issueStorageService.updateIssue(issueId, updates);
        
        if (!updated) {
            return res.status(404).json({ error: 'Issue not found' });
        }

        res.json({ success: true, issue: updated });
    } catch (err) {
        log.error('Update issue error:', err);
        // SECURITY: Use standardized error handling
        const { formatErrorResponse } = require('../utils/errors');
        const errorResponse = formatErrorResponse(err);
        res.status(errorResponse.statusCode).json(errorResponse);
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

// ============================================
// New Services API Endpoints
// ============================================

// Fix Impact Prediction Service
let fixImpactPredictionService = null;
try {
    fixImpactPredictionService = require('../services/fixImpactPredictionService');
} catch (err) {
    log.warn('⚠️ Fix Impact Prediction Service not available:', err.message);
}

if (fixImpactPredictionService) {
    router.post('/fixes/predict-impact', authenticate, async (req, res) => {
        try {
            const { fix, context } = req.body;
            const result = await fixImpactPredictionService.predictImpact(fix, context);
            res.json(result);
        } catch (err) {
            log.error('Predict impact error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Fix Confidence Calibration Service
let fixConfidenceCalibrationService = null;
try {
    fixConfidenceCalibrationService = require('../services/fixConfidenceCalibrationService');
} catch (err) {
    log.warn('⚠️ Fix Confidence Calibration Service not available:', err.message);
}

if (fixConfidenceCalibrationService) {
    router.post('/fixes/calibrate-confidence', authenticate, async (req, res) => {
        try {
            const { confidence, context } = req.body;
            const result = await fixConfidenceCalibrationService.calibrateConfidence(confidence, context);
            res.json(result);
        } catch (err) {
            log.error('Calibrate confidence error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/fixes/record-outcome', authenticate, async (req, res) => {
        try {
            const { fixId, predictedConfidence, actualSuccess, context } = req.body;
            await fixConfidenceCalibrationService.recordOutcome(fixId, predictedConfidence, actualSuccess, context);
            res.json({ success: true });
        } catch (err) {
            log.error('Record outcome error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/fixes/calibration-report', authenticate, async (req, res) => {
        try {
            const { method, domain } = req.query;
            const result = await fixConfidenceCalibrationService.getCalibrationReport(method, domain);
            res.json(result);
        } catch (err) {
            log.error('Calibration report error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Fix Rollback Intelligence Service
let fixRollbackIntelligenceService = null;
try {
    fixRollbackIntelligenceService = require('../services/fixRollbackIntelligenceService');
} catch (err) {
    log.warn('⚠️ Fix Rollback Intelligence Service not available:', err.message);
}

if (fixRollbackIntelligenceService) {
    router.post('/fixes/:fixId/monitor', authenticate, async (req, res) => {
        try {
            const { fixData, context } = req.body;
            const result = await fixRollbackIntelligenceService.monitorFix(req.params.fixId, fixData, context);
            res.json(result);
        } catch (err) {
            log.error('Monitor fix error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/fixes/:fixId/rollback-check', authenticate, async (req, res) => {
        try {
            const result = await fixRollbackIntelligenceService.shouldRollback(req.params.fixId);
            res.json(result);
        } catch (err) {
            log.error('Rollback check error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/fixes/:fixId/rollback', authenticate, async (req, res) => {
        try {
            const { strategy } = req.body;
            const result = await fixRollbackIntelligenceService.executeRollback(req.params.fixId, strategy);
            res.json(result);
        } catch (err) {
            log.error('Rollback error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/fixes/rollback-stats', authenticate, async (req, res) => {
        try {
            const { projectId } = req.query;
            const result = await fixRollbackIntelligenceService.getRollbackStats(projectId);
            res.json(result);
        } catch (err) {
            log.error('Rollback stats error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Fix Cost-Benefit Analysis Service
let fixCostBenefitAnalysisService = null;
try {
    fixCostBenefitAnalysisService = require('../services/fixCostBenefitAnalysisService');
} catch (err) {
    log.warn('⚠️ Fix Cost-Benefit Analysis Service not available:', err.message);
}

if (fixCostBenefitAnalysisService) {
    router.post('/fixes/analyze-cost-benefit', authenticate, async (req, res) => {
        try {
            const { fix, context } = req.body;
            const result = await fixCostBenefitAnalysisService.analyzeCostBenefit(fix, context);
            res.json(result);
        } catch (err) {
            log.error('Cost-benefit analysis error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/fixes/prioritize', authenticate, async (req, res) => {
        try {
            const { issues, context } = req.body;
            const result = await fixCostBenefitAnalysisService.prioritizeFixes(issues, context);
            res.json(result);
        } catch (err) {
            log.error('Prioritize fixes error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Fix Orchestration Service
let fixOrchestrationService = null;
try {
    fixOrchestrationService = require('../services/fixOrchestrationService');
} catch (err) {
    log.warn('⚠️ Fix Orchestration Service not available:', err.message);
}

if (fixOrchestrationService) {
    router.post('/fixes/orchestrate', authenticate, async (req, res) => {
        try {
            const { issue, context } = req.body;
            const result = await fixOrchestrationService.orchestrateFix(issue, context);
            res.json(result);
        } catch (err) {
            log.error('Orchestrate fix error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/fixes/pipelines/:pipelineId', authenticate, async (req, res) => {
        try {
            const result = fixOrchestrationService.getPipelineStatus(req.params.pipelineId);
            res.json(result);
        } catch (err) {
            log.error('Get pipeline status error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/fixes/pipelines', authenticate, async (req, res) => {
        try {
            const result = fixOrchestrationService.getAllPipelines();
            res.json(result);
        } catch (err) {
            log.error('Get pipelines error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Fix Monitoring Service
let fixMonitoringService = null;
try {
    fixMonitoringService = require('../services/fixMonitoringService');
} catch (err) {
    log.warn('⚠️ Fix Monitoring Service not available:', err.message);
}

if (fixMonitoringService) {
    router.post('/fixes/:fixId/start-monitoring', authenticate, async (req, res) => {
        try {
            const { fixData, context } = req.body;
            const result = await fixMonitoringService.startMonitoring(req.params.fixId, fixData, context);
            res.json(result);
        } catch (err) {
            log.error('Start monitoring error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/fixes/:fixId/monitoring-status', authenticate, async (req, res) => {
        try {
            const result = fixMonitoringService.getMonitoringStatus(req.params.fixId);
            res.json(result);
        } catch (err) {
            log.error('Get monitoring status error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/fixes/:fixId/stop-monitoring', authenticate, async (req, res) => {
        try {
            const result = fixMonitoringService.stopMonitoring(req.params.fixId);
            res.json(result);
        } catch (err) {
            log.error('Stop monitoring error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/fixes/monitoring/dashboard', authenticate, async (req, res) => {
        try {
            const result = fixMonitoringService.getDashboardData();
            res.json(result);
        } catch (err) {
            log.error('Get monitoring dashboard error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Fix Marketplace Service
let fixMarketplaceService = null;
try {
    fixMarketplaceService = require('../services/fixMarketplaceService');
} catch (err) {
    log.warn('⚠️ Fix Marketplace Service not available:', err.message);
}

if (fixMarketplaceService) {
    router.get('/marketplace/patterns', optionalAuth, async (req, res) => {
        try {
            const options = {
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0,
                sortBy: req.query.sortBy || 'rating',
                minRating: parseFloat(req.query.minRating) || 0,
                category: req.query.category || null,
                search: req.query.search || null
            };
            const result = await fixMarketplaceService.listPatterns(options);
            res.json(result);
        } catch (err) {
            log.error('List marketplace patterns error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/marketplace/patterns', authenticate, async (req, res) => {
        try {
            const { pattern, projectId, options } = req.body;
            const result = await fixMarketplaceService.submitPattern(pattern, projectId, options);
            res.json(result);
        } catch (err) {
            log.error('Submit pattern error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/marketplace/patterns/:patternId/rate', authenticate, async (req, res) => {
        try {
            const { rating, comment } = req.body;
            const userId = req.user?.id || 'anonymous';
            const result = await fixMarketplaceService.ratePattern(req.params.patternId, rating, userId, comment);
            res.json(result);
        } catch (err) {
            log.error('Rate pattern error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/marketplace/patterns/:patternId', optionalAuth, async (req, res) => {
        try {
            const result = await fixMarketplaceService.getPatternDetails(req.params.patternId);
            res.json(result);
        } catch (err) {
            log.error('Get pattern details error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/marketplace/featured', optionalAuth, async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const result = await fixMarketplaceService.getFeaturedPatterns(limit);
            res.json(result);
        } catch (err) {
            log.error('Get featured patterns error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/marketplace/trending', optionalAuth, async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const result = await fixMarketplaceService.getTrendingPatterns(limit);
            res.json(result);
        } catch (err) {
            log.error('Get trending patterns error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Fix Quality Metrics & SLAs Service
let fixQualityMetricsService = null;
try {
    fixQualityMetricsService = require('../services/fixQualityMetricsService');
} catch (err) {
    log.warn('⚠️ Fix Quality Metrics Service not available:', err.message);
}

if (fixQualityMetricsService) {
    router.get('/quality/metrics', authenticate, async (req, res) => {
        try {
            const projectId = req.query.projectId || null;
            const days = parseInt(req.query.days) || 30;
            const result = await fixQualityMetricsService.calculateMetrics(projectId, { days });
            res.json(result);
        } catch (err) {
            log.error('Calculate quality metrics error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/quality/sla-report', authenticate, async (req, res) => {
        try {
            const projectId = req.query.projectId || null;
            const days = parseInt(req.query.days) || 30;
            const result = await fixQualityMetricsService.getSLAReport(projectId, { days });
            res.json(result);
        } catch (err) {
            log.error('Get SLA report error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Fix Personalization Service
let fixPersonalizationService = null;
try {
    fixPersonalizationService = require('../services/fixPersonalizationService');
} catch (err) {
    log.warn('⚠️ Fix Personalization Service not available:', err.message);
}

if (fixPersonalizationService) {
    router.post('/fixes/personalize', authenticate, async (req, res) => {
        try {
            const { fix, context } = req.body;
            const result = await fixPersonalizationService.personalizeFix(fix, context);
            res.json(result);
        } catch (err) {
            log.error('Personalize fix error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/teams/:teamId/preferences', authenticate, async (req, res) => {
        try {
            const { preferences } = req.body;
            const projectId = req.query.projectId || null;
            const result = await fixPersonalizationService.updateTeamPreferences(projectId, req.params.teamId, preferences);
            res.json(result);
        } catch (err) {
            log.error('Update team preferences error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Fix Documentation Generation Service
let fixDocumentationGenerationService = null;
try {
    fixDocumentationGenerationService = require('../services/fixDocumentationGenerationService');
} catch (err) {
    log.warn('⚠️ Fix Documentation Generation Service not available:', err.message);
}

if (fixDocumentationGenerationService) {
    router.post('/fixes/:fixId/documentation', authenticate, async (req, res) => {
        try {
            const { fix, context } = req.body;
            const result = await fixDocumentationGenerationService.generateDocumentation(fix, context);
            res.json(result);
        } catch (err) {
            log.error('Generate documentation error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Enhanced Explainability Service
let explainabilityService = null;
try {
    explainabilityService = require('../services/explainabilityService');
} catch (err) {
    log.warn('⚠️ Explainability Service not available:', err.message);
}

if (explainabilityService) {
    router.post('/fixes/explain-enhanced', authenticate, async (req, res) => {
        try {
            const { fix, context } = req.body;
            const result = await explainabilityService.explainFixEnhanced(fix, context);
            res.json(result);
        } catch (err) {
            log.error('Explain fix enhanced error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/fixes/explain-summary', authenticate, async (req, res) => {
        try {
            const { fix, context } = req.body;
            const result = await explainabilityService.generateSummary(fix, context);
            res.json({ summary: result });
        } catch (err) {
            log.error('Generate summary error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Cross-Project Learning Service (Enhanced)
let crossProjectLearningService = null;
try {
    crossProjectLearningService = require('../services/crossProjectLearningService');
} catch (err) {
    log.warn('⚠️ Cross-Project Learning Service not available:', err.message);
}

if (crossProjectLearningService) {
    router.get('/learning/cross-project/recommendations', authenticate, async (req, res) => {
        try {
            const { issue, projectId } = req.query;
            
            // SECURITY: Prevent prototype pollution in JSON.parse
            let parsedIssue = {};
            if (issue) {
                try {
                    parsedIssue = JSON.parse(issue);
                    // SECURITY: Remove dangerous prototype properties
                    if (parsedIssue && typeof parsedIssue === 'object') {
                        delete parsedIssue.__proto__;
                        delete parsedIssue.constructor;
                        delete parsedIssue.prototype;
                        // Create a clean object without prototype chain pollution
                        parsedIssue = Object.assign(Object.create(null), parsedIssue);
                    }
                } catch (parseErr) {
                    log.warn('[Security] Invalid JSON in issue parameter:', parseErr.message);
                    parsedIssue = {};
                }
            }
            
            const result = await crossProjectLearningService.getCrossProjectRecommendations(
                parsedIssue,
                projectId
            );
            res.json(result);
        } catch (err) {
            log.error('Get cross-project recommendations error:', err);
            // SECURITY: Use standardized error handling
            const { formatErrorResponse } = require('../utils/errors');
            const errorResponse = formatErrorResponse(err);
            res.status(errorResponse.statusCode).json(errorResponse);
        }
    });

    router.get('/learning/marketplace', optionalAuth, async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const result = await crossProjectLearningService.getPatternMarketplace(limit);
            res.json(result);
        } catch (err) {
            log.error('Get pattern marketplace error:', err);
            res.status(500).json({ error: err.message });
        }
    });
}

// Projects endpoint
router.get('/projects', optionalAuth, async (req, res) => {
    try {
        const organizationId = req.query.organizationId;
        
        if (supabase) {
            // Use database
            let query = supabase.from('projects').select('*');
            
            if (organizationId) {
                query = query.eq('organization_id', organizationId);
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) {
                log.error('Database error fetching projects:', error);
                return res.status(500).json({ 
                    success: false,
                    error: error.message,
                    projects: []
                });
            }
            
            // Transform database format to API format
            const projects = (data || []).map(proj => ({
                id: proj.id,
                organizationId: proj.organization_id,
                name: proj.name,
                slug: proj.slug,
                repository_url: proj.repository_url,
                repository_type: proj.repository_type,
                root_directory: proj.root_directory,
                language: proj.language,
                framework: proj.framework,
                createdAt: proj.created_at,
                updatedAt: proj.updated_at
            }));
            
            res.json({
                success: true,
                projects: projects,
                message: 'Projects loaded successfully'
            });
        } else {
            // Fallback to in-memory
            let projects = inMemoryStore.projects;
            if (organizationId) {
                projects = projects.filter(p => p.organizationId === organizationId);
            }
            res.json({
                success: true,
                projects: projects,
                message: 'Projects loaded successfully (in-memory)'
            });
        }
    } catch (err) {
        log.error('Projects endpoint error:', err);
        res.status(500).json({ 
            success: false,
            error: err.message,
            projects: []
        });
    }
});

// Create project endpoint
router.post('/projects', optionalAuth, async (req, res) => {
    try {
        const { organizationId, name, slug, repository_url, language, framework } = req.body;
        
        if (!name) {
            return res.status(400).json({ 
                success: false,
                error: 'Project name is required' 
            });
        }
        
        // SECURITY: Validate repository_url to prevent SSRF attacks
        if (repository_url) {
            try {
                const url = new URL(repository_url);
                // Only allow http/https protocols
                if (!['http:', 'https:'].includes(url.protocol)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid repository URL protocol'
                    });
                }
                // Block private/internal IP addresses (SSRF protection)
                const hostname = url.hostname;
                if (hostname === 'localhost' || hostname === '127.0.0.1' || 
                    hostname === '0.0.0.0' || hostname.startsWith('192.168.') ||
                    hostname.startsWith('10.') || hostname.startsWith('172.16.') ||
                    hostname.startsWith('172.17.') || hostname.startsWith('172.18.') ||
                    hostname.startsWith('172.19.') || hostname.startsWith('172.20.') ||
                    hostname.startsWith('172.21.') || hostname.startsWith('172.22.') ||
                    hostname.startsWith('172.23.') || hostname.startsWith('172.24.') ||
                    hostname.startsWith('172.25.') || hostname.startsWith('172.26.') ||
                    hostname.startsWith('172.27.') || hostname.startsWith('172.28.') ||
                    hostname.startsWith('172.29.') || hostname.startsWith('172.30.') ||
                    hostname.startsWith('172.31.') || hostname === '[::1]' ||
                    hostname === '::1' || hostname.startsWith('169.254.')) {
                    log.warn('[Security] Blocked SSRF attempt with internal IP:', repository_url);
                    return res.status(400).json({
                        success: false,
                        error: 'Repository URL cannot point to internal addresses'
                    });
                }
            } catch (urlError) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid repository URL format'
                });
            }
        }
        
        // Generate slug if not provided
        const projectSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        if (supabase) {
            // Use database
            // Check if slug already exists in the organization
            const { data: existing } = await supabase
                .from('projects')
                .select('id')
                .eq('organization_id', organizationId)
                .eq('slug', projectSlug)
                .single();
            
            if (existing) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Project with this slug already exists in this organization' 
                });
            }
            
            // Create project in database
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    organization_id: organizationId || null,
                    name: name,
                    slug: projectSlug,
                    repository_url: repository_url || null,
                    repository_type: 'github', // Default
                    root_directory: '.',
                    language: language || null,
                    framework: framework || null
                })
                .select()
                .single();
            
            if (error) {
                log.error('Database error creating project:', error);
                return res.status(500).json({ 
                    success: false,
                    error: error.message
                });
            }
            
            // Transform to API format
            const project = {
                id: data.id,
                organizationId: data.organization_id,
                name: data.name,
                slug: data.slug,
                repository_url: data.repository_url,
                repository_type: data.repository_type,
                root_directory: data.root_directory,
                language: data.language,
                framework: data.framework,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };
            
            res.json({
                success: true,
                project: project,
                message: 'Project created successfully'
            });
        } else {
            // Fallback to in-memory
            const existingProject = inMemoryStore.projects.find(
                p => p.slug === projectSlug && p.organizationId === organizationId
            );
            if (existingProject) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Project with this slug already exists in this organization' 
                });
            }
            
            const project = {
                id: 'proj-' + Date.now(),
                organizationId: organizationId || null,
                name: name,
                slug: projectSlug,
                repository_url: repository_url || null,
                language: language || null,
                framework: framework || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            inMemoryStore.projects.push(project);
            
            res.json({
                success: true,
                project: project,
                message: 'Project created successfully (in-memory)'
            });
        }
    } catch (err) {
        log.error('Create project error:', err);
        res.status(500).json({ 
            success: false,
            error: err.message
        });
    }
});

// Update project endpoint
router.put('/projects/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        if (supabase) {
            // Use database
            // Transform API format to database format
            const dbUpdates = {};
            if (updates.name !== undefined) dbUpdates.name = updates.name;
            if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
            // SECURITY: Validate repository_url to prevent SSRF attacks
            if (updates.repository_url !== undefined) {
                if (updates.repository_url === null) {
                    dbUpdates.repository_url = null;
                } else {
                    try {
                        const url = new URL(updates.repository_url);
                        // Only allow http/https protocols
                        if (!['http:', 'https:'].includes(url.protocol)) {
                            return res.status(400).json({
                                success: false,
                                error: 'Invalid repository URL protocol'
                            });
                        }
                        // Block private/internal IP addresses (SSRF protection)
                        const hostname = url.hostname;
                        if (hostname === 'localhost' || hostname === '127.0.0.1' || 
                            hostname === '0.0.0.0' || hostname.startsWith('192.168.') ||
                            hostname.startsWith('10.') || hostname.startsWith('172.16.') ||
                            hostname.startsWith('172.17.') || hostname.startsWith('172.18.') ||
                            hostname.startsWith('172.19.') || hostname.startsWith('172.20.') ||
                            hostname.startsWith('172.21.') || hostname.startsWith('172.22.') ||
                            hostname.startsWith('172.23.') || hostname.startsWith('172.24.') ||
                            hostname.startsWith('172.25.') || hostname.startsWith('172.26.') ||
                            hostname.startsWith('172.27.') || hostname.startsWith('172.28.') ||
                            hostname.startsWith('172.29.') || hostname.startsWith('172.30.') ||
                            hostname.startsWith('172.31.') || hostname === '[::1]' ||
                            hostname === '::1' || hostname.startsWith('169.254.')) {
                            log.warn('[Security] Blocked SSRF attempt with internal IP:', updates.repository_url);
                            return res.status(400).json({
                                success: false,
                                error: 'Repository URL cannot point to internal addresses'
                            });
                        }
                        dbUpdates.repository_url = updates.repository_url;
                    } catch (urlError) {
                        return res.status(400).json({
                            success: false,
                            error: 'Invalid repository URL format'
                        });
                    }
                }
            }
            if (updates.language !== undefined) dbUpdates.language = updates.language;
            if (updates.framework !== undefined) dbUpdates.framework = updates.framework;
            if (updates.organizationId !== undefined) dbUpdates.organization_id = updates.organizationId;
            
            const { data, error } = await supabase
                .from('projects')
                .update(dbUpdates)
                .eq('id', id)
                .select()
                .single();
            
            if (error) {
                log.error('Database error updating project:', error);
                return res.status(error.code === 'PGRST116' ? 404 : 500).json({ 
                    success: false,
                    error: error.message
                });
            }
            
            if (!data) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Project not found' 
                });
            }
            
            // Transform to API format
            const project = {
                id: data.id,
                organizationId: data.organization_id,
                name: data.name,
                slug: data.slug,
                repository_url: data.repository_url,
                repository_type: data.repository_type,
                root_directory: data.root_directory,
                language: data.language,
                framework: data.framework,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };
            
            res.json({
                success: true,
                project: project,
                message: 'Project updated successfully'
            });
        } else {
            // Fallback to in-memory
            const projectIndex = inMemoryStore.projects.findIndex(p => p.id === id);
            if (projectIndex === -1) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Project not found' 
                });
            }
            
            const project = inMemoryStore.projects[projectIndex];
            const updatedProject = {
                ...project,
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            inMemoryStore.projects[projectIndex] = updatedProject;
            
            res.json({
                success: true,
                project: updatedProject,
                message: 'Project updated successfully (in-memory)'
            });
        }
    } catch (err) {
        log.error('Update project error:', err);
        res.status(500).json({ 
            success: false,
            error: err.message
        });
    }
});

// Delete project endpoint
router.delete('/projects/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (supabase) {
            // Use database
            // First check if project exists
            const { data: existing } = await supabase
                .from('projects')
                .select('id')
                .eq('id', id)
                .single();
            
            if (!existing) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Project not found' 
                });
            }
            
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id);
            
            if (error) {
                log.error('Database error deleting project:', error);
                return res.status(500).json({ 
                    success: false,
                    error: error.message
                });
            }
            
            res.json({
                success: true,
                message: 'Project deleted successfully'
            });
        } else {
            // Fallback to in-memory
            const projectIndex = inMemoryStore.projects.findIndex(p => p.id === id);
            if (projectIndex === -1) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Project not found' 
                });
            }
            
            inMemoryStore.projects.splice(projectIndex, 1);
            
            res.json({
                success: true,
                message: 'Project deleted successfully (in-memory)'
            });
        }
    } catch (err) {
        log.error('Delete project error:', err);
        res.status(500).json({ 
            success: false,
            error: err.message
        });
    }
});

// Organizations endpoint
router.get('/organizations', optionalAuth, async (req, res) => {
    try {
        res.json({
            success: true,
            organizations: inMemoryStore.organizations,
            message: 'Organizations loaded successfully'
        });
    } catch (err) {
        log.error('Organizations endpoint error:', err);
        res.status(500).json({ 
            success: false,
            error: err.message,
            organizations: []
        });
    }
});

// Create organization endpoint (optionalAuth for now - can require auth later)
router.post('/organizations', optionalAuth, async (req, res) => {
    try {
        const { name, slug } = req.body;
        if (!name) {
            return res.status(400).json({ 
                success: false,
                error: 'Organization name is required' 
            });
        }
        
        // Generate slug if not provided
        const orgSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        if (supabase) {
            // Use database
            // Check if slug already exists
            const { data: existing } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', orgSlug)
                .single();
            
            if (existing) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Organization with this slug already exists' 
                });
            }
            
            // Create organization in database
            const { data, error } = await supabase
                .from('organizations')
                .insert({
                    name: name,
                    slug: orgSlug,
                    plan: 'starter' // Default plan
                })
                .select()
                .single();
            
            if (error) {
                log.error('Database error creating organization:', error);
                return res.status(500).json({ 
                    success: false,
                    error: error.message
                });
            }
            
            // Transform to API format
            const organization = {
                id: data.id,
                name: data.name,
                slug: data.slug,
                plan: data.plan,
                billing_email: data.billing_email,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };
            
            res.json({
                success: true,
                organization: organization,
                message: 'Organization created successfully'
            });
        } else {
            // Fallback to in-memory
            const existingOrg = inMemoryStore.organizations.find(org => org.slug === orgSlug);
            if (existingOrg) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Organization with this slug already exists' 
                });
            }
            
            const organization = {
                id: 'org-' + Date.now(),
                name: name,
                slug: orgSlug,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            inMemoryStore.organizations.push(organization);
            
            res.json({
                success: true,
                organization: organization,
                message: 'Organization created successfully (in-memory)'
            });
        }
    } catch (err) {
        log.error('Create organization error:', err);
        res.status(500).json({ 
            success: false,
            error: err.message
        });
    }
});

module.exports = router;

