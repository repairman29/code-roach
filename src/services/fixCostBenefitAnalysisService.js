/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixCostBenefitAnalysisService.js
 * Last Sync: 2025-12-25T04:10:02.887Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Cost-Benefit Analysis Service
 * ROI-based fix prioritization and economic analysis
 *
 * Critical Missing Feature #5
 */

const { createClient } = require("@supabase/supabase-js");
const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("FixCostBenefitAnalysisService");
const codeHealthScoring = require("./codeHealthScoring");
const { getSupabaseService } = require("../utils/supabaseClient");

class FixCostBenefitAnalysisService {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = createClient(
          config.getSupabaseService().url,
          config.getSupabaseService().serviceRoleKey,
        );
      } catch (error) {
        console.warn(
          "[fixCostBenefitAnalysisService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      console.warn(
        "[fixCostBenefitAnalysisService] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Analyze cost-benefit of a fix
   */
  async analyzeCostBenefit(fix, context = {}) {
    const {
      issue,
      filePath,
      originalCode,
      fixedCode,
      estimatedFixTime,
      projectId,
    } = context;

    try {
      // 1. Calculate fix cost
      const fixCost = await this.calculateFixCost(fix, context);

      // 2. Calculate benefit (cost of NOT fixing)
      const benefit = await this.calculateBenefit(issue, filePath, context);

      // 3. Calculate ROI
      const roi = this.calculateROI(fixCost, benefit);

      // 4. Calculate payback period
      const paybackPeriod = this.calculatePaybackPeriod(fixCost, benefit);

      // 5. Calculate long-term value
      const longTermValue = await this.calculateLongTermValue(
        fix,
        filePath,
        context,
      );

      // 6. Generate recommendation
      const recommendation = this.generateRecommendation(
        roi,
        paybackPeriod,
        benefit,
        fixCost,
      );

      return {
        success: true,
        analysis: {
          fixCost,
          benefit,
          roi,
          paybackPeriod,
          longTermValue,
          recommendation,
          priority: this.calculatePriority(roi, benefit, issue),
          confidence: this.calculateConfidence(context),
        },
      };
    } catch (error) {
      console.error("[Fix Cost-Benefit Analysis] Error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Calculate cost of applying the fix
   */
  async calculateFixCost(fix, context) {
    const { estimatedFixTime, filePath, originalCode, fixedCode } = context;

    let cost = 0;

    // 1. Developer time cost
    const fixTime =
      estimatedFixTime || this.estimateFixTime(originalCode, fixedCode);
    const developerCost = fixTime * this.costModels.developerHourlyRate;
    cost += developerCost;

    // 2. Review time cost (assume 30% of fix time)
    const reviewCost = fixTime * 0.3 * this.costModels.developerHourlyRate;
    cost += reviewCost;

    // 3. Testing time cost (assume 50% of fix time)
    const testingCost = fixTime * 0.5 * this.costModels.developerHourlyRate;
    cost += testingCost;

    // 4. Risk cost (probability of introducing bugs)
    const riskCost = await this.calculateRiskCost(fix, context);
    cost += riskCost;

    // 5. Maintenance cost (if code becomes more complex)
    const maintenanceCost = await this.calculateMaintenanceCost(
      originalCode,
      fixedCode,
    );
    cost += maintenanceCost;

    return {
      total: cost,
      breakdown: {
        developerTime: developerCost,
        reviewTime: reviewCost,
        testingTime: testingCost,
        riskCost: riskCost,
        maintenanceCost: maintenanceCost,
        fixTimeHours: fixTime,
      },
    };
  }

  /**
   * Estimate fix time based on code changes
   */
  estimateFixTime(originalCode, fixedCode) {
    if (!originalCode || !fixedCode) return 1; // Default 1 hour

    const originalLines = originalCode.split("\n").length;
    const fixedLines = fixedCode.split("\n").length;
    const linesChanged = Math.abs(fixedLines - originalLines);

    // Rough estimate: 10 lines per hour for simple fixes, 5 for complex
    const complexity = this.estimateComplexity(originalCode, fixedCode);
    const linesPerHour = complexity > 0.7 ? 5 : 10;

    return Math.max(0.5, linesChanged / linesPerHour);
  }

  /**
   * Estimate complexity of fix
   */
  estimateComplexity(originalCode, fixedCode) {
    let complexity = 0;

    // Check for structural changes
    const originalFunctions = (
      originalCode.match(/(?:function|const|let|var)\s+\w+\s*[=(]/g) || []
    ).length;
    const fixedFunctions = (
      fixedCode.match(/(?:function|const|let|var)\s+\w+\s*[=(]/g) || []
    ).length;
    if (originalFunctions !== fixedFunctions) complexity += 0.3;

    // Check for class changes
    const originalClasses = (originalCode.match(/class\s+\w+/g) || []).length;
    const fixedClasses = (fixedCode.match(/class\s+\w+/g) || []).length;
    if (originalClasses !== fixedClasses) complexity += 0.3;

    // Check for async/await changes
    const originalAsync = (originalCode.match(/async|await|Promise/g) || [])
      .length;
    const fixedAsync = (fixedCode.match(/async|await|Promise/g) || []).length;
    if (originalAsync !== fixedAsync) complexity += 0.2;

    // Check for error handling changes
    const originalTryCatch = (originalCode.match(/try\s*\{|catch\s*\(/g) || [])
      .length;
    const fixedTryCatch = (fixedCode.match(/try\s*\{|catch\s*\(/g) || [])
      .length;
    if (originalTryCatch !== fixedTryCatch) complexity += 0.2;

    return Math.min(1, complexity);
  }

  /**
   * Calculate risk cost (cost of potential bugs introduced)
   */
  async calculateRiskCost(fix, context) {
    const riskProbability = fix.confidence ? 1 - fix.confidence : 0.3;
    const avgBugCost = this.getAverageBugCost(context.issue?.severity);

    return riskProbability * avgBugCost * 0.1; // 10% of bug cost as risk
  }

  /**
   * Calculate maintenance cost
   */
  async calculateMaintenanceCost(originalCode, fixedCode) {
    const originalLines = originalCode.split("\n").length;
    const fixedLines = fixedCode.split("\n").length;
    const linesAdded = Math.max(0, fixedLines - originalLines);

    // Annual maintenance cost
    const annualCost = linesAdded * this.costModels.maintenanceCostPerLine;

    // Present value over 3 years (discounted)
    const discountRate = 0.1; // 10%
    let pv = 0;
    for (let year = 1; year <= 3; year++) {
      pv += annualCost / Math.pow(1 + discountRate, year);
    }

    return pv;
  }

  /**
   * Calculate benefit (cost of NOT fixing)
   */
  async calculateBenefit(issue, filePath, context) {
    let benefit = 0;

    // 1. Direct bug cost (if bug exists in production)
    const bugCost = this.getBugCost(issue);
    benefit += bugCost;

    // 2. Future bug prevention cost
    const futureBugCost = await this.calculateFutureBugCost(
      issue,
      filePath,
      context,
    );
    benefit += futureBugCost;

    // 3. Developer productivity cost (time wasted on bugs)
    const productivityCost = await this.calculateProductivityCost(
      issue,
      filePath,
      context,
    );
    benefit += productivityCost;

    // 4. Technical debt cost
    const technicalDebtCost = await this.calculateTechnicalDebtCost(
      issue,
      filePath,
      context,
    );
    benefit += technicalDebtCost;

    // 5. User impact cost (if applicable)
    const userImpactCost = await this.calculateUserImpactCost(issue, context);
    benefit += userImpactCost;

    return {
      total: benefit,
      breakdown: {
        bugCost: bugCost,
        futureBugCost: futureBugCost,
        productivityCost: productivityCost,
        technicalDebtCost: technicalDebtCost,
        userImpactCost: userImpactCost,
      },
    };
  }

  /**
   * Get bug cost based on severity
   */
  getBugCost(issue) {
    const severity = issue?.severity || "medium";

    switch (severity) {
      case "critical":
        return this.costModels.criticalBugCost;
      case "high":
        return this.costModels.highBugCost;
      case "medium":
        return this.costModels.mediumBugCost;
      case "low":
        return this.costModels.lowBugCost;
      default:
        return this.costModels.mediumBugCost;
    }
  }

  /**
   * Get average bug cost
   */
  getAverageBugCost(severity) {
    return this.getBugCost({ severity });
  }

  /**
   * Calculate future bug prevention cost
   */
  async calculateFutureBugCost(issue, filePath, context) {
    // Estimate how many similar bugs this fix prevents
    const similarBugs = await this.estimateSimilarBugs(
      issue,
      filePath,
      context,
    );
    const avgBugCost = this.getAverageBugCost(issue?.severity);

    return similarBugs * avgBugCost * 0.5; // 50% probability of future bugs
  }

  /**
   * Estimate similar bugs that could occur
   */
  async estimateSimilarBugs(issue, filePath, context) {
    if (!this.supabase) return 1; // Default estimate

    try {
      // Count similar issues in the codebase
      const { data, error } = await this.supabase
        .from("code_roach_issues")
        .select("id")
        .eq("error_type", issue?.type || "")
        .eq("error_severity", issue?.severity || "")
        .limit(100);

      if (error) throw error;

      // Estimate: 10% of similar issues could occur in future
      return Math.max(1, (data?.length || 0) * 0.1);
    } catch (error) {
      return 1; // Default estimate
    }
  }

  /**
   * Calculate productivity cost (time wasted on bugs)
   */
  async calculateProductivityCost(issue, filePath, context) {
    // Estimate developer time wasted per bug occurrence
    const timePerOccurrence = this.estimateDebugTime(issue);
    const occurrences = await this.estimateOccurrences(
      issue,
      filePath,
      context,
    );

    return (
      timePerOccurrence * occurrences * this.costModels.developerHourlyRate
    );
  }

  /**
   * Estimate debug time per bug occurrence
   */
  estimateDebugTime(issue) {
    const severity = issue?.severity || "medium";

    switch (severity) {
      case "critical":
        return 8; // 8 hours
      case "high":
        return 4; // 4 hours
      case "medium":
        return 2; // 2 hours
      case "low":
        return 0.5; // 30 minutes
      default:
        return 2;
    }
  }

  /**
   * Estimate bug occurrences
   */
  async estimateOccurrences(issue, filePath, context) {
    // Estimate based on file usage and issue frequency
    // For now, use a simple estimate
    return 5; // Assume 5 occurrences per year
  }

  /**
   * Calculate technical debt cost
   */
  async calculateTechnicalDebtCost(issue, filePath, context) {
    try {
      // Get current health score
      const healthScore = await codeHealthScoring.getHealthScore(filePath);
      const currentHealth = healthScore?.overall || 70;

      // Estimate cost of technical debt accumulation
      if (currentHealth < 60) {
        // Low health = high technical debt
        const debtMultiplier = (60 - currentHealth) / 60; // 0 to 1
        return this.costModels.technicalDebtMultiplier * debtMultiplier * 1000;
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate user impact cost
   */
  async calculateUserImpactCost(issue, context) {
    // If issue affects users, calculate impact
    // For now, assume 0 (internal tool)
    return 0;
  }

  /**
   * Calculate long-term value
   */
  async calculateLongTermValue(fix, filePath, context) {
    const benefit = await this.calculateBenefit(
      context.issue,
      filePath,
      context,
    );
    const fixCost = await this.calculateFixCost(fix, context);

    // Calculate value over 3 years
    const annualBenefit = benefit.total / 3; // Assume benefit over 3 years
    const discountRate = 0.1; // 10%

    let pv = 0;
    for (let year = 1; year <= 3; year++) {
      pv += annualBenefit / Math.pow(1 + discountRate, year);
    }

    return {
      netPresentValue: pv - fixCost.total,
      totalValue: pv,
      fixCost: fixCost.total,
      years: 3,
    };
  }

  /**
   * Calculate ROI
   */
  calculateROI(fixCost, benefit) {
    if (fixCost.total === 0) return Infinity;

    const netBenefit = benefit.total - fixCost.total;
    return (netBenefit / fixCost.total) * 100; // Percentage
  }

  /**
   * Calculate payback period (in months)
   */
  calculatePaybackPeriod(fixCost, benefit) {
    if (benefit.total === 0) return Infinity;

    // Assume benefit is realized over 12 months
    const monthlyBenefit = benefit.total / 12;
    if (monthlyBenefit === 0) return Infinity;

    return fixCost.total / monthlyBenefit;
  }

  /**
   * Calculate priority score
   */
  calculatePriority(roi, benefit, issue) {
    // Priority based on ROI and benefit
    let priority = 0;

    // ROI component (0-50 points)
    if (roi > 1000) priority += 50;
    else if (roi > 500) priority += 40;
    else if (roi > 200) priority += 30;
    else if (roi > 100) priority += 20;
    else if (roi > 0) priority += 10;

    // Benefit component (0-30 points)
    if (benefit.total > 10000) priority += 30;
    else if (benefit.total > 5000) priority += 20;
    else if (benefit.total > 1000) priority += 10;

    // Severity component (0-20 points)
    const severity = issue?.severity || "medium";
    if (severity === "critical") priority += 20;
    else if (severity === "high") priority += 15;
    else if (severity === "medium") priority += 10;
    else priority += 5;

    return {
      score: priority,
      level:
        priority >= 70
          ? "critical"
          : priority >= 50
            ? "high"
            : priority >= 30
              ? "medium"
              : "low",
    };
  }

  /**
   * Calculate confidence in analysis
   */
  calculateConfidence(context) {
    let confidence = 0.5; // Base confidence

    // More context = higher confidence
    if (context.estimatedFixTime) confidence += 0.2;
    if (context.issue) confidence += 0.2;
    if (context.filePath) confidence += 0.1;

    return Math.min(1, confidence);
  }

  /**
   * Generate recommendation
   */
  generateRecommendation(roi, paybackPeriod, benefit, fixCost) {
    if (roi < 0) {
      return {
        action: "defer",
        reason: "Fix cost exceeds benefit",
        details: `ROI is negative (${roi.toFixed(0)}%). Consider deferring this fix.`,
      };
    }

    if (roi > 500 && paybackPeriod < 1) {
      return {
        action: "fix_immediately",
        reason: "Very high ROI with quick payback",
        details: `ROI: ${roi.toFixed(0)}%, Payback: ${paybackPeriod.toFixed(1)} months`,
      };
    }

    if (roi > 200) {
      return {
        action: "fix_soon",
        reason: "High ROI",
        details: `ROI: ${roi.toFixed(0)}%, Payback: ${paybackPeriod.toFixed(1)} months`,
      };
    }

    if (roi > 100) {
      return {
        action: "fix_when_convenient",
        reason: "Positive ROI",
        details: `ROI: ${roi.toFixed(0)}%, Payback: ${paybackPeriod.toFixed(1)} months`,
      };
    }

    return {
      action: "consider_alternatives",
      reason: "Low ROI",
      details: `ROI: ${roi.toFixed(0)}%. Consider if there's a cheaper way to fix this.`,
    };
  }

  /**
   * Prioritize fixes by ROI
   */
  async prioritizeFixes(issues, context = {}) {
    const analyses = [];

    for (const issue of issues) {
      try {
        const analysis = await this.analyzeCostBenefit(
          { confidence: 0.8 }, // Default confidence
          { issue, ...context },
        );

        if (analysis.success) {
          analyses.push({
            issue,
            analysis: analysis.analysis,
            priority: analysis.analysis.priority,
          });
        }
      } catch (error) {
        console.warn(
          "[Fix Cost-Benefit Analysis] Error analyzing issue:",
          error,
        );
      }
    }

    // Sort by priority score
    analyses.sort((a, b) => b.priority.score - a.priority.score);

    return {
      prioritized: analyses,
      totalIssues: issues.length,
      analyzed: analyses.length,
    };
  }
}

module.exports = new FixCostBenefitAnalysisService();
