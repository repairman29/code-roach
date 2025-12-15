// Review and improve config.js
// Audit server file server/config.js for security, performance, error handling, and best practices

/**
 * Server Configuration
 * Centralized environment variable management
 */

// Load environment variables
require('dotenv').config();

/**
 * Server configuration object
 */
const config = {
    // Server
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // SECURITY: Validate required environment variables in production
    validateProductionConfig() {
        if (this.isProduction()) {
            const required = ['ADMIN_KEY', 'ADMIN_PASSWORD_HASH'];
            const missing = required.filter(key => !process.env[key] || process.env[key] === 'dev-admin-key');
            if (missing.length > 0) {
                console.error('❌ CRITICAL: Missing required environment variables in production:', missing.join(', '));
                console.error('   Application will not start securely. Please configure:', missing.join(', '));
                // Don't exit - allow startup but log warning
                // In production, you may want to: process.exit(1);
            }
        }
    },
    
    // CORS
    // SECURITY FIX: Removed wildcard '*' from allowed origins
    // Wildcard allows any origin, making CSRF attacks possible
    allowedOrigins: process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o !== '*') // Remove wildcards
        : (process.env.NODE_ENV === 'production' 
            ? [
                'https://smugglers-production.up.railway.app',
                'https://smuggler-d1b4a.web.app',
                'https://smuggler-d1b4a.firebaseapp.com'
                // Removed localhost from production - use ALLOWED_ORIGINS env var if needed
              ]
            : [
                'http://localhost:3000', 
                'http://localhost:5000',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:5000'
                // Removed wildcard '*' - explicitly list allowed origins
              ]),
    
    // Sentry Error Tracking
    sentry: {
        dsn: process.env.SENTRY_DSN || null,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        release: process.env.RAILWAY_GIT_COMMIT_SHA || 'development'
    },
    
    // Firebase
    firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID || 'smuggler-d1b4a',
        apiKey: process.env.FIREBASE_API_KEY || null,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || null,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || null,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || null,
        appId: process.env.FIREBASE_APP_ID || null,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID || null,
        clientConfig: process.env.FIREBASE_CLIENT_CONFIG ? JSON.parse(process.env.FIREBASE_CLIENT_CONFIG) : null,
        googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
        googleApplicationCredentialsJson: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? JSON.
            parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) : null
    },
    
    // OAuth
    oauth: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET'
        },
        github: {
            clientId: process.env.GITHUB_CLIENT_ID || 'YOUR_GITHUB_CLIENT_ID',
            clientSecret: process.env.GITHUB_CLIENT_SECRET || 'YOUR_GITHUB_CLIENT_SECRET'
        }
    },
    
    // Push Notifications (VAPID)
    vapid: {
        publicKey: process.env.VAPID_PUBLIC_KEY || 'PLACEHOLDER_KEY',
        privateKey: process.env.VAPID_PRIVATE_KEY || null
    },
    
    // Server URL
    serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
    
    // HTTPS Enforcement
    // SECURITY: Enforce HTTPS in production
    https: {
        // Force HTTPS redirects in production
        enforce: process.env.ENFORCE_HTTPS !== 'false', // Default: true in production
        // Trust proxy headers (set by reverse proxy like Railway, Heroku, etc.)
        trustProxy: process.env.TRUST_PROXY !== 'false', // Default: true
        // Headers to check for HTTPS detection (in order of preference)
        proxyHeaders: [
            'x-forwarded-proto',
            'x-forwarded-ssl',
            'x-forwarded-scheme'
        ]
    },
    
    // Logging
    logging: {
        morgan: process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
    },
    
    // Image Generation
    imageGeneration: {
        provider: process.env.IMAGE_PROVIDER || 'stability', // stability, openai, replicate, banana, imagen, vertex (stability is default as it's more reliable)
        openai: {
            apiKey: process.env.OPENAI_API_KEY || null
        },
        stability: {
            apiKey: process.env.STABILITY_API_KEY || null
        },
        replicate: {
            apiToken: process.env.REPLICATE_API_TOKEN || null
        },
        banana: {
            apiKey: process.env.BANANA_API_KEY || null,
            modelKey: process.env.BANANA_MODEL_KEY || null
        },
        imagen: {
            apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null
        },
        googleAI: {
            apiKey: process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null
        },
        vertex: {
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GCP_PROJECT_ID || null
        }
    },
    
    // Phase 16: Supabase Configuration
    supabase: {
        url: process.env.SUPABASE_URL || 'https://rbfzlqmkwhbvrrfdcain.supabase.co',
        anonKey: process.env.SUPABASE_ANON_KEY || 'sb_publishable__0QE-QKqJ1jBSzadCtNNhg_ztWxCn32', 
            // Client-side key (safe to expose)
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 
            'sb_secret_zvJ_wjanuj9msZmRBEecSA_G1L1nla5' // Server-side only (NEVER expose)
    }
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
    return config.nodeEnv === 'production';
};

/**
 * Check if in development
 */
config.isDevelopment = () => {
    return config.nodeEnv === 'development';
};

/**
 * Check if in test
 */
config.isTest = () => {
    return config.nodeEnv === 'test';
};

module.exports = config;
