/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/issueStorageService.js
 * Last Sync: 2025-12-25T07:02:34.010Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Issue Storage Service
 * Handles storing and retrieving issues from database
 * Now uses resilient databaseService with circuit breakers and retry logic
 */

const databaseService = require("./databaseService");
const { createLogger } = require("../utils/logger");
const log = createLogger("IssueStorageService");

class IssueStorageService {
  constructor() {
    // Database service auto-initializes
  }

  /**
   * Store issue in database
   */
  async storeIssue(issue, projectId) {
    try {
      // Auto-mark as resolved if issue was auto-fixed
      let reviewStatus = issue.reviewStatus || "pending";
      if (issue.type === "auto-fixed" || issue.error_type === "auto-fixed") {
        reviewStatus = "resolved";
      } else if (issue.fixApplied && issue.fixSuccess !== false) {
        // Also mark as resolved if fix was applied and successful
        reviewStatus = "resolved";
      }

      const { data, error } = await databaseService.insert(
        "code_roach_issues",
        {
          project_id: projectId,
          file_path: issue.file || issue.filePath,
          line: issue.line,
          end_line: issue.endLine,
          column: issue.column,
          error_type: issue.type,
          error_message: issue.message,
          error_severity: issue.severity || "medium",
          error_code: issue.code,
          review_status: reviewStatus,
          fix_applied: issue.fixApplied,
          fix_method: issue.fixMethod,
          fix_confidence: issue.fixConfidence,
        },
        { select: "*", single: true },
      );

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("[Issue Storage] Store issue error:", err.message);
      return null;
    }
  }

  /**
   * Store multiple issues
   */
  async storeIssues(issues, projectId) {
    if (!issues || issues.length === 0) {
      return [];
    }

    try {
      const issueData = issues.map((issue) => ({
        project_id: projectId,
        file_path: issue.file || issue.filePath,
        line: issue.line,
        end_line: issue.endLine,
        column: issue.column,
        error_type: issue.type,
        error_message: issue.message,
        error_severity: issue.severity || "medium",
        error_code: issue.code,
        review_status: issue.reviewStatus || "pending",
        fix_applied: issue.fixApplied,
        fix_method: issue.fixMethod,
        fix_confidence: issue.fixConfidence,
      }));

      const { data, error } = await databaseService.insert(
        "code_roach_issues",
        issueData,
        {
          select: "*",
        },
      );

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[Issue Storage] Store issues error:", err.message);
      return [];
    }
  }

  /**
   * Update issue
   */
  async updateIssue(issueId, updates) {
    try {
      const { data, error } = await databaseService.update(
        "code_roach_issues",
        [{ column: "id", operator: "eq", value: issueId }],
        updates,
        { select: "*", single: true },
      );

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("[Issue Storage] Update issue error:", err.message);
      return null;
    }
  }

  /**
   * Get issues for project
   */
  async getProjectIssues(projectId, filters = {}) {
    try {
      const queryFilters = [
        { column: "project_id", operator: "eq", value: projectId },
      ];

      if (filters.status) {
        queryFilters.push({
          column: "review_status",
          operator: "eq",
          value: filters.status,
        });
      }
      if (filters.severity) {
        queryFilters.push({
          column: "error_severity",
          operator: "eq",
          value: filters.severity,
        });
      }
      if (filters.type) {
        queryFilters.push({
          column: "error_type",
          operator: "eq",
          value: filters.type,
        });
      }
      if (filters.filePath) {
        queryFilters.push({
          column: "file_path",
          operator: "eq",
          value: filters.filePath,
        });
      }

      const { data, error, count } = await databaseService.query(
        "code_roach_issues",
        {
          select: "*",
          filters: queryFilters,
          order: { column: "created_at", ascending: false },
          limit: filters.limit,
          offset: filters.offset,
          count: "exact",
        },
      );

      if (error) throw error;
      // Return data with count for pagination
      const result = data || [];
      result._count = count || result.length;
      return result;
    } catch (err) {
      console.error("[Issue Storage] Get issues error:", err.message);
      return [];
    }
  }

  /**
   * Get all issues (with optional filters, no project filter)
   */
  async getAllIssues(filters = {}) {
    try {
      const queryFilters = [];

      if (filters.status) {
        queryFilters.push({
          column: "review_status",
          operator: "eq",
          value: filters.status,
        });
      }
      if (filters.severity) {
        queryFilters.push({
          column: "error_severity",
          operator: "eq",
          value: filters.severity,
        });
      }
      if (filters.type) {
        queryFilters.push({
          column: "error_type",
          operator: "eq",
          value: filters.type,
        });
      }
      if (filters.filePath) {
        queryFilters.push({
          column: "file_path",
          operator: "eq",
          value: filters.filePath,
        });
      }

      const { data, error, count } = await databaseService.query(
        "code_roach_issues",
        {
          select: "*",
          filters: queryFilters,
          order: { column: "created_at", ascending: false },
          limit: filters.limit || 100,
          offset: filters.offset || 0,
          count: "exact",
        },
      );

      if (error) throw error;
      // Return data with count for pagination
      const result = data || [];
      result._count = count || result.length;
      return result;
    } catch (err) {
      console.error("[Issue Storage] Get all issues error:", err.message);
      return [];
    }
  }

  /**
   * Get issue by ID
   */
  async getIssue(issueId) {
    try {
      const { data, error } = await databaseService.query("code_roach_issues", {
        select: "*",
        filters: [{ column: "id", operator: "eq", value: issueId }],
        single: true,
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("[Issue Storage] Get issue error:", err.message);
      return null;
    }
  }

  /**
   * Mark issue as resolved
   */
  async resolveIssue(issueId, userId, fixApplied = null) {
    if (!this.supabase) {
      return null;
    }

    try {
      const updates = {
        review_status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      };

      if (fixApplied) {
        updates.fix_applied = fixApplied;
      }

      return await this.updateIssue(issueId, updates);
    } catch (err) {
      console.error("[Issue Storage] Resolve issue error:", err.message);
      return null;
    }
  }

  /**
   * Get issue statistics for project
   */
  async getProjectStatistics(projectId) {
    try {
      const { data: issues, error } = await databaseService.query(
        "code_roach_issues",
        {
          select: "review_status, error_severity, error_type",
          filters: [{ column: "project_id", operator: "eq", value: projectId }],
        },
      );

      if (error) throw error;

      const stats = {
        total: issues.length,
        byStatus: {},
        bySeverity: {},
        byType: {},
        resolved: 0,
        pending: 0,
      };

      for (const issue of issues) {
        // By status
        stats.byStatus[issue.review_status] =
          (stats.byStatus[issue.review_status] || 0) + 1;

        // By severity
        stats.bySeverity[issue.error_severity] =
          (stats.bySeverity[issue.error_severity] || 0) + 1;

        // By type
        stats.byType[issue.error_type] =
          (stats.byType[issue.error_type] || 0) + 1;

        // Counts
        if (issue.review_status === "resolved") {
          stats.resolved++;
        } else if (issue.review_status === "pending") {
          stats.pending++;
        }
      }

      return stats;
    } catch (err) {
      console.error("[Issue Storage] Get statistics error:", err.message);
      return null;
    }
  }
}

module.exports = new IssueStorageService();
