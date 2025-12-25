/**
 * API Routes
 * Main API endpoint setup
 *
 * NOTE: Many routes have been extracted to modular files in ./api/
 * See ./api/aiGmRoutes.js, ./api/healthRoutes.js, ./api/sessionsRoutes.js
 */

const SessionPersistence = require("../sessionPersistence");
const { setupModularRoutes } = require("./api/index");
const { setupHealthRoutes } = require("./api/healthRoutes");
const { createLogger } = require("../utils/logger");
const log = createLogger("APIRoutes");

module.exports = function setupAPIRoutes(app, options = {}) {
  const {
    sessions = {},
    sessionCode = null,
    createSession = null,
    gameStateManager = null,
    io = null,
    findPlayerSocket = null,
    sessionManager = null,
    apiGateway = null, // Optional API Gateway for advanced routing
  } = options;

  // Setup modular routes (extracted from this file for maintainability)
  setupModularRoutes(app, options);

  // Setup health routes
  setupHealthRoutes(app, options);

  // Auth routes - Moved to ./api/authRoutes.js
  // Auth routes are now registered via setupModularRoutes()

  // API Gateway - Moved to ./api/gatewayRoutes.js
  // Gateway routes are now registered via setupModularRoutes()

  // Performance & Cost Tracking API - Performance & Scale Expert
  try {
    const performanceRoutes = require("./apiPerformance");
    app.use("/api/performance", performanceRoutes);
  } catch (err) {
    log.warn("⚠️ Performance API routes not available:", err.message);
  }

  if (createSession) {
    app.post("/api/sessions", (req, res) => {
      try {
        const session = createSession();
        res.json({ sessionCode: session.code, session });
      } catch (err) {
        // SECURITY: Use standardized error handling to prevent information disclosure
        const { formatErrorResponse } = require("../utils/errors");
        const errorResponse = formatErrorResponse(err);
        res.status(errorResponse.statusCode).json(errorResponse);
      }
    });
  }

  // Get session by code
  // SECURITY: Session codes are public identifiers, but we should validate access
  app.get("/api/sessions/:code", (req, res) => {
    const { code } = req.params;

    // SECURITY: Validate session code format (prevent injection)
    if (
      !code ||
      typeof code !== "string" ||
      code.length > 50 ||
      !/^[a-zA-Z0-9_-]+$/.test(code)
    ) {
      return res.status(400).json({ error: "Invalid session code format" });
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
      res.status(404).json({ error: "Session not found" });
    }
  });

  // Save session
  app.post("/api/sessions/:sessionCode/save", async (req, res) => {
    try {
      const { sessionCode } = req.params;
      const session = sessions[sessionCode];

      if (!session) {
        return res.status(404).json({
          success: false,
          error: "Session not found",
        });
      }

      // Use SessionPersistence to save
      const result = await SessionPersistence.saveSession(session);

      if (result.success) {
        res.json({ success: true, sessionCode: result.sessionCode });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Failed to save session",
        });
      }
    } catch (err) {
      console.error("Error saving session:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Internal server error",
      });
    }
  });

  // Load session
  app.post("/api/sessions/:sessionCode/load", async (req, res) => {
    try {
      const { sessionCode } = req.params;

      // Use SessionPersistence to load
      const result = await SessionPersistence.loadSession(sessionCode);

      if (result.success && result.data) {
        // Restore session to memory
        sessions[sessionCode] = result.data;

        res.json({
          success: true,
          session: result.data,
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error || "Session not found",
        });
      }
    } catch (err) {
      console.error("Error loading session:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Internal server error",
      });
    }
  });

  // List saved sessions
  app.get("/api/sessions/saved", async (req, res) => {
    try {
      const savedSessions = await SessionPersistence.listSavedSessions();
      res.json({
        success: true,
        sessions: savedSessions,
      });
    } catch (err) {
      console.error("Error listing saved sessions:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Internal server error",
      });
    }
  });

  // Async Mode API endpoints
  // Enable/disable async mode for a session
  app.post("/api/sessions/:sessionCode/async-mode", (req, res) => {
    try {
      const { sessionCode } = req.params;
      const { enabled, turnOrder } = req.body;
      const session = sessions[sessionCode];

      if (!session) {
        return res.status(404).json({
          success: false,
          error: "Session not found",
        });
      }

      // Initialize async mode if not exists
      if (!session.asyncMode) {
        session.asyncMode = {
          enabled: false,
          turnOrder: [],
          currentTurn: 0,
          pendingActions: {},
        };
      }

      // Update async mode
      session.asyncMode.enabled = enabled === true;
      if (turnOrder && Array.isArray(turnOrder)) {
        session.asyncMode.turnOrder = turnOrder;
      }

      res.json({
        success: true,
        asyncMode: session.asyncMode.enabled,
      });
    } catch (err) {
      console.error("Error setting async mode:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Internal server error",
      });
    }
  });

  // Get async mode status
  app.get("/api/sessions/:sessionCode/async-mode", (req, res) => {
    try {
      const { sessionCode } = req.params;
      const session = sessions[sessionCode];

      if (!session) {
        return res.status(404).json({
          success: false,
          error: "Session not found",
        });
      }

      const asyncMode = session.asyncMode || { enabled: false };
      res.json({
        success: true,
        asyncMode: asyncMode.enabled,
      });
    } catch (err) {
      console.error("Error getting async mode:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Internal server error",
      });
    }
  });

  // Submit async action
  app.post("/api/sessions/:sessionCode/async-action", (req, res) => {
    try {
      const { sessionCode } = req.params;
      const { playerId, action } = req.body;
      const session = sessions[sessionCode];

      if (!session) {
        return res.status(404).json({
          success: false,
          error: "Session not found",
        });
      }

      if (!session.asyncMode || !session.asyncMode.enabled) {
        return res.status(400).json({
          success: false,
          error: "Async mode is not enabled for this session",
        });
      }

      const { turnOrder, currentTurn, pendingActions } = session.asyncMode;
      const currentPlayerId = turnOrder[currentTurn];

      // Check if it's this player's turn
      if (playerId !== currentPlayerId) {
        return res.status(400).json({
          success: false,
          error: `Not your turn. Current turn: ${currentPlayerId || "none"}`,
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
        message: "Action queued",
        nextTurn: turnOrder[session.asyncMode.currentTurn],
      });
    } catch (err) {
      console.error("Error submitting async action:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Internal server error",
      });
    }
  });

  // Game state endpoints
  if (gameStateManager) {
    app.get("/api/game-state/:sessionCode", (req, res) => {
      const { sessionCode } = req.params;
      const state = gameStateManager.getState(sessionCode);
      if (state) {
        res.json(state);
      } else {
        res.status(404).json({ error: "Game state not found" });
      }
    });

    app.post("/api/game-state/:sessionCode", (req, res) => {
      const { sessionCode } = req.params;
      try {
        gameStateManager.setState(sessionCode, req.body);
        res.json({ success: true });
      } catch (err) {
        // SECURITY: Use standardized error handling to prevent information disclosure
        const { formatErrorResponse } = require("../utils/errors");
        const errorResponse = formatErrorResponse(err);
        res.status(errorResponse.statusCode).json(errorResponse);
      }
    });
  }

  // Player socket lookup
  if (findPlayerSocket) {
    app.get("/api/player-socket/:playerId", (req, res) => {
      const { playerId } = req.params;
      const socket = findPlayerSocket(playerId);
      if (socket) {
        res.json({ connected: true, socketId: socket.id });
      } else {
        res.json({ connected: false });
      }
    });
  }

  // Config routes - Moved to ./api/configRoutes.js
  // Supabase config and A/B testing routes are now registered via setupModularRoutes()

  // Code Roach API routes
  try {
    const { setupCodeRoachRoutes } = require("./codeRoachAPI");
    setupCodeRoachRoutes(app, options);
    log.info("Code Roach API routes registered");
  } catch (err) {
    log.warn("⚠️ Code Roach API routes not available:", err.message);
  }

  // Autonomous Mode API routes
  try {
    const autonomousModeAPI = require("./autonomousModeAPI");
    app.use("/api/autonomous", autonomousModeAPI);
    log.info("Autonomous Mode API routes registered");
  } catch (err) {
    log.warn("⚠️ Autonomous Mode API routes not available:", err.message);
  }
};

// ============================================
// ENGAGEMENT ANALYTICS (Sprint 2)
// ============================================

// Analytics routes - Moved to ./api/analyticsRoutes.js
// Analytics routes are now registered via setupModularRoutes()

// GitHub webhooks (for Code Roach)
try {
  const githubWebhooks = require("./githubWebhooks");
  app.use("/api/github", githubWebhooks);
  log.info("GitHub webhook routes registered");
} catch (err) {
  log.warn("⚠️ GitHub webhook routes not available:", err.message);
}

// Hybrid Storage API - Moved to ./api/storageRoutes.js
// Storage routes are now registered via setupModularRoutes()

// AI/ML Lead - AI GM Metrics API
try {
  const aiGMMetricsService = require("../services/aiGMMetricsService");

  app.get("/api/ai-gm/metrics", async (req, res) => {
    try {
      const metrics = aiGMMetricsService.getMetrics();
      res.json({
        success: true,
        data: metrics,
      });
    } catch (err) {
      log.error("AI GM metrics error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/ai-gm/metrics/period", async (req, res) => {
    try {
      const startTime =
        req.query.start ||
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Default: last 24 hours
      const endTime = req.query.end || new Date().toISOString();

      const metrics = await aiGMMetricsService.getMetricsForPeriod(
        startTime,
        endTime,
      );
      res.json({
        success: true,
        data: metrics,
        period: { start: startTime, end: endTime },
      });
    } catch (err) {
      log.error("AI GM metrics period error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  log.info("AI GM Metrics API routes registered");
} catch (err) {
  log.warn("⚠️ AI GM Metrics routes not available:", err.message);
}

// AI GM Explainability API Endpoints - HEAD OF AI - Short-Term Enhancements
try {
  const aiGMExplainabilityService = require("../services/aiGMExplainabilityService");

  // Get explanation for specific response ID
  app.get("/api/ai-gm/explain/:responseId", async (req, res) => {
    try {
      const { responseId } = req.params;
      const explanation = aiGMExplainabilityService.getExplanation(responseId);

      if (!explanation) {
        return res.status(404).json({
          success: false,
          error: "Explanation not found for response ID",
        });
      }

      res.json({
        success: true,
        data: explanation,
      });
    } catch (err) {
      log.error("AI GM explain error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get explanation for most recent response
  app.get("/api/ai-gm/explain/latest", async (req, res) => {
    try {
      // Get latest explanation from cache (most recent timestamp)
      const explanations = aiGMExplainabilityService.getAllExplanations();

      if (!explanations || explanations.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No explanations available",
        });
      }

      // Sort by timestamp (most recent first)
      const sorted = explanations.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
      );

      res.json({
        success: true,
        data: sorted[0],
        totalAvailable: explanations.length,
        timestamp: sorted[0].timestamp,
      });
    } catch (err) {
      log.error("AI GM explain latest error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  log.info("AI GM Explainability API routes registered");
} catch (err) {
  log.warn("⚠️ AI GM Explainability routes not available:", err.message);
}

// AI GM Calibration API Endpoint - HEAD OF AI - Short-Term Enhancements
try {
  const aiGMConfidenceCalibrationService = require("../services/aiGMConfidenceCalibrationService");

  // Get calibration dashboard data
  app.get("/api/ai-gm/calibration", async (req, res) => {
    try {
      // Get all calibration data
      const allData =
        await aiGMConfidenceCalibrationService.queryCalibrationData(null, null);

      if (!allData || allData.length === 0) {
        return res.json({
          success: true,
          data: {
            totalPredictions: 0,
            calibrationAccuracy: 0,
            overconfident: 0,
            underconfident: 0,
            wellCalibrated: 0,
            trend: "stable",
            scatterData: [],
            calibrationCurve: [],
            errorByBucket: [],
            historicalTrend: [],
          },
        });
      }

      // Calculate metrics
      const metrics = calculateCalibrationMetrics(allData);

      // Generate scatter plot data
      const scatterData = allData.map((d) => ({
        predicted: parseFloat(d.predicted_quality),
        actual: parseFloat(d.actual_quality),
      }));

      // Generate calibration curve (bucketed)
      const calibrationCurve = generateCalibrationCurve(allData);

      // Generate error by bucket
      const errorByBucket = generateErrorByBucket(allData);

      // Generate historical trend (last 30 days)
      const historicalTrend = await generateHistoricalTrend(
        aiGMConfidenceCalibrationService,
      );

      res.json({
        success: true,
        data: {
          ...metrics,
          scatterData: scatterData,
          calibrationCurve: calibrationCurve,
          errorByBucket: errorByBucket,
          historicalTrend: historicalTrend,
        },
      });
    } catch (err) {
      log.error("AI GM calibration error:", err);
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

    data.forEach((d) => {
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
    const trend = "stable";

    return {
      totalPredictions: total,
      calibrationAccuracy: Math.max(0, Math.min(1, calibrationAccuracy)),
      overconfident: overconfident,
      underconfident: underconfident,
      wellCalibrated: wellCalibrated,
      trend: trend,
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

      const bucketData = data.filter((d) => {
        const pred = parseFloat(d.predicted_quality);
        return pred >= min && pred < max;
      });

      if (bucketData.length > 0) {
        const avgPredicted =
          bucketData.reduce(
            (sum, d) => sum + parseFloat(d.predicted_quality),
            0,
          ) / bucketData.length;
        const avgActual =
          bucketData.reduce((sum, d) => sum + parseFloat(d.actual_quality), 0) /
          bucketData.length;

        curve.push({
          bucket: `${(min * 100).toFixed(0)}-${(max * 100).toFixed(0)}%`,
          predicted: avgPredicted,
          actual: avgActual,
          count: bucketData.length,
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

      const bucketData = data.filter((d) => {
        const pred = parseFloat(d.predicted_quality);
        return pred >= min && pred < max;
      });

      if (bucketData.length > 0) {
        const avgError =
          bucketData.reduce((sum, d) => {
            return (
              sum +
              Math.abs(
                parseFloat(d.predicted_quality) - parseFloat(d.actual_quality),
              )
            );
          }, 0) / bucketData.length;

        errors.push({
          bucket: `${(min * 100).toFixed(0)}-${(max * 100).toFixed(0)}%`,
          error: avgError,
          count: bucketData.length,
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
        .from("ai_gm_quality_learning")
        .select("predicted_quality, actual_quality, created_at")
        .not("predicted_quality", "is", null)
        .not("actual_quality", "is", null)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error || !data) return [];

      // Group by date and calculate daily accuracy
      const dailyData = {};
      data.forEach((d) => {
        const date = new Date(d.created_at).toISOString().split("T")[0];
        if (!dailyData[date]) {
          dailyData[date] = { predictions: [], errors: [] };
        }
        const error = Math.abs(
          parseFloat(d.predicted_quality) - parseFloat(d.actual_quality),
        );
        dailyData[date].errors.push(error);
      });

      return Object.keys(dailyData)
        .sort()
        .map((date) => {
          const errors = dailyData[date].errors;
          const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
          return {
            date: date,
            accuracy: Math.max(0, Math.min(1, 1 - avgError)),
          };
        });
    } catch (err) {
      log.warn("[Calibration API] Error generating historical trend:", err);
      return [];
    }
  }

  log.info("AI GM Calibration API route registered");
} catch (err) {
  log.warn("⚠️ AI GM Calibration route not available:", err.message);
}

// AI GM Engagement Events API - HEAD OF AI - Optional Enhancement
try {
  const aiGMEngagementEventsService = require("../services/aiGMEngagementEventsService");

  // Track engagement event
  app.post("/api/ai-gm/engagement/track", async (req, res) => {
    try {
      const { eventType, eventData, context } = req.body;

      if (!eventType) {
        return res.status(400).json({ error: "eventType is required" });
      }

      await aiGMEngagementEventsService.trackEvent(
        eventType,
        eventData || {},
        context || {},
      );

      res.json({ success: true });
    } catch (err) {
      log.error("AI GM engagement tracking error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get engagement events
  app.get("/api/ai-gm/engagement/events", async (req, res) => {
    try {
      const filters = {
        sessionId: req.query.sessionId,
        userId: req.query.userId,
        eventType: req.query.eventType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const events =
        await aiGMEngagementEventsService.getEngagementEvents(filters);

      res.json({
        success: true,
        data: events,
        count: events.length,
      });
    } catch (err) {
      log.error("AI GM engagement events error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  log.info("AI GM Engagement Events API routes registered");
} catch (err) {
  log.warn("⚠️ AI GM Engagement Events routes not available:", err.message);
}

// AI GM Quality Feedback API - HEAD OF AI - Optional Enhancement
try {
  const aiGMQualityFeedbackService = require("../services/aiGMQualityFeedbackService");

  // Submit quality feedback
  app.post("/api/ai-gm/quality/feedback", async (req, res) => {
    try {
      const { responseId, qualityRating, feedback } = req.body;

      if (!responseId || qualityRating === undefined) {
        return res.status(400).json({
          error: "responseId and qualityRating are required",
        });
      }

      if (qualityRating < 0 || qualityRating > 1) {
        return res.status(400).json({
          error: "qualityRating must be between 0 and 1",
        });
      }

      const result = await aiGMQualityFeedbackService.submitFeedback(
        responseId,
        qualityRating,
        feedback || {},
      );

      // HEAD OF AI: Record CSAT when feedback is submitted
      if (result.success) {
        try {
          const aiGMCSATOptimizationService = require("../services/aiGMCSATOptimizationService");
          await aiGMCSATOptimizationService.recordCSAT({
            responseId: responseId,
            qualityRating: qualityRating,
            feedbackText: feedback?.feedbackText || feedback?.feedback_text,
            sessionId: feedback?.sessionId || feedback?.session_id,
            userId: feedback?.userId || feedback?.user_id,
            provider: feedback?.provider || result.feedback?.provider || null, // Sprint 8.1: Provider tracking
            model: feedback?.model || result.feedback?.model || null, // Sprint 8.2: Model tracking
          });
        } catch (csatErr) {
          log.warn(
            "[API] Error recording CSAT (non-fatal):",
            csatErr.message,
          );
        }
      }

      res.json(result);
    } catch (err) {
      log.error("AI GM quality feedback error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get feedback for a response
  app.get("/api/ai-gm/quality/feedback/:responseId", async (req, res) => {
    try {
      const { responseId } = req.params;
      const feedback =
        await aiGMQualityFeedbackService.getFeedbackForResponse(responseId);

      res.json({
        success: true,
        data: feedback,
        count: feedback.length,
      });
    } catch (err) {
      log.error("AI GM quality feedback get error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get feedback statistics
  app.get("/api/ai-gm/quality/feedback-stats", async (req, res) => {
    try {
      const filters = {
        scenarioId: req.query.scenarioId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const stats = await aiGMQualityFeedbackService.getFeedbackStats(filters);

      res.json({
        success: true,
        data: stats,
      });
    } catch (err) {
      log.error("AI GM quality feedback stats error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  log.info("AI GM Quality Feedback API routes registered");
} catch (err) {
  log.warn("⚠️ AI GM Quality Feedback routes not available:", err.message);
}

// HEAD OF AI: A/B Testing API endpoints
try {
  const aiGMABTestingService = require("../services/aiGMABTestingService");

  // Create new experiment
  app.post("/api/ai-gm/ab-tests", async (req, res) => {
    try {
      const result = await aiGMABTestingService.createExperiment(req.body);
      res.json(result);
    } catch (err) {
      console.error("[API] Error creating A/B test:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get all experiments
  app.get("/api/ai-gm/ab-tests", async (req, res) => {
    try {
      const status = req.query.status || null;
      const experiments = await aiGMABTestingService.getAllExperiments(status);
      res.json({ success: true, experiments });
    } catch (err) {
      console.error("[API] Error getting A/B tests:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get experiment results
  app.get("/api/ai-gm/ab-tests/:experimentName/results", async (req, res) => {
    try {
      const { experimentName } = req.params;
      const filters = {
        variant: req.query.variant || null,
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
      };
      const results = await aiGMABTestingService.getExperimentResults(
        experimentName,
        filters,
      );
      res.json({ success: true, results });
    } catch (err) {
      console.error("[API] Error getting A/B test results:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  log.info("AI GM A/B Testing API routes registered");
} catch (err) {
  log.warn("[API] AI GM A/B Testing service not available:", err.message);
}

// HEAD OF AI: Quality Prediction API endpoints
try {
  const aiGMQualityPredictionService = require("../services/aiGMQualityPredictionService");

  // Get prediction statistics
  app.get("/api/ai-gm/quality/prediction/stats", async (req, res) => {
    try {
      const stats = aiGMQualityPredictionService.getPredictionStats();
      res.json({ success: true, stats });
    } catch (err) {
      console.error("[API] Error getting prediction stats:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Predict quality for a context
  app.post("/api/ai-gm/quality/prediction", async (req, res) => {
    try {
      const prediction = aiGMQualityPredictionService.predictQuality(req.body);
      res.json({ success: true, prediction });
    } catch (err) {
      console.error("[API] Error predicting quality:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  log.info("AI GM Quality Prediction API routes registered");
} catch (err) {
  log.warn(
    "[API] AI GM Quality Prediction service not available:",
    err.message,
  );
}

// HEAD OF AI: Multi-Model Ensemble API endpoints
try {
  const aiGMMultiModelEnsembleService = require("../services/aiGMMultiModelEnsembleService");

  // Get ensemble statistics
  app.get("/api/ai-gm/ensemble/stats", async (req, res) => {
    try {
      const stats = aiGMMultiModelEnsembleService.getStats();
      res.json({ success: true, stats });
    } catch (err) {
      console.error("[API] Error getting ensemble stats:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  log.info("AI GM Multi-Model Ensemble API routes registered");
} catch (err) {
  log.warn(
    "[API] AI GM Multi-Model Ensemble service not available:",
    err.message,
  );
}

// HEAD OF AI: CSAT Optimization API endpoints
try {
  const aiGMCSATOptimizationService = require("../services/aiGMCSATOptimizationService");
  const aiGMQualityFeedbackService = require("../services/aiGMQualityFeedbackService");

  // Get CSAT optimization stats
  app.get("/api/ai-gm/csat/stats", async (req, res) => {
    try {
      const stats = await aiGMCSATOptimizationService.getStats();
      res.json({ success: true, stats });
    } catch (err) {
      console.error("[API] Error getting CSAT stats:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Record CSAT from quality feedback (called when feedback is submitted)
  app.post("/api/ai-gm/csat/record", async (req, res) => {
    try {
      const {
        responseId,
        qualityRating,
        feedbackText,
        sessionId,
        userId,
        provider,
        model,
      } = req.body;
      await aiGMCSATOptimizationService.recordCSAT({
        responseId,
        qualityRating,
        feedbackText,
        sessionId,
        userId,
        provider: provider || null, // Sprint 8.1: Provider tracking
        model: model || null, // Sprint 8.2: Model tracking
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[API] Error recording CSAT:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get CSAT optimization recommendations
  app.get("/api/ai-gm/csat/recommendations", async (req, res) => {
    try {
      const stats = aiGMCSATOptimizationService.getStats();
      res.json({ success: true, recommendations: stats.recommendations });
    } catch (err) {
      console.error("[API] Error getting CSAT recommendations:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get A/B test recommendation based on CSAT
  app.get(
    "/api/ai-gm/csat/ab-test-recommendation/:experimentName",
    async (req, res) => {
      try {
        const { experimentName } = req.params;
        const aiGMABTestingService = require("../services/aiGMABTestingService");
        const results =
          await aiGMABTestingService.getExperimentResults(experimentName);
        const recommendation =
          aiGMCSATOptimizationService.getABTestRecommendation(results);
        res.json({ success: true, recommendation, results });
      } catch (err) {
        console.error("[API] Error getting CSAT A/B test recommendation:", err);
        res.status(500).json({ success: false, error: err.message });
      }
    },
  );

  log.info("AI GM CSAT Optimization API routes registered");
} catch (err) {
  log.warn(
    "[API] AI GM CSAT Optimization service not available:",
    err.message,
  );
}

// HEAD OF AI: Admin Hub Overview API
try {
  app.get("/api/admin/overview", async (req, res) => {
    try {
      const overview = {
        aiGM: {},
        experiments: {},
        system: {},
        services: {},
      };

      // AI GM Metrics
      try {
        const aiGMMetricsService = require("../services/aiGMMetricsService");
        const metrics = aiGMMetricsService.getMetrics();

        // Extract quality (handle both number and object)
        let quality = 0;
        if (metrics.quality) {
          if (typeof metrics.quality === "object") {
            quality = metrics.quality.average || 0;
          } else {
            quality = metrics.quality;
          }
        }

        // Extract response rate (handle both number and object)
        // Note: percentage is 0-100, convert to 0-1
        let responseRate = 0;
        if (metrics.responseRate) {
          if (typeof metrics.responseRate === "object") {
            responseRate = (metrics.responseRate.percentage || 0) / 100;
          } else {
            responseRate = metrics.responseRate;
          }
        }

        overview.aiGM = {
          quality: quality,
          responseRate: responseRate,
          avgResponseTime: metrics.avgResponseTime || 0,
          totalResponses: metrics.totalResponses || 0,
        };
      } catch (err) {
        log.warn("[Admin Hub] Error loading AI GM metrics:", err.message);
      }

      // A/B Tests
      try {
        const aiGMABTestingService = require("../services/aiGMABTestingService");
        const experiments =
          await aiGMABTestingService.getAllExperiments("active");
        overview.experiments = {
          active: experiments.length || 0,
          total: (await aiGMABTestingService.getAllExperiments()).length || 0,
        };
      } catch (err) {
        log.warn("[Admin Hub] Error loading experiments:", err.message);
      }

      // Quality Prediction
      try {
        const aiGMQualityPredictionService = require("../services/aiGMQualityPredictionService");
        const stats = aiGMQualityPredictionService.getPredictionStats();
        overview.aiGM.predictionConfidence = stats.confidence || 0;
        overview.aiGM.predictionSamples = stats.sampleCount || 0;
      } catch (err) {
        log.warn(
          "[Admin Hub] Error loading prediction stats:",
          err.message,
        );
      }

      // System Health
      try {
        const serviceRegistry = require("../services/serviceRegistry");
        const services = serviceRegistry.getAllServices();
        const operational = Object.values(services).filter(
          (s) => s.status === "operational",
        ).length;
        overview.system = {
          totalServices: Object.keys(services).length,
          operational: operational,
          healthPercentage:
            Object.keys(services).length > 0
              ? (operational / Object.keys(services).length) * 100
              : 100,
        };
      } catch (err) {
        log.warn("[Admin Hub] Error loading system health:", err.message);
      }

      res.json({ success: true, overview });
    } catch (err) {
      console.error("[API] Error getting admin overview:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  log.info("Admin Hub Overview API route registered");
} catch (err) {
  log.warn("[API] Admin Hub Overview route not available:", err.message);
}

// AI GM Services Health Endpoints - AI GM Team - Phase 1 - 2025-01-15
try {
  const serviceRegistry = require("../services/serviceRegistry");

  // Get health status for all AI GM services
  // AI GM Health Endpoint - Phase 1
  app.get("/api/ai-gm/health", async (req, res) => {
    try {
      const aiGMServices = [
        "fallbackResponseService",
        "responseTimeoutService",
        "scenarioKnowledgeService",
        "eventHandlerAuditService",
        "narrativeQualityService",
        "proactiveNarrativeService",
        "playerSentimentService",
        "adaptiveDifficultyService",
        "deepPersonalizationService",
        "emotionalIntelligenceService",
        "predictiveAnticipationService",
        "multiAgentGMService",
        "surpriseAndDelightService",
        "collaborativeStorytellingService",
        "personalityVariationService",
        "llmService",
        "aiGMMemoryService",
        "enhancedContextAwarenessService",
      ];

      const health = {};
      let allHealthy = true;

      for (const serviceName of aiGMServices) {
        const service = serviceRegistry.get(serviceName);
        if (service && typeof service.getHealth === "function") {
          try {
            health[serviceName] = await service.getHealth();
            if (health[serviceName].status !== "healthy") {
              allHealthy = false;
            }
          } catch (error) {
            health[serviceName] = {
              status: "error",
              error: error.message,
            };
            allHealthy = false;
          }
        } else {
          health[serviceName] = {
            status: "not_registered",
            message: "Service not found in registry",
          };
        }
      }

      const statusCode = allHealthy ? 200 : 503;
      res.status(statusCode).json({
        status: allHealthy ? "healthy" : "degraded",
        services: health,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        status: "error",
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Get coverage report from event handler audit service
  app.get("/api/ai-gm/coverage", async (req, res) => {
    try {
      const eventHandlerAuditService = serviceRegistry.get(
        "eventHandlerAuditService",
      );
      if (!eventHandlerAuditService) {
        return res.status(404).json({
          error: "Event Handler Audit Service not found",
        });
      }

      const report = eventHandlerAuditService.getCoverageReport();
      res.json(report);
    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  });

  // Trigger event handler audit
  app.post("/api/ai-gm/audit", async (req, res) => {
    try {
      const eventHandlerAuditService = serviceRegistry.get(
        "eventHandlerAuditService",
      );
      if (!eventHandlerAuditService) {
        return res.status(404).json({
          error: "Event Handler Audit Service not found",
        });
      }

      const report = await eventHandlerAuditService.auditEventHandlers();
      res.json({
        success: true,
        report,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  // Auto-fix missing handlers
  app.post("/api/ai-gm/auto-fix", async (req, res) => {
    try {
      const eventHandlerAuditService = serviceRegistry.get(
        "eventHandlerAuditService",
      );
      if (!eventHandlerAuditService) {
        return res.status(404).json({
          error: "Event Handler Audit Service not found",
        });
      }

      const results = await eventHandlerAuditService.autoFixMissingHandlers();
      res.json({
        success: true,
        results,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  log.info("AI GM Services Health API routes registered");
} catch (err) {
  log.warn("⚠️ AI GM Services Health routes not available:", err.message);
}

// Event Bus API Endpoints - System Architecture Expert - 2025-01-15
// Event-Driven Architecture Enhancement
try {
  const eventBus = require("../services/eventBus");
  const eventBusEnhancements = require("../services/eventBusEnhancements");

  // Get event bus statistics
  app.get("/api/events/stats", (req, res) => {
    try {
      const stats = eventBus.getStats();
      const enhancements = eventBusEnhancements.getMetrics();
      res.json({
        success: true,
        eventBus: stats,
        enhancements: enhancements,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  // Get event history
  app.get("/api/events/history", (req, res) => {
    try {
      const eventType = req.query.type || null;
      const limit = parseInt(req.query.limit) || 100;
      const since = req.query.since ? parseInt(req.query.since) : null;

      const history = eventBus.getHistory({
        eventType,
        limit,
        since,
      });

      res.json({
        success: true,
        events: history,
        count: history.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  // Get registered event types
  app.get("/api/events/types", (req, res) => {
    try {
      const eventTypes = eventBus.getEventTypes();
      const registeredEvents = eventBusEnhancements.getRegisteredEvents();

      res.json({
        success: true,
        eventTypes: eventTypes,
        registeredEvents: registeredEvents,
        count: eventTypes.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  // Get subscribers for an event type
  app.get("/api/events/subscribers/:eventType", (req, res) => {
    try {
      const eventType = req.params.eventType;
      const subscribers = eventBus.getSubscribers(eventType);

      res.json({
        success: true,
        eventType: eventType,
        subscribers: subscribers,
        count: subscribers.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  });

  log.info("Event Bus API routes registered");
} catch (err) {
  log.warn("⚠️ Event Bus API routes not available:", err.message);
}

log.info("API routes registered");
