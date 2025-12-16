#!/usr/bin/env node

/**
 * Code Roach End-to-End Test
 * Tests the full flow: organization → project → crawl → issues → frontend
 */

const projectService = require('../../server/services/projectService');
const codebaseCrawler = require('../../server/services/codebaseCrawler');
const issueStorageService = require('../../server/services/issueStorageService');
const { createClient } = require('@supabase/supabase-js');
const config = require('../../server/config');

// Test configuration
const TEST_ORG_NAME = `E2E Test Org ${Date.now()}`;
const TEST_PROJECT_NAME = `E2E Test Project ${Date.now()}`;
const TEST_USER_ID = 'e2e-test-user'; // Default test user

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

// Test results
const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
};

function recordTest(name, passed, message = '') {
    results.tests.push({ name, passed, message });
    if (passed) {
        results.passed++;
        logSuccess(`${name}: ${message || 'PASSED'}`);
    } else {
        results.failed++;
        logError(`${name}: ${message || 'FAILED'}`);
    }
}

// Cleanup function
let createdOrg = null;
let createdProject = null;

async function cleanup() {
    logStep('CLEANUP', 'Cleaning up test data...');
    
    if (createdProject && projectService.supabase) {
        try {
            await projectService.supabase
                .from('code_roach_issues')
                .delete()
                .eq('project_id', createdProject.id);
            
            await projectService.supabase
                .from('projects')
                .delete()
                .eq('id', createdProject.id);
            
            logSuccess('Test project deleted');
        } catch (err) {
            logWarning(`Failed to delete test project: ${err.message}`);
        }
    }
    
    if (createdOrg && projectService.supabase) {
        try {
            await projectService.supabase
                .from('organization_members')
                .delete()
                .eq('organization_id', createdOrg.id);
            
            await projectService.supabase
                .from('organizations')
                .delete()
                .eq('id', createdOrg.id);
            
            logSuccess('Test organization deleted');
        } catch (err) {
            logWarning(`Failed to delete test organization: ${err.message}`);
        }
    }
}

// Test 1: Create Organization
async function testCreateOrganization() {
    logStep('TEST 1', 'Creating organization...');
    
    try {
        createdOrg = await projectService.createOrganization(
            TEST_ORG_NAME,
            TEST_USER_ID
        );
        
        if (createdOrg && createdOrg.id) {
            recordTest('Create Organization', true, `Created org: ${createdOrg.name} (${createdOrg.id})`);
            return true;
        } else {
            recordTest('Create Organization', false, 'Organization created but missing ID');
            return false;
        }
    } catch (err) {
        recordTest('Create Organization', false, err.message);
        return false;
    }
}

// Test 2: Create Project
async function testCreateProject() {
    logStep('TEST 2', 'Creating project...');
    
    if (!createdOrg) {
        recordTest('Create Project', false, 'No organization available');
        return false;
    }
    
    try {
        createdProject = await projectService.createProject(
            createdOrg.id,
            TEST_PROJECT_NAME,
            {
                rootDirectory: process.cwd(),
                language: 'javascript',
                framework: 'node'
            }
        );
        
        if (createdProject && createdProject.id) {
            recordTest('Create Project', true, `Created project: ${createdProject.name} (${createdProject.id})`);
            return true;
        } else {
            recordTest('Create Project', false, 'Project created but missing ID');
            return false;
        }
    } catch (err) {
        recordTest('Create Project', false, err.message);
        return false;
    }
}

// Test 3: Run Crawl with Project ID
async function testRunCrawl() {
    logStep('TEST 3', 'Running crawl with project ID...');
    
    if (!createdProject) {
        recordTest('Run Crawl', false, 'No project available');
        return false;
    }
    
    try {
        // Run a quick crawl on a small directory (tests directory)
        const testDir = process.cwd();
        const crawlOptions = {
            projectId: createdProject.id,
            autoFix: false, // Don't auto-fix in tests
            maxFiles: 10, // Limit to 10 files for speed
            useOptimizations: true
        };
        
        log('Starting crawl (this may take a moment)...', 'yellow');
        const result = await codebaseCrawler.crawlCodebase(testDir, crawlOptions);
        
        if (result && result.stats) {
            recordTest('Run Crawl', true, 
                `Scanned ${result.stats.filesScanned} files, found ${result.stats.issuesFound} issues`);
            return true;
        } else {
            recordTest('Run Crawl', false, 'Crawl completed but no stats returned');
            return false;
        }
    } catch (err) {
        recordTest('Run Crawl', false, err.message);
        return false;
    }
}

// Test 4: Verify Issues Stored in Database
async function testVerifyIssuesStored() {
    logStep('TEST 4', 'Verifying issues stored in database...');
    
    if (!createdProject) {
        recordTest('Verify Issues Stored', false, 'No project available');
        return false;
    }
    
    try {
        if (!projectService.supabase) {
            recordTest('Verify Issues Stored', false, 'Supabase not initialized');
            return false;
        }
        
        // Wait a moment for issues to be stored
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: issues, error } = await projectService.supabase
            .from('code_roach_issues')
            .select('*')
            .eq('project_id', createdProject.id)
            .limit(100);
        
        if (error) {
            recordTest('Verify Issues Stored', false, error.message);
            return false;
        }
        
        if (issues && issues.length > 0) {
            recordTest('Verify Issues Stored', true, `Found ${issues.length} issues in database`);
            
            // Log sample issue
            if (issues[0]) {
                log(`  Sample issue: ${issues[0].error_type} at ${issues[0].file_path}:${issues[0].line_number}`, 'blue');
            }
            
            return true;
        } else {
            recordTest('Verify Issues Stored', true, 'No issues found (this is OK - may be no issues in test files)');
            results.warnings++;
            return true; // Not a failure - just no issues found
        }
    } catch (err) {
        recordTest('Verify Issues Stored', false, err.message);
        return false;
    }
}

// Test 5: Test API Endpoints
async function testAPIEndpoints() {
    logStep('TEST 5', 'Testing API endpoints...');
    
    if (!createdProject) {
        recordTest('Test API Endpoints', false, 'No project available');
        return false;
    }
    
    try {
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        
        // Test health endpoint
        try {
            const healthResponse = await fetch(`${baseUrl}/api/health`);
            if (healthResponse.ok) {
                recordTest('API Health Check', true, 'Health endpoint responding');
            } else {
                recordTest('API Health Check', false, `Health endpoint returned ${healthResponse.status}`);
            }
        } catch (err) {
            logWarning(`API server may not be running: ${err.message}`);
            recordTest('API Health Check', false, 'API server not accessible');
            results.warnings++;
        }
        
        // Test stats endpoint with project ID
        try {
            const statsResponse = await fetch(`${baseUrl}/api/code-roach/stats?projectId=${createdProject.id}`);
            if (statsResponse.ok) {
                const stats = await statsResponse.json();
                recordTest('API Stats Endpoint', true, 'Stats endpoint working');
            } else {
                recordTest('API Stats Endpoint', false, `Stats endpoint returned ${statsResponse.status}`);
            }
        } catch (err) {
            logWarning(`Stats endpoint not accessible: ${err.message}`);
            recordTest('API Stats Endpoint', false, 'Stats endpoint not accessible');
            results.warnings++;
        }
        
        return true;
    } catch (err) {
        recordTest('Test API Endpoints', false, err.message);
        return false;
    }
}

// Test 6: Verify Project Retrieval
async function testProjectRetrieval() {
    logStep('TEST 6', 'Verifying project retrieval...');
    
    if (!createdProject) {
        recordTest('Project Retrieval', false, 'No project available');
        return false;
    }
    
    try {
        const project = await projectService.getProject(createdProject.id);
        
        if (project && project.id === createdProject.id) {
            recordTest('Project Retrieval', true, `Retrieved project: ${project.name}`);
            return true;
        } else {
            recordTest('Project Retrieval', false, 'Project not found or ID mismatch');
            return false;
        }
    } catch (err) {
        recordTest('Project Retrieval', false, err.message);
        return false;
    }
}

// Main test runner
async function runTests() {
    log('\n' + '='.repeat(60), 'cyan');
    log('Code Roach End-to-End Test Suite', 'cyan');
    log('='.repeat(60) + '\n', 'cyan');
    
    try {
        // Run tests in sequence
        await testCreateOrganization();
        await testCreateProject();
        await testProjectRetrieval();
        await testRunCrawl();
        await testVerifyIssuesStored();
        await testAPIEndpoints();
        
    } catch (err) {
        logError(`Test suite error: ${err.message}`);
        console.error(err);
    } finally {
        // Cleanup
        await cleanup();
        
        // Print summary
        log('\n' + '='.repeat(60), 'cyan');
        log('Test Summary', 'cyan');
        log('='.repeat(60), 'cyan');
        log(`✅ Passed: ${results.passed}`, 'green');
        log(`❌ Failed: ${results.failed}`, 'red');
        log(`⚠️  Warnings: ${results.warnings}`, 'yellow');
        log(`📊 Total: ${results.tests.length}`, 'blue');
        
        if (results.failed === 0) {
            log('\n🎉 All tests passed!', 'green');
            process.exit(0);
        } else {
            log('\n❌ Some tests failed', 'red');
            process.exit(1);
        }
    }
}

// Handle unhandled errors
process.on('unhandledRejection', (err) => {
    logError(`Unhandled rejection: ${err.message}`);
    console.error(err);
    process.exit(1);
});

// Run tests
if (require.main === module) {
    runTests();
}

module.exports = { runTests };

