/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codeRoachAlerts.js
 * Last Sync: 2025-12-25T05:17:15.783Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Code Roach Real-Time Alert Service
 * Monitors for critical issues and sends alerts
 */

const config = require("../config");
const { getSupabaseService } = require("../utils/supabaseClient");
const { createLogger } = require("../utils/logger");
const { getSupabaseClient } = require('../utils/supabaseClient');
const log = createLogger("CodeRoachAlerts");

class CodeRoachAlerts {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[codeRoachAlerts] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[codeRoachAlerts] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  start() {
    if (!this.supabase) {
      log.warn("[Code Roach Alerts] Supabase not configured");
      return;
    }

    // Check for critical issues every minute
    this.alertInterval = setInterval(async () => {
      await this.checkCriticalIssues();
    }, 60000); // 1 minute

    console.log("[Code Roach Alerts] Started monitoring");
  }

  async checkCriticalIssues() {
    try {
      const { data, error } = await this.supabase
        .from("code_roach_issues")
        .select("*")
        .eq("error_severity", "critical")
        .eq("review_status", "pending")
        .gte("created_at", new Date(Date.now() - 3600000).toISOString()) // Last hour
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        await this.sendAlert(data);
      }
    } catch (err) {
      console.error("[Code Roach Alerts] Error checking issues:", err);
    }
  }

  async sendAlert(issues) {
    // Send to Slack/Discord/webhook
    const webhookUrl = process.env.CODE_ROACH_WEBHOOK_URL;

    if (webhookUrl) {
      const message = {
        text: `🚨 Code Roach: ${issues.length} critical issue(s) detected!`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🚨 Code Roach Alert*\n${issues.length} critical issue(s) detected in the last hour`,
            },
          },
        ],
      };

      issues.slice(0, 5).forEach((issue) => {
        message.blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${issue.error_message}*\nFile: ${issue.error_file}:${
              issue.error_line
            }\nType: ${issue.error_type}`,
          },
        });
      });

      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message),
        });
      } catch (err) {
        console.error("[Code Roach Alerts] Failed to send webhook:", err);
      }
    }

    // Also log to console
    console.log(
      `🚨 [Code Roach Alerts] ${issues.length} critical issue(s) detected!`,
    );
  }

  stop() {
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = null;
    }
  }
}

module.exports = new CodeRoachAlerts();
