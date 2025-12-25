/**
 * Code Roach API Routes
 * Main aggregator for all Code Roach endpoints
 *
 * NOTE: All routes have been extracted to modular files in ./codeRoach/
 * See ./codeRoach/crawlerRoutes.js, ./codeRoach/analyticsRoutes.js, etc.
 */

const express = require("express");
const router = express.Router();
const { createLogger } = require("../utils/logger");
const { setupModularCodeRoachRoutes } = require("./codeRoach");

const log = createLogger("CodeRoachAPI");

/**
 * Setup Code Roach API routes
 * @param {Express} app - Express application
 * @param {Object} options - Route options
 */
function setupCodeRoachRoutes(app, options) {
  log.info("🐜 Setting up Code Roach API routes...");

  // Setup all modular Code Roach routes
  setupModularCodeRoachRoutes(app, options);

  log.info("✅ Code Roach API routes loaded");
}

module.exports = {
  setupCodeRoachRoutes,
};

// Start crawl (non-blocking - starts in background)
