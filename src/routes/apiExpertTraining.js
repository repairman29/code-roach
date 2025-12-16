/**
 * Expert Training API Routes
 * REST API endpoints for customer expert training system
 */

const express = require('express');
const router = express.Router();
const customerOnboardingService = require('../services/customerOnboardingService');
const expertTrainingService = require('../services/expertTrainingService');
const customerCodebaseAnalyzer = require('../services/customerCodebaseAnalyzer');

/**
 * POST /api/expert-training/onboard
 * Start onboarding process for a project
 */
router.post('/onboard', async (req, res) => {
    try {
        const { project_id, repository_url, options } = req.body;

        if (!project_id || !repository_url) {
            return res.status(400).json({
                error: 'Missing required fields: project_id, repository_url'
            });
        }

        const result = await customerOnboardingService.startOnboarding(
            project_id,
            repository_url,
            options || {}
        );

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        console.error('[Expert Training API] Error starting onboarding:', err);
        res.status(500).json({
            error: 'Failed to start onboarding',
            message: err.message
        });
    }
});

/**
 * GET /api/expert-training/status/:projectId
 * Get onboarding status for a project
 */
router.get('/status/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const status = await customerOnboardingService.getOnboardingStatus(projectId);

        res.json({
            success: true,
            data: status
        });
    } catch (err) {
        console.error('[Expert Training API] Error getting status:', err);
        res.status(500).json({
            error: 'Failed to get onboarding status',
            message: err.message
        });
    }
});

/**
 * POST /api/expert-training/retry/:projectId
 * Retry failed onboarding
 */
router.post('/retry/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { repository_url } = req.body;

        if (!repository_url) {
            return res.status(400).json({
                error: 'Missing required field: repository_url'
            });
        }

        const result = await customerOnboardingService.retryOnboarding(projectId, repository_url);

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        console.error('[Expert Training API] Error retrying onboarding:', err);
        res.status(500).json({
            error: 'Failed to retry onboarding',
            message: err.message
        });
    }
});

/**
 * POST /api/expert-training/update/:projectId
 * Update experts for a project (re-analyze and regenerate)
 */
router.post('/update/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { repository_url } = req.body;

        if (!repository_url) {
            return res.status(400).json({
                error: 'Missing required field: repository_url'
            });
        }

        const result = await customerOnboardingService.updateExperts(projectId, repository_url);

        res.json({
            success: true,
            data: result
        });
    } catch (err) {
        console.error('[Expert Training API] Error updating experts:', err);
        res.status(500).json({
            error: 'Failed to update experts',
            message: err.message
        });
    }
});

/**
 * GET /api/expert-training/experts/:projectId
 * Get all expert guides for a project
 */
router.get('/experts/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { expert_type } = req.query;

        // This would query the database for expert guides
        // For now, return a placeholder
        res.json({
            success: true,
            data: {
                project_id: projectId,
                experts: [],
                message: 'Expert guides endpoint - implementation needed'
            }
        });
    } catch (err) {
        console.error('[Expert Training API] Error getting experts:', err);
        res.status(500).json({
            error: 'Failed to get expert guides',
            message: err.message
        });
    }
});

/**
 * GET /api/expert-training/analysis/:projectId
 * Get codebase analysis for a project
 */
router.get('/analysis/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const analysis = await customerCodebaseAnalyzer.getCachedAnalysis(projectId);

        if (!analysis) {
            return res.status(404).json({
                error: 'Analysis not found for this project'
            });
        }

        res.json({
            success: true,
            data: analysis
        });
    } catch (err) {
        console.error('[Expert Training API] Error getting analysis:', err);
        res.status(500).json({
            error: 'Failed to get codebase analysis',
            message: err.message
        });
    }
});

/**
 * POST /api/expert-training/analyze/:projectId
 * Trigger codebase analysis for a project
 */
router.post('/analyze/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { repository_url } = req.body;

        if (!repository_url) {
            return res.status(400).json({
                error: 'Missing required field: repository_url'
            });
        }

        const analysis = await customerCodebaseAnalyzer.analyzeCodebase(projectId, repository_url);

        res.json({
            success: true,
            data: analysis
        });
    } catch (err) {
        console.error('[Expert Training API] Error analyzing codebase:', err);
        res.status(500).json({
            error: 'Failed to analyze codebase',
            message: err.message
        });
    }
});

module.exports = router;

