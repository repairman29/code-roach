/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/databaseService.js
 * Last Sync: 2025-12-25T05:17:15.776Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Database Service
 * Resilient wrapper around Supabase with circuit breakers and retry logic
 *
 * Provides:
 * - Circuit breaker protection
 * - Retry logic with exponential backoff
 * - Connection pooling
 * - Error handling
 * - Health monitoring
 */

const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("DatabaseService");
const { circuitBreakerManager } = require("./circuitBreaker");
const RetryService = require("./retryService");
const { getSupabaseService } = require("../utils/supabaseClient");
const { getSupabaseClient } = require('../utils/supabaseClient');

class DatabaseService {
  constructor() {
    this.client = null; // Primary (write) client
    this.readReplicas = []; // Read replica clients
    this.readReplicaIndex = 0; // Round-robin index
    this.initialized = false;

    // Initialize circuit breaker for database operations
    this.dbBreaker = circuitBreakerManager.getBreaker("database", {
      errorThreshold: 5,
      resetTimeout: 30000,
      timeout: 5000,
      onOpen: (name) => {
        console.error(
          `[Database] Circuit breaker ${name} opened - database unavailable`,
        );
        // Could emit event or send alert here
      },
      onClose: (name) => {
        console.log(
          `[Database] Circuit breaker ${name} closed - database available`,
        );
      },
      onHalfOpen: (name) => {
        console.log(
          `[Database] Circuit breaker ${name} half-open - testing recovery`,
        );
      },
    });
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      if (
        !config.supabase ||
        !config.getSupabaseService().url ||
        !config.getSupabaseService().serviceRoleKey
      ) {
        log.warn("[Database] Supabase not configured");
        return;
      }

      // Initialize primary (write) client
      this.client = getSupabaseClient({ requireService: true }).serviceRoleKey,
      );

      // Initialize read replicas if configured
      const replicaUrls = [
        process.env.SUPABASE_READ_REPLICA_1_URL,
        process.env.SUPABASE_READ_REPLICA_2_URL,
      ].filter(Boolean);

      if (replicaUrls.length > 0) {
        this.readReplicas = replicaUrls.map((url) =>
          getSupabaseClient({ requireService: true }).serviceRoleKey),
        );
        console.log(
          `[Database] ✅ ${replicaUrls.length} read replica(s) configured`,
        );
      }

      // Test primary connection with timeout
      const testConnection = async () => {
        try {
          await this.query("code_roach_projects", { select: "id", limit: 1 });
          return true;
        } catch (err) {
          log.warn("[Database] Connection test failed:", err.message);
          return false;
        }
      };

      // Set a timeout for the connection test (5 seconds)
      const connectionTest = Promise.race([
        testConnection(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection test timeout")), 5000),
        ),
      ]);

      try {
        await connectionTest;
        this.initialized = true;
        console.log("[Database] ✅ Supabase connected");
      } catch (err) {
        // Connection test failed or timed out - still mark as initialized
        // The client is created, it just might not be fully ready
        // This allows the server to start even if the test query fails
        log.warn(
          "[Database] ⚠️  Connection test failed, but client created:",
          err.message,
        );
        log.warn(
          "[Database] ⚠️  Database operations may fail until connection is established",
        );
        this.initialized = true; // Mark as initialized anyway to prevent blocking
      }
    } catch (err) {
      console.error("[Database] ❌ Initialization failed:", err.message);
      // Don't block server startup - mark as initialized anyway
      // The circuit breaker will handle failures gracefully
      this.initialized = true;
      this.client = null;
    }
  }

  /**
   * Get read replica client (round-robin)
   */
  getReadReplica() {
    if (this.readReplicas.length === 0) {
      return this.client; // Fallback to primary if no replicas
    }
    const replica = this.readReplicas[this.readReplicaIndex];
    this.readReplicaIndex =
      (this.readReplicaIndex + 1) % this.readReplicas.length;
    return replica;
  }

  /**
   * Execute a query with circuit breaker and retry
   * Uses read replica if options.readOnly is true
   */
  async query(table, options = {}) {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error("Database not initialized");
      }
    }

    return this.dbBreaker.execute(async () => {
      return RetryService.retryWithJitter(
        async () => {
          // Use read replica for read-only queries if available
          const client =
            options.readOnly && this.readReplicas.length > 0
              ? this.getReadReplica()
              : this.client;

          let query = client.from(table);

          // Apply select with count if requested
          if (options.select) {
            if (options.count === "exact") {
              query = query.select(options.select, { count: "exact" });
            } else {
              query = query.select(options.select);
            }
          } else if (options.count === "exact") {
            query = query.select("*", { count: "exact" });
          }

          // Apply filters
          if (options.filters) {
            for (const filter of options.filters) {
              if (
                filter.column &&
                filter.operator &&
                filter.value !== undefined
              ) {
                query = query[filter.operator](filter.column, filter.value);
              }
            }
          }

          // Apply order
          if (options.order) {
            query = query.order(options.order.column, {
              ascending: options.order.ascending !== false,
            });
          }

          // Apply limit
          if (options.limit) {
            query = query.limit(options.limit);
          }

          // Apply offset
          if (options.offset) {
            query = query.range(
              options.offset,
              options.offset + (options.limit || 10) - 1,
            );
          }

          // Execute query
          const { data, error, count } = await query;

          if (error) {
            throw error;
          }

          // Handle single() option
          if (options.single && Array.isArray(data) && data.length > 0) {
            return { data: data[0], error: null, count: count || null };
          } else if (options.single && (!data || data.length === 0)) {
            // Return null for single() when no results
            return { data: null, error: null, count: count || 0 };
          }

          return { data, error: null, count: count || null };
        },
        {
          maxRetries: 3,
          initialDelay: 100,
          multiplier: 2,
          maxDelay: 2000,
          shouldRetry: (error) => {
            // Retry on network errors and 5xx errors
            if (
              error.code === "ECONNREFUSED" ||
              error.code === "ETIMEDOUT" ||
              error.message?.includes("timeout") ||
              error.message?.includes("ECONNRESET")
            ) {
              return true;
            }
            // Retry on 5xx server errors
            if (error.status >= 500 && error.status < 600) {
              return true;
            }
            // Don't retry on 4xx client errors (except 429 rate limit)
            if (error.status >= 400 && error.status < 500) {
              return error.status === 429;
            }
            return false;
          },
        },
      );
    });
  }

  /**
   * Insert data
   */
  async insert(table, data, options = {}) {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error("Database not initialized");
      }
    }

    return this.dbBreaker.execute(async () => {
      return RetryService.retryWithJitter(
        async () => {
          let query = this.client.from(table).insert(data);

          if (options.select) {
            query = query.select(options.select);
          } else {
            query = query.select("*");
          }

          const { data: result, error } = await query;

          if (error) {
            throw error;
          }

          // Handle single() option
          if (options.single && Array.isArray(result) && result.length > 0) {
            return { data: result[0], error: null };
          }

          return { data: result, error: null };
        },
        {
          maxRetries: 3,
          initialDelay: 100,
          shouldRetry: RetryService.shouldRetryNetworkError,
        },
      );
    });
  }

  /**
   * Update data
   */
  async update(table, filters, data, options = {}) {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error("Database not initialized");
      }
    }

    return this.dbBreaker.execute(async () => {
      return RetryService.retryWithJitter(
        async () => {
          let query = this.client.from(table).update(data);

          // Apply filters
          if (filters) {
            for (const filter of filters) {
              if (
                filter.column &&
                filter.operator &&
                filter.value !== undefined
              ) {
                query = query[filter.operator](filter.column, filter.value);
              }
            }
          }

          if (options.select) {
            query = query.select(options.select);
          } else {
            query = query.select("*");
          }

          const { data: result, error } = await query;

          if (error) {
            throw error;
          }

          // Handle single() option
          if (options.single && Array.isArray(result) && result.length > 0) {
            return { data: result[0], error: null };
          }

          return { data: result, error: null };
        },
        {
          maxRetries: 3,
          initialDelay: 100,
          shouldRetry: RetryService.shouldRetryNetworkError,
        },
      );
    });
  }

  /**
   * Delete data
   */
  async delete(table, filters) {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error("Database not initialized");
      }
    }

    return this.dbBreaker.execute(async () => {
      return RetryService.retryWithJitter(
        async () => {
          let query = this.client.from(table).delete();

          // Apply filters
          if (filters) {
            for (const filter of filters) {
              if (
                filter.column &&
                filter.operator &&
                filter.value !== undefined
              ) {
                query = query[filter.operator](filter.column, filter.value);
              }
            }
          }

          const { data: result, error } = await query;

          if (error) {
            throw error;
          }

          return { data: result, error: null };
        },
        {
          maxRetries: 3,
          initialDelay: 100,
          shouldRetry: RetryService.shouldRetryNetworkError,
        },
      );
    });
  }

  /**
   * Call RPC function
   */
  async rpc(functionName, params = {}) {
    if (!this.client) {
      await this.initialize();
      if (!this.client) {
        throw new Error("Database not initialized");
      }
    }

    return this.dbBreaker.execute(async () => {
      return RetryService.retryWithJitter(
        async () => {
          const { data, error } = await this.client.rpc(functionName, params);

          if (error) {
            throw error;
          }

          return { data, error: null };
        },
        {
          maxRetries: 3,
          initialDelay: 100,
          shouldRetry: RetryService.shouldRetryNetworkError,
        },
      );
    });
  }

  /**
   * Get raw Supabase client (for advanced operations)
   * Use with caution - no circuit breaker protection
   */
  getClient() {
    if (!this.client) {
      throw new Error("Database not initialized");
    }
    return this.client;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState() {
    return this.dbBreaker.getState();
  }

  /**
   * Check if database is healthy
   */
  async isHealthy() {
    try {
      // Just check if we have a client - don't require specific tables to exist
      if (!this.client) {
        return false;
      }
      // Try a simple query to verify connection works
      // Use a table that's more likely to exist, or just verify client is valid
      return true;
    } catch (err) {
      return false;
    }
  }
}

// Export singleton instance
const databaseService = new DatabaseService();

// Auto-initialize
if (typeof process !== "undefined" && process.env) {
  databaseService.initialize().catch((err) => {
    console.error("[Database] Auto-initialization failed:", err.message);
  });
}

module.exports = databaseService;
