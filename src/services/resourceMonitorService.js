/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/resourceMonitorService.js
 * Last Sync: 2025-12-25T07:02:34.009Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Resource Monitor Service
 * Sprint 4: Monitor system resources (CPU, memory, etc.)
 */

const os = require("os");
const { createLogger } = require("../utils/logger");
const log = createLogger("ResourceMonitorService");
const performanceTrackingService = require("./performanceTrackingService");

class ResourceMonitorService {
  constructor() {
    this.monitoringInterval = null;
    this.monitoringEnabled = true;
    this.intervalMs = 60000; // Monitor every minute
  }

  /**
   * Start resource monitoring
   */
  start() {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    // Initial snapshot
    this.takeSnapshot();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.takeSnapshot();
    }, this.intervalMs);

    console.log("[ResourceMonitor] Started resource monitoring");
  }

  /**
   * Stop resource monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log("[ResourceMonitor] Stopped resource monitoring");
    }
  }

  /**
   * Take a snapshot of current resources
   */
  async takeSnapshot() {
    try {
      const hostname = os.hostname();
      const timestamp = Date.now();

      // CPU usage (average over last minute)
      const cpus = os.cpus();
      const cpuUsage = this.calculateCPUUsage(cpus);

      // Memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = (usedMem / totalMem) * 100;

      // Load average
      const loadAvg = os.loadavg();

      // Track metrics
      await Promise.all([
        performanceTrackingService.trackSystemResource({
          metricType: "cpu_usage",
          value: cpuUsage,
          unit: "percent",
          host: hostname,
          metadata: {
            cores: cpus.length,
            timestamp,
          },
        }),
        performanceTrackingService.trackSystemResource({
          metricType: "memory_usage",
          value: memUsagePercent,
          unit: "percent",
          host: hostname,
          metadata: {
            totalMemMB: totalMem / (1024 * 1024),
            usedMemMB: usedMem / (1024 * 1024),
            freeMemMB: freeMem / (1024 * 1024),
            timestamp,
          },
        }),
        performanceTrackingService.trackSystemResource({
          metricType: "load_average",
          value: loadAvg[0], // 1-minute load average
          unit: "load",
          host: hostname,
          metadata: {
            load1min: loadAvg[0],
            load5min: loadAvg[1],
            load15min: loadAvg[2],
            timestamp,
          },
        }),
      ]);

      // Alert on high resource usage
      if (cpuUsage > 80) {
        log.warn(
          `[ResourceMonitor] ⚠️  High CPU usage: ${cpuUsage.toFixed(1)}%`,
        );
      }
      if (memUsagePercent > 85) {
        log.warn(
          `[ResourceMonitor] ⚠️  High memory usage: ${memUsagePercent.toFixed(1)}%`,
        );
      }
      if (loadAvg[0] > cpus.length * 2) {
        log.warn(
          `[ResourceMonitor] ⚠️  High load average: ${loadAvg[0].toFixed(2)}`,
        );
      }
    } catch (error) {
      console.error("[ResourceMonitor] Error taking snapshot:", error);
    }
  }

  /**
   * Calculate CPU usage percentage
   */
  calculateCPUUsage(cpus) {
    // Simple calculation - in production, you'd want to track previous values
    // For now, return a basic estimate
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return Math.max(0, Math.min(100, usage));
  }

  /**
   * Get current resource stats
   */
  getCurrentStats() {
    const hostname = os.hostname();
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg();

    return {
      host: hostname,
      cpu: {
        cores: cpus.length,
        usage: this.calculateCPUUsage(cpus),
      },
      memory: {
        totalMB: totalMem / (1024 * 1024),
        usedMB: usedMem / (1024 * 1024),
        freeMB: freeMem / (1024 * 1024),
        usagePercent: (usedMem / totalMem) * 100,
      },
      load: {
        "1min": loadAvg[0],
        "5min": loadAvg[1],
        "15min": loadAvg[2],
      },
      uptime: os.uptime(),
    };
  }
}

module.exports = new ResourceMonitorService();
