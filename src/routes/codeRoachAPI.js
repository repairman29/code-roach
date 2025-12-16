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
            const result = await crossProjectLearningService.getCrossProjectRecommendations(
                JSON.parse(issue || '{}'),
                projectId
            );
            res.json(result);
        } catch (err) {
            log.error('Get cross-project recommendations error:', err);
            res.status(500).json({ error: err.message });
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

module.exports = router;

