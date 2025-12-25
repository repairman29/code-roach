/**
 * Extract Productizable Assets for Code Roach Standalone Product
 *
 * Identifies all services, infrastructure, and capabilities that can be
 * extracted and productized as a standalone Code Roach product
 */

const fs = require("fs").promises;
const path = require("path");

const SERVICES_DIR = path.join(__dirname, "../server/services");
const ROUTES_DIR = path.join(__dirname, "../server/routes");
const PUBLIC_DIR = path.join(__dirname, "../public");

class AssetExtractor {
  constructor() {
    this.assets = {
      core: [],
      infrastructure: [],
      integrations: [],
      analytics: [],
      ui: [],
      gameSpecific: [],
      total: 0,
    };
  }

  /**
   * Categorize a service file
   */
  categorizeService(filename) {
    const name = filename.toLowerCase();

    // Core Code Roach services
    if (
      name.includes("codebase") ||
      name.includes("code") ||
      name.includes("fix") ||
      name.includes("agent") ||
      name.includes("knowledge") ||
      name.includes("learning") ||
      name.includes("pattern") ||
      name.includes("search") ||
      name.includes("index")
    ) {
      return "core";
    }

    // Infrastructure
    if (
      name.includes("embedding") ||
      name.includes("cache") ||
      name.includes("chunk") ||
      name.includes("retrieval") ||
      name.includes("vector") ||
      name.includes("monitor") ||
      name.includes("resource") ||
      name.includes("connection")
    ) {
      return "infrastructure";
    }

    // Integrations
    if (
      name.includes("git") ||
      name.includes("cicd") ||
      name.includes("slack") ||
      name.includes("teams") ||
      name.includes("webhook") ||
      name.includes("integration") ||
      name.includes("thirdparty")
    ) {
      return "integrations";
    }

    // Analytics
    if (
      name.includes("analytics") ||
      name.includes("metric") ||
      name.includes("tracking") ||
      name.includes("reporting") ||
      name.includes("dashboard") ||
      name.includes("stats")
    ) {
      return "analytics";
    }

    // UI/Dashboard
    if (
      name.includes("dashboard") ||
      name.includes("ui") ||
      name.includes("html")
    ) {
      return "ui";
    }

    // Game-specific (not productizable)
    if (
      name.includes("game") ||
      name.includes("player") ||
      name.includes("npc") ||
      name.includes("character") ||
      name.includes("audio") ||
      name.includes("image") ||
      name.includes("economy") ||
      name.includes("achievement") ||
      name.includes("world") ||
      name.includes("scenario") ||
      name.includes("location") ||
      name.includes("save") ||
      name.includes("multiplayer") ||
      name.includes("replay") ||
      name.includes("mod") ||
      name.includes("subscription") ||
      name.includes("solo") ||
      name.includes("ai-gm") ||
      name.includes("conversation") ||
      name.includes("transcript") ||
      name.includes("canvas") ||
      name.includes("pdf") ||
      name.includes("print")
    ) {
      return "gameSpecific";
    }

    return "core"; // Default to core
  }

  /**
   * Extract service information
   */
  async extractServiceInfo(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const filename = path.basename(filePath);

      // Extract description from JSDoc
      const descMatch = content.match(/\/\*\*[\s\S]*?\* (.*?)(?:\n|$)/);
      const description = descMatch ? descMatch[1].trim() : "No description";

      // Extract exports
      const exports = [];
      if (content.includes("module.exports")) {
        const exportMatch = content.match(/module\.exports\s*=\s*(\w+)/);
        if (exportMatch) exports.push(exportMatch[1]);
      }

      // Check for dependencies
      const requires = [];
      const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
      for (const match of requireMatches) {
        if (!match[1].startsWith(".")) {
          requires.push(match[1]);
        }
      }

      // Check for API endpoints
      const hasAPI =
        content.includes("app.get") ||
        content.includes("app.post") ||
        content.includes("router.get") ||
        content.includes("router.post");

      return {
        filename,
        path: filePath,
        description,
        exports,
        dependencies: [...new Set(requires)],
        hasAPI,
        lines: content.split("\n").length,
        category: this.categorizeService(filename),
      };
    } catch (err) {
      return {
        filename: path.basename(filePath),
        path: filePath,
        error: err.message,
      };
    }
  }

  /**
   * Scan services directory
   */
  async scanServices() {
    const files = await fs.readdir(SERVICES_DIR, { recursive: true });
    const jsFiles = files.filter((f) => f.endsWith(".js"));

    console.log(`📁 Found ${jsFiles.length} service files\n`);

    for (const file of jsFiles) {
      const filePath = path.join(SERVICES_DIR, file);
      const info = await this.extractServiceInfo(filePath);

      if (info.error) {
        console.warn(`⚠️  ${info.filename}: ${info.error}`);
        continue;
      }

      this.assets[info.category].push(info);
      this.assets.total++;
    }
  }

  /**
   * Scan API routes
   */
  async scanRoutes() {
    try {
      const files = await fs.readdir(ROUTES_DIR);
      const jsFiles = files.filter((f) => f.endsWith(".js"));

      for (const file of jsFiles) {
        const filePath = path.join(ROUTES_DIR, file);
        const content = await fs.readFile(filePath, "utf-8");

        // Count Code Roach endpoints
        const codeRoachEndpoints = (content.match(/\/api\/code-roach/g) || [])
          .length;

        if (codeRoachEndpoints > 0) {
          this.assets.integrations.push({
            filename: file,
            type: "api-route",
            codeRoachEndpoints,
            path: filePath,
          });
        }
      }
    } catch (err) {
      console.warn(`⚠️  Error scanning routes: ${err.message}`);
    }
  }

  /**
   * Scan UI/Dashboard files
   */
  async scanUI() {
    try {
      const dashboardFiles = [
        "code-roach-dashboard.html",
        "code-roach-ide.html",
        "admin/code-quality-dashboard.html",
        "admin/knowledge-base-dashboard.html",
      ];

      for (const file of dashboardFiles) {
        const filePath = path.join(PUBLIC_DIR, file);
        try {
          await fs.access(filePath);
          this.assets.ui.push({
            filename: file,
            path: filePath,
            type: "dashboard",
          });
        } catch {
          // File doesn't exist, skip
        }
      }
    } catch (err) {
      console.warn(`⚠️  Error scanning UI: ${err.message}`);
    }
  }

  /**
   * Generate report
   */
  generateReport() {
    console.log("\n" + "=".repeat(70));
    console.log("📦 PRODUCTIZABLE ASSETS INVENTORY");
    console.log("=".repeat(70) + "\n");

    console.log(`📊 Total Assets: ${this.assets.total}\n`);

    console.log("🎯 CORE PRODUCT ASSETS:");
    console.log(`   ${this.assets.core.length} services\n`);
    this.assets.core.slice(0, 20).forEach((asset) => {
      console.log(`   ✅ ${asset.filename}`);
      console.log(`      ${asset.description.substring(0, 60)}...`);
      console.log(
        `      ${asset.lines} lines | ${asset.dependencies.length} deps`,
      );
      if (asset.hasAPI) console.log(`      🔌 Has API endpoints`);
      console.log("");
    });
    if (this.assets.core.length > 20) {
      console.log(
        `   ... and ${this.assets.core.length - 20} more core services\n`,
      );
    }

    console.log("🏗️  INFRASTRUCTURE ASSETS:");
    console.log(`   ${this.assets.infrastructure.length} services\n`);
    this.assets.infrastructure.forEach((asset) => {
      console.log(`   ✅ ${asset.filename}`);
    });
    console.log("");

    console.log("🔗 INTEGRATION ASSETS:");
    console.log(`   ${this.assets.integrations.length} services/routes\n`);
    this.assets.integrations.forEach((asset) => {
      if (asset.codeRoachEndpoints) {
        console.log(
          `   ✅ ${asset.filename} (${asset.codeRoachEndpoints} Code Roach endpoints)`,
        );
      } else {
        console.log(`   ✅ ${asset.filename}`);
      }
    });
    console.log("");

    console.log("📊 ANALYTICS ASSETS:");
    console.log(`   ${this.assets.analytics.length} services\n`);
    this.assets.analytics.forEach((asset) => {
      console.log(`   ✅ ${asset.filename}`);
    });
    console.log("");

    console.log("🎨 UI/DASHBOARD ASSETS:");
    console.log(`   ${this.assets.ui.length} dashboards\n`);
    this.assets.ui.forEach((asset) => {
      console.log(`   ✅ ${asset.filename}`);
    });
    console.log("");

    console.log("🎮 GAME-SPECIFIC (NOT PRODUCTIZABLE):");
    console.log(`   ${this.assets.gameSpecific.length} services\n`);
    console.log(
      "   (These are game-specific and not part of Code Roach product)\n",
    );

    // Calculate productization percentage
    const productizable =
      this.assets.core.length +
      this.assets.infrastructure.length +
      this.assets.integrations.length +
      this.assets.analytics.length +
      this.assets.ui.length;
    const percentage = ((productizable / this.assets.total) * 100).toFixed(1);

    console.log("=".repeat(70));
    console.log("📈 PRODUCTIZATION SUMMARY");
    console.log("=".repeat(70) + "\n");
    console.log(
      `Productizable Assets: ${productizable}/${this.assets.total} (${percentage}%)`,
    );
    console.log(`Core Services: ${this.assets.core.length}`);
    console.log(`Infrastructure: ${this.assets.infrastructure.length}`);
    console.log(`Integrations: ${this.assets.integrations.length}`);
    console.log(`Analytics: ${this.assets.analytics.length}`);
    console.log(`UI/Dashboards: ${this.assets.ui.length}`);
    console.log(`\n✅ Ready for productization!\n`);
  }

  /**
   * Generate extraction plan
   */
  generateExtractionPlan() {
    const plan = {
      phase1: {
        name: "Core Engine",
        services: this.assets.core
          .filter(
            (s) =>
              s.filename.includes("codebase") ||
              s.filename.includes("fix") ||
              s.filename.includes("agent") ||
              s.filename.includes("knowledge") ||
              s.filename.includes("learning"),
          )
          .map((s) => s.filename),
      },
      phase2: {
        name: "Infrastructure",
        services: this.assets.infrastructure.map((s) => s.filename),
      },
      phase3: {
        name: "Integrations",
        services: this.assets.integrations.map((s) => s.filename),
      },
      phase4: {
        name: "Analytics & UI",
        services: [
          ...this.assets.analytics.map((s) => s.filename),
          ...this.assets.ui.map((s) => s.filename),
        ],
      },
    };

    console.log("\n" + "=".repeat(70));
    console.log("📋 EXTRACTION PLAN");
    console.log("=".repeat(70) + "\n");

    Object.entries(plan).forEach(([phase, data]) => {
      console.log(`${phase.toUpperCase()}: ${data.name}`);
      console.log(`   Services: ${data.services.length}`);
      data.services.slice(0, 10).forEach((s) => console.log(`   - ${s}`));
      if (data.services.length > 10) {
        console.log(`   ... and ${data.services.length - 10} more`);
      }
      console.log("");
    });
  }

  /**
   * Main execution
   */
  async extract() {
    console.log("🔍 Extracting Productizable Assets...\n");

    await this.scanServices();
    await this.scanRoutes();
    await this.scanUI();

    this.generateReport();
    this.generateExtractionPlan();
  }
}

// Main execution
if (require.main === module) {
  const extractor = new AssetExtractor();
  extractor.extract().catch(console.error);
}

module.exports = AssetExtractor;
