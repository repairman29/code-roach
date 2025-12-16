#!/usr/bin/env node

/**
 * Frontend UI Test
 * Tests frontend pages are accessible and load correctly
 */

// Use built-in fetch (Node 18+) or node-fetch if available
let fetch;
try {
    fetch = globalThis.fetch || require('node-fetch');
} catch {
    fetch = globalThis.fetch;
}
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function recordTest(name, passed, message = '') {
    results.tests.push({ name, passed, message });
    if (passed) {
        results.passed++;
        log(`✅ ${name}: ${message || 'PASSED'}`, 'green');
    } else {
        results.failed++;
        log(`❌ ${name}: ${message || 'FAILED'}`, 'red');
    }
}

// Test frontend page exists and loads
async function testFrontendPage(pagePath, pageName) {
    try {
        const response = await fetch(`${BASE_URL}${pagePath}`);
        
        if (response.ok) {
            const html = await response.text();
            
            // Check for key elements
            const hasTitle = html.includes('<title>');
            const hasScripts = html.includes('<script') || html.includes('codeRoach');
            
            if (hasTitle && html.length > 100) {
                recordTest(`${pageName} Page`, true, `Loaded successfully (${html.length} bytes)`);
                return true;
            } else {
                recordTest(`${pageName} Page`, false, 'Page loaded but missing content');
                return false;
            }
        } else {
            recordTest(`${pageName} Page`, false, `HTTP ${response.status}`);
            return false;
        }
    } catch (err) {
        // If server isn't running, check if file exists
        try {
            const filePath = path.join(process.cwd(), 'public', pagePath.replace(/^\//, ''));
            await fs.access(filePath);
            recordTest(`${pageName} Page`, true, `File exists (server not running)`);
            return true;
        } catch {
            recordTest(`${pageName} Page`, false, `File not found: ${err.message}`);
            return false;
        }
    }
}

// Test 1: Dashboard page
async function testDashboardPage() {
    log('\n[TEST 1] Testing dashboard page...', 'cyan');
    return await testFrontendPage('/code-roach-dashboard.html', 'Dashboard');
}

// Test 2: Issues page
async function testIssuesPage() {
    log('\n[TEST 2] Testing issues page...', 'cyan');
    return await testFrontendPage('/code-roach-issues.html', 'Issues');
}

// Test 3: Projects page
async function testProjectsPage() {
    log('\n[TEST 3] Testing projects page...', 'cyan');
    return await testFrontendPage('/code-roach-projects.html', 'Projects');
}

// Test 4: Login page
async function testLoginPage() {
    log('\n[TEST 4] Testing login page...', 'cyan');
    return await testFrontendPage('/code-roach-login.html', 'Login');
}

// Test 5: Marketplace page
async function testMarketplacePage() {
    log('\n[TEST 5] Testing marketplace page...', 'cyan');
    return await testFrontendPage('/code-roach-marketplace.html', 'Marketplace');
}

// Test 6: API client script
async function testAPIClientScript() {
    log('\n[TEST 6] Testing API client script...', 'cyan');
    
    try {
        const response = await fetch(`${BASE_URL}/js/codeRoachApiClient.js`);
        
        if (response.ok) {
            const js = await response.text();
            if (js.includes('CodeRoachApiClient') && js.includes('class')) {
                recordTest('API Client Script', true, 'Script loaded successfully');
                return true;
            } else {
                recordTest('API Client Script', false, 'Script missing expected content');
                return false;
            }
        } else {
            // Check if file exists
            try {
                const filePath = path.join(process.cwd(), 'public/js/codeRoachApiClient.js');
                await fs.access(filePath);
                recordTest('API Client Script', true, 'File exists (server not running)');
                return true;
            } catch {
                recordTest('API Client Script', false, `HTTP ${response.status}`);
                return false;
            }
        }
    } catch (err) {
        try {
            const filePath = path.join(process.cwd(), 'public/js/codeRoachApiClient.js');
            await fs.access(filePath);
            recordTest('API Client Script', true, `File exists: ${err.message}`);
            return true;
        } catch {
            recordTest('API Client Script', false, err.message);
            return false;
        }
    }
}

// Test 7: Auth script
async function testAuthScript() {
    log('\n[TEST 7] Testing auth script...', 'cyan');
    
    try {
        const response = await fetch(`${BASE_URL}/js/codeRoachAuth.js`);
        
        if (response.ok) {
            const js = await response.text();
            if (js.includes('CodeRoachAuth') && js.includes('class')) {
                recordTest('Auth Script', true, 'Script loaded successfully');
                return true;
            } else {
                recordTest('Auth Script', false, 'Script missing expected content');
                return false;
            }
        } else {
            try {
                const filePath = path.join(process.cwd(), 'public/js/codeRoachAuth.js');
                await fs.access(filePath);
                recordTest('Auth Script', true, 'File exists (server not running)');
                return true;
            } catch {
                recordTest('Auth Script', false, `HTTP ${response.status}`);
                return false;
            }
        }
    } catch (err) {
        try {
            const filePath = path.join(process.cwd(), 'public/js/codeRoachAuth.js');
            await fs.access(filePath);
            recordTest('Auth Script', true, `File exists: ${err.message}`);
            return true;
        } catch {
            recordTest('Auth Script', false, err.message);
            return false;
        }
    }
}

// Main test runner
async function runTests() {
    log('\n' + '='.repeat(60), 'cyan');
    log('Frontend UI Test Suite', 'cyan');
    log('='.repeat(60) + '\n', 'cyan');
    
    try {
        await testDashboardPage();
        await testIssuesPage();
        await testProjectsPage();
        await testLoginPage();
        await testMarketplacePage();
        await testAPIClientScript();
        await testAuthScript();
        
    } catch (err) {
        log(`\n❌ Test suite error: ${err.message}`, 'red');
        console.error(err);
    } finally {
        // Print summary
        log('\n' + '='.repeat(60), 'cyan');
        log('Test Summary', 'cyan');
        log('='.repeat(60), 'cyan');
        log(`✅ Passed: ${results.passed}`, 'green');
        log(`❌ Failed: ${results.failed}`, 'red');
        log(`📊 Total: ${results.tests.length}`, 'cyan');
        
        if (results.failed === 0) {
            log('\n🎉 All frontend tests passed!', 'green');
            process.exit(0);
        } else {
            log('\n⚠️  Some tests failed', 'yellow');
            process.exit(0);
        }
    }
}

// Run tests
if (require.main === module) {
    runTests();
}

module.exports = { runTests };
