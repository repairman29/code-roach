/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/customerCodebaseAnalyzer.js
 * Last Sync: 2025-12-16T04:14:36.743Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Customer Codebase Analyzer Service
 * Analyzes customer codebases to identify tech stack, patterns, and architecture
 * Used to generate customer-specific expert guides
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const codebaseSearch = require('./codebaseSearch');
const execAsync = promisify(exec);

class CustomerCodebaseAnalyzer {
    constructor() {
        this.supabase = null;
        this.analysisCache = new Map();
        
        if (config.supabase?.url && config.supabase?.serviceRoleKey) {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        }
    }

    /**
     * Analyze a customer codebase
     * @param {string} projectId - Project ID
     * @param {string} codebasePath - Path to codebase (or repository URL)
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeCodebase(projectId, codebasePath) {
        console.log(`[Customer Codebase Analyzer] Analyzing codebase for project ${projectId}...`);

        try {
            // Check cache
            const cached = await this.getCachedAnalysis(projectId);
            if (cached) {
                console.log('[Customer Codebase Analyzer] Using cached analysis');
                return cached;
            }

            // Perform analysis
            const analysis = {
                project_id: projectId,
                tech_stack: await this.analyzeTechStack(codebasePath),
                architecture_patterns: await this.analyzeArchitecture(codebasePath),
                code_organization: await this.analyzeCodeOrganization(codebasePath),
                testing_patterns: await this.analyzeTestingPatterns(codebasePath),
                security_practices: await this.analyzeSecurityPractices(codebasePath),
                dependencies: await this.analyzeDependencies(codebasePath),
                code_style: await this.analyzeCodeStyle(codebasePath),
                analyzed_at: new Date().toISOString()
            };

            // Store analysis
            await this.storeAnalysis(projectId, analysis);

            console.log(`[Customer Codebase Analyzer] Analysis complete for project ${projectId}`);
            return analysis;
        } catch (err) {
            console.error('[Customer Codebase Analyzer] Error analyzing codebase:', err);
            throw err;
        }
    }

    /**
     * Analyze tech stack (languages, frameworks, databases)
     */
    async analyzeTechStack(codebasePath) {
        const techStack = {
            languages: [],
            frameworks: [],
            databases: [],
            build_tools: [],
            cloud_providers: []
        };

        try {
            // Read package.json / requirements.txt / etc.
            const packageJsonPath = path.join(codebasePath, 'package.json');
            let packageJson = null;
            
            try {
                const content = await fs.readFile(packageJsonPath, 'utf8');
                packageJson = JSON.parse(content);
            } catch (err) {
                // No package.json, try other package managers
            }

            // Detect languages
            techStack.languages = await this.detectLanguages(codebasePath);

            // Detect frameworks
            if (packageJson) {
                techStack.frameworks = this.detectFrameworks(packageJson);
                techStack.build_tools = this.detectBuildTools(packageJson);
            }

            // Detect databases
            techStack.databases = await this.detectDatabases(codebasePath, packageJson);

            // Detect cloud providers
            techStack.cloud_providers = await this.detectCloudProviders(codebasePath);

        } catch (err) {
            console.warn('[Customer Codebase Analyzer] Error analyzing tech stack:', err);
        }

        return techStack;
    }

    /**
     * Detect programming languages
     */
    async detectLanguages(codebasePath) {
        const languages = new Set();
        
        try {
            // Use file extensions to detect languages
            const files = await this.getAllFiles(codebasePath, {
                exclude: ['node_modules', '.git', 'dist', 'build']
            });

            const extensions = new Set();
            files.forEach(file => {
                const ext = path.extname(file).toLowerCase();
                if (ext) extensions.add(ext);
            });

            // Map extensions to languages
            const extensionMap = {
                '.js': 'JavaScript',
                '.jsx': 'JavaScript',
                '.ts': 'TypeScript',
                '.tsx': 'TypeScript',
                '.py': 'Python',
                '.java': 'Java',
                '.go': 'Go',
                '.rs': 'Rust',
                '.rb': 'Ruby',
                '.php': 'PHP',
                '.cs': 'C#',
                '.cpp': 'C++',
                '.c': 'C',
                '.swift': 'Swift',
                '.kt': 'Kotlin',
                '.scala': 'Scala',
                '.clj': 'Clojure',
                '.hs': 'Haskell'
            };

            extensions.forEach(ext => {
                if (extensionMap[ext]) {
                    languages.add(extensionMap[ext]);
                }
            });

        } catch (err) {
            console.warn('[Customer Codebase Analyzer] Error detecting languages:', err);
        }

        return Array.from(languages);
    }

    /**
     * Detect frameworks from package.json
     */
    detectFrameworks(packageJson) {
        const frameworks = [];
        const deps = {
            ...packageJson.dependencies || {},
            ...packageJson.devDependencies || {}
        };

        // Frontend frameworks
        if (deps.react || deps['react-dom']) frameworks.push('React');
        if (deps.vue || deps['vue-router']) frameworks.push('Vue');
        if (deps.angular || deps['@angular/core']) frameworks.push('Angular');
        if (deps.svelte || deps['svelte-kit']) frameworks.push('Svelte');
        if (deps.next) frameworks.push('Next.js');
        if (deps.nuxt) frameworks.push('Nuxt.js');
        if (deps.gatsby) frameworks.push('Gatsby');

        // Backend frameworks
        if (deps.express) frameworks.push('Express');
        if (deps.koa) frameworks.push('Koa');
        if (deps.fastify) frameworks.push('Fastify');
        if (deps.nestjs || deps['@nestjs/core']) frameworks.push('NestJS');
        if (deps.hapi) frameworks.push('Hapi');
        if (deps.sails) frameworks.push('Sails.js');

        // Full-stack
        if (deps.meteor) frameworks.push('Meteor');
        if (deps.remix) frameworks.push('Remix');

        return frameworks;
    }

    /**
     * Detect build tools
     */
    detectBuildTools(packageJson) {
        const buildTools = [];
        const deps = {
            ...packageJson.dependencies || {},
            ...packageJson.devDependencies || {}
        };

        if (deps.webpack || deps['webpack-cli']) buildTools.push('Webpack');
        if (deps.vite) buildTools.push('Vite');
        if (deps.rollup) buildTools.push('Rollup');
        if (deps.parcel) buildTools.push('Parcel');
        if (deps.esbuild) buildTools.push('esbuild');
        if (deps.turbopack) buildTools.push('Turbopack');

        return buildTools;
    }

    /**
     * Detect databases
     */
    async detectDatabases(codebasePath, packageJson) {
        const databases = [];
        const deps = {
            ...packageJson?.dependencies || {},
            ...packageJson?.devDependencies || {}
        };

        // Database clients
        if (deps.pg || deps['pg-native'] || deps.postgres) databases.push('PostgreSQL');
        if (deps.mysql || deps.mysql2) databases.push('MySQL');
        if (deps.mongodb || deps.mongoose) databases.push('MongoDB');
        if (deps.redis || deps.ioredis) databases.push('Redis');
        if (deps['@supabase/supabase-js']) databases.push('Supabase');
        if (deps.firebase || deps['firebase-admin']) databases.push('Firebase');
        if (deps.dynamodb || deps['aws-sdk']) databases.push('DynamoDB');
        if (deps.sqlite || deps['better-sqlite3']) databases.push('SQLite');

        // Check for database config files
        try {
            const files = await this.getAllFiles(codebasePath, {
                include: ['*.sql', '*.db', '*.sqlite'],
                exclude: ['node_modules', '.git']
            });
            if (files.length > 0) {
                // Additional database detection from files
            }
        } catch (err) {
            // Ignore
        }

        return databases;
    }

    /**
     * Detect cloud providers
     */
    async detectCloudProviders(codebasePath) {
        const providers = [];

        try {
            // Check for cloud provider config files
            const awsFiles = ['aws.yml', 'serverless.yml', '.aws'];
            const gcpFiles = ['app.yaml', 'cloudbuild.yaml', '.gcloud'];
            const azureFiles = ['azure-pipelines.yml', '.azure'];

            const files = await fs.readdir(codebasePath);

            if (files.some(f => awsFiles.includes(f) || f.includes('aws'))) {
                providers.push('AWS');
            }
            if (files.some(f => gcpFiles.includes(f) || f.includes('gcp') || f.includes('google'))) {
                providers.push('GCP');
            }
            if (files.some(f => azureFiles.includes(f) || f.includes('azure'))) {
                providers.push('Azure');
            }

            // Check package.json for cloud SDKs
            try {
                const packageJsonPath = path.join(codebasePath, 'package.json');
                const content = await fs.readFile(packageJsonPath, 'utf8');
                const packageJson = JSON.parse(content);
                const deps = {
                    ...packageJson.dependencies || {},
                    ...packageJson.devDependencies || {}
                };

                if (deps['aws-sdk'] || deps['@aws-sdk/client-s3']) providers.push('AWS');
                if (deps['@google-cloud/storage']) providers.push('GCP');
                if (deps['@azure/storage-blob']) providers.push('Azure');
            } catch (err) {
                // Ignore
            }

        } catch (err) {
            console.warn('[Customer Codebase Analyzer] Error detecting cloud providers:', err);
        }

        return providers;
    }

    /**
     * Analyze architecture patterns
     */
    async analyzeArchitecture(codebasePath) {
        const patterns = {
            pattern: null, // MVC, Microservices, Serverless, etc.
            api_style: null, // REST, GraphQL, gRPC, etc.
            state_management: null, // Redux, Zustand, Context, etc.
            routing: null, // React Router, Next.js Router, etc.
            authentication: null, // JWT, OAuth, Session, etc.
            file_structure: null // feature-based, layer-based, etc.
        };

        try {
            // Detect API style
            patterns.api_style = await this.detectAPIStyle(codebasePath);

            // Detect state management
            patterns.state_management = await this.detectStateManagement(codebasePath);

            // Detect architecture pattern
            patterns.pattern = await this.detectArchitecturePattern(codebasePath);

            // Detect file structure
            patterns.file_structure = await this.detectFileStructure(codebasePath);

        } catch (err) {
            console.warn('[Customer Codebase Analyzer] Error analyzing architecture:', err);
        }

        return patterns;
    }

    /**
     * Detect API style (REST, GraphQL, gRPC)
     */
    async detectAPIStyle(codebasePath) {
        try {
            const files = await this.getAllFiles(codebasePath, {
                include: ['*.js', '*.ts', '*.jsx', '*.tsx'],
                exclude: ['node_modules', '.git', 'dist', 'build']
            });

            let hasGraphQL = false;
            let hasREST = false;
            let hasgRPC = false;

            for (const file of files.slice(0, 50)) { // Sample first 50 files
                try {
                    const content = await fs.readFile(file, 'utf8');
                    if (content.includes('graphql') || content.includes('gql`') || content.includes('GraphQL')) {
                        hasGraphQL = true;
                    }
                    if (content.includes('app.get') || content.includes('app.post') || content.includes('router.')) {
                        hasREST = true;
                    }
                    if (content.includes('grpc') || content.includes('@grpc/grpc-js')) {
                        hasgRPC = true;
                    }
                } catch (err) {
                    // Skip file
                }
            }

            if (hasGraphQL) return 'GraphQL';
            if (hasgRPC) return 'gRPC';
            if (hasREST) return 'REST';
            return 'Unknown';
        } catch (err) {
            return 'Unknown';
        }
    }

    /**
     * Detect state management
     */
    async detectStateManagement(codebasePath) {
        try {
            const packageJsonPath = path.join(codebasePath, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);
            const deps = {
                ...packageJson.dependencies || {},
                ...packageJson.devDependencies || {}
            };

            if (deps.redux || deps['@reduxjs/toolkit']) return 'Redux';
            if (deps.zustand) return 'Zustand';
            if (deps.mobx) return 'MobX';
            if (deps.recoil) return 'Recoil';
            if (deps.jotai) return 'Jotai';
            if (deps['react-query'] || deps['@tanstack/react-query']) return 'React Query';
            return 'Context API';
        } catch (err) {
            return 'Unknown';
        }
    }

    /**
     * Detect architecture pattern
     */
    async detectArchitecturePattern(codebasePath) {
        // Simple heuristic: check folder structure
        try {
            const files = await fs.readdir(codebasePath);
            
            // Check for microservices indicators
            if (files.includes('services') || files.includes('microservices')) {
                return 'Microservices';
            }

            // Check for serverless indicators
            if (files.includes('serverless.yml') || files.includes('functions')) {
                return 'Serverless';
            }

            // Default to MVC
            return 'MVC';
        } catch (err) {
            return 'Unknown';
        }
    }

    /**
     * Detect file structure pattern
     */
    async detectFileStructure(codebasePath) {
        try {
            const srcPath = path.join(codebasePath, 'src');
            const files = await fs.readdir(srcPath || codebasePath);

            // Feature-based: features/ folder or feature folders at root
            if (files.includes('features') || files.some(f => f.includes('feature'))) {
                return 'feature-based';
            }

            // Layer-based: controllers/, models/, views/ or services/, repositories/
            if (files.some(f => ['controllers', 'models', 'views', 'services', 'repositories'].includes(f))) {
                return 'layer-based';
            }

            return 'flat';
        } catch (err) {
            return 'unknown';
        }
    }

    /**
     * Analyze code organization
     */
    async analyzeCodeOrganization(codebasePath) {
        return {
            structure: await this.detectFileStructure(codebasePath),
            naming: await this.detectNamingConvention(codebasePath),
            module_system: await this.detectModuleSystem(codebasePath)
        };
    }

    /**
     * Detect naming convention
     */
    async detectNamingConvention(codebasePath) {
        try {
            const files = await this.getAllFiles(codebasePath, {
                include: ['*.js', '*.ts'],
                exclude: ['node_modules', '.git', 'dist', 'build']
            });

            let camelCase = 0;
            let snakeCase = 0;
            let kebabCase = 0;

            for (const file of files.slice(0, 20)) {
                const basename = path.basename(file, path.extname(file));
                if (/^[a-z][a-zA-Z0-9]*$/.test(basename)) camelCase++;
                if (/^[a-z]+(_[a-z]+)+$/.test(basename)) snakeCase++;
                if (/^[a-z]+(-[a-z]+)+$/.test(basename)) kebabCase++;
            }

            if (camelCase > snakeCase && camelCase > kebabCase) return 'camelCase';
            if (snakeCase > kebabCase) return 'snake_case';
            if (kebabCase > 0) return 'kebab-case';
            return 'camelCase'; // Default
        } catch (err) {
            return 'camelCase';
        }
    }

    /**
     * Detect module system
     */
    async detectModuleSystem(codebasePath) {
        try {
            const packageJsonPath = path.join(codebasePath, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);

            if (packageJson.type === 'module') return 'ESM';
            return 'CommonJS';
        } catch (err) {
            return 'CommonJS';
        }
    }

    /**
     * Analyze testing patterns
     */
    async analyzeTestingPatterns(codebasePath) {
        const patterns = {
            frameworks: [],
            test_location: null, // __tests__, tests/, same-folder
            coverage_tool: null
        };

        try {
            const packageJsonPath = path.join(codebasePath, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);
            const deps = {
                ...packageJson.dependencies || {},
                ...packageJson.devDependencies || {}
            };

            // Detect testing frameworks
            if (deps.jest || deps['jest-cli']) patterns.frameworks.push('Jest');
            if (deps.mocha) patterns.frameworks.push('Mocha');
            if (deps.jasmine) patterns.frameworks.push('Jasmine');
            if (deps.vitest) patterns.frameworks.push('Vitest');
            if (deps.cypress) patterns.frameworks.push('Cypress');
            if (deps.playwright) patterns.frameworks.push('Playwright');
            if (deps.puppeteer) patterns.frameworks.push('Puppeteer');
            if (deps['@testing-library/react']) patterns.frameworks.push('React Testing Library');

            // Detect test location
            const files = await fs.readdir(codebasePath);
            if (files.includes('__tests__')) patterns.test_location = '__tests__';
            else if (files.includes('tests') || files.includes('test')) patterns.test_location = 'tests/';
            else patterns.test_location = 'same-folder';

            // Detect coverage tool
            if (deps['@istanbuljs/nyc'] || deps.nyc) patterns.coverage_tool = 'nyc';
            else if (deps.jest) patterns.coverage_tool = 'Jest';

        } catch (err) {
            console.warn('[Customer Codebase Analyzer] Error analyzing testing patterns:', err);
        }

        return patterns;
    }

    /**
     * Analyze security practices
     */
    async analyzeSecurityPractices(codebasePath) {
        const practices = {
            authentication: null,
            encryption: [],
            security_headers: false,
            input_validation: false
        };

        try {
            // Check for common security libraries
            const packageJsonPath = path.join(codebasePath, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);
            const deps = {
                ...packageJson.dependencies || {},
                ...packageJson.devDependencies || {}
            };

            // Authentication
            if (deps.passport || deps['passport-jwt']) practices.authentication = 'Passport';
            if (deps['jsonwebtoken']) practices.authentication = 'JWT';
            if (deps['@supabase/supabase-js']) practices.authentication = 'Supabase Auth';

            // Encryption
            if (deps.bcrypt || deps['bcryptjs']) practices.encryption.push('bcrypt');
            if (deps.crypto) practices.encryption.push('crypto');

        } catch (err) {
            console.warn('[Customer Codebase Analyzer] Error analyzing security practices:', err);
        }

        return practices;
    }

    /**
     * Analyze dependencies
     */
    async analyzeDependencies(codebasePath) {
        try {
            const packageJsonPath = path.join(codebasePath, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);

            return {
                dependencies: Object.keys(packageJson.dependencies || {}),
                devDependencies: Object.keys(packageJson.devDependencies || {}),
                total: Object.keys(packageJson.dependencies || {}).length + 
                       Object.keys(packageJson.devDependencies || {}).length
            };
        } catch (err) {
            return { dependencies: [], devDependencies: [], total: 0 };
        }
    }

    /**
     * Analyze code style
     */
    async analyzeCodeStyle(codebasePath) {
        const style = {
            linter: null,
            formatter: null,
            config_files: []
        };

        try {
            const files = await fs.readdir(codebasePath);
            
            if (files.includes('.eslintrc') || files.includes('.eslintrc.js') || files.includes('eslint.config.js')) {
                style.linter = 'ESLint';
            }
            if (files.includes('.prettierrc') || files.includes('.prettierrc.js') || files.includes('prettier.config.js')) {
                style.formatter = 'Prettier';
            }

            style.config_files = files.filter(f => 
                f.includes('eslint') || f.includes('prettier') || f.includes('stylelint')
            );

        } catch (err) {
            console.warn('[Customer Codebase Analyzer] Error analyzing code style:', err);
        }

        return style;
    }

    /**
     * Get all files in codebase
     */
    async getAllFiles(dir, options = {}) {
        const { include = [], exclude = [] } = options;
        const files = [];

        async function walk(currentPath) {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                // Skip excluded directories
                if (entry.isDirectory()) {
                    if (exclude.some(pattern => entry.name.includes(pattern))) continue;
                    await walk(fullPath);
                } else {
                    // Check include patterns
                    if (include.length > 0) {
                        const matches = include.some(pattern => {
                            if (pattern.startsWith('*.')) {
                                return fullPath.endsWith(pattern.slice(1));
                            }
                            return fullPath.includes(pattern);
                        });
                        if (!matches) continue;
                    }

                    files.push(fullPath);
                }
            }
        }

        await walk(dir);
        return files;
    }

    /**
     * Store analysis in database
     */
    async storeAnalysis(projectId, analysis) {
        if (!this.supabase) return;

        try {
            const { error } = await this.supabase
                .from('customer_codebase_analysis')
                .upsert({
                    project_id: projectId,
                    analysis_data: analysis,
                    tech_stack: analysis.tech_stack,
                    architecture_patterns: analysis.architecture_patterns,
                    code_organization: analysis.code_organization,
                    testing_patterns: analysis.testing_patterns,
                    security_practices: analysis.security_practices,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'project_id'
                });

            if (error) throw error;
        } catch (err) {
            console.warn('[Customer Codebase Analyzer] Error storing analysis:', err);
        }
    }

    /**
     * Get cached analysis
     */
    async getCachedAnalysis(projectId) {
        if (!this.supabase) return null;

        try {
            const { data, error } = await this.supabase
                .from('customer_codebase_analysis')
                .select('*')
                .eq('project_id', projectId)
                .single();

            if (error || !data) return null;

            // Return analysis_data if available, otherwise reconstruct
            return data.analysis_data || {
                project_id: projectId,
                tech_stack: data.tech_stack,
                architecture_patterns: data.architecture_patterns,
                code_organization: data.code_organization,
                testing_patterns: data.testing_patterns,
                security_practices: data.security_practices,
                analyzed_at: data.analyzed_at
            };
        } catch (err) {
            return null;
        }
    }
}

module.exports = new CustomerCodebaseAnalyzer();

