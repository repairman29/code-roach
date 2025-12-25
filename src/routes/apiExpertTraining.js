/**
 * Expert Training API Routes
 * REST API endpoints for customer expert training system
 */

const express = require("express");
const router = express.Router();
const customerOnboardingService = require("../services/customerOnboardingService");
const customerCodebaseAnalyzer = require("../services/customerCodebaseAnalyzer");

const {
  asyncHandler,
  ValidationError,
  NotFoundError,
} = require("../utils/errorHandler");
const { sendSuccess } = require("../utils/responseHandler");

router.post(
  "/onboard",
  asyncHandler(async (req, res) => {
    const { project_id, repository_url, options } = req.body;

    if (!project_id || !repository_url) {
      throw new ValidationError(
        "Missing required fields: project_id, repository_url",
      );
    }

    const result = await customerOnboardingService.startOnboarding(
      project_id,
      repository_url,
      options || {},
    );
    sendSuccess(res, result);
  }),
);

router.get(
  "/status/:projectId",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const status =
      await customerOnboardingService.getOnboardingStatus(projectId);
    sendSuccess(res, status);
  }),
);

router.post(
  "/retry/:projectId",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { repository_url } = req.body;

    if (!repository_url) {
      throw new ValidationError("Missing required field: repository_url");
    }

    const result = await customerOnboardingService.retryOnboarding(
      projectId,
      repository_url,
    );
    sendSuccess(res, result);
  }),
);

router.post(
  "/update/:projectId",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { repository_url } = req.body;

    if (!repository_url) {
      throw new ValidationError("Missing required field: repository_url");
    }

    const result = await customerOnboardingService.updateExperts(
      projectId,
      repository_url,
    );
    sendSuccess(res, result);
  }),
);

router.get(
  "/experts/:projectId",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    sendSuccess(res, {
      project_id: projectId,
      experts: [],
      message: "Expert guides endpoint - implementation needed",
    });
  }),
);

router.get(
  "/analysis/:projectId",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const analysis =
      await customerCodebaseAnalyzer.getCachedAnalysis(projectId);

    if (!analysis) {
      throw new NotFoundError("Analysis not found for this project");
    }

    sendSuccess(res, analysis);
  }),
);

router.post(
  "/analyze/:projectId",
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const { repository_url } = req.body;

    if (!repository_url) {
      throw new ValidationError("Missing required field: repository_url");
    }

    const analysis = await customerCodebaseAnalyzer.analyzeCodebase(
      projectId,
      repository_url,
    );
    sendSuccess(res, analysis);
  }),
);

module.exports = router;
