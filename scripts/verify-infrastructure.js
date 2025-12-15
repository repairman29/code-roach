#!/usr/bin/env node

/**
 * Infrastructure Verification Script
 * Verifies that all infrastructure components are properly configured
 */

require('dotenv').config();

const http = require('http');
const https = require('https');

// Colors
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.APP_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;
let warnings = 0;

function log(message, color = RESET) {
    console.log(`${color}${message}${RESET}`);
}

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

async function checkHealthEndpoint() {
    try {
        const result = await makeRequest(`${BASE_URL}/api/health`);
        if (result.status === 200 || result.status === 503) {
            log('   ✅ Health endpoint responding', GREEN);
            passed++;
            return true;
        } else {
            log(`   ❌ Health endpoint returned ${result.status}`, RED);
            failed++;
            return false;
        }
    } catch (err) {
        log(`   ❌ Health endpoint failed: ${err.message}`, RED);
        failed++;
        return false;
    }
}

async function checkLivenessProbe() {
    try {
        const result = await makeRequest(`${BASE_URL}/api/health/live`);
        if (result.status === 200) {
            log('   ✅ Liveness probe working', GREEN);
            passed++;
            return true;
        } else {
            log(`   ❌ Liveness probe returned ${result.status}`, RED);
            failed++;
            return false;
        }
    } catch (err) {
        log(`   ❌ Liveness probe failed: ${err.message}`, RED);
        failed++;
        return false;
    }
}

async function checkReadinessProbe() {
    try {
        const result = await makeRequest(`${BASE_URL}/api/health/ready`);
        if (result.status === 200) {
            log('   ✅ Readiness probe working', GREEN);
            passed++;
            return true;
        } else if (result.status === 503) {
            log('   ⚠️  Readiness probe returned 503 (degraded)', YELLOW);
            warnings++;
            return false;
        } else {
            log(`   ❌ Readiness probe returned ${result.status}`, RED);
            failed++;
            return false;
        }
    } catch (err) {
        log(`   ❌ Readiness probe failed: ${err.message}`, RED);
        failed++;
        return false;
    }
}

async function checkCircuitBreakers() {
    try {
        const result = await makeRequest(`${BASE_URL}/api/health/circuit-breakers`);
        if (result.status === 200 && result.data.circuit_breakers) {
            const breakers = result.data.circuit_breakers;
            const openBreakers = Object.entries(breakers)
                .filter(([_, state]) => state.state === 'OPEN')
                .map(([name]) => name);
            
            if (openBreakers.length === 0) {
                log('   ✅ All circuit breakers CLOSED', GREEN);
                passed++;
            } else {
                log(`   ⚠️  ${openBreakers.length} circuit breaker(s) OPEN: ${openBreakers.join(', ')}`, YELLOW);
                warnings++;
            }
            return true;
        } else {
            log('   ❌ Circuit breakers endpoint failed', RED);
            failed++;
            return false;
        }
    } catch (err) {
        log(`   ❌ Circuit breakers check failed: ${err.message}`, RED);
        failed++;
        return false;
    }
}

async function checkMetrics() {
    try {
        const result = await makeRequest(`${BASE_URL}/api/metrics`);
        if (result.status === 200 && result.data) {
            log('   ✅ Metrics endpoint working', GREEN);
            passed++;
            return true;
        } else {
            log('   ❌ Metrics endpoint failed', RED);
            failed++;
            return false;
        }
    } catch (err) {
        log(`   ❌ Metrics check failed: ${err.message}`, RED);
        failed++;
        return false;
    }
}

async function checkEnvironmentVariables() {
    const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const optional = ['REDIS_URL', 'UPSTASH_REDIS_REST_URL', 'SENTRY_DSN'];
    
    let allRequired = true;
    
    for (const varName of required) {
        if (process.env[varName]) {
            log(`   ✅ ${varName} is set`, GREEN);
            passed++;
        } else {
            log(`   ❌ ${varName} is missing (required)`, RED);
            failed++;
            allRequired = false;
        }
    }
    
    for (const varName of optional) {
        if (process.env[varName]) {
            log(`   ✅ ${varName} is set`, GREEN);
            passed++;
        } else {
            log(`   ⚠️  ${varName} not set (optional)`, YELLOW);
            warnings++;
        }
    }
    
    return allRequired;
}

async function checkRailwayConfig() {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
        const railwayJson = await fs.readFile(path.join(process.cwd(), 'railway.json'), 'utf8');
        const config = JSON.parse(railwayJson);
        
        if (config.deploy && config.deploy.numReplicas >= 3) {
            log(`   ✅ railway.json configured for ${config.deploy.numReplicas} replicas`, GREEN);
            passed++;
        } else {
            log('   ⚠️  railway.json not configured for multi-instance (recommended: 3+)', YELLOW);
            warnings++;
        }
        
        if (config.deploy && config.deploy.healthcheckPath) {
            log(`   ✅ Health check path configured: ${config.deploy.healthcheckPath}`, GREEN);
            passed++;
        } else {
            log('   ⚠️  Health check path not configured', YELLOW);
            warnings++;
        }
        
        return true;
    } catch (err) {
        log(`   ❌ Failed to read railway.json: ${err.message}`, RED);
        failed++;
        return false;
    }
}

async function main() {
    log('\n🔍 Infrastructure Verification', BLUE);
    log('==================================================\n');
    log(`Testing: ${BASE_URL}\n`);
    
    log('📊 Checking Health Endpoints...', BLUE);
    await checkHealthEndpoint();
    await checkLivenessProbe();
    await checkReadinessProbe();
    
    log('\n🔌 Checking Circuit Breakers...', BLUE);
    await checkCircuitBreakers();
    
    log('\n📈 Checking Metrics...', BLUE);
    await checkMetrics();
    
    log('\n🔐 Checking Environment Variables...', BLUE);
    await checkEnvironmentVariables();
    
    log('\n⚙️  Checking Railway Configuration...', BLUE);
    await checkRailwayConfig();
    
    log('\n==================================================', BLUE);
    log(`\n📊 Verification Results:`, BLUE);
    log(`   ${GREEN}✅ Passed: ${passed}${RESET}`);
    if (warnings > 0) {
        log(`   ${YELLOW}⚠️  Warnings: ${warnings}${RESET}`);
    }
    if (failed > 0) {
        log(`   ${RED}❌ Failed: ${failed}${RESET}`);
        log('\n⚠️  Some checks failed. Please review and fix issues.', YELLOW);
        process.exit(1);
    } else {
        log('\n✅ All critical checks passed!', GREEN);
        if (warnings > 0) {
            log('⚠️  Some optional checks have warnings. Review for optimization.', YELLOW);
        }
    }
}

main().catch(err => {
    log(`\n❌ Verification failed: ${err.message}`, RED);
    process.exit(1);
});
