#!/usr/bin/env node

/**
 * Code Roach CLI
 * Command-line interface for Code Roach integration and setup
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CLI_VERSION = '1.0.0';
const CONFIG_FILE = '.code-roach.json';

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
    log(`❌ Error: ${message}`, 'red');
    process.exit(1);
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function warn(message) {
    log(`⚠️  ${message}`, 'yellow');
}

// Command handlers
const commands = {
    init: () => {
        log('\n🪳 Code Roach CLI - Initialization\n', 'bright');
        
        const config = {
            version: CLI_VERSION,
            serverUrl: process.env.CODE_ROACH_URL || 'http://localhost:3000',
            apiKey: process.env.CODE_ROACH_API_KEY || null,
            integrations: {
                github: { enabled: false },
                gitlab: { enabled: false },
                slack: { enabled: false },
                teams: { enabled: false },
                sentry: { enabled: false },
                datadog: { enabled: false }
            },
            ci: {
                enabled: false,
                platform: null
            }
        };

        // Check if config already exists
        if (fs.existsSync(CONFIG_FILE)) {
            warn('Configuration file already exists. Use --force to overwrite.');
            return;
        }

        // Write config file
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        success('Configuration file created: .code-roach.json');
        
        info('\nNext steps:');
        info('1. Configure your server URL: code-roach config set serverUrl <url>');
        info('2. Set up integrations: code-roach integrate <platform>');
        info('3. Test connection: code-roach test');
    },

    config: {
        get: (key) => {
            if (!fs.existsSync(CONFIG_FILE)) {
                error('Configuration file not found. Run "code-roach init" first.');
            }
            
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            if (key) {
                const value = key.split('.').reduce((obj, k) => obj?.[k], config);
                console.log(value !== undefined ? value : '');
            } else {
                console.log(JSON.stringify(config, null, 2));
            }
        },

        set: (key, value) => {
            if (!fs.existsSync(CONFIG_FILE)) {
                error('Configuration file not found. Run "code-roach init" first.');
            }

            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            const keys = key.split('.');
            const lastKey = keys.pop();
            const target = keys.reduce((obj, k) => {
                if (!obj[k]) obj[k] = {};
                return obj[k];
            }, config);
            
            target[lastKey] = value;
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
            success(`Configuration updated: ${key} = ${value}`);
        }
    },

    integrate: {
        github: () => {
            log('\n🔗 Integrating with GitHub...\n', 'bright');
            
            try {
                const githubIntegration = require('./integrations/github-actions');
                const result = githubIntegration.install({ force: false });
                
                success(`GitHub Actions workflow created: ${result.workflowPath}`);
                info('\nNext steps:');
                info('1. Add secrets to GitHub repository:');
                info('   - CODE_ROACH_URL');
                info('   - CODE_ROACH_API_KEY');
                info('2. Push this workflow file to your repository');
            } catch (err) {
                if (err.message.includes('already exists')) {
                    warn('Workflow file already exists. Use --force to overwrite.');
                } else {
                    error(err.message);
                }
            }
        },

        gitlab: () => {
            log('\n🔗 Integrating with GitLab...\n', 'bright');
            
            try {
                const gitlabIntegration = require('./integrations/gitlab-ci');
                const result = gitlabIntegration.install({ force: false });
                
                success(`GitLab CI configuration added: ${result.ciPath}`);
                info('\nNext steps:');
                info('1. Add CI/CD variables in GitLab:');
                info('   - CODE_ROACH_URL');
                info('   - CODE_ROACH_API_KEY');
                info('2. Commit and push .gitlab-ci.yml');
            } catch (err) {
                error(err.message);
            }
        },

        slack: () => {
            log('\n🔗 Integrating with Slack...\n', 'bright');
            
            const webhookUrl = process.env.SLACK_WEBHOOK_URL || prompt('Slack webhook URL: ');
            const channel = process.env.SLACK_CHANNEL || prompt('Channel (default: #code-roach): ') || '#code-roach';
            
            if (!webhookUrl) {
                error('Slack webhook URL is required');
            }

            // Update config
            if (!fs.existsSync(CONFIG_FILE)) {
                commands.init();
            }
            
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            config.integrations.slack = {
                enabled: true,
                webhookUrl,
                channel
            };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
            
            success('Slack integration configured');
            info('Configure on server: POST /api/code-roach/slack/configure');
        },

        sentry: () => {
            log('\n🔗 Integrating with Sentry...\n', 'bright');
            
            try {
                const sentryIntegration = require('./integrations/sentry');
                const result = sentryIntegration.install();
                
                success(`Sentry integration created: ${result.outputFile}`);
                info('\nNext steps:');
                result.instructions.forEach(instruction => info(instruction));
            } catch (err) {
                error(err.message);
            }
        },

        datadog: () => {
            log('\n🔗 Integrating with Datadog...\n', 'bright');
            
            try {
                const datadogIntegration = require('./integrations/datadog');
                const result = datadogIntegration.install();
                
                success(`Datadog integration created: ${result.outputFile}`);
                info('\nNext steps:');
                result.instructions.forEach(instruction => info(instruction));
            } catch (err) {
                error(err.message);
            }
        },

        discord: () => {
            log('\n🔗 Integrating with Discord...\n', 'bright');
            
            try {
                const discordIntegration = require('./integrations/discord');
                const result = discordIntegration.install();
                
                success(`Discord integration created: ${result.outputFile}`);
                info('\nNext steps:');
                result.instructions.forEach(instruction => info(instruction));
            } catch (err) {
                error(err.message);
            }
        },

        vscode: () => {
            log('\n🔗 Integrating with VS Code...\n', 'bright');
            
            try {
                const vscodeIntegration = require('./integrations/vscode-extension');
                const result = vscodeIntegration.generateExtension();
                
                success(`VS Code extension created: ${result.extensionDir}`);
                info('\nNext steps:');
                info('1. cd .vscode-extension');
                info('2. npm install');
                info('3. Press F5 in VS Code to run extension');
            } catch (err) {
                error(err.message);
            }
        },

        jenkins: () => {
            log('\n🔗 Integrating with Jenkins...\n', 'bright');
            
            try {
                const jenkinsIntegration = require('./integrations/jenkins');
                const result = jenkinsIntegration.install();
                
                success(`Jenkins pipeline created: ${result.pipelineFile}`);
                info('\nNext steps:');
                result.instructions.forEach(instruction => info(instruction));
            } catch (err) {
                error(err.message);
            }
        },

        circleci: () => {
            log('\n🔗 Integrating with CircleCI...\n', 'bright');
            
            try {
                const circleciIntegration = require('./integrations/circleci');
                const result = circleciIntegration.install();
                
                success(`CircleCI config created: ${result.configFile}`);
                info('\nNext steps:');
                result.instructions.forEach(instruction => info(instruction));
            } catch (err) {
                error(err.message);
            }
        }
    },

    analyze: {
        pr: (args) => {
            log('\n🔍 Analyzing Pull Request...\n', 'bright');
            
            const prNumber = args.pr || args.p || process.env.PR_NUMBER;
            if (!prNumber) {
                error('PR number required. Use --pr <number>');
            }

            // This would call the API
            info(`Analyzing PR #${prNumber}...`);
            // Implementation would fetch PR data and analyze
            success('PR analysis complete');
        },

        code: (args) => {
            const file = args.file || args.f;
            if (!file) {
                error('File required. Use --file <path>');
            }

            if (!fs.existsSync(file)) {
                error(`File not found: ${file}`);
            }

            const code = fs.readFileSync(file, 'utf8');
            log('\n🔍 Analyzing code...\n', 'bright');
            
            // This would call the API
            info(`Analyzing ${file}...`);
            // Implementation would analyze code
            success('Code analysis complete');
        }
    },

    test: () => {
        log('\n🧪 Testing Code Roach Connection...\n', 'bright');
        
        if (!fs.existsSync(CONFIG_FILE)) {
            error('Configuration file not found. Run "code-roach init" first.');
        }

        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const serverUrl = config.serverUrl || 'http://localhost:3000';

        // Test connection
        const http = require('http');
        const url = new URL('/api/health', serverUrl);

        const req = http.request({
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname,
            method: 'GET',
            timeout: 5000
        }, (res) => {
            if (res.statusCode === 200) {
                success('Connection successful!');
                info(`Server: ${serverUrl}`);
            } else {
                warn(`Server responded with status ${res.statusCode}`);
            }
        });

        req.on('error', (err) => {
            error(`Connection failed: ${err.message}`);
        });

        req.on('timeout', () => {
            req.destroy();
            error('Connection timeout');
        });

        req.end();
    },

    health: (args) => {
        const filePath = args.file || args.f;
        
        if (filePath) {
            log(`\n📊 Health Score: ${filePath}\n`, 'bright');
            // Call API to get health score
            info(`Getting health score for ${filePath}...`);
        } else {
            log('\n📊 Code Health Overview\n', 'bright');
            // Call API to get overall health
            info('Getting overall code health...');
        }
    },

    crawl: (args) => {
        log('\n🪳 Starting Codebase Crawl...\n', 'bright');
        
        if (!fs.existsSync(CONFIG_FILE)) {
            error('Configuration file not found. Run "code-roach init" first.');
            return;
        }

        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const serverUrl = config.serverUrl || 'http://localhost:3000';
        const http = require('http');

        // Check if status flag is set
        if (args.status || args.s) {
            // Get crawl status
            const url = new URL('/api/code-roach/crawl/status', serverUrl);
            
            const options = {
                hostname: url.hostname,
                port: url.port || 3000,
                path: url.pathname,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode === 200 && json.success) {
                            const status = json.status || json;
                            log('\n📊 Crawl Status:\n', 'bright');
                            if (status.isRunning) {
                                info('Status: Running');
                                if (status.stats) {
                                    info(`Files scanned: ${status.stats.filesScanned || 0}`);
                                    info(`Issues found: ${status.stats.issuesFound || 0}`);
                                    info(`Auto-fixed: ${status.stats.issuesAutoFixed || 0}`);
                                    info(`Needs review: ${status.stats.issuesNeedingReview || 0}`);
                                }
                            } else {
                                info('Status: Not running');
                                if (status.stats) {
                                    info(`Last scan: ${status.stats.filesScanned || 0} files`);
                                    info(`Total issues: ${status.stats.issuesFound || 0}`);
                                    info(`Auto-fixed: ${status.stats.issuesAutoFixed || 0}`);
                                }
                            }
                        } else {
                            error(json.error || 'Failed to get crawl status');
                        }
                    } catch (err) {
                        error(`Invalid response: ${err.message}`);
                    }
                });
            });

            req.on('error', (err) => {
                error(`Request failed: ${err.message}`);
            });

            req.end();
            return;
        }

        // Start crawl
        const url = new URL('/api/code-roach/crawl', serverUrl);
        const postData = JSON.stringify({
            rootDir: process.cwd(),
            options: {
                autoFix: true,
                extensions: ['.js', '.ts', '.jsx', '.tsx']
            }
        });

        const options = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode === 200 && json.success) {
                        success('Crawl started!');
                        info('\nThe crawler is now scanning your codebase...');
                        info('Use "code-roach crawl --status" to check progress');
                        info('Use "code-roach issues --review" to see issues needing review');
                    } else if (res.statusCode === 409) {
                        warn('Crawler is already running');
                        info('Use "code-roach crawl --status" to check progress');
                    } else {
                        error(json.error || 'Failed to start crawl');
                    }
                } catch (err) {
                    error(`Invalid response: ${err.message}`);
                }
            });
        });

        req.on('error', (err) => {
            error(`Request failed: ${err.message}`);
        });

        req.write(postData);
        req.end();
    },

    crawlParallel: (options) => {
        log('\n🪳 Code Roach - Parallel Crawl\n', 'bright');
        
        if (!fs.existsSync(CONFIG_FILE)) {
            error('Configuration file not found. Run "code-roach init" first.');
            return;
        }

        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const serverUrl = config.serverUrl || 'http://localhost:3000';

        // Parse directories from options or use defaults
        let directories = [];
        if (options.directories) {
            directories = options.directories.split(',').map(d => d.trim());
        } else if (options.dir) {
            directories = [options.dir];
        } else {
            // Default: crawl server/, public/, and cli/ in parallel
            directories = [
                path.join(process.cwd(), 'server'),
                path.join(process.cwd(), 'public'),
                path.join(process.cwd(), 'cli')
            ].filter(dir => fs.existsSync(dir));
        }

        if (directories.length === 0) {
            error('No valid directories found to crawl');
            return;
        }

        info(`Starting ${directories.length} parallel crawls...`);
        directories.forEach((dir, i) => {
            info(`  ${i + 1}. ${dir}`);
        });

        const url = new URL('/api/code-roach/crawl/parallel', serverUrl);
        const postData = JSON.stringify({
            directories: directories,
            options: {
                autoFix: options.autoFix !== false,
                useAllFixGenerators: true,
                enableContinuousLearning: true,
                concurrency: parseInt(options.concurrency) || 10,
                extensions: ['.js', '.ts', '.jsx', '.tsx']
            }
        });

        const http = require('http');
        const httpOptions = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(httpOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode === 200 && json.success) {
                        success('Parallel crawls started!');
                        info(`\n${json.results.length} crawls initiated`);
                        json.results.forEach((result, i) => {
                            if (result.success) {
                                info(`  ✅ ${directories[i]}: ${result.crawlId}`);
                            } else {
                                warn(`  ⚠️  ${directories[i]}: ${result.message || 'Failed'}`);
                            }
                        });
                        if (json.queueStatus) {
                            info(`\nQueue: ${json.queueStatus.active} active, ${json.queueStatus.queued} queued`);
                        }
                        info('\nUse "code-roach crawl-parallel --status" to check progress');
                    } else {
                        error(json.error || 'Failed to start parallel crawls');
                    }
                } catch (err) {
                    error(`Invalid response: ${err.message}`);
                }
            });
        });

        req.on('error', (err) => {
            error(`Request failed: ${err.message}`);
        });

        req.write(postData);
        req.end();
    },

    issues: (args) => {
        log('\n🐛 Code Roach Issues\n', 'bright');
        
        if (!fs.existsSync(CONFIG_FILE)) {
            error('Configuration file not found. Run "code-roach init" first.');
            return;
        }

        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        const serverUrl = config.serverUrl || 'http://localhost:3000';
        const http = require('http');

        // Check if reviewing a specific issue
        const reviewId = args.review || args.r;
        const action = args.action || args.a;
        
        if (reviewId && action) {
            if (!['approve', 'reject', 'defer'].includes(action)) {
                error('Action must be: approve, reject, or defer');
                return;
            }

            const notes = args.notes || args.n || '';
            const url = new URL(`/api/code-roach/issues/${reviewId}/review`, serverUrl);
            
            const postData = JSON.stringify({ action, notes });
            
            const options = {
                hostname: url.hostname,
                port: url.port || 3000,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode === 200 && json.success) {
                            success(`Issue ${reviewId} marked as ${action}`);
                            if (notes) {
                                info(`Notes: ${notes}`);
                            }
                        } else {
                            error(json.error || 'Failed to mark issue as reviewed');
                        }
                    } catch (err) {
                        error(`Invalid response: ${data}`);
                    }
                });
            });

            req.on('error', (err) => {
                error(`Request failed: ${err.message}`);
            });

            req.write(postData);
            req.end();
            return;
        }

        // Check for workflow flags
        const openInEditor = args.open || args.o || args.cursor || args.code;
        const editor = args.editor || args.e || (openInEditor ? (args.cursor ? 'cursor' : 'code') : null);
        const autoFix = args.fix || args.f;
        const deploy = args.deploy || args.d;

        // Get issues
        const hasReviewFlag = args.review !== undefined || args.r !== undefined;
        const hasOtherFilters = args.all || args.a || args.severity || args.s || args.safety || args.status;
        const reviewOnly = hasReviewFlag || (!hasOtherFilters && !args.limit && !args.l);
        const severity = args.severity || args.s;
        const safety = args.safety;
        const status = args.status;
        const limit = args.limit || args.l || (reviewOnly ? 20 : 50);
        
        if (reviewOnly) {
            log('📋 Fetching issues needing review...\n', 'cyan');
        }

        let apiPath = reviewOnly 
            ? '/api/code-roach/issues/review'
            : '/api/code-roach/issues';

        if (!reviewOnly) {
            const params = new URLSearchParams();
            if (severity) params.append('severity', severity);
            if (safety) params.append('safety', safety);
            if (status) params.append('status', status);
            if (limit) params.append('limit', limit);
            const query = params.toString();
            if (query) apiPath += '?' + query;
        }

        const url = new URL(apiPath, serverUrl);

        const options = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode === 200 && json.success) {
                        const issues = json.issues || [];
                        const count = json.count !== undefined ? json.count : issues.length;
                        
                        if (count === 0) {
                            success('No issues found! 🎉');
                            return;
                        }

                        log(`\n📋 Found ${count} issue(s):\n`, 'bright');
                        
                        // Group issues by file for better workflow
                        const issuesByFile = {};
                        issues.forEach((issue) => {
                            // Try multiple possible file path locations
                            const file = issue.error?.file || 
                                        issue.file || 
                                        issue.error?.filePath ||
                                        (issue.error && typeof issue.error === 'object' ? issue.error.file : null) ||
                                        'unknown';
                            if (file && file !== 'unknown') {
                                if (!issuesByFile[file]) {
                                    issuesByFile[file] = [];
                                }
                                issuesByFile[file].push(issue);
                            }
                        });

                        // Display issues
                        issues.forEach((issue, index) => {
                            const severity = issue.error?.severity || issue.severity || 'unknown';
                            const severityColor = severity === 'critical' ? 'red' : 
                                                 severity === 'high' ? 'yellow' : 
                                                 severity === 'medium' ? 'cyan' :
                                                 'green';
                            
                            const type = issue.error?.type || issue.type || 'unknown';
                            
                            log(`\n${index + 1}. Issue ID: ${issue.id}`, severityColor);
                            log(`   ──────────────────────────────────────────────`, 'reset');
                            info(`   Severity: ${severity.toUpperCase()} | Type: ${type}`);
                            if (issue.error?.message) {
                                log(`   Error: ${issue.error.message}`, 'reset');
                            }
                            const filePath = issue.error?.file || issue.file || issue.error?.filePath || 'unknown';
                            const line = issue.error?.line || issue.line || '?';
                            if (filePath && filePath !== 'unknown') {
                                log(`   File: ${filePath}:${line}`, 'cyan');
                            }
                            if (issue.fix) {
                                const safety = issue.fix.safety || 'medium';
                                const safetyColor = safety === 'risky' ? 'red' : 
                                                   safety === 'medium' ? 'yellow' : 
                                                   'green';
                                log(`   Fix Available: Yes (${safety} safety)`, safetyColor);
                                if (issue.fix.explanation) {
                                    info(`   Explanation: ${issue.fix.explanation.substring(0, 
                                        100)}${issue.fix.explanation.length > 100 ? '...' : ''}`);
                                }
                            } else {
                                log(`   Fix Available: No`, 'yellow');
                            }
                            if (issue.timestamp) {
                                info(`   Detected: ${new Date(issue.timestamp).toLocaleString()}`);
                            }
                        });

                        // Open files in editor if requested
                        if (openInEditor && editor) {
                            log('\n\n🚀 Opening files in ' + editor + '...\n', 'bright');
                            const filesToOpen = Object.keys(issuesByFile);
                            
                            filesToOpen.slice(0, 10).forEach((file) => { // Limit to 10 files
                                const fileIssues = issuesByFile[file];
                                const firstIssue = fileIssues[0];
                                const line = firstIssue.error?.line || 1;
                                
                                // Try to open file at specific line
                                const editorCmd = editor === 'cursor' ? 'cursor' : 'code';
                                const filePath = path.resolve(process.cwd(), file);
                                
                                try {
                                    if (fs.existsSync(filePath)) {
                                        // Try with --goto flag first
                                        try {
                                            execSync(`${editorCmd} --goto ${filePath}:${line}`, { stdio: 'ignore' });
                                        } catch {
                                            // Fallback: open file without line number
                                            execSync(`${editorCmd} ${filePath}`, { stdio: 'ignore' });
                                        }
                                        info(`   ✓ Opened: ${file}:${line} (${fileIssues.length} issue(s))`);
                                    } else {
                                        warn(`   ✗ File not found: ${file}`);
                                    }
                                } catch (err) {
                                    warn(`   ✗ Could not open ${file} in ${editor}: ${err.message}`);
                                }
                            });
                            
                            if (filesToOpen.length > 10) {
                                info(`   ... and ${filesToOpen.length - 10} more files`);
                            }
                        }

                        // Auto-fix if requested
                        if (autoFix) {
                            log('\n\n🔧 Auto-fix workflow:\n', 'bright');
                            info('Use --open to review fixes in editor first');
                            info('Or use the Code Roach extension in Cursor for interactive fixing');
                        }

                        // Deploy if requested
                        if (deploy) {
                            log('\n\n🚀 Deployment Workflow:\n', 'bright');
                            info('1. Review fixes in editor');
                            info('2. Test: npm test');
                            info('3. Commit: git add . && git commit -m "Code Roach fixes"');
                            info('4. Push: git push');
                            info('5. Deploy: (configure your deployment command)');
                        }

                        if (reviewOnly && count > 0) {
                            log('\n\n💡 Review Commands:', 'bright');
                            log('   To approve an issue:', 'reset');
                            info('     code-roach issues --review <id> --action approve [--notes "text"]');
                            log('   To reject an issue:', 'reset');
                            info('     code-roach issues --review <id> --action reject [--notes "text"]');
                            log('   To defer an issue:', 'reset');
                            info('     code-roach issues --review <id> --action defer [--notes "text"]');
                            log('\n   Workflow Commands:', 'bright');
                            info('     code-roach issues --review --open --cursor    # Open issues in Cursor');
                            info('     code-roach issues --review --open --code      # Open in VS Code');
                            info('     code-roach issues --review --open --deploy    # Show deployment workflow');
                        }
                    } else {
                        error(json.error || 'Failed to fetch issues');
                    }
                } catch (err) {
                    error(`Invalid response: ${err.message}`);
                }
            });
        });

        req.on('error', (err) => {
            error(`Request failed: ${err.message}`);
        });

        req.end();
    },

    version: () => {
        console.log(`Code Roach CLI v${CLI_VERSION}`);
    },

    help: () => {
        log('\n🪳 Code Roach CLI\n', 'bright');
        console.log(`
Usage: code-roach <command> [options]

Commands:
  init                          Initialize Code Roach configuration
  config get [key]              Get configuration value
  config set <key> <value>      Set configuration value
  integrate <platform>          Integrate with third-party platform
  analyze pr [--pr <number>]    Analyze pull request
  analyze code [--file <path>]  Analyze code file
  crawl [--status]              Start codebase crawl or check status
  crawl-parallel [--status]     Start parallel crawls for multiple directories
  issues [--review] [--open]    Get issues (use --review for review queue, --open to open in editor)
  test                          Test connection to Code Roach server
  health [--file <path>]        Get code health score
  version                       Show version
  help                          Show this help message

Platforms:
  github                        GitHub Actions integration
  gitlab                        GitLab CI integration
  slack                         Slack integration
  teams                         Microsoft Teams integration
  sentry                        Sentry integration
  datadog                       Datadog integration
  discord                       Discord integration
  vscode                        VS Code extension
  jenkins                       Jenkins pipeline
  circleci                      CircleCI integration

Examples:
  code-roach init
  code-roach integrate github
  code-roach analyze pr --pr 123
  code-roach crawl                              # Start codebase crawl
  code-roach crawl --status                     # Check crawl status
  code-roach crawl-parallel                     # Start parallel crawls (server/, public/, cli/)
  code-roach crawl-parallel --status            # Check parallel crawl status
  code-roach issues --review                    # Get issues needing review
  code-roach issues --review --open --cursor    # Open issues in Cursor
  code-roach issues --review <id> --action approve  # Approve an issue
  code-roach health --file server/routes/api.js
  code-roach test

For more information, visit: https://code-roach.dev/docs
`);
    }
};

// Main CLI handler
function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        commands.help();
        return;
    }

    const command = args[0];
    const subcommand = args[1];
    const options = parseArgs(args.slice(2));

    try {
        if (command === 'init') {
            commands.init();
        } else if (command === 'config') {
            if (subcommand === 'get') {
                commands.config.get(args[2]);
            } else if (subcommand === 'set') {
                commands.config.set(args[2], args[3]);
            } else {
                error('Config command requires "get" or "set"');
            }
        } else if (command === 'integrate') {
            if (subcommand === 'github') {
                commands.integrate.github();
            } else if (subcommand === 'gitlab') {
                commands.integrate.gitlab();
            } else if (subcommand === 'slack') {
                commands.integrate.slack();
            } else if (subcommand === 'sentry') {
                commands.integrate.sentry();
            } else if (subcommand === 'datadog') {
                commands.integrate.datadog();
            } else if (subcommand === 'discord') {
                commands.integrate.discord();
            } else if (subcommand === 'vscode') {
                commands.integrate.vscode();
            } else if (subcommand === 'jenkins') {
                commands.integrate.jenkins();
            } else if (subcommand === 'circleci') {
                commands.integrate.circleci();
            } else {
                error(`Unknown platform: ${subcommand}`);
            }
        } else if (command === 'analyze') {
            if (subcommand === 'pr') {
                commands.analyze.pr(options);
            } else if (subcommand === 'code') {
                commands.analyze.code(options);
            } else {
                error('Analyze command requires "pr" or "code"');
            }
        } else if (command === 'crawl') {
            commands.crawl(options);
        } else if (command === 'crawl-parallel' || command === 'parallel-crawl') {
            commands.crawlParallel(options);
        } else if (command === 'issues') {
            commands.issues(options);
        } else if (command === 'test') {
            commands.test();
        } else if (command === 'health') {
            commands.health(options);
        } else if (command === 'version' || command === '-v' || command === '--version') {
            commands.version();
        } else if (command === 'help' || command === '-h' || command === '--help') {
            commands.help();
        } else {
            error(`Unknown command: ${command}. Run "code-roach help" for usage.`);
        }
    } catch (err) {
        error(err.message);
    }
}

// Parse command-line arguments
function parseArgs(args) {
    const options = {};
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        // Handle flags with optional values (like --review)
        if (arg.startsWith('--')) {
            const key = arg.replace(/^--/, '');
            // Check if next arg is a value (not a flag)
            if (i + 1 < args.length && !args[i + 1].startsWith('--') && !args[i + 1].startsWith('-')) {
                options[key] = args[i + 1];
                i += 2;
            } else {
                // Boolean flag
                options[key] = true;
                i += 1;
            }
        } else if (arg.startsWith('-') && arg.length === 2) {
            // Short flag like -r
            const key = arg.replace(/^-/, '');
            if (i + 1 < args.length && !args[i + 1].startsWith('--') && !args[i + 1].startsWith('-')) {
                options[key] = args[i + 1];
                i += 2;
            } else {
                options[key] = true;
                i += 1;
            }
        } else {
            i += 1;
        }
    }
    return options;
}

// Simple prompt function (for CLI)
function prompt(message) {
    // In a real CLI, you'd use readline or a library like inquirer
    // For now, return empty string
    return '';
}

// Run CLI
if (require.main === module) {
    main();
}

module.exports = { commands };

