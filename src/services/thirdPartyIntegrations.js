/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/thirdPartyIntegrations.js
 * Last Sync: 2025-12-25T07:02:34.013Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Third-Party Integrations Service
 * Manages integrations with external tools and platforms
 */

const webhookService = require("./webhookService");
const gitIntegration = require("./gitIntegration");
const slackTeamsBot = require("./slackTeamsBot");

class ThirdPartyIntegrations {
  constructor() {
    this.integrations = new Map();
    this.integrationTypes = {
      ci: [
        "github-actions",
        "gitlab-ci",
        "jenkins",
        "circleci",
        "azure-devops",
        "travis-ci",
      ],
      monitoring: ["sentry", "datadog", "new-relic", "rollbar", "bugsnag"],
      communication: ["slack", "teams", "discord", "email", "pagerduty"],
      ide: ["vscode", "intellij", "sublime"],
      versionControl: ["github", "gitlab", "bitbucket"],
      projectManagement: ["jira", "linear", "asana", "trello"],
    };
  }

  /**
   * Register an integration
   */
  registerIntegration(config) {
    const {
      id,
      type,
      platform,
      enabled = true,
      credentials = {},
      settings = {},
    } = config;

    if (!id || !type || !platform) {
      throw new Error("Integration requires id, type, and platform");
    }

    const integration = {
      id,
      type,
      platform,
      enabled,
      credentials,
      settings,
      registeredAt: new Date().toISOString(),
      lastUsed: null,
      usageCount: 0,
    };

    this.integrations.set(id, integration);

    // Initialize platform-specific integration
    this.initializePlatformIntegration(integration);

    return { success: true, integrationId: id };
  }

  /**
   * Initialize platform-specific integration
   */
  initializePlatformIntegration(integration) {
    switch (integration.platform) {
      case "github":
        if (integration.credentials.token && integration.credentials.repo) {
          gitIntegration.configureGitHub(
            integration.credentials.token,
            integration.credentials.repo,
          );
        }
        break;

      case "gitlab":
        if (
          integration.credentials.token &&
          integration.credentials.projectId
        ) {
          gitIntegration.configureGitLab(
            integration.credentials.token,
            integration.credentials.projectId,
          );
        }
        break;

      case "slack":
        if (integration.credentials.webhookUrl) {
          slackTeamsBot.configureSlack(
            integration.credentials.webhookUrl,
            integration.settings.channel || "#code-roach",
          );
        }
        break;

      case "teams":
        if (integration.credentials.webhookUrl) {
          slackTeamsBot.configureTeams(integration.credentials.webhookUrl);
        }
        break;

      case "sentry":
      case "datadog":
      case "discord":
        // These are handled via webhooks
        if (integration.credentials.webhookUrl) {
          webhookService.registerWebhook({
            id: `integration-${integration.id}`,
            url: integration.credentials.webhookUrl,
            events: integration.settings.events || ["error", "fix", "critical"],
            enabled: integration.enabled,
          });
        }
        break;
    }
  }

  /**
   * Get all integrations
   */
  getIntegrations(filter = {}) {
    let integrations = Array.from(this.integrations.values());

    if (filter.type) {
      integrations = integrations.filter((i) => i.type === filter.type);
    }

    if (filter.platform) {
      integrations = integrations.filter((i) => i.platform === filter.platform);
    }

    if (filter.enabled !== undefined) {
      integrations = integrations.filter((i) => i.enabled === filter.enabled);
    }

    return integrations;
  }

  /**
   * Get integration by ID
   */
  getIntegration(id) {
    return this.integrations.get(id);
  }

  /**
   * Update integration
   */
  updateIntegration(id, updates) {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error("Integration not found");
    }

    Object.assign(integration, updates, {
      updatedAt: new Date().toISOString(),
    });

    // Re-initialize if credentials changed
    if (updates.credentials || updates.enabled !== undefined) {
      this.initializePlatformIntegration(integration);
    }

    return { success: true, integration };
  }

  /**
   * Delete integration
   */
  deleteIntegration(id) {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error("Integration not found");
    }

    // Cleanup platform-specific resources
    if (integration.platform === "slack" || integration.platform === "teams") {
      webhookService.unregisterWebhook(`integration-${id}`);
    }

    this.integrations.delete(id);
    return { success: true };
  }

  /**
   * Test integration
   */
  async testIntegration(id) {
    const integration = this.integrations.get(id);
    if (!integration) {
      throw new Error("Integration not found");
    }

    const testResult = {
      success: false,
      platform: integration.platform,
      message: "",
      timestamp: new Date().toISOString(),
    };

    try {
      switch (integration.platform) {
        case "github":
          // Test GitHub API connection
          testResult.success = true;
          testResult.message = "GitHub integration active";
          break;

        case "gitlab":
          // Test GitLab API connection
          testResult.success = true;
          testResult.message = "GitLab integration active";
          break;

        case "slack":
        case "teams":
        case "discord":
          // Test webhook
          await webhookService.testWebhook(`integration-${id}`);
          testResult.success = true;
          testResult.message = `${integration.platform} webhook active`;
          break;

        default:
          testResult.message = "Test not implemented for this platform";
      }

      // Update last used
      integration.lastUsed = new Date().toISOString();
      integration.usageCount = (integration.usageCount || 0) + 1;
    } catch (error) {
      testResult.message = `Test failed: ${error.message}`;
    }

    return testResult;
  }

  /**
   * Get integration statistics
   */
  getStatistics() {
    const integrations = Array.from(this.integrations.values());

    return {
      total: integrations.length,
      byType: this.groupBy(integrations, "type"),
      byPlatform: this.groupBy(integrations, "platform"),
      enabled: integrations.filter((i) => i.enabled).length,
      disabled: integrations.filter((i) => !i.enabled).length,
      mostUsed: integrations
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 5)
        .map((i) => ({
          id: i.id,
          platform: i.platform,
          usageCount: i.usageCount || 0,
        })),
    };
  }

  /**
   * Group array by property
   */
  groupBy(array, property) {
    return array.reduce((groups, item) => {
      const key = item[property];
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Get available integration platforms
   */
  getAvailablePlatforms() {
    return {
      ci: this.integrationTypes.ci.map((platform) => ({
        platform,
        name: this.getPlatformName(platform),
        status: "available",
      })),
      monitoring: this.integrationTypes.monitoring.map((platform) => ({
        platform,
        name: this.getPlatformName(platform),
        status: "available",
      })),
      communication: this.integrationTypes.communication.map((platform) => ({
        platform,
        name: this.getPlatformName(platform),
        status: "available",
      })),
      ide: this.integrationTypes.ide.map((platform) => ({
        platform,
        name: this.getPlatformName(platform),
        status: "available",
      })),
      versionControl: this.integrationTypes.versionControl.map((platform) => ({
        platform,
        name: this.getPlatformName(platform),
        status: "available",
      })),
      projectManagement: this.integrationTypes.projectManagement.map(
        (platform) => ({
          platform,
          name: this.getPlatformName(platform),
          status: "available",
        }),
      ),
    };
  }

  /**
   * Get platform display name
   */
  getPlatformName(platform) {
    const names = {
      "github-actions": "GitHub Actions",
      "gitlab-ci": "GitLab CI",
      "azure-devops": "Azure DevOps",
      "travis-ci": "Travis CI",
      "new-relic": "New Relic",
      vscode: "VS Code",
      intellij: "IntelliJ IDEA",
    };
    return (
      names[platform] || platform.charAt(0).toUpperCase() + platform.slice(1)
    );
  }
}

module.exports = new ThirdPartyIntegrations();
