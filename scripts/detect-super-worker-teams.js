/**
 * Detect and Analyze Super Worker Teams
 *
 * Identifies teams of 3+ workers that work together effectively
 * Analyzes team specializations, workflows, and collaboration patterns
 */

const fs = require("fs").promises;
const path = require("path");
const { glob } = require("glob");
const agentKnowledgeService = require("../server/services/agentKnowledgeService");

const BOT_LEARNING_DIR = path.join(__dirname, "../data/bot-learning");

// Team specializations (can be auto-detected or manually defined)
const TEAM_SPECIALIZATIONS = {
  frontend: {
    categories: ["ui", "css", "html", "javascript"],
    fileTypes: [".html", ".css", ".js"],
  },
  backend: {
    categories: ["api", "server", "database"],
    fileTypes: [".js"],
    paths: ["server/"],
  },
  testing: {
    categories: ["test", "testing"],
    fileTypes: [".js", ".spec.js", ".test.js"],
  },
  security: { categories: ["security", "auth"], fileTypes: [".js"] },
  performance: {
    categories: ["performance", "optimization"],
    fileTypes: [".js"],
  },
  documentation: {
    categories: ["documentation", "docs"],
    fileTypes: [".md", ".txt"],
  },
  "full-stack": {
    categories: ["feature", "bug", "ui", "api"],
    fileTypes: [".js", ".html", ".css"],
  },
};

class TeamDetector {
  constructor() {
    this.workerData = new Map();
    this.teams = [];
    this.stats = {
      teamsDetected: 0,
      teamKnowledgeAdded: 0,
      specializationsFound: 0,
    };
  }

  /**
   * Load all worker data
   */
  async loadWorkerData() {
    try {
      // Use fs.readdir for more reliable file finding
      const files = await fs.readdir(BOT_LEARNING_DIR);
      const knowledgeFiles = files.filter(
        (f) => f.includes("bot-super-worker") && f.includes("-knowledge.json"),
      );

      if (!Array.isArray(knowledgeFiles) || knowledgeFiles.length === 0) {
        console.warn("⚠️  No knowledge files found");
        return;
      }

      for (const file of knowledgeFiles) {
        const workerId = this.extractWorkerId(file);
        const filePath = path.join(BOT_LEARNING_DIR, file);

        try {
          const data = JSON.parse(await fs.readFile(filePath, "utf-8"));
          this.workerData.set(workerId, {
            id: workerId,
            knowledge: data,
            categories: new Set(),
            fileTypes: new Set(),
            strengths: [],
          });

          // Extract categories
          if (data.taskCategories) {
            data.taskCategories.forEach(([cat, stats]) => {
              if (stats.count > 10) {
                this.workerData.get(workerId).categories.add(cat);
              }
            });
          }

          // Extract file types
          if (data.fileTypes) {
            data.fileTypes.forEach(([type, stats]) => {
              if (stats.count > 5) {
                this.workerData.get(workerId).fileTypes.add(type);
              }
            });
          }
        } catch (err) {
          console.warn(`⚠️  Failed to load ${file}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`❌ Error loading worker data: ${err.message}`);
      throw err;
    }
  }

  extractWorkerId(filename) {
    const match = filename.match(/bot-super-worker-([^-]+)/);
    return match ? match[1] : "unknown";
  }

  /**
   * Detect teams based on complementary skills
   */
  detectTeams() {
    const workers = Array.from(this.workerData.keys());
    const teams = [];

    // Try different team sizes (3, 4, 5 workers)
    for (
      let teamSize = 3;
      teamSize <= Math.min(5, workers.length);
      teamSize++
    ) {
      const combinations = this.generateCombinations(workers, teamSize);

      for (const combination of combinations) {
        const teamScore = this.evaluateTeam(combination);

        if (teamScore.totalScore > 0.6) {
          // Threshold for good teams
          teams.push({
            workers: combination,
            size: teamSize,
            score: teamScore,
            specialization: this.detectTeamSpecialization(combination),
            name: this.generateTeamName(combination, teamScore.specialization),
          });
        }
      }
    }

    // Sort by score
    teams.sort((a, b) => b.score.totalScore - a.score.totalScore);

    // Remove overlapping teams (keep best)
    return this.deduplicateTeams(teams);
  }

  /**
   * Generate combinations of workers
   */
  generateCombinations(workers, size) {
    if (size === 1) return workers.map((w) => [w]);
    if (size > workers.length) return [];

    const combinations = [];

    function combine(start, combo) {
      if (combo.length === size) {
        combinations.push([...combo]);
        return;
      }

      for (let i = start; i < workers.length; i++) {
        combo.push(workers[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    }

    combine(0, []);
    return combinations.slice(0, 50); // Limit to top 50 to avoid too many
  }

  /**
   * Evaluate how well a team works together
   */
  evaluateTeam(workerIds) {
    const teamWorkers = workerIds
      .map((id) => this.workerData.get(id))
      .filter(Boolean);
    if (teamWorkers.length < 2) return { totalScore: 0 };

    // Coverage: How many categories/file types does the team cover?
    const allCategories = new Set();
    const allFileTypes = new Set();

    teamWorkers.forEach((worker) => {
      worker.categories.forEach((cat) => allCategories.add(cat));
      worker.fileTypes.forEach((type) => allFileTypes.add(type));
    });

    const categoryCoverage = allCategories.size / 20; // Normalize
    const fileTypeCoverage = allFileTypes.size / 10;

    // Complementarity: How well do they complement each other?
    let complementarity = 0;
    let comparisons = 0;

    for (let i = 0; i < teamWorkers.length; i++) {
      for (let j = i + 1; j < teamWorkers.length; j++) {
        const overlap = new Set(
          [...teamWorkers[i].categories].filter((c) =>
            teamWorkers[j].categories.has(c),
          ),
        ).size;
        const union = new Set([
          ...teamWorkers[i].categories,
          ...teamWorkers[j].categories,
        ]).size;
        complementarity += union > 0 ? 1 - overlap / union : 0;
        comparisons++;
      }
    }
    complementarity = comparisons > 0 ? complementarity / comparisons : 0;

    // Specialization: Does the team have a clear specialization?
    const specialization = this.detectTeamSpecialization(workerIds);
    const specializationScore = specialization ? 0.2 : 0;

    // Total score
    const totalScore =
      categoryCoverage * 0.3 +
      fileTypeCoverage * 0.2 +
      complementarity * 0.3 +
      specializationScore * 0.2;

    return {
      totalScore,
      categoryCoverage,
      fileTypeCoverage,
      complementarity,
      specialization,
      categories: Array.from(allCategories),
      fileTypes: Array.from(allFileTypes),
    };
  }

  /**
   * Detect team specialization
   */
  detectTeamSpecialization(workerIds) {
    const teamWorkers = workerIds
      .map((id) => this.workerData.get(id))
      .filter(Boolean);
    const allCategories = new Set();
    const allFileTypes = new Set();

    teamWorkers.forEach((worker) => {
      worker.categories.forEach((cat) => allCategories.add(cat));
      worker.fileTypes.forEach((type) => allFileTypes.add(type));
    });

    // Check against known specializations
    for (const [spec, criteria] of Object.entries(TEAM_SPECIALIZATIONS)) {
      const categoryMatch = criteria.categories.filter(
        (cat) =>
          allCategories.has(cat) ||
          Array.from(allCategories).some((c) => c.includes(cat)),
      ).length;
      const fileTypeMatch = criteria.fileTypes.filter((type) =>
        Array.from(allFileTypes).some((ft) =>
          ft.includes(type.replace(".", "")),
        ),
      ).length;

      const matchScore =
        (categoryMatch / criteria.categories.length) * 0.6 +
        (fileTypeMatch / criteria.fileTypes.length) * 0.4;

      if (matchScore > 0.5) {
        return spec;
      }
    }

    return null;
  }

  /**
   * Generate team name
   */
  generateTeamName(workerIds, specialization) {
    if (specialization) {
      return `${specialization.charAt(0).toUpperCase() + specialization.slice(1)} Team (${workerIds.join(", ")})`;
    }
    return `Team ${workerIds.join("-")}`;
  }

  /**
   * Remove overlapping teams
   */
  deduplicateTeams(teams) {
    const unique = [];
    const seen = new Set();

    for (const team of teams) {
      const key = team.workers.sort().join("-");
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(team);
      }
    }

    return unique.slice(0, 20); // Top 20 teams
  }

  /**
   * Absorb team knowledge into Code Roach
   */
  async absorbTeamKnowledge(team) {
    const teamWorkers = team.workers
      .map((id) => this.workerData.get(id))
      .filter(Boolean);

    // Create comprehensive team knowledge
    const teamKnowledge = {
      type: "pattern",
      content: `Super Worker Team: ${team.name}

Team Composition: ${team.workers.length} workers (${team.workers.join(", ")})
Specialization: ${team.specialization || "General purpose"}
Team Score: ${(team.score.totalScore * 100).toFixed(1)}%

Coverage:
- Categories: ${team.score.categories.length} (${team.score.categories.slice(0, 5).join(", ")}${team.score.categories.length > 5 ? "..." : ""})
- File Types: ${team.score.fileTypes.length} (${team.score.fileTypes.slice(0, 5).join(", ")}${team.score.fileTypes.length > 5 ? "..." : ""})

Complementarity: ${(team.score.complementarity * 100).toFixed(1)}%
Category Coverage: ${(team.score.categoryCoverage * 100).toFixed(1)}%
File Type Coverage: ${(team.score.fileTypeCoverage * 100).toFixed(1)}%

This team combines the expertise of ${team.workers.length} workers for comprehensive code quality improvements.`,
      sourceAgent: `super-worker-team-${team.workers.join("-")}`,
      confidence: Math.min(team.score.totalScore + 0.3, 0.95),
      tags: [
        "super-worker",
        "team",
        team.specialization || "general",
        ...team.workers,
      ],
      metadata: {
        teamName: team.name,
        workers: team.workers,
        teamSize: team.workers.length,
        specialization: team.specialization,
        teamScore: team.score.totalScore,
        categories: team.score.categories,
        fileTypes: team.score.fileTypes,
        complementarity: team.score.complementarity,
      },
    };

    try {
      const result = await agentKnowledgeService.addKnowledge(teamKnowledge);
      if (result) {
        this.stats.teamKnowledgeAdded++;
        return true;
      }
    } catch (err) {
      console.warn(`⚠️  Failed to add team knowledge: ${err.message}`);
    }

    return false;
  }

  /**
   * Create specialization-specific team knowledge
   */
  async createSpecializationKnowledge(teams) {
    const bySpecialization = new Map();

    teams.forEach((team) => {
      const spec = team.specialization || "general";
      if (!bySpecialization.has(spec)) {
        bySpecialization.set(spec, []);
      }
      bySpecialization.get(spec).push(team);
    });

    for (const [spec, specTeams] of bySpecialization.entries()) {
      if (specTeams.length === 0) continue;

      const bestTeam = specTeams[0]; // Best team for this specialization
      const allWorkers = new Set();
      specTeams.forEach((team) =>
        team.workers.forEach((w) => allWorkers.add(w)),
      );

      const specKnowledge = {
        type: "pattern",
        content: `Specialized Team: ${spec.charAt(0).toUpperCase() + spec.slice(1)}

Best Team: ${bestTeam.name}
Team Score: ${(bestTeam.score.totalScore * 100).toFixed(1)}%
Workers Available: ${allWorkers.size} (${Array.from(allWorkers).slice(0, 5).join(", ")}${allWorkers.size > 5 ? "..." : ""})

This specialization has ${specTeams.length} team(s) available for ${spec} tasks.`,
        sourceAgent: `super-worker-specialization-${spec}`,
        confidence: 0.85,
        tags: ["super-worker", "specialization", spec, "team"],
        metadata: {
          specialization: spec,
          teamCount: specTeams.length,
          bestTeam: bestTeam.name,
          availableWorkers: Array.from(allWorkers),
        },
      };

      try {
        await agentKnowledgeService.addKnowledge(specKnowledge);
        this.stats.specializationsFound++;
      } catch (err) {
        // Skip duplicates
      }
    }
  }

  /**
   * Main execution
   */
  async detectAndAbsorb() {
    console.log("🔍 Detecting Super Worker Teams...\n");

    await this.loadWorkerData();
    console.log(`📊 Loaded ${this.workerData.size} workers\n`);

    const teams = this.detectTeams();
    console.log(`👥 Detected ${teams.length} teams\n`);

    // Show top teams
    console.log("🏆 Top Teams:");
    teams.slice(0, 10).forEach((team, i) => {
      console.log(`   ${i + 1}. ${team.name}`);
      console.log(
        `      Score: ${(team.score.totalScore * 100).toFixed(1)}% | Specialization: ${team.specialization || "General"}`,
      );
      console.log(`      Workers: ${team.workers.join(", ")}\n`);
    });

    // Absorb team knowledge
    console.log("📚 Absorbing team knowledge...\n");
    for (const team of teams) {
      await this.absorbTeamKnowledge(team);
    }

    // Create specialization knowledge
    await this.createSpecializationKnowledge(teams);

    this.stats.teamsDetected = teams.length;

    console.log(`\n✅ Team Detection Complete!`);
    console.log(`   Teams Detected: ${this.stats.teamsDetected}`);
    console.log(`   Team Knowledge Added: ${this.stats.teamKnowledgeAdded}`);
    console.log(
      `   Specializations Found: ${this.stats.specializationsFound}\n`,
    );
  }
}

// Main execution
if (require.main === module) {
  const detector = new TeamDetector();
  detector.detectAndAbsorb().catch(console.error);
}

module.exports = TeamDetector;
