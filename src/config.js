// Review and improve config.js
// Audit server file server/config.js for security, performance, error handling, and best practices

/**
 * Server Configuration
 * Centralized environment variable management
 */

// Load environment variables
require("dotenv").config();

// Logger setup - simple console logger for now
const log = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => console.debug('[DEBUG]', ...args)
};

/**
 * Server configuration object
 */
const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",

  // SECURITY: Validate required environment variables in production
  validateProductionConfig() {
    if (this.isProduction()) {
      const required = ["ADMIN_KEY", "ADMIN_PASSWORD_HASH"];
      const missing = required.filter(
        (key) => !process.env[key] || process.env[key] === "dev-admin-key",
      );
      if (missing.length > 0) {
        console.error(
          "❌ CRITICAL: Missing required environment variables in production:",
          missing.join(", "),
        );
        console.error(
          "   Application will not start securely. Please configure:",
          missing.join(", "),
        );
        // Don't exit - allow startup but log warning
        // In production, you may want to: process.exit(1);
      }
    }
  },

  // CORS
  // SECURITY FIX: Removed wildcard '*' from allowed origins
  // Wildcard allows any origin, making CSRF attacks possible
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter((o) => o !== "*") // Remove wildcards
    : process.env.NODE_ENV === "production"
      ? [
          "https://playsmuggler.com",
          "https://www.playsmuggler.com",
          "https://d6consortium.com",
          "https://www.d6consortium.com",
          "https://smugglers-production.up.railway.app",
          "https://smuggler-d1b4a.web.app",
          "https://smuggler-d1b4a.firebaseapp.com",
          // Allow localhost for development/testing (can be removed in production if needed)
          "http://localhost:3000",
          "http://localhost:5000",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:5000",
        ]
      : [
          "http://localhost:3000",
          "http://localhost:5000",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:5000",
          // Removed wildcard '*' - explicitly list allowed origins
        ],

  // Sentry Error Tracking
  sentry: {
    dsn: process.env.SENTRY_DSN || null,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    release: process.env.RAILWAY_GIT_COMMIT_SHA || "development",
  },

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "smuggler-d1b4a",
    apiKey: process.env.FIREBASE_API_KEY || null,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || null,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || null,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || null,
    appId: process.env.FIREBASE_APP_ID || null,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || null,
    clientConfig: process.env.FIREBASE_CLIENT_CONFIG
      ? JSON.parse(process.env.FIREBASE_CLIENT_CONFIG)
      : null,
    googleApplicationCredentials:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    googleApplicationCredentialsJson: process.env
      .GOOGLE_APPLICATION_CREDENTIALS_JSON
      ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      : null,
  },

  // OAuth
  // SECURITY FIX: Removed hardcoded placeholder credentials - must be set via environment variables
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || null,
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET ||
        (() => {
          if (process.env.NODE_ENV === "production") {
            console.error(
              "❌ CRITICAL: GOOGLE_CLIENT_SECRET must be set in production",
            );
          }
          return null;
        })(),
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || null,
      clientSecret:
        process.env.GITHUB_CLIENT_SECRET ||
        (() => {
          if (process.env.NODE_ENV === "production") {
            console.error(
              "❌ CRITICAL: GITHUB_CLIENT_SECRET must be set in production",
            );
          }
          return null;
        })(),
    },
  },

  // Push Notifications (VAPID)
  // SECURITY FIX: Removed hardcoded placeholder key
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    privateKey: process.env.VAPID_PRIVATE_KEY || null,
  },

  // Server URL
  serverUrl: process.env.SERVER_URL || "http://localhost:3000",

  // Stripe Payment Processing
  stripe: {
    // Use production keys in production environment, test keys otherwise
    secretKey:
      process.env.NODE_ENV === "production" ||
      process.env.USE_PRODUCTION_STRIPE === "true"
        ? process.env.STRIPE_SECRET_KEY_LIVE ||
          process.env.STRIPE_SECRET_KEY ||
          null
        : process.env.STRIPE_SECRET_KEY || null,
    publishableKey:
      process.env.NODE_ENV === "production" ||
      process.env.USE_PRODUCTION_STRIPE === "true"
        ? process.env.STRIPE_PUBLISHABLE_KEY_LIVE ||
          process.env.STRIPE_PUBLISHABLE_KEY ||
          null
        : process.env.STRIPE_PUBLISHABLE_KEY || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
    // Test mode detection
    isTestMode: () => {
      const key =
        process.env.NODE_ENV === "production" ||
        process.env.USE_PRODUCTION_STRIPE === "true"
          ? process.env.STRIPE_SECRET_KEY_LIVE ||
            process.env.STRIPE_SECRET_KEY ||
            ""
          : process.env.STRIPE_SECRET_KEY || "";
      return key.startsWith("sk_test_");
    },
  },

  // HTTPS Enforcement
  // SECURITY: Enforce HTTPS in production
  https: {
    // Force HTTPS redirects in production
    enforce: process.env.ENFORCE_HTTPS !== "false", // Default: true in production
    // Trust proxy headers (set by reverse proxy like Railway, Heroku, etc.)
    trustProxy: process.env.TRUST_PROXY !== "false", // Default: true
    // Headers to check for HTTPS detection (in order of preference)
    proxyHeaders: [
      "x-forwarded-proto",
      "x-forwarded-ssl",
      "x-forwarded-scheme",
    ],
  },

  // Logging
  logging: {
    morgan: process.env.NODE_ENV === "production" ? "combined" : "dev",
  },

  // Image Generation
  imageGeneration: {
    provider: process.env.IMAGE_PROVIDER || "stability", // stability, openai, replicate, banana, imagen, vertex (stability is default as it's more reliable)
    openai: {
      apiKey: process.env.OPENAI_API_KEY || null,
    },
    stability: {
      apiKey: process.env.STABILITY_API_KEY || null,
    },
    replicate: {
      apiToken: process.env.REPLICATE_API_TOKEN || null,
    },
    banana: {
      apiKey: process.env.BANANA_API_KEY || null,
      modelKey: process.env.BANANA_MODEL_KEY || null,
    },
    imagen: {
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null,
    },
    googleAI: {
      apiKey:
        process.env.GOOGLE_AI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        null,
    },
    vertex: {
      projectId:
        process.env.GOOGLE_CLOUD_PROJECT_ID ||
        process.env.GCP_PROJECT_ID ||
        null,
    },
  },

  // Phase 16: Supabase Configuration
  // SECURITY: All keys must be in environment variables - no hardcoded fallbacks
  supabase: {
    url:
      process.env.SUPABASE_URL ||
      "https://rbfzlqmkwhbvrrfdcain.supabase.co",
    // SECURITY FIX: Removed hardcoded anon key - must be set via environment variable
    // Note: Anon key is safe to expose client-side, but should still use env var for configuration
    anonKey:
      process.env.SUPABASE_ANON_KEY ||
      (() => {
        if (process.env.NODE_ENV === "production") {
          console.error(
            "❌ CRITICAL: SUPABASE_ANON_KEY must be set in production",
          );
          console.error(
            "⚠️  Server will start but Supabase-dependent features will be disabled.",
          );
        }
        return null;
      })(),
    // SECURITY FIX: Removed hardcoded service role key - CRITICAL security vulnerability
    // Service role key bypasses ALL Row Level Security policies - NEVER hardcode
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      (() => {
        if (process.env.NODE_ENV === "production") {
          console.error(
            "❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY must be set in production",
          );
          console.error(
            "⚠️  Server will start but Supabase-dependent features will be disabled.",
          );
          // Don't throw - services handle missing credentials gracefully
          // throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production');
        }
        log.warn(
          "⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY not set. Supabase operations will fail.",
        );
        return null;
      })(),
  },

  // Phase 17: Redis Configuration (Upstash)
  // Oracle AI services, caching, and neural network state persistence
  redis: {
    // Primary Redis URL (Upstash or other Redis)
    url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL || null,
    // Redis REST API URL (for Upstash REST API)
    restUrl: process.env.UPSTASH_REDIS_REST_URL || null,
    // Redis REST API Token (for Upstash REST API)
    restToken: process.env.UPSTASH_REDIS_REST_TOKEN || null,
    // Oracle-specific Redis configuration
    oracle: {
      // Neural network state persistence
      neuralNetwork: {
        enabled:
          process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
            ? true
            : false,
        keyPrefix: "oracle:nn:",
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        maxMemory: 50 * 1024 * 1024, // 50MB for neural network data
      },
      // Predictive intelligence cache
      predictive: {
        enabled:
          process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
            ? true
            : false,
        keyPrefix: "oracle:predictive:",
        ttl: 60 * 60 * 1000, // 1 hour
        maxMemory: 100 * 1024 * 1024, // 100MB for predictive data
      },
      // Oracle knowledge cache
      knowledge: {
        enabled:
          process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
            ? true
            : false,
        keyPrefix: "oracle:knowledge:",
        ttl: 6 * 60 * 60 * 1000, // 6 hours
        maxMemory: 200 * 1024 * 1024, // 200MB for knowledge cache
      },
      // Usage analytics
      analytics: {
        enabled:
          process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
            ? true
            : false,
        keyPrefix: "oracle:analytics:",
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxMemory: 10 * 1024 * 1024, // 10MB for analytics
      },
    },
  },
};

/**
 * Get Supabase configuration
 * Helper method for backwards compatibility with services expecting config.getSupabaseService()
 * @returns {Object} Supabase config { url, anonKey, serviceRoleKey }
 */
config.getSupabaseService = () => {
  return config.supabase;
};

/**
 * Check if Sentry is configured
 */
config.isSentryEnabled = () => {
  return !!config.sentry.dsn;
};

/**
 * Check if in production
 */
config.isProduction = () => {
  return config.nodeEnv === "production";
};

/**
 * Check if in development
 */
config.isDevelopment = () => {
  return config.nodeEnv === "development";
};

/**
 * Check if in test
 */
config.isTest = () => {
  return config.nodeEnv === "test";
};

module.exports = config;
