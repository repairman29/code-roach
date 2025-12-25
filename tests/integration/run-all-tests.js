#!/usr/bin/env node

/**
 * Run All Integration Tests
 * Runs all integration test suites and provides summary
 */

const { runTests: runAuthTests } = require("./api-auth-test");
const { runTests: runWebhookTests } = require("./github-webhook-test");
const {
  runTests: runOrchestrationTests,
} = require("./orchestration-pipeline-test");
const { runTests: runFrontendTests } = require("./frontend-ui-test");
const { runTests: runE2ETests } = require("../e2e/code-roach-e2e-test");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

const allResults = {
  suites: [],
  totalPassed: 0,
  totalFailed: 0,
  totalTests: 0,
};

async function runTestSuite(name, testFn) {
  log(`\n${"=".repeat(70)}`, "blue");
  log(`Running: ${name}`, "blue");
  log("=".repeat(70), "blue");

  try {
    await testFn();
    allResults.suites.push({ name, status: "completed" });
  } catch (err) {
    log(`\n❌ ${name} failed with error: ${err.message}`, "red");
    allResults.suites.push({ name, status: "error", error: err.message });
  }
}

async function runAllTests() {
  log("\n" + "=".repeat(70), "cyan");
  log("Code Roach - Complete Integration Test Suite", "cyan");
  log("=".repeat(70), "cyan");
  log(`Started: ${new Date().toISOString()}`, "cyan");

  const startTime = Date.now();

  // Run all test suites
  await runTestSuite("API Authentication Tests", runAuthTests);
  await runTestSuite("GitHub Webhook Tests", runWebhookTests);
  await runTestSuite("Orchestration Pipeline Tests", runOrchestrationTests);
  await runTestSuite("Frontend UI Tests", runFrontendTests);
  await runTestSuite("End-to-End Tests", runE2ETests);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Final summary
  log("\n" + "=".repeat(70), "cyan");
  log("Final Test Summary", "cyan");
  log("=".repeat(70), "cyan");
  log(`Total Suites: ${allResults.suites.length}`, "cyan");
  log(`Duration: ${duration}s`, "cyan");
  log(`Completed: ${new Date().toISOString()}`, "cyan");

  const completed = allResults.suites.filter(
    (s) => s.status === "completed",
  ).length;
  const errors = allResults.suites.filter((s) => s.status === "error").length;

  log(`\n✅ Completed: ${completed}`, "green");
  if (errors > 0) {
    log(`❌ Errors: ${errors}`, "red");
  }

  log("\n" + "=".repeat(70), "cyan");
  log("All tests completed!", "cyan");
  log("=".repeat(70) + "\n", "cyan");

  process.exit(0);
}

// Run all tests
if (require.main === module) {
  runAllTests().catch((err) => {
    log(`\n❌ Fatal error: ${err.message}`, "red");
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runAllTests };
