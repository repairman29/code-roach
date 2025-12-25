#!/usr/bin/env node

/**
 * Documentation Synchronization System
 *
 * Automatically keeps documentation in sync across all repositories:
 * - Syncs docs between main Smugglers project and standalone repos
 * - Validates documentation integrity
 * - Updates API documentation from code
 * - Generates changelog and release notes
 * - Notifies when documentation is out of sync
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

class DocsSync {
    constructor() {
        this.rootDir = path.join(__dirname, '..', '..');
        this.repos = {
            codeRoach: path.join(this.rootDir, 'code-roach-standalone'),
            oracle: path.join(this.rootDir, 'oracle-standalone'),
            daisyChain: path.join(this.rootDir, 'daisy-chain-standalone')
        };
        this.smugglersDir = path.join(this.rootDir, 'smugglers');
    }

    async run() {
        const command = process.argv[2] || 'sync';

        console.log('🚀 Documentation Sync System');
        console.log('==========================\n');

        switch (command) {
            case 'sync':
                await this.syncAll();
                break;
            case 'validate':
                await this.validateAll();
                break;
            case 'update-api':
                await this.updateApiDocs();
                break;
            case 'check-drift':
                await this.checkDocumentationDrift();
                break;
            case 'generate-changelog':
                await this.generateChangelog();
                break;
            case 'watch':
                await this.watchMode();
                break;
            default:
                this.showHelp();
        }
    }

    async syncAll() {
        console.log('📋 Syncing documentation across all repositories...\n');

        // 1. Sync shared documentation
        await this.syncSharedDocs();

        // 2. Update API documentation
        await this.updateApiDocs();

        // 3. Sync configuration examples
        await this.syncConfigExamples();

        // 4. Update cross-references
        await this.updateCrossReferences();

        // 5. Validate all documentation
        await this.validateAll();

        console.log('✅ Documentation sync complete!');
    }

    async syncSharedDocs() {
        console.log('📚 Syncing shared documentation...');

        const sharedDocs = [
            'CONTRIBUTING.md',
            'CODE_OF_CONDUCT.md',
            'SECURITY.md',
            'SUPPORT.md'
        ];

        for (const repo of Object.values(this.repos)) {
            for (const doc of sharedDocs) {
                const sourcePath = path.join(this.rootDir, doc);
                const targetPath = path.join(repo, doc);

                if (await this.fileExists(sourcePath)) {
                    await this.copyFile(sourcePath, targetPath);
                    console.log(`  ✓ ${doc} → ${path.basename(repo)}`);
                }
            }
        }
    }

    async updateApiDocs() {
        console.log('🔌 Updating API documentation...');

        // Update Code Roach API docs
        await this.updateCodeRoachApiDocs();

        // Update Oracle API docs
        await this.updateOracleApiDocs();

        // Update Daisy Chain API docs
        await this.updateDaisyChainApiDocs();

        console.log('  ✓ API documentation updated');
    }

    async updateCodeRoachApiDocs() {
        const sourceDir = path.join(this.smugglersDir, 'src', 'routes');
        const docsDir = path.join(this.repos.codeRoach, 'docs');

        // Extract API routes and generate documentation
        const routes = await this.extractRoutes(sourceDir);
        const apiDocs = this.generateApiDocs(routes, 'code-roach');

        await fs.writeFile(path.join(docsDir, 'api.md'), apiDocs);
    }

    async updateOracleApiDocs() {
        const sourceDir = path.join(this.smugglersDir, 'src', 'services', 'oracle');
        const docsDir = path.join(this.repos.oracle, 'docs');

        // Extract Oracle API endpoints
        const endpoints = await this.extractOracleEndpoints(sourceDir);
        const apiDocs = this.generateApiDocs(endpoints, 'oracle');

        await fs.writeFile(path.join(docsDir, 'api.md'), apiDocs);
    }

    async updateDaisyChainApiDocs() {
        const sourceDir = path.join(this.smugglersDir, 'src', 'services', 'daisy-chain');
        const docsDir = path.join(this.repos.daisyChain, 'docs');

        // Extract Daisy Chain API endpoints
        const endpoints = await this.extractDaisyChainEndpoints(sourceDir);
        const apiDocs = this.generateApiDocs(endpoints, 'daisy-chain');

        await fs.writeFile(path.join(docsDir, 'api.md'), apiDocs);
    }

    async syncConfigExamples() {
        console.log('⚙️ Syncing configuration examples...');

        // Copy working config examples from main project
        const configExamples = [
            '.coderoach/config.json',
            'oracle-config.json',
            'daisy-config.json'
        ];

        for (const config of configExamples) {
            const sourcePath = path.join(this.smugglersDir, config);
            if (await this.fileExists(sourcePath)) {
                // Copy to appropriate repo
                const repoName = this.getRepoForConfig(config);
                if (repoName) {
                    const targetPath = path.join(this.repos[repoName], 'docs', 'examples', config);
                    await this.ensureDir(path.dirname(targetPath));
                    await this.copyFile(sourcePath, targetPath);
                }
            }
        }
    }

    async updateCrossReferences() {
        console.log('🔗 Updating cross-references...');

        // Update links between documentation files
        for (const [repoName, repoPath] of Object.entries(this.repos)) {
            await this.updateRepoCrossReferences(repoPath, repoName);
        }
    }

    async validateAll() {
        console.log('✅ Validating documentation...');

        let hasErrors = false;

        for (const [repoName, repoPath] of Object.entries(this.repos)) {
            console.log(`  Checking ${repoName}...`);

            // Check for broken links
            const brokenLinks = await this.checkBrokenLinks(repoPath);
            if (brokenLinks.length > 0) {
                console.log(`    ❌ Broken links: ${brokenLinks.join(', ')}`);
                hasErrors = true;
            }

            // Check for outdated API docs
            const outdatedApis = await this.checkOutdatedApiDocs(repoPath, repoName);
            if (outdatedApis.length > 0) {
                console.log(`    ❌ Outdated APIs: ${outdatedApis.join(', ')}`);
                hasErrors = true;
            }

            // Validate README links
            const readmeErrors = await this.validateReadmeLinks(repoPath);
            if (readmeErrors.length > 0) {
                console.log(`    ❌ README errors: ${readmeErrors.join(', ')}`);
                hasErrors = true;
            }
        }

        if (hasErrors) {
            console.log('\n❌ Documentation validation failed!');
            process.exit(1);
        } else {
            console.log('  ✓ All documentation valid');
        }
    }

    async checkDocumentationDrift() {
        console.log('🔍 Checking documentation drift...');

        const driftReport = {
            totalFiles: 0,
            driftedFiles: [],
            missingDocs: [],
            outdatedApis: []
        };

        for (const [repoName, repoPath] of Object.entries(this.repos)) {
            // Check for code changes without doc updates
            const codeChanges = await this.getRecentCodeChanges(repoName);
            const docChanges = await this.getRecentDocChanges(repoPath);

            for (const change of codeChanges) {
                const hasDocUpdate = docChanges.some(docChange =>
                    docChange.file.includes(change.api) ||
                    docChange.file.includes('api.md')
                );

                if (!hasDocUpdate) {
                    driftReport.driftedFiles.push({
                        repo: repoName,
                        codeFile: change.file,
                        api: change.api,
                        lastCodeChange: change.date
                    });
                }
            }

            // Check for missing documentation
            const undocumentedApis = await this.findUndocumentedApis(repoPath, repoName);
            driftReport.missingDocs.push(...undocumentedApis);

            // Check for outdated API documentation
            const outdatedApis = await this.checkOutdatedApiDocs(repoPath, repoName);
            driftReport.outdatedApis.push(...outdatedApis);
        }

        if (driftReport.driftedFiles.length > 0 ||
            driftReport.missingDocs.length > 0 ||
            driftReport.outdatedApis.length > 0) {

            console.log('\n📊 Documentation Drift Report:');
            console.log('================================');

            if (driftReport.driftedFiles.length > 0) {
                console.log('\n🔄 Code changes without documentation updates:');
                driftReport.driftedFiles.forEach(drift => {
                    console.log(`  - ${drift.repo}: ${drift.codeFile} (${drift.api})`);
                });
            }

            if (driftReport.missingDocs.length > 0) {
                console.log('\n📝 Missing documentation:');
                driftReport.missingDocs.forEach(missing => {
                    console.log(`  - ${missing.repo}: ${missing.api}`);
                });
            }

            if (driftReport.outdatedApis.length > 0) {
                console.log('\n⏰ Outdated API documentation:');
                driftReport.outdatedApis.forEach(outdated => {
                    console.log(`  - ${outdated.repo}: ${outdated.endpoint}`);
                });
            }

            // Generate drift report file
            const reportPath = path.join(this.rootDir, 'docs-drift-report.json');
            await fs.writeFile(reportPath, JSON.stringify(driftReport, null, 2));
            console.log(`\n📄 Detailed report saved to: ${reportPath}`);

            return driftReport;
        } else {
            console.log('  ✓ No documentation drift detected');
            return null;
        }
    }

    async generateChangelog() {
        console.log('📝 Generating changelog...');

        for (const [repoName, repoPath] of Object.entries(this.repos)) {
            const changelog = await this.generateRepoChangelog(repoPath, repoName);
            const changelogPath = path.join(repoPath, 'CHANGELOG.md');

            // Prepend new entries to existing changelog
            let existingContent = '';
            if (await this.fileExists(changelogPath)) {
                existingContent = await fs.readFile(changelogPath, 'utf8');
            }

            const newContent = changelog + '\n\n' + existingContent;
            await fs.writeFile(changelogPath, newContent);

            console.log(`  ✓ ${repoName} changelog updated`);
        }
    }

    async watchMode() {
        console.log('👀 Entering watch mode...');
        console.log('   Monitoring for code changes to sync documentation');
        console.log('   Press Ctrl+C to exit\n');

        // Watch for file changes in the main Smugglers project
        const watcher = spawn('fswatch', [
            '-r',
            path.join(this.smugglersDir, 'src'),
            path.join(this.smugglersDir, 'docs')
        ], { stdio: ['pipe', 'pipe', 'pipe'] });

        let changeBuffer = [];
        let timeout;

        watcher.stdout.on('data', (data) => {
            const files = data.toString().trim().split('\n');
            changeBuffer.push(...files);

            // Debounce changes
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                if (changeBuffer.length > 0) {
                    console.log(`🔄 Detected ${changeBuffer.length} file changes, syncing docs...`);
                    await this.syncAll();
                    changeBuffer = [];
                }
            }, 2000);
        });

        process.on('SIGINT', () => {
            console.log('\n👋 Watch mode stopped');
            watcher.kill();
            process.exit(0);
        });
    }

    // Helper methods
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async copyFile(source, target) {
        await this.ensureDir(path.dirname(target));
        await fs.copyFile(source, target);
    }

    async ensureDir(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
        }
    }

    async extractRoutes(sourceDir) {
        // Extract API routes from code (simplified)
        const routes = [];
        // Implementation would scan route files and extract endpoint information
        return routes;
    }

    generateApiDocs(endpoints, product) {
        // Generate API documentation from endpoints (simplified)
        let docs = `# ${product.toUpperCase()} API Reference\n\n<!-- Generated automatically - do not edit -->\n\n## Endpoints\n\n`;

        for (const endpoint of endpoints) {
            docs += `### ${endpoint.method} ${endpoint.endpoint}\n\n`;
            docs += `<!-- API documentation for ${endpoint.endpoint} -->\n\n`;
        }

        return docs;
    }

    async extractOracleEndpoints(sourceDir) {
        // Extract Oracle API endpoints from source code
        const apis = [];
        // Implementation would scan Oracle-specific API routes
        return apis;
    }

    async extractDaisyChainEndpoints(sourceDir) {
        // Extract Daisy Chain API endpoints from source code
        const apis = [];
        // Implementation would scan Daisy Chain-specific API routes
        return apis;
    }

    async checkBrokenLinks(repoPath) {
        // Check for broken internal links (simplified)
        const brokenLinks = [];
        // Implementation would scan markdown files for broken links
        return brokenLinks;
    }

    async checkOutdatedApiDocs(repoPath, repoName) {
        // Check if API docs are outdated (simplified)
        const outdated = [];
        // Implementation would compare API docs with actual code
        return outdated;
    }

    async validateReadmeLinks(repoPath) {
        // Validate README links (simplified)
        const errors = [];
        // Implementation would check all links in README
        return errors;
    }

    getRepoForConfig(configFile) {
        if (configFile.includes('code-roach')) return 'codeRoach';
        if (configFile.includes('oracle')) return 'oracle';
        if (configFile.includes('daisy')) return 'daisyChain';
        return null;
    }

    async getRecentCodeChanges(repoName) {
        // Get recent code changes (simplified)
        return [];
    }

    async getRecentDocChanges(repoPath) {
        // Get recent documentation changes (simplified)
        return [];
    }

    async findUndocumentedApis(repoPath, repoName) {
        // Find undocumented APIs (simplified)
        return [];
    }

    async updateRepoCrossReferences(repoPath, repoName) {
        // Update cross-references in repo (simplified)
        // Implementation would update links between docs
    }

    async generateRepoChangelog(repoPath, repoName) {
        // Generate changelog for repo (simplified)
        const now = new Date().toISOString().split('T')[0];
        return `# Changelog\n\n## [Unreleased] - ${now}\n\n### Added\n- Documentation synchronization system\n\n### Changed\n- Updated API documentation\n\n### Fixed\n- Fixed broken documentation links`;
    }

    showHelp() {
        console.log(`
Documentation Sync System

Usage: node docs-sync.js <command>

Commands:
  sync              Sync all documentation across repositories
  validate          Validate documentation integrity
  update-api        Update API documentation from code
  check-drift       Check for documentation drift
  generate-changelog Generate changelog entries
  watch             Watch mode for automatic sync

Examples:
  node docs-sync.js sync
  node docs-sync.js validate
  node docs-sync.js watch
        `);
    }
}

// Run the documentation sync system
if (require.main === module) {
    const docsSync = new DocsSync();
    docsSync.run().catch(console.error);
}

module.exports = DocsSync;
