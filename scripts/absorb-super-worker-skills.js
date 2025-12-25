/**
 * Absorb Super Worker Skills into Code Roach
 *
 * Reads knowledge, patterns, and experience from super workers
 * and integrates them into Code Roach's knowledge base
 */

const fs = require("fs").promises;
const path = require("path");
const agentKnowledgeService = require("../server/services/agentKnowledgeService");
const { glob } = require("glob");

const BOT_LEARNING_DIR = path.join(__dirname, "../data/bot-learning");

// Super worker pairs (like Sonic & Tails)
// Can be manually defined or auto-detected based on complementary skills
const SUPER_WORKER_PAIRS = [
  {
    name: "Sonic & Tails",
    workers: ["1", "2"],
    description: "Speed and technical expertise",
  },
  // Add more pairs as discovered
];

// Auto-detect pairs based on complementary skills
const AUTO_DETECT_PAIRS = true;

class SuperWorkerSkillAbsorber {
  constructor() {
    this.stats = {
      workersProcessed: 0,
      knowledgeAdded: 0,
      patternsAdded: 0,
      fixesAdded: 0,
      pairsDetected: 0,
      pairKnowledgeAdded: 0,
      errors: [],
    };
    this.workerData = new Map(); // Store worker data for pair analysis
  }

  /**
   * Find all super worker files
   */
  async findSuperWorkerFiles() {
    try {
      // Use fs.readdir for more reliable file finding
      const files = await fs.readdir(BOT_LEARNING_DIR);

      const knowledgeFiles = files.filter(
        (f) => f.includes("bot-super-worker") && f.includes("-knowledge.json"),
      );
      const patternFiles = files.filter(
        (f) => f.includes("bot-super-worker") && f.includes("-patterns.json"),
      );
      const experienceFiles = files.filter(
        (f) => f.includes("bot-super-worker") && f.includes("-experience.json"),
      );

      return {
        knowledge: knowledgeFiles.map((f) => path.join(BOT_LEARNING_DIR, f)),
        patterns: patternFiles.map((f) => path.join(BOT_LEARNING_DIR, f)),
        experience: experienceFiles.map((f) => path.join(BOT_LEARNING_DIR, f)),
      };
    } catch (err) {
      console.warn(`⚠️  Error finding files: ${err.message}`);
      return { knowledge: [], patterns: [], experience: [] };
    }
  }

  /**
   * Extract worker ID from filename
   */
  extractWorkerId(filename) {
    const match = filename.match(/bot-super-worker-([^-]+)/);
    return match ? match[1] : "unknown";
  }

  /**
   * Read and parse JSON file
   */
  async readWorkerFile(filePath) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      console.warn(`⚠️  Failed to read ${filePath}: ${err.message}`);
      return null;
    }
  }

  /**
   * Absorb knowledge from a super worker
   */
  async absorbKnowledge(knowledgeData, workerId) {
    if (!knowledgeData) return;

    const skills = [];

    // Extract task category expertise
    if (knowledgeData.taskCategories) {
      for (const [category, stats] of knowledgeData.taskCategories) {
        if (stats.count > 10) {
          // Only significant experience
          skills.push({
            type: "pattern",
            content: `Super Worker ${workerId} Expertise: ${category} tasks

Task Category: ${category}
Experience: ${stats.count} tasks processed
Success Rate: ${stats.success > 0 ? ((stats.success / stats.count) * 100).toFixed(1) : 0}%
Average Time: ${stats.avgTime || "N/A"}

This worker has significant experience with ${category} tasks and can provide insights for similar issues.`,
            sourceAgent: `super-worker-${workerId}`,
            confidence: Math.min(stats.count / 100, 0.95),
            tags: ["super-worker", "task-category", category, workerId],
            metadata: {
              workerId,
              category,
              taskCount: stats.count,
              successCount: stats.success,
              avgTime: stats.avgTime,
            },
          });
        }
      }
    }

    // Extract file type expertise
    if (knowledgeData.fileTypes) {
      for (const [fileType, stats] of knowledgeData.fileTypes) {
        if (stats.count > 5 && stats.success > 0) {
          skills.push({
            type: "pattern",
            content: `Super Worker ${workerId} File Type Expertise: ${fileType}

File Type: ${fileType}
Files Processed: ${stats.count}
Successful Fixes: ${stats.success}
Success Rate: ${((stats.success / stats.count) * 100).toFixed(1)}%

This worker has proven success fixing issues in ${fileType} files.`,
            sourceAgent: `super-worker-${workerId}`,
            confidence: Math.min(stats.success / 50, 0.9),
            tags: ["super-worker", "file-type", fileType, workerId],
            metadata: {
              workerId,
              fileType,
              fileCount: stats.count,
              successCount: stats.success,
            },
          });
        }
      }
    }

    // Extract common issues and solutions
    if (knowledgeData.commonIssues) {
      for (const [issue, data] of knowledgeData.commonIssues) {
        if (data.count >= 3) {
          // Recurring issues
          const contexts = data.contexts || [];
          const categories = [...new Set(contexts.map((c) => c.category))];
          const files = [...new Set(contexts.flatMap((c) => c.files || []))];

          skills.push({
            type: "fix",
            content: `Super Worker ${workerId} Common Issue Fix: ${issue.substring(0, 100)}

Issue: ${issue}
Occurrences: ${data.count}
Categories: ${categories.join(", ")}
Common Files: ${files.slice(0, 5).join(", ")}

This issue has been encountered ${data.count} times. The super worker has experience handling this pattern.`,
            sourceAgent: `super-worker-${workerId}`,
            confidence: Math.min(data.count / 10, 0.85),
            tags: ["super-worker", "common-issue", ...categories, workerId],
            metadata: {
              workerId,
              issue: issue.substring(0, 200),
              occurrenceCount: data.count,
              categories,
              commonFiles: files.slice(0, 10),
            },
          });
        }
      }
    }

    // Extract effective solutions
    if (
      knowledgeData.effectiveSolutions &&
      knowledgeData.effectiveSolutions.length > 0
    ) {
      for (const solution of knowledgeData.effectiveSolutions) {
        skills.push({
          type: "fix",
          content: `Super Worker ${workerId} Effective Solution

${JSON.stringify(solution, null, 2)}

This solution has been proven effective by the super worker.`,
          sourceAgent: `super-worker-${workerId}`,
          confidence: 0.9,
          tags: ["super-worker", "effective-solution", workerId],
          metadata: {
            workerId,
            solution,
          },
        });
      }
    }

    // Add all skills to knowledge base
    for (const skill of skills) {
      try {
        const result = await agentKnowledgeService.addKnowledge(skill);
        if (result) {
          this.stats.knowledgeAdded++;
          if (skill.type === "pattern") this.stats.patternsAdded++;
          if (skill.type === "fix") this.stats.fixesAdded++;
        }
      } catch (err) {
        this.stats.errors.push({
          skill: skill.content.substring(0, 50),
          error: err.message,
        });
      }
    }
  }

  /**
   * Absorb patterns from a super worker
   */
  async absorbPatterns(patternData, workerId) {
    if (!patternData) return;

    // Patterns file has similar structure to knowledge
    // Process task categories, file types, etc.
    await this.absorbKnowledge(patternData, workerId);
  }

  /**
   * Absorb experience from a super worker
   */
  async absorbExperience(experienceData, workerId) {
    if (!experienceData) return;

    // Extract successful patterns from experience
    if (experienceData.successfulPatterns) {
      for (const pattern of experienceData.successfulPatterns) {
        try {
          await agentKnowledgeService.addKnowledge({
            type: "pattern",
            content: `Super Worker ${workerId} Successful Pattern

${JSON.stringify(pattern, null, 2)}

This pattern has been successfully used by the super worker.`,
            sourceAgent: `super-worker-${workerId}`,
            confidence: 0.85,
            tags: ["super-worker", "successful-pattern", workerId],
            metadata: {
              workerId,
              pattern,
            },
          });
          this.stats.patternsAdded++;
        } catch (err) {
          this.stats.errors.push({
            pattern: "experience pattern",
            error: err.message,
          });
        }
      }
    }
  }

  /**
   * Process a single super worker
   */
  async processWorker(workerId, files) {
    console.log(`\n🔄 Processing Super Worker: ${workerId}`);

    // Find files for this worker
    const workerFiles = {
      knowledge: files.knowledge.find((f) =>
        f.includes(`-${workerId}-knowledge`),
      ),
      patterns: files.patterns.find((f) => f.includes(`-${workerId}-patterns`)),
      experience: files.experience.find((f) =>
        f.includes(`-${workerId}-experience`),
      ),
    };

    const workerInfo = {
      id: workerId,
      knowledge: null,
      patterns: null,
      experience: null,
      skills: new Set(),
      fileTypes: new Set(),
      categories: new Set(),
    };

    // Read and process each file type
    if (workerFiles.knowledge) {
      const knowledge = await this.readWorkerFile(workerFiles.knowledge);
      workerInfo.knowledge = knowledge;
      await this.absorbKnowledge(knowledge, workerId);

      // Extract skills for pair analysis
      if (knowledge.taskCategories) {
        knowledge.taskCategories.forEach(([cat]) =>
          workerInfo.categories.add(cat),
        );
      }
      if (knowledge.fileTypes) {
        knowledge.fileTypes.forEach(([type]) => workerInfo.fileTypes.add(type));
      }
    }

    if (workerFiles.patterns) {
      const patterns = await this.readWorkerFile(workerFiles.patterns);
      workerInfo.patterns = patterns;
      await this.absorbPatterns(patterns, workerId);
    }

    if (workerFiles.experience) {
      const experience = await this.readWorkerFile(workerFiles.experience);
      workerInfo.experience = experience;
      await this.absorbExperience(experience, workerId);

      // Extract skills from experience
      if (experience.skills) {
        experience.skills.forEach(([skill]) => workerInfo.skills.add(skill));
      }
    }

    // Store worker data for pair analysis
    this.workerData.set(workerId, workerInfo);

    this.stats.workersProcessed++;
    console.log(`   ✅ Processed ${workerId}`);
  }

  /**
   * Detect complementary pairs based on skills
   */
  detectComplementaryPairs() {
    const pairs = [];
    const workers = Array.from(this.workerData.keys());

    for (let i = 0; i < workers.length; i++) {
      for (let j = i + 1; j < workers.length; j++) {
        const worker1 = this.workerData.get(workers[i]);
        const worker2 = this.workerData.get(workers[j]);

        if (!worker1 || !worker2) continue;

        // Calculate complementarity score
        const score = this.calculateComplementarity(worker1, worker2);

        if (score.complementary > 0.3) {
          // Threshold for good pairs
          pairs.push({
            name: `Auto-Detected Pair: Worker ${workers[i]} & ${workers[j]}`,
            workers: [workers[i], workers[j]],
            score: score,
            description: this.generatePairDescription(worker1, worker2, score),
          });
        }
      }
    }

    // Sort by complementarity score
    pairs.sort((a, b) => b.score.complementary - a.score.complementary);

    return pairs;
  }

  /**
   * Calculate how complementary two workers are
   */
  calculateComplementarity(worker1, worker2) {
    // Categories: complementary if they cover different areas
    const categories1 = worker1.categories;
    const categories2 = worker2.categories;
    const categoryOverlap = new Set(
      [...categories1].filter((c) => categories2.has(c)),
    );
    const categoryUnion = new Set([...categories1, ...categories2]);
    const categoryComplementarity =
      1 - categoryOverlap.size / categoryUnion.size;

    // File types: complementary if they cover different types
    const fileTypes1 = worker1.fileTypes;
    const fileTypes2 = worker2.fileTypes;
    const fileTypeOverlap = new Set(
      [...fileTypes1].filter((t) => fileTypes2.has(t)),
    );
    const fileTypeUnion = new Set([...fileTypes1, ...fileTypes2]);
    const fileTypeComplementarity =
      fileTypeUnion.size > 0
        ? 1 - fileTypeOverlap.size / fileTypeUnion.size
        : 0;

    // Skills: complementary if they have different strengths
    const skills1 = worker1.skills;
    const skills2 = worker2.skills;
    const skillOverlap = new Set([...skills1].filter((s) => skills2.has(s)));
    const skillUnion = new Set([...skills1, ...skills2]);
    const skillComplementarity =
      skillUnion.size > 0 ? 1 - skillOverlap.size / skillUnion.size : 0;

    // Overall complementarity (weighted average)
    const complementary =
      categoryComplementarity * 0.4 +
      fileTypeComplementarity * 0.3 +
      skillComplementarity * 0.3;

    return {
      complementary,
      categoryComplementarity,
      fileTypeComplementarity,
      skillComplementarity,
      categoryOverlap: categoryOverlap.size,
      fileTypeOverlap: fileTypeOverlap.size,
      skillOverlap: skillOverlap.size,
    };
  }

  /**
   * Generate description for a pair
   */
  generatePairDescription(worker1, worker2, score) {
    const strengths1 = Array.from(worker1.categories).slice(0, 3).join(", ");
    const strengths2 = Array.from(worker2.categories).slice(0, 3).join(", ");

    return (
      `Worker ${worker1.id} excels at: ${strengths1}. Worker ${worker2.id} excels at: ${strengths2}. ` +
      `Together they cover ${score.categoryOverlap + (worker1.categories.size + worker2.categories.size - score.categoryOverlap * 2)} unique categories.`
    );
  }

  /**
   * Absorb pair knowledge - combined expertise
   */
  async absorbPairKnowledge(pair) {
    const [worker1Id, worker2Id] = pair.workers;
    const worker1 = this.workerData.get(worker1Id);
    const worker2 = this.workerData.get(worker2Id);

    if (!worker1 || !worker2) {
      console.warn(`⚠️  Missing worker data for pair ${pair.name}`);
      return;
    }

    console.log(`\n🤝 Processing Pair: ${pair.name}`);

    // Calculate complementarity if not provided
    let complementarityScore = 0.5;
    if (pair.score && pair.score.complementary !== undefined) {
      complementarityScore = pair.score.complementary;
    } else {
      // Calculate on the fly
      const score = this.calculateComplementarity(worker1, worker2);
      complementarityScore = score.complementary;
    }

    // Combine categories
    const combinedCategories = new Set([
      ...worker1.categories,
      ...worker2.categories,
    ]);

    // Combine file types
    const combinedFileTypes = new Set([
      ...worker1.fileTypes,
      ...worker2.fileTypes,
    ]);

    // Create pair knowledge entries
    const pairKnowledge = {
      type: "pattern",
      content: `Super Worker Pair: ${pair.name}

${pair.description || "Combined expertise from two complementary workers"}

Complementarity Score: ${(complementarityScore * 100).toFixed(1)}%

Combined Expertise:
- Categories: ${Array.from(combinedCategories).join(", ")}
- File Types: ${Array.from(combinedFileTypes).join(", ")}

This pair combines the strengths of Worker ${worker1Id} and Worker ${worker2Id} for comprehensive code quality improvements.`,
      sourceAgent: `super-worker-pair-${worker1Id}-${worker2Id}`,
      confidence: Math.min(complementarityScore + 0.5, 0.95),
      tags: [
        "super-worker",
        "pair",
        "combined-expertise",
        worker1Id,
        worker2Id,
      ],
      metadata: {
        pairName: pair.name,
        workers: pair.workers,
        complementarityScore: complementarityScore,
        combinedCategories: Array.from(combinedCategories),
        combinedFileTypes: Array.from(combinedFileTypes),
        description: pair.description,
      },
    };

    try {
      const result = await agentKnowledgeService.addKnowledge(pairKnowledge);
      if (result) {
        this.stats.pairKnowledgeAdded++;
        this.stats.knowledgeAdded++;
        console.log(`   ✅ Added pair knowledge`);
      }
    } catch (err) {
      this.stats.errors.push({ pair: pair.name, error: err.message });
    }

    // Create category-specific pair knowledge
    for (const category of combinedCategories) {
      const hasWorker1 = worker1.categories.has(category);
      const hasWorker2 = worker2.categories.has(category);

      if (hasWorker1 || hasWorker2) {
        const pairCategoryKnowledge = {
          type: "pattern",
          content: `Pair Expertise: ${category} - ${pair.name}

Worker ${worker1Id}: ${hasWorker1 ? "Expert" : "Not specialized"}
Worker ${worker2Id}: ${hasWorker2 ? "Expert" : "Not specialized"}

This pair can handle ${category} tasks with combined expertise.`,
          sourceAgent: `super-worker-pair-${worker1Id}-${worker2Id}`,
          confidence: 0.8,
          tags: [
            "super-worker",
            "pair",
            "category",
            category,
            worker1Id,
            worker2Id,
          ],
          metadata: {
            pairName: pair.name,
            category,
            workers: pair.workers,
          },
        };

        try {
          await agentKnowledgeService.addKnowledge(pairCategoryKnowledge);
          this.stats.pairKnowledgeAdded++;
          this.stats.knowledgeAdded++;
        } catch (err) {
          // Skip duplicates
        }
      }
    }
  }

  /**
   * Process all super workers
   */
  async processAllWorkers() {
    console.log("🚀 Starting Super Worker Skill Absorption...\n");

    const files = await this.findSuperWorkerFiles();
    console.log(`📁 Found:`);
    console.log(`   Knowledge files: ${files.knowledge.length}`);
    console.log(`   Pattern files: ${files.patterns.length}`);
    console.log(`   Experience files: ${files.experience.length}\n`);

    // Extract unique worker IDs
    const workerIds = new Set();
    files.knowledge.forEach((f) => {
      const id = this.extractWorkerId(path.basename(f));
      if (id !== "unknown") workerIds.add(id);
    });
    files.patterns.forEach((f) => {
      const id = this.extractWorkerId(path.basename(f));
      if (id !== "unknown") workerIds.add(id);
    });
    files.experience.forEach((f) => {
      const id = this.extractWorkerId(path.basename(f));
      if (id !== "unknown") workerIds.add(id);
    });

    console.log(`👷 Found ${workerIds.size} super workers\n`);

    // Process each worker
    for (const workerId of workerIds) {
      await this.processWorker(workerId, files);
    }

    // Process manually defined pairs
    for (const pair of SUPER_WORKER_PAIRS) {
      console.log(`\n🤝 Processing Defined Pair: ${pair.name}`);
      for (const workerId of pair.workers) {
        if (!this.workerData.has(workerId)) {
          await this.processWorker(workerId, files);
        }
      }
      // Add pair knowledge
      await this.absorbPairKnowledge(pair);
    }

    // Auto-detect complementary pairs
    if (AUTO_DETECT_PAIRS && this.workerData.size >= 2) {
      console.log(`\n🔍 Auto-detecting complementary pairs...`);
      const detectedPairs = this.detectComplementaryPairs();

      console.log(`   Found ${detectedPairs.length} complementary pairs\n`);

      // Process top pairs (limit to top 10 to avoid too many)
      const topPairs = detectedPairs.slice(0, 10);
      this.stats.pairsDetected = topPairs.length;

      for (const pair of topPairs) {
        await this.absorbPairKnowledge(pair);
      }
    }

    // Suggest team detection
    if (this.workerData.size >= 3) {
      console.log(
        `\n💡 Tip: Run 'npm run code-roach:detect-teams' to detect teams of 3+ workers`,
      );
    }
  }

  /**
   * Display statistics
   */
  displayStats() {
    console.log(`\n${"=".repeat(60)}`);
    console.log("📊 Absorption Complete!");
    console.log(`${"=".repeat(60)}\n`);

    console.log(`Workers Processed: ${this.stats.workersProcessed}`);
    console.log(`Pairs Detected: ${this.stats.pairsDetected}`);
    console.log(`Knowledge Added: ${this.stats.knowledgeAdded}`);
    console.log(`   - Patterns: ${this.stats.patternsAdded}`);
    console.log(`   - Fixes: ${this.stats.fixesAdded}`);
    console.log(`   - Pair Knowledge: ${this.stats.pairKnowledgeAdded}`);

    if (this.stats.errors.length > 0) {
      console.log(`\n⚠️  Errors: ${this.stats.errors.length}`);
      this.stats.errors.slice(0, 5).forEach((err) => {
        console.log(`   - ${err.error}`);
      });
    }

    console.log(`\n✅ Code Roach has absorbed super worker skills!`);
    console.log(`   Code Roach can now use these patterns and fixes.\n`);
  }
}

// Main execution
async function main() {
  const absorber = new SuperWorkerSkillAbsorber();

  try {
    await absorber.processAllWorkers();
    absorber.displayStats();
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SuperWorkerSkillAbsorber;
