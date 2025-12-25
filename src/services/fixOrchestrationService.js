/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixOrchestrationService.js
 * Last Sync: 2025-12-25T07:02:34.020Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Orchestration Service
 * Coordinates all fix services into a unified pipeline
 *
 * Improvement #1: Integration & Orchestration
 * System Architecture Expert - 2025-01-15 - Added Event Bus integration
 */

// Service Client integration - System Architecture Expert - 2025-01-15
// Migrated from direct requires to Service Client for retry logic, circuit breakers, and logging
let serviceClient = null;
let fixImpactPredictionService = null;
let fixConfidenceCalibrationService = null;
let fixVerificationService = null;
let fixApplicationService = null;
let fixRollbackIntelligenceService = null;
let explainabilityService = null;
let fixCostBenefitAnalysisService = null;
let issuePrioritizationService = null;

try {
  serviceClient = require("./serviceClient");
} catch (err) {
  log.warn(
    "[Fix Orchestration] Service Client not available, using direct requires:",
    err.message,
  );
  // Fallback to direct requires if Service Client not available
  fixImpactPredictionService = require("./fixImpactPredictionService");
  fixConfidenceCalibrationService = require("./fixConfidenceCalibrationService");
  fixVerificationService = require("./fixVerificationService");
  fixApplicationService = require("./fixApplicationService");
  fixRollbackIntelligenceService = require("./fixRollbackIntelligenceService");
  explainabilityService = require("./explainabilityService");
  fixCostBenefitAnalysisService = require("./fixCostBenefitAnalysisService");
  issuePrioritizationService = require("./issuePrioritizationService");
}

// Event Bus integration - System Architecture Expert - 2025-01-15
let eventBus = null;
try {
  eventBus = require("./eventBus");
} catch (err) {
  log.warn("[Fix Orchestration] Event Bus not available:", err.message);
}

class FixOrchestrationService {
  constructor() {
    this.pipelines = new Map();
    this.activeFixes = new Map();
  }

  /**
   * Orchestrate complete fix pipeline
   */
  async orchestrateFix(issue, context = {}) {
    // Handle null/undefined issue gracefully
    if (!issue) {
      return {
        success: false,
        error: "No issue provided",
        pipelineId: null,
      };
    }

    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Emit pipeline started event - System Architecture Expert - 2025-01-15
    if (eventBus) {
      await eventBus
        .emit(
          "code-roach:pipeline:started",
          {
            pipelineId,
            issue: {
              file: issue.file || context.filePath,
              line: issue.line,
              type: issue.type,
            },
            context: {
              method: context.method || "orchestration",
              projectId: context.projectId,
            },
          },
          { source: "fixOrchestrationService" },
        )
        .catch(() => {});
    }

    try {
      // Initialize pipeline
      const pipeline = {
        id: pipelineId,
        issue,
        context,
        stages: [],
        status: "running",
        startedAt: Date.now(),
        result: null,
      };

      this.pipelines.set(pipelineId, pipeline);

      // Stage 1: Analysis & Prioritization
      pipeline.stages.push(await this.stageAnalyze(issue, context));

      // Stage 2: Impact Prediction
      pipeline.stages.push(await this.stagePredictImpact(issue, context));

      // Stage 3: Cost-Benefit Analysis
      pipeline.stages.push(await this.stageCostBenefit(issue, context));

      // Stage 4: Fix Generation (delegated to appropriate service)
      pipeline.stages.push(await this.stageGenerateFix(issue, context));

      // Stage 5: Confidence Calibration
      pipeline.stages.push(await this.stageCalibrateConfidence(issue, context));

      // Stage 6: Verification
      pipeline.stages.push(await this.stageVerify(issue, context));

      // Stage 7: Explainability
      pipeline.stages.push(await this.stageExplain(issue, context));

      // Stage 8: Decision
      const decision = await this.stageDecision(pipeline);

      // Stage 9: Application (if approved)
      if (decision.action === "apply") {
        pipeline.stages.push(await this.stageApply(issue, context, decision));
      }

      // Stage 10: Monitoring (if applied)
      if (decision.action === "apply") {
        pipeline.stages.push(await this.stageMonitor(issue, context, decision));
      }

      pipeline.status = "completed";
      pipeline.completedAt = Date.now();
      pipeline.result = decision;

      // Emit pipeline completed event - System Architecture Expert - 2025-01-15
      if (eventBus) {
        await eventBus
          .emit(
            "code-roach:pipeline:completed",
            {
              pipelineId,
              status: "completed",
              decision: decision.action,
              duration: Date.now() - pipeline.startedAt,
              stages: pipeline.stages.length,
            },
            { source: "fixOrchestrationService" },
          )
          .catch(() => {});
      }

      return {
        success: true,
        pipelineId,
        pipeline,
        decision,
      };
    } catch (error) {
      console.error("[Fix Orchestration] Error:", error);
      const pipeline = this.pipelines.get(pipelineId);
      if (pipeline) {
        pipeline.status = "failed";
        pipeline.error = error.message;
      }

      // Emit pipeline failed event - System Architecture Expert - 2025-01-15
      if (eventBus) {
        await eventBus
          .emit(
            "code-roach:pipeline:failed",
            {
              pipelineId,
              error: error.message,
              duration: pipeline ? Date.now() - pipeline.startedAt : 0,
            },
            { source: "fixOrchestrationService" },
          )
          .catch(() => {});
      }

      return {
        success: false,
        pipelineId,
        error: error.message,
      };
    }
  }

  /**
   * Stage 1: Analyze issue
   */
  async stageAnalyze(issue, context) {
    const stage = {
      name: "analyze",
      startedAt: Date.now(),
      status: "running",
    };

    try {
      // Prioritize issue - System Architecture Expert - 2025-01-15 - Using Service Client
      const priority = serviceClient
        ? await serviceClient.call(
            "issuePrioritizationService",
            "prioritizeIssue",
            { issue, context },
            { retries: 2, useCircuitBreaker: true },
          )
        : await issuePrioritizationService.prioritizeIssue(issue, context);

      stage.result = {
        priority: priority.priority,
        score: priority.score,
        reasons: priority.reasons,
      };
      stage.status = "completed";
      stage.completedAt = Date.now();
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
    }

    return stage;
  }

  /**
   * Stage 2: Predict impact
   */
  async stagePredictImpact(issue, context) {
    const stage = {
      name: "predict_impact",
      startedAt: Date.now(),
      status: "running",
    };

    try {
      // Create mock fix for prediction
      const mockFix = {
        code: context.fixedCode || "",
        confidence: context.confidence || 0.8,
      };

      // Predict impact - System Architecture Expert - 2025-01-15 - Using Service Client
      const impact = serviceClient
        ? await serviceClient.call(
            "fixImpactPredictionService",
            "predictImpact",
            { mockFix, context: { ...context, issue } },
            { retries: 2, useCircuitBreaker: true },
          )
        : await fixImpactPredictionService.predictImpact(mockFix, {
            ...context,
            issue,
          });

      stage.result = impact.success ? impact.impact : null;
      stage.status = "completed";
      stage.completedAt = Date.now();
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
    }

    return stage;
  }

  /**
   * Stage 3: Cost-benefit analysis
   */
  async stageCostBenefit(issue, context) {
    const stage = {
      name: "cost_benefit",
      startedAt: Date.now(),
      status: "running",
    };

    try {
      const mockFix = {
        confidence: context.confidence || 0.8,
      };

      const analysis = await fixCostBenefitAnalysisService.analyzeCostBenefit(
        mockFix,
        {
          ...context,
          issue,
        },
      );

      stage.result = analysis.success ? analysis.analysis : null;
      stage.status = "completed";
      stage.completedAt = Date.now();
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
    }

    return stage;
  }

  /**
   * Stage 4: Generate fix (delegated)
   */
  async stageGenerateFix(issue, context) {
    const stage = {
      name: "generate_fix",
      startedAt: Date.now(),
      status: "running",
    };

    try {
      // This would delegate to appropriate fix generation service
      // For now, assume fix is already generated in context
      stage.result = {
        fix: context.fixedCode,
        method: context.method || "unknown",
        confidence: context.confidence || 0.8,
      };
      stage.status = "completed";
      stage.completedAt = Date.now();
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
    }

    return stage;
  }

  /**
   * Stage 5: Calibrate confidence
   */
  async stageCalibrateConfidence(issue, context) {
    const stage = {
      name: "calibrate_confidence",
      startedAt: Date.now(),
      status: "running",
    };

    try {
      // Calibrate confidence - System Architecture Expert - 2025-01-15 - Using Service Client
      const calibrated = serviceClient
        ? await serviceClient.call(
            "fixConfidenceCalibrationService",
            "calibrateConfidence",
            {
              confidence: context.confidence || 0.8,
              options: {
                method: context.method,
                domain: context.domain,
                filePath: context.filePath,
                issueType: issue.type,
              },
            },
            { retries: 2, useCircuitBreaker: true },
          )
        : await fixConfidenceCalibrationService.calibrateConfidence(
            context.confidence || 0.8,
            {
              method: context.method,
              domain: context.domain,
              filePath: context.filePath,
              issueType: issue.type,
            },
          );

      stage.result = calibrated;
      stage.status = "completed";
      stage.completedAt = Date.now();
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
    }

    return stage;
  }

  /**
   * Stage 6: Verify fix
   */
  async stageVerify(issue, context) {
    const stage = {
      name: "verify",
      startedAt: Date.now(),
      status: "running",
    };

    try {
      // Verify fix - System Architecture Expert - 2025-01-15 - Using Service Client
      const verification = serviceClient
        ? await serviceClient.call(
            "fixVerificationService",
            "verifyFix",
            {
              fixedCode: context.fixedCode,
              filePath: context.filePath,
              originalCode: context.originalCode,
            },
            { retries: 2, useCircuitBreaker: true },
          )
        : await fixVerificationService.verifyFix(
            context.fixedCode,
            context.filePath,
            context.originalCode,
          );

      stage.result = verification;
      stage.status = verification.overall ? "completed" : "failed";
      stage.completedAt = Date.now();
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
    }

    return stage;
  }

  /**
   * Stage 7: Explain fix
   */
  async stageExplain(issue, context) {
    const stage = {
      name: "explain",
      startedAt: Date.now(),
      status: "running",
    };

    try {
      const mockFix = {
        id: `fix-${Date.now()}`,
        code: context.fixedCode,
      };

      // Explain fix - System Architecture Expert - 2025-01-15 - Using Service Client
      const explanation = serviceClient
        ? await serviceClient.call(
            "explainabilityService",
            "explainFixEnhanced",
            { mockFix, context: { ...context, issue } },
            { retries: 2, useCircuitBreaker: true },
          )
        : await explainabilityService.explainFixEnhanced(mockFix, {
            ...context,
            issue,
          });

      stage.result = explanation.success ? explanation.explanation : null;
      stage.status = "completed";
      stage.completedAt = Date.now();
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
    }

    return stage;
  }

  /**
   * Stage 8: Make decision
   */
  async stageDecision(pipeline) {
    const stage = {
      name: "decision",
      startedAt: Date.now(),
      status: "running",
    };

    try {
      const impactStage = pipeline.stages.find(
        (s) => s.name === "predict_impact",
      );
      const costBenefitStage = pipeline.stages.find(
        (s) => s.name === "cost_benefit",
      );
      const verifyStage = pipeline.stages.find((s) => s.name === "verify");
      const calibrateStage = pipeline.stages.find(
        (s) => s.name === "calibrate_confidence",
      );

      // Decision logic
      let action = "defer";
      let reason = "";
      let confidence = 0;

      // Check verification
      if (!verifyStage || !verifyStage.result || !verifyStage.result.overall) {
        action = "reject";
        reason = "Fix verification failed";
      } else {
        // Check impact
        const impact = impactStage?.result;
        if (impact && impact.riskLevel === "high") {
          action = "review";
          reason = "High risk of breaking changes";
        } else {
          // Check cost-benefit
          const costBenefit = costBenefitStage?.result;
          if (costBenefit && costBenefit.roi > 0) {
            // Check calibrated confidence
            const calibrated = calibrateStage?.result;
            confidence = calibrated?.calibrated || 0.8;

            if (confidence >= 0.9 && costBenefit.roi > 200) {
              action = "apply";
              reason = "High confidence and high ROI";
            } else if (confidence >= 0.7 && costBenefit.roi > 100) {
              action = "apply";
              reason = "Good confidence and positive ROI";
            } else {
              action = "review";
              reason = "Requires human review";
            }
          } else {
            action = "defer";
            reason = "Negative or low ROI";
          }
        }
      }

      stage.result = {
        action,
        reason,
        confidence,
        requiresApproval: action === "review" || action === "apply",
      };
      stage.status = "completed";
      stage.completedAt = Date.now();

      return stage.result;
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
      return {
        action: "defer",
        reason: "Decision failed",
        confidence: 0,
      };
    }
  }

  /**
   * Stage 9: Apply fix
   */
  async stageApply(issue, context, decision) {
    const stage = {
      name: "apply",
      startedAt: Date.now(),
      status: "running",
    };

    try {
      const fixData = {
        filePath: context.filePath,
        originalCode: context.originalCode,
        fixedCode: context.fixedCode,
        issue,
        fix: {
          code: context.fixedCode,
          confidence: decision.confidence,
        },
      };

      // Apply fix - System Architecture Expert - 2025-01-15 - Using Service Client
      const result = serviceClient
        ? await serviceClient.call(
            "fixApplicationService",
            "applyFix",
            { fixData },
            { retries: 1, useCircuitBreaker: true },
          )
        : await fixApplicationService.applyFix(fixData);

      stage.result = result;
      stage.status = result.success ? "completed" : "failed";
      stage.completedAt = Date.now();
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
    }

    return stage;
  }

  /**
   * Stage 10: Monitor fix
   */
  async stageMonitor(issue, context, decision) {
    const stage = {
      name: "monitor",
      startedAt: Date.now(),
      status: "running",
    };

    try {
      const fixId = `fix-${Date.now()}`;
      // Monitor fix - System Architecture Expert - 2025-01-15 - Using Service Client
      const monitoring = serviceClient
        ? await serviceClient.call(
            "fixRollbackIntelligenceService",
            "monitorFix",
            { fixId, code: context.fixedCode, context: { ...context, issue } },
            { retries: 2, useCircuitBreaker: true },
          )
        : await fixRollbackIntelligenceService.monitorFix(
            fixId,
            { code: context.fixedCode },
            { ...context, issue },
          );

      stage.result = monitoring;
      stage.status = "completed";
      stage.completedAt = Date.now();
    } catch (error) {
      stage.status = "failed";
      stage.error = error.message;
    }

    return stage;
  }

  /**
   * Get pipeline status
   */
  getPipelineStatus(pipelineId) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return { error: "Pipeline not found" };
    }

    return {
      id: pipeline.id,
      status: pipeline.status,
      stages: pipeline.stages.map((s) => ({
        name: s.name,
        status: s.status,
        duration: s.completedAt ? s.completedAt - s.startedAt : null,
      })),
      result: pipeline.result,
      duration: pipeline.completedAt
        ? pipeline.completedAt - pipeline.startedAt
        : Date.now() - pipeline.startedAt,
    };
  }

  /**
   * Get all pipelines
   */
  getAllPipelines() {
    return Array.from(this.pipelines.values()).map((p) => ({
      id: p.id,
      status: p.status,
      startedAt: p.startedAt,
      completedAt: p.completedAt,
      duration: p.completedAt ? p.completedAt - p.startedAt : null,
    }));
  }
}

// Create singleton instance
const fixOrchestrationService = new FixOrchestrationService();

// Add metadata for auto-registration - System Architecture Expert - 2025-01-15
fixOrchestrationService.capabilities = [
  "fix-orchestration",
  "pipeline-coordination",
  "fix-decision",
];
fixOrchestrationService.dependencies = [
  "fixImpactPredictionService",
  "fixConfidenceCalibrationService",
  "fixVerificationService",
  "fixApplicationService",
  "fixRollbackIntelligenceService",
  "explainabilityService",
  "fixCostBenefitAnalysisService",
  "issuePrioritizationService",
];
fixOrchestrationService.version = "1.0.0";
fixOrchestrationService.description =
  "Coordinates all fix services into a unified pipeline";
fixOrchestrationService.category = "code-roach";

// Register with Service Registry if available
try {
  const serviceRegistry = require("./serviceRegistry");
  const { createLogger } = require("../utils/logger");
  const log = createLogger("FixOrchestrationService");
  serviceRegistry.register("fixOrchestrationService", fixOrchestrationService, {
    capabilities: fixOrchestrationService.capabilities,
    dependencies: fixOrchestrationService.dependencies,
    version: fixOrchestrationService.version,
    description: fixOrchestrationService.description,
    category: fixOrchestrationService.category,
  });
} catch (err) {
  // Service Registry not available - will be auto-registered
}

module.exports = fixOrchestrationService;
