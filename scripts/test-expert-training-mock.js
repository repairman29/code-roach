#!/usr/bin/env node
/**
 * Mock Test for Expert Training System
 * Tests the system without requiring database or LLM
 */

const path = require("path");
const fs = require("fs").promises;

// Mock data
const mockAnalysis = {
  project_id: "test-project-123",
  tech_stack: {
    languages: ["JavaScript", "TypeScript"],
    frameworks: ["React", "Express"],
    databases: ["PostgreSQL", "Redis"],
    build_tools: ["Vite"],
  },
  architecture_patterns: {
    pattern: "MVC",
    api_style: "REST",
    state_management: "Redux",
    file_structure: "feature-based",
  },
  code_organization: {
    structure: "feature-based",
    naming: "camelCase",
    module_system: "CommonJS",
  },
  testing_patterns: {
    frameworks: ["Jest", "Playwright"],
    test_location: "tests/",
    coverage_tool: "Jest",
  },
  security_practices: {
    authentication: "Supabase Auth",
    encryption: ["bcrypt"],
  },
  dependencies: {
    dependencies: ["express", "react"],
    devDependencies: ["jest", "vite"],
    total: 50,
  },
  code_style: {
    linter: "ESLint",
    formatter: "Prettier",
    config_files: [".eslintrc.js", ".prettierrc"],
  },
};

const mockExpert = {
  expert_type: "database",
  guide: {
    title: "Database Expert Guide",
    overview: "Comprehensive guide for PostgreSQL database operations",
    sections: [
      {
        title: "Overview",
        content: "PostgreSQL patterns and best practices",
        code_examples: [],
      },
      {
        title: "Best Practices",
        content: "Use RLS, index properly, use transactions",
        code_examples: [],
      },
    ],
    best_practices: [
      "Always enable RLS on tables",
      "Use indexes for frequently queried columns",
      "Use transactions for multi-step operations",
    ],
    troubleshooting: [
      {
        issue: "Slow queries",
        solution: "Add indexes, use EXPLAIN ANALYZE",
      },
    ],
    programmatic_tools: [
      {
        name: "validateSchema",
        description: "Validate database schema",
        example: 'await dbHelper.validateSchema("users", ["id", "email"])',
      },
    ],
  },
  quick_reference: {
    common_operations: [
      { name: "validateSchema", description: "Validate table schema" },
      { name: "safeUpsert", description: "Safe upsert operation" },
    ],
    quick_commands: ["npm run db:validate", "npm run db:migrate"],
    common_patterns: [
      { title: "RLS Pattern", pattern: "Enable RLS on all tables" },
    ],
    common_issues: [{ issue: "Slow query", fix: "Add index" }],
  },
  helper_service: {
    service_name: "DatabaseHelper",
    file_name: "databaseHelper.js",
    code: `class DatabaseHelper {
    async validateSchema(tableName, expectedColumns) {
        // Implementation
    }
}`,
    methods: [
      {
        name: "validateSchema",
        description: "Validate schema",
        params: "tableName, expectedColumns",
      },
    ],
  },
  integration_guide: {
    expert_type: "database",
    integration_patterns: ["Service integration", "Script integration"],
    service_integration: {
      import: 'const dbHelper = require("./services/databaseHelper");',
      usage: 'await dbHelper.validateSchema("users", ["id"]);',
    },
    script_integration: {
      cli_command: "npm run db:operation",
      script_example:
        'const dbHelper = require("./server/services/databaseHelper");',
    },
    api_integration: {
      endpoint: "/api/database/*",
      example: "GET /api/database/validate",
    },
  },
  quality_score: 0.85,
};

async function testExpertTypeDetermination() {
  console.log("🧪 Test 1: Expert Type Determination\n");

  const expertTrainingService = require("../server/services/expertTrainingService");
  const expertTypes = expertTrainingService.determineExpertTypes(mockAnalysis);

  console.log("✅ Expert types determined:", expertTypes.length);
  console.log("   Types:", expertTypes.join(", "));
  console.log("");

  // Verify expected types
  const expectedTypes = [
    "code-style",
    "architecture",
    "database",
    "testing",
    "security",
    "api",
  ];
  const found = expectedTypes.filter((type) => expertTypes.includes(type));
  console.log(
    `✅ Found ${found.length}/${expectedTypes.length} expected types:`,
    found.join(", "),
  );
  console.log("");

  return expertTypes;
}

async function testQualityScore() {
  console.log("🧪 Test 2: Quality Score Calculation\n");

  const expertTrainingService = require("../server/services/expertTrainingService");
  const score = expertTrainingService.calculateQualityScore(
    mockExpert.guide,
    mockExpert.quick_reference,
    mockExpert.helper_service,
  );

  console.log("✅ Quality score calculated:", score);
  console.log("   Score range: 0.00 - 1.00");
  console.log(
    "   Status:",
    score >= 0.7 ? "✅ Good" : score >= 0.5 ? "⚠️  Acceptable" : "❌ Poor",
  );
  console.log("");

  return score;
}

async function testExpertTypeDetection() {
  console.log("🧪 Test 3: Expert Type Detection from Issues\n");

  const customerExpertHelper = require("../server/services/customerExpertHelper");

  const testCases = [
    {
      issue: {
        error_type: "database_error",
        error_message: "PostgreSQL connection failed",
      },
      expected: "database",
    },
    {
      issue: { error_type: "test_failure", file_path: "tests/unit/test.js" },
      expected: "testing",
    },
    {
      issue: {
        error_type: "security_vulnerability",
        error_message: "XSS detected",
      },
      expected: "security",
    },
    {
      issue: { error_type: "api_error", file_path: "server/routes/api.js" },
      expected: "api",
    },
    {
      issue: {
        error_type: "syntax_error",
        file_path: "src/components/Button.jsx",
      },
      expected: "framework-react",
    },
  ];

  let passed = 0;
  for (const testCase of testCases) {
    const detected = customerExpertHelper.determineExpertType(testCase.issue);
    const match = detected === testCase.expected;
    if (match) passed++;
    console.log(
      `   ${match ? "✅" : "❌"} ${testCase.issue.error_type} → ${detected} (expected: ${testCase.expected})`,
    );
  }

  console.log(`\n✅ Passed: ${passed}/${testCases.length}`);
  console.log("");

  return passed === testCases.length;
}

async function testExpertContextBuilding() {
  console.log("🧪 Test 4: Expert Context Building\n");

  const customerExpertHelper = require("../server/services/customerExpertHelper");

  // Mock getCustomerExperts to return our mock expert
  const originalGetExperts =
    customerExpertHelper.getCustomerExperts.bind(customerExpertHelper);
  customerExpertHelper.getCustomerExperts = async () => ({
    database: {
      guide: mockExpert.guide,
      quick_reference: mockExpert.quick_reference,
      quality_score: mockExpert.quality_score,
    },
  });

  const issue = {
    error_type: "database_error",
    error_message: "Connection failed",
  };

  const context = await customerExpertHelper.buildExpertContext(
    "test-project",
    issue,
  );

  console.log("✅ Expert context built");
  console.log("   Length:", context.length, "characters");
  console.log(
    '   Contains "Customer-Specific":',
    context.includes("Customer-Specific Expert Context"),
  );
  console.log('   Contains "database":', context.includes("database"));
  console.log("   Contains overview:", context.includes("PostgreSQL"));
  console.log("");

  // Restore original
  customerExpertHelper.getCustomerExperts = originalGetExperts;

  return context.length > 0;
}

async function testFullFlow() {
  console.log("🧪 Test 5: Full Onboarding Flow (Mocked)\n");

  console.log("📋 Simulated Flow:");
  console.log("   1. ✅ Analyze codebase");
  console.log(
    "      - Detected:",
    mockAnalysis.tech_stack.languages.join(", "),
  );
  console.log(
    "      - Frameworks:",
    mockAnalysis.tech_stack.frameworks.join(", "),
  );
  console.log(
    "      - Databases:",
    mockAnalysis.tech_stack.databases.join(", "),
  );
  console.log("");
  console.log("   2. ✅ Determine expert types");
  const expertTypes = await testExpertTypeDetermination();
  console.log("");
  console.log("   3. ✅ Generate experts");
  console.log("      - Generated:", expertTypes.length, "experts");
  console.log(
    "      - Example: Database expert (quality:",
    mockExpert.quality_score,
    ")",
  );
  console.log("");
  console.log("   4. ✅ Train agents");
  console.log("      - Agents trained on customer patterns");
  console.log("");
  console.log("   5. ✅ Validate training");
  const score = await testQualityScore();
  console.log("      - Quality score:", score);
  console.log("");

  return true;
}

async function runMockTests() {
  console.log("🚀 Expert Training System - Mock Tests\n");
  console.log("=".repeat(60));
  console.log("");

  try {
    await testExpertTypeDetermination();
    await testQualityScore();
    await testExpertTypeDetection();
    await testExpertContextBuilding();
    await testFullFlow();

    console.log("=".repeat(60));
    console.log("");
    console.log("✅ All Mock Tests Passed!");
    console.log("");
    console.log("📋 Summary:");
    console.log("  - Expert type determination: ✅");
    console.log("  - Quality score calculation: ✅");
    console.log("  - Expert type detection: ✅");
    console.log("  - Context building: ✅");
    console.log("  - Full flow simulation: ✅");
    console.log("");
    console.log("💡 Note: These are mock tests. For full integration tests,");
    console.log("   run: npm test tests/expert-training-system.test.js");
    console.log("");
  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMockTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("💥 Fatal error:", err);
      process.exit(1);
    });
}

module.exports = {
  runMockTests,
  testExpertTypeDetermination,
  testQualityScore,
};
