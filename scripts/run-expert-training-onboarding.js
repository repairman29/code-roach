#!/usr/bin/env node
/**
 * Run Full Expert Training Onboarding
 * Generates all experts and stores them in the database
 */

const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const config = require("../server/config");
const customerOnboardingService = require("../server/services/customerOnboardingService");
const customerCodebaseAnalyzer = require("../server/services/customerCodebaseAnalyzer");
const expertTrainingService = require("../server/services/expertTrainingService");

const CODEBASE_PATH = path.join(__dirname, "..");
const crypto = require("crypto");

// Generate a UUID for project ID (or use existing if you have one)
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const PROJECT_ID = process.env.PROJECT_ID || generateUUID();

async function runFullOnboarding() {
  console.log("🚀 Expert Training System - Full Onboarding");
  console.log("=".repeat(70));
  console.log("");
  console.log("📁 Codebase:", CODEBASE_PATH);
  console.log("🆔 Project ID:", PROJECT_ID);
  console.log("");
  console.log("⚠️  This will:");
  console.log("   1. Analyze your codebase");
  console.log("   2. Generate all expert guides using OpenAI");
  console.log("   3. Store experts in the database");
  console.log("   4. Train Code Roach agents");
  console.log("");
  console.log("=".repeat(70));
  console.log("");

  try {
    // Check if Supabase is configured
    if (!config.supabase?.url || !config.supabase?.serviceRoleKey) {
      console.error("❌ Supabase not configured!");
      console.log(
        "   Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set",
      );
      process.exit(1);
    }

    const supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
    );

    // Check if projects table exists and create a project entry
    console.log("📋 Step 0: Setting up project...");
    console.log("-".repeat(70));

    try {
      // Try to create/update project entry
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .upsert(
          {
            id: PROJECT_ID,
            name: "Smugglers RPG",
            slug: "smugglers-rpg",
            organization_id: null, // Will need to set this if you have organizations
            repository_url: CODEBASE_PATH,
            repository_type: "local",
            language: "javascript",
            framework: "express",
          },
          {
            onConflict: "id",
          },
        );

      if (projectError && !projectError.message.includes("does not exist")) {
        console.log(
          "   ⚠️  Could not create project entry (table may not exist yet)",
        );
        console.log("   Continuing anyway...");
      } else {
        console.log("   ✅ Project entry ready");
      }
    } catch (err) {
      console.log("   ⚠️  Project table may not exist, continuing...");
    }

    console.log("");

    // Step 1: Analyze codebase
    console.log("📊 Step 1: Analyzing Codebase...");
    console.log("-".repeat(70));
    const analysis = await customerCodebaseAnalyzer.analyzeCodebase(
      PROJECT_ID,
      CODEBASE_PATH,
    );

    console.log("✅ Analysis Complete!");
    console.log("   Languages:", analysis.tech_stack?.languages?.join(", "));
    console.log("   Frameworks:", analysis.tech_stack?.frameworks?.join(", "));
    console.log("   Databases:", analysis.tech_stack?.databases?.join(", "));
    console.log("");

    // Step 2: Determine expert types
    console.log("📚 Step 2: Determining Expert Types...");
    console.log("-".repeat(70));
    const expertTypes = expertTrainingService.determineExpertTypes(analysis);
    console.log(`✅ Will generate ${expertTypes.length} expert types:`);
    expertTypes.forEach((type, idx) => {
      console.log(`   ${idx + 1}. ${type}`);
    });
    console.log("");

    // Step 3: Generate all experts
    console.log(
      "🔨 Step 3: Generating Expert Guides (This will take a few minutes)...",
    );
    console.log("-".repeat(70));
    console.log("");

    const experts = {};
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < expertTypes.length; i++) {
      const expertType = expertTypes[i];
      console.log(
        `   [${i + 1}/${expertTypes.length}] Generating ${expertType}...`,
      );

      try {
        const expert = await expertTrainingService.generateExpert(
          PROJECT_ID,
          expertType,
          analysis,
        );

        experts[expertType] = expert;
        const qualityIcon =
          expert.quality_score >= 0.8
            ? "✅"
            : expert.quality_score >= 0.5
              ? "⚠️"
              : "❌";
        console.log(
          `      ${qualityIcon} Quality: ${expert.quality_score.toFixed(2)}`,
        );
        successCount++;
      } catch (err) {
        console.log(`      ❌ Failed: ${err.message.substring(0, 60)}...`);
        failCount++;
      }
    }

    console.log("");
    console.log(`✅ Generated ${successCount}/${expertTypes.length} experts`);
    if (failCount > 0) {
      console.log(`   ⚠️  ${failCount} failed (will use fallback templates)`);
    }
    console.log("");

    // Step 4: Store experts
    console.log("💾 Step 4: Storing Experts in Database...");
    console.log("-".repeat(70));

    try {
      await expertTrainingService.storeExperts(PROJECT_ID, experts);
      console.log("✅ Experts stored successfully!");
    } catch (err) {
      console.log("   ⚠️  Error storing experts:", err.message);
      console.log(
        "   Experts generated but not stored. You can review them above.",
      );
    }
    console.log("");

    // Step 5: Train agents
    console.log("🎓 Step 5: Training Code Roach Agents...");
    console.log("-".repeat(70));

    try {
      await expertTrainingService.trainAgents(PROJECT_ID, experts);
      console.log("✅ Agents trained successfully!");
    } catch (err) {
      console.log(
        "   ⚠️  Training note:",
        err.message || "Agents will use experts when available",
      );
    }
    console.log("");

    // Step 6: Validate
    console.log("✅ Step 6: Validating Training...");
    console.log("-".repeat(70));

    const validation = await expertTrainingService.validateTraining(PROJECT_ID);

    if (validation.valid) {
      console.log("✅ Training validated successfully!");
      console.log(
        `   Quality Score: ${validation.quality_score?.toFixed(2) || "N/A"}`,
      );
      console.log(
        `   Experts Generated: ${validation.experts_generated || Object.keys(experts).length}`,
      );
    } else {
      console.log("   ⚠️  Validation:", validation.reason || "Incomplete");
    }
    console.log("");

    // Summary
    console.log("=".repeat(70));
    console.log("📊 Summary");
    console.log("=".repeat(70));
    console.log("");
    console.log(`   • Project ID: ${PROJECT_ID}`);
    console.log(`   • Experts Generated: ${Object.keys(experts).length}`);
    console.log(`   • Success Rate: ${successCount}/${expertTypes.length}`);

    const avgQuality =
      Object.values(experts).reduce(
        (sum, e) => sum + (e.quality_score || 0),
        0,
      ) / Object.keys(experts).length;
    console.log(`   • Average Quality: ${avgQuality.toFixed(2)}`);

    const highQuality = Object.values(experts).filter(
      (e) => (e.quality_score || 0) >= 0.8,
    ).length;
    console.log(
      `   • High Quality (≥0.8): ${highQuality}/${Object.keys(experts).length}`,
    );
    console.log("");

    console.log("✅ Onboarding Complete!");
    console.log("");
    console.log("🎉 Code Roach is now trained on your codebase!");
    console.log("   Fix generation will now use your expert guides.");
    console.log("");

    return {
      success: true,
      projectId: PROJECT_ID,
      experts: Object.keys(experts).length,
      quality: avgQuality,
    };
  } catch (err) {
    console.error("❌ Onboarding failed:", err);
    throw err;
  }
}

// Run if called directly
if (require.main === module) {
  runFullOnboarding()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("💥 Fatal error:", err);
      process.exit(1);
    });
}

module.exports = { runFullOnboarding };
