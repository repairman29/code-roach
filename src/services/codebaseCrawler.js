/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codebaseCrawler.js
 * Last Sync: 2025-12-16T03:17:15.002Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Codebase Crawler Service
 * Automatically scans the entire codebase, analyzes files, and fixes issues
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const execAsync = promisify(exec);
const codeReviewAssistant = require('./codeReviewAssistant');
const errorHistoryService = require('./errorHistoryService');
const fixApplicationService = require('./fixApplicationService');
const llmFixGenerator = require('./llmFixGenerator');
const contextAwareFixGenerator = require('./contextAwareFixGenerator');
const fixLearningSystem = require('./fixLearningSystem');
const advancedFixGenerator = require('./advancedFixGenerator');
const fixWorkflowIntegration = require('./fixWorkflowIntegration');
const multiFileFixGenerator = require('./multiFileFixGenerator');
const fixVerificationService = require('./fixVerificationService');
const fixPreviewService = require('./fixPreviewService');
const validatedFixApplication = require('./validatedFixApplication');
const performanceOptimizerService = require('./performanceOptimizerService');
const codebaseAwareFixGenerator = require('./codebaseAwareFixGenerator');
const metaLearningService = require('./metaLearningService');
const continuousLearningService = require('./continuousLearningService');
const languageKnowledgeService = require('./languageKnowledgeService');
const riskAlertService = require('./riskAlertService');
const developerMetricsService = require('./developerMetricsService');
const fixHelpers = require('./codebaseCrawlerFixHelpers');
const fixApplication = require('./codebaseCrawlerFixApplication');
const codebaseSearch = require('./codebaseSearch');
const issuePrioritizationService = require('./issuePrioritizationService'); // ROUND 7
const issueStorageService = require('./issueStorageService');
let notificationService = null;
try {
    notificationService = require('./notificationService');
} catch (err) {
    // Notification service optional
}

// New Services (December 2025) - System Architecture Expert Integration
// These services are now always available and integrated into the crawler workflow
const fixOrchestrationService = require('./fixOrchestrationService');
const fixImpactPredictionService = require('./fixImpactPredictionService');
const fixConfidenceCalibrationService = require('./fixConfidenceCalibrationService');
const fixCostBenefitAnalysisService = require('./fixCostBenefitAnalysisService');
const fixMonitoringService = require('./fixMonitoringService');
const fixDocumentationGenerationService = require('./fixDocumentationGenerationService');

// Path for persisting crawler stats
const STATS_FILE = path.join(__dirname, '../../data/crawler-stats.json');

class CodebaseCrawler {
    constructor() {
        this.isRunning = false;
        this.stats = {
            filesScanned: 0,
            filesSkipped: 0, // PHASE 3: Track skipped files (cached/unchanged)
            filesWithIssues: 0,
            issuesFound: 0,
            issuesAutoFixed: 0,
            issuesNeedingReview: 0,
            errors: 0,
            startTime: null,
            endTime: null
        };
        this.scanResults = [];
        this.fileCache = new Map(); // PHASE 3: In-memory cache for file hashes
        
        // Initialize Supabase client for optimizations
        try {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        } catch (err) {
            console.warn('[Codebase Crawler] Supabase not available, optimizations disabled:', err.message);
            this.supabase = null;
        }
        
        // Load persisted stats on initialization
        this.loadStats().catch(err => {
            console.warn('[Codebase Crawler] Failed to load persisted stats:', err.message);
        });
    }

    /**
     * ENHANCEMENT: Start real-time file watching for instant updates
     */
    async startFileWatcher(rootDir, options = {}) {
        if (this.fileWatcher) {
            return; // Already watching
        }
        
        try {
            const { watchExtensions = ['.js', '.ts', '.jsx', '.tsx'], watchDelay = 1000 } = options;
            
            this.fileWatcher = new CodebaseWatcher();
            
            // Set up file change handler
            const handleFileChange = async (filePath, eventType) => {
                if (!watchExtensions.includes(path.extname(filePath))) {
                    return; // Not a watched file type
                }
                
                // Debounce rapid changes
                if (this.watchedFiles.has(filePath)) {
                    return; // Already processing
                }
                
                this.watchedFiles.add(filePath);
                
                // Clear from set after delay
                setTimeout(() => {
                    this.watchedFiles.delete(filePath);
                }, watchDelay);
                
                // Invalidate cache for changed file
                if (this.fileCache.has(filePath)) {
                    this.fileCache.delete(filePath);
                }
                
                // If Supabase cache exists, mark for re-scan
                if (this.supabase) {
                    try {
                        const relativePath = path.relative(rootDir, filePath);
                        await this.supabase
                            .from('code_roach_file_cache')
                            .delete()
                            .eq('file_path', relativePath);
                    } catch (err) {
                        // Ignore cache invalidation errors
                    }
                }
                
                // Auto-scan changed file if auto-scan is enabled
                if (options.autoScanOnChange) {
                    console.log(`[Codebase Crawler] 🔄 File changed: ${filePath}, auto-scanning...`);
                    setTimeout(async () => {
                        try {
                            await this.analyzeFile(filePath, { autoFix: options.autoFix !== false });
                        } catch (err) {
                            console.warn(`[Codebase Crawler] Auto-scan failed for ${filePath}:`, err.message);
                        }
                    }, watchDelay);
                }
            };
            
            // Start watching
            await this.fileWatcher.start(rootDir, {
                onChange: handleFileChange,
                onError: (err) => {
                    console.warn(`[Codebase Crawler] File watcher error:`, err.message);
                }
            });
            
            console.log(`[Codebase Crawler] 👁️  Real-time file watching enabled for ${rootDir}`);
        } catch (err) {
            console.warn(`[Codebase Crawler] Failed to start file watcher:`, err.message);
        }
    }

    /**
     * ENHANCEMENT: Stop file watching
     */
    async stopFileWatcher() {
        if (this.fileWatcher) {
            try {
                await this.fileWatcher.stop();
                this.fileWatcher = null;
                this.watchedFiles.clear();
                console.log(`[Codebase Crawler] 👁️  File watching stopped`);
            } catch (err) {
                console.warn(`[Codebase Crawler] Error stopping file watcher:`, err.message);
            }
        }
    }
    
    /**
     * Load persisted stats from disk
     */
    async loadStats() {
        try {
            await fs.mkdir(path.dirname(STATS_FILE), { recursive: true });
            const data = await fs.readFile(STATS_FILE, 'utf8').catch(() => '{}');
            const saved = JSON.parse(data);
            
            // Only load if we don't have current stats (preserve in-memory stats if crawler is running)
            if (!this.isRunning && saved.stats) {
                this.stats = { ...this.stats, ...saved.stats };
                console.log('[Codebase Crawler] Loaded persisted stats:', this.stats);
            }
        } catch (err) {
            // Ignore errors - start fresh
        }
    }
    
    /**
     * Save stats to disk
     */
    async saveStats() {
        try {
            await fs.mkdir(path.dirname(STATS_FILE), { recursive: true });
            await fs.writeFile(STATS_FILE, JSON.stringify({
                stats: this.stats,
                lastUpdated: Date.now()
            }, null, 2), 'utf8');
        } catch (err) {
            console.warn('[Codebase Crawler] Failed to save stats:', err.message);
        }
    }

    /**
     * PHASE 1 OPTIMIZATION: Get files with pending issues from Supabase
     */
    async getFilesWithPendingIssues() {
        if (!this.supabase) return [];
        
        try {
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('file_path')
                .eq('review_status', 'pending')
                .is('resolved_at', null)
                .not('file_path', 'is', null);
            
            if (error) {
                console.warn('[Codebase Crawler] Error querying pending issues:', error.message);
                return [];
            }
            
            const files = [...new Set(data.map(item => item.file_path).filter(Boolean))];
            console.log(`[Codebase Crawler] Found ${files.length} files with pending issues from Supabase`);
            return files;
        } catch (err) {
            console.warn('[Codebase Crawler] Failed to get files with pending issues:', err.message);
            return [];
        }
    }

    /**
     * PHASE 1 OPTIMIZATION: Get files with low health scores from Supabase
     */
    async getFilesWithLowHealthScores(threshold = 70, limit = 1000) {
        if (!this.supabase) return [];
        
        try {
            const { data, error } = await this.supabase
                .from('code_roach_file_health')
                .select('file_path')
                .lt('health_score', threshold)
                .order('recorded_at', { ascending: false })
                .limit(limit);
            
            if (error) {
                console.warn('[Codebase Crawler] Error querying file health:', error.message);
                return [];
            }
            
            const files = [...new Set(data.map(item => item.file_path).filter(Boolean))];
            console.log(`[Codebase Crawler] Found ${files.length} files with low health scores (
                <${threshold}) from Supabase`);
            return files;
        } catch (err) {
            console.warn('[Codebase Crawler] Failed to get files with low health scores:', err.message);
            return [];
        }
    }

    /**
     * PHASE 1 OPTIMIZATION: Get changed files from git
     */
    async getGitChangedFiles(rootDir = process.cwd(), since = 'HEAD~1') {
        try {
            // Get files changed since last commit
            const { stdout } = await execAsync(`cd ${rootDir} && git diff --name-only ${since} HEAD 
                2>/dev/null || echo ""`);
            const changedFiles = stdout.trim().split('\n').filter(Boolean);
            
            // Also get untracked files
            const { stdout: untracked } = await execAsync(`cd ${rootDir} && git ls-files --others --exclude-standard 2>/dev/null || echo ""`);
            const untrackedFiles = untracked.trim().split('\n').filter(Boolean);
            
            const allChanged = [...new Set([...changedFiles, ...untrackedFiles])];
            console.log(`[Codebase Crawler] Found ${allChanged.length} changed files from git (${changedFiles.length} modified, ${untrackedFiles.length} untracked)`);
            return allChanged;
        } catch (err) {
            // Git might not be available or not a git repo - that's okay
            console.warn('[Codebase Crawler] Could not get git changed files:', err.message);
            return [];
        }
    }

    /**
     * PHASE 1+ OPTIMIZATION: Get files using semantic search for similar issues
     */
    async getFilesWithSimilarIssues(limit = 200) {
        try {
            // Check if codebaseSearch is available
            if (!codebaseSearch || typeof codebaseSearch.semanticSearch !== 'function') {
                console.warn('[Codebase Crawler] Semantic search not available, skipping');
                return [];
            }

            // Search for common issue patterns using semantic search
            const queries = [
                "error handling async await promises",
                "security vulnerabilities SQL injection XSS",
                "performance bottlenecks memory leaks",
                "code style issues inconsistent formatting",
                "best practices missing error handling"
            ];
            
            const allFiles = new Set();
            for (const query of queries) {
                try {
                    const results = await codebaseSearch.semanticSearch(query, { limit: Math.ceil(limit / queries.length) });
                    if (results && results.results) {
                        results.results.forEach(result => {
                            if (result && result.file_path) {
                                allFiles.add(result.file_path);
                            }
                        });
                    }
                } catch (err) {
                    // Don't fail entire crawl if semantic search fails for one query
                    console.warn(`[Codebase Crawler] Semantic search failed for "${query}":`, err.message);
                }
            }
            
            const files = Array.from(allFiles);
            if (files.length > 0) {
                console.log(`[Codebase Crawler] 🔍 Found ${files.length} files with similar issues via semantic search`);
            }
            return files;
        } catch (err) {
            // Don't fail entire crawl if semantic search fails
            console.warn('[Codebase Crawler] Semantic search unavailable, continuing without it:', err.message);
            return [];
        }
    }

    /**
     * PHASE 2 OPTIMIZATION: Get known patterns from Supabase for fast pattern matching
     */
    async getKnownPatterns() {
        if (!this.supabase) return [];
        
        try {
            const { data, error } = await this.supabase
                .from('code_roach_patterns')
                .select('fingerprint, error_pattern, best_fix, occurrence_count')
                .gt('occurrence_count', 5)
                .order('occurrence_count', { ascending: false })
                .limit(100);
            
            if (error) {
                console.warn('[Codebase Crawler] Error querying patterns:', error.message);
                return [];
            }
            
            console.log(`[Codebase Crawler] Loaded ${data.length} known patterns from Supabase`);
            return data || [];
        } catch (err) {
            console.warn('[Codebase Crawler] Failed to get known patterns:', err.message);
            return [];
        }
    }

    /**
     * PHASE 5: Get similar resolved issues to reuse fixes
     * ENHANCEMENT: Added fuzzy matching for better fix reuse
     */
    async getSimilarResolvedIssues(issue, filePath) {
        if (!this.supabase) return [];
        
        try {
            const issueMessage = issue.message || '';
            const issueType = issue.type || '';
            const issueSeverity = issue.severity || '';
            
            // ENHANCEMENT: Multi-criteria fuzzy matching
            // 1. Exact message match (highest priority)
            let { data: exactMatches, error: exactError } = await this.supabase
                .from('code_roach_issues')
                .select('error_message, fix_applied, file_path, resolved_at, error_type, error_severity')
                .eq('review_status', 'resolved')
                .not('fix_applied', 'is', null)
                .ilike('error_message', `%${issueMessage.substring(0, 50)}%`)
                .order('resolved_at', { ascending: false })
                .limit(3);
            
            if (exactError) exactMatches = [];
            
            // 2. Type + severity match (medium priority)
            let { data: typeMatches, error: typeError } = await this.supabase
                .from('code_roach_issues')
                .select('error_message, fix_applied, file_path, resolved_at, error_type, error_severity')
                .eq('review_status', 'resolved')
                .eq('error_type', issueType)
                .eq('error_severity', issueSeverity)
                .not('fix_applied', 'is', null)
                .order('resolved_at', { ascending: false })
                .limit(3);
            
            if (typeError) typeMatches = [];
            
            // 3. Fuzzy message match using keywords (lower priority)
            const keywords = issueMessage.split(/\s+/).filter(w => w.length > 4).slice(0, 3);
            let fuzzyMatches = [];
            if (keywords.length > 0) {
                const { data, error } = await this.supabase
                    .from('code_roach_issues')
                    .select('error_message, fix_applied, file_path, resolved_at, error_type, error_severity')
                    .eq('review_status', 'resolved')
                    .not('fix_applied', 'is', null)
                    .or(keywords.map(k => `error_message.ilike.%${k}%`).join(','))
                    .order('resolved_at', { ascending: false })
                    .limit(2);
                
                if (!error && data) {
                    fuzzyMatches = data;
                }
            }
            
            // Combine and deduplicate by file_path + error_message
            const allMatches = [...(exactMatches || []), ...(typeMatches || []), ...fuzzyMatches];
            const seen = new Set();
            const uniqueMatches = [];
            
            for (const match of allMatches) {
                const key = `${match.file_path}:${match.error_message}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    // Add similarity score
                    match.similarityScore = this.calculateIssueSimilarity(issue, match);
                    uniqueMatches.push(match);
                }
            }
            
            // Sort by similarity score (highest first)
            uniqueMatches.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
            
            return uniqueMatches.slice(0, 5);
        } catch (err) {
            return [];
        }
    }

    /**
     * ENHANCEMENT: Calculate similarity score between two issues
     */
    calculateIssueSimilarity(issue, resolvedIssue) {
        let score = 0;
        
        // Message similarity (0-50 points)
        const issueMsg = (issue.message || '').toLowerCase();
        const resolvedMsg = (resolvedIssue.error_message || '').toLowerCase();
        if (issueMsg && resolvedMsg) {
            if (issueMsg === resolvedMsg) {
                score += 50;
            } else if (resolvedMsg.includes(issueMsg.substring(0, 30)) || issueMsg.includes(resolvedMsg.substring(0, 30))) {
                score += 30;
            } else {
                // Word overlap
                const issueWords = new Set(issueMsg.split(/\s+/));
                const resolvedWords = new Set(resolvedMsg.split(/\s+/));
                const overlap = [...issueWords].filter(w => resolvedWords.has(w)).length;
                score += Math.min(20, overlap * 2);
            }
        }
        
        // Type match (0-30 points)
        if (issue.type === resolvedIssue.error_type) {
            score += 30;
        }
        
        // Severity match (0-20 points)
        if (issue.severity === resolvedIssue.error_severity) {
            score += 20;
        }
        
        return score;
    }

    /**
     * PHASE 5: Try to reuse fix from similar resolved issue
     */
    async tryReuseFix(issue, code, filePath) {
        const similarIssues = await this.getSimilarResolvedIssues(issue, filePath);
        
        if (similarIssues.length === 0) {
            return null;
        }
        
        // Try the most recent similar fix
        const mostRecent = similarIssues[0];
        if (mostRecent.fix_applied) {
            try {
                // Apply the fix pattern (simplified - can be enhanced)
                const fixPattern = mostRecent.fix_applied;
                if (typeof fixPattern === 'string' && fixPattern.includes('→')) {
                    const [before, after] = fixPattern.split('→').map(s => s.trim());
                    if (code.includes(before)) {
                        const fixedCode = code.replace(before, after);
                        console.log(`[Codebase Crawler] 🔄 Reusing fix from similar issue: ${filePath}:${issue.line}`);
                        return {
                            code: fixedCode,
                            method: 'reused',
                            confidence: 0.85, // High confidence for proven fixes
                            source: mostRecent.file_path
                        };
                    }
                }
            } catch (err) {
                // Fix reuse failed, continue with normal flow
            }
        }
        
        return null;
    }

    /**
     * PHASE 4: Group files by similarity for batch processing
     * ENHANCEMENT: Added semantic similarity grouping using codebase search
     */
    async groupFilesBySimilarity(files, limit = 10, useSemanticGrouping = true) {
        if (files.length <= limit) {
            return [files]; // No grouping needed
        }
        
        // ENHANCEMENT: Try semantic similarity grouping first
        if (useSemanticGrouping && codebaseSearch && files.length > 20) {
            try {
                // Sample a few files to get semantic clusters
                const sampleSize = Math.min(50, Math.floor(files.length / 5));
                const sampleFiles = files.slice(0, sampleSize);
                
                // Get semantic embeddings for sample files
                const semanticGroups = new Map();
                let groupIndex = 0;
                
                for (const file of sampleFiles) {
                    try {
                        const code = await fs.readFile(file, 'utf8').catch(() => '');
                        if (code.length < 100) continue; // Skip very small files
                        
                        // Use first 500 chars as a signature for grouping
                        const signature = code.substring(0, 500);
                        
                        // Try to find similar files using semantic search
                        const similar = await codebaseSearch.semanticSearch(signature, { 
                            limit: 5, 
                            threshold: 0.7,
                            fileFilter: path.extname(file)
                        }).catch(() => ({ results: [] }));
                        
                        // Group by similarity
                        let foundGroup = false;
                        for (const [groupKey, groupFiles] of semanticGroups.entries()) {
                            const groupFile = groupFiles[0];
                            if (groupFile && path.extname(file) === path.extname(groupFile)) {
                                semanticGroups.get(groupKey).push(file);
                                foundGroup = true;
                                break;
                            }
                        }
                        
                        if (!foundGroup) {
                            semanticGroups.set(`semantic-${groupIndex++}`, [file]);
                        }
                    } catch (err) {
                        // Skip file if semantic grouping fails
                    }
                }
                
                // Add remaining files to groups based on extension
                const remainingFiles = files.slice(sampleSize);
                remainingFiles.forEach(file => {
                    const ext = path.extname(file);
                    let added = false;
                    for (const [groupKey, groupFiles] of semanticGroups.entries()) {
                        if (groupFiles.length > 0 && path.extname(groupFiles[0]) === ext) {
                            groupFiles.push(file);
                            added = true;
                            break;
                        }
                    }
                    if (!added) {
                        semanticGroups.set(`semantic-${groupIndex++}`, [file]);
                    }
                });
                
                if (semanticGroups.size > 0) {
                    console.log(`[Codebase Crawler] 📦 Semantic grouping: ${files.length} files → ${semanticGroups.size} groups`);
                    return Array.from(semanticGroups.values());
                }
            } catch (err) {
                console.warn(`[Codebase Crawler] Semantic grouping failed, using simple grouping:`, err.message);
            }
        }
        
        // Fallback: Simple grouping by file extension and directory depth
        const groups = new Map();
        
        files.forEach(file => {
            const ext = path.extname(file);
            const dirDepth = file.split(path.sep).length;
            const key = `${ext}-${dirDepth}`;
            
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(file);
        });
        
        // Return groups as arrays
        return Array.from(groups.values());
    }

    /**
     * PHASE 1+ OPTIMIZATION: Smart file selection using Supabase, git, and semantic search
     */
    async getOptimizedFileList(rootDir, fileExtensions, excludeDirs, options = {}) {
        const useOptimizations = options.useOptimizations !== false;
        
        if (!useOptimizations) {
            // Fallback to full scan
            return await this.findCodeFiles(rootDir, fileExtensions, excludeDirs);
        }

        const optimizedFiles = new Set();
        
        // 1. Get files with pending issues from Supabase (HIGH PRIORITY)
        const filesWithIssues = await this.getFilesWithPendingIssues();
        filesWithIssues.forEach(f => optimizedFiles.add(path.resolve(rootDir, f)));

        // 2. Get changed files from git (HIGH PRIORITY)
        const changedFiles = await this.getGitChangedFiles(rootDir);
        changedFiles.forEach(f => {
            const fullPath = path.resolve(rootDir, f);
            const ext = path.extname(f);
            if (fileExtensions.includes(ext)) {
                optimizedFiles.add(fullPath);
            }
        });

        // 3. Get files with low health scores from Supabase (MEDIUM PRIORITY)
        const lowHealthFiles = await this.getFilesWithLowHealthScores(70, 1000);
        lowHealthFiles.forEach(f => optimizedFiles.add(path.resolve(rootDir, f)));

        // 4. PHASE 4: Use semantic search to find files with similar issues (MEDIUM PRIORITY)
        const similarIssueFiles = await this.getFilesWithSimilarIssues(200);
        for (const f of similarIssueFiles) {
            try {
                const fullPath = path.resolve(rootDir, f);
                await fs.access(fullPath); // Check if file exists
                optimizedFiles.add(fullPath);
            } catch {
                // File doesn't exist, skip
            }
        }

        let optimizedList = Array.from(optimizedFiles);
        
        // PHASE 4: Prioritize by health scores if available
        if (this.supabase && optimizedList.length > 0) {
            try {
                // Get health scores for prioritized files
                const relativePaths = optimizedList.map(f => path.relative(rootDir, f));
                const { data: healthData } = await this.supabase
                    .from('code_roach_file_health')
                    .select('file_path, health_score')
                    .in('file_path', relativePaths);
                
                if (healthData && healthData.length > 0) {
                    const healthMap = new Map(healthData.map(h => [h.file_path, h.health_score]));
                    optimizedList.sort((a, b) => {
                        const aPath = path.relative(rootDir, a);
                        const bPath = path.relative(rootDir, b);
                        const aScore = healthMap.get(aPath) || 100;
                        const bScore = healthMap.get(bPath) || 100;
                        return aScore - bScore; // Lower score = higher priority
                    });
                }
            } catch (err) {
                // Continue without prioritization if health check fails
            }
        }
        
        // If we have optimized files, use them. Otherwise fallback to full scan.
        if (optimizedList.length > 0) {
            const totalFiles = await this.findCodeFiles(rootDir, fileExtensions, excludeDirs).then(f => f.length);
            const reduction = ((1 - optimizedList.length / totalFiles) * 100).toFixed(1);
            console.log(`[Codebase Crawler] 🚀 OPTIMIZED: Using ${optimizedList.length} files (${reduction}% reduction from ${totalFiles} total files)`);
            console.log(`[Codebase Crawler]    Sources: Supabase issues, git diff, health scores, semantic search`);
            return optimizedList;
        } else {
            console.log(`[Codebase Crawler] No optimized files found, falling back to full scan`);
            return await this.findCodeFiles(rootDir, fileExtensions, excludeDirs);
        }
    }

    /**
     * Crawl the entire codebase
     */
    async crawlCodebase(rootDir = process.cwd(), options = {}) {
        // Handle case where rootDir is actually options object (backwards compatibility)
        if (typeof rootDir === 'object' && rootDir !== null && !rootDir.includes && !rootDir.startsWith) {
            options = rootDir;
            rootDir = options.rootDir || process.cwd();
        }

        // Ensure rootDir is a string
        if (typeof rootDir !== 'string') {
            rootDir = process.cwd();
        }

        if (this.isRunning) {
            throw new Error('Crawler is already running');
        }

        this.isRunning = true;
        this.stats = {
            filesScanned: 0,
            filesWithIssues: 0,
            issuesFound: 0,
            issuesAutoFixed: 0,
            issuesNeedingReview: 0,
            errors: 0,
            startTime: Date.now(),
            endTime: null
        };
        this.scanResults = [];

        const {
            autoFix = true,
            fileExtensions = ['.js', '.ts', '.jsx', '.tsx'],
            excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.vscode-extension'],
            maxFileSize = 500000, // 500KB
            concurrency = 5
        } = options;

        console.log(`[Codebase Crawler] Starting crawl of ${rootDir}`);
        console.log(`[Codebase Crawler] Options: autoFix=${autoFix}, extensions=${fileExtensions.join(',')}`);

        try {
            // PHASE 1 OPTIMIZATION: Use smart file selection
            let files = await this.getOptimizedFileList(rootDir, fileExtensions, excludeDirs, options);
            console.log(`[Codebase Crawler] Found ${files.length} files to scan`);

            // Optimize: Prioritize files for faster issue detection
            if (options.prioritizeFiles !== false) {
                files = performanceOptimizerService.prioritizeFiles(files, {
                    prioritizeRecent: true,
                    prioritizeErrors: true,
                    prioritizeTestFiles: false
                });
                console.log(`[Codebase Crawler] Files prioritized for analysis`);
            }

            // Use optimal concurrency if not specified - ENHANCED for maximum speed
            const optimalConcurrency = concurrency || Math.max(performanceOptimizerService.getOptimalConcurrency(), 10);
            console.log(`[Codebase Crawler] Using concurrency: ${optimalConcurrency} (enhanced for speed)`);
            
            // PHASE 2: Load known patterns for fast pattern matching
            const knownPatterns = await this.getKnownPatterns();
            if (knownPatterns.length > 0) {
                console.log(`[Codebase Crawler] 🎯 Loaded ${knownPatterns.length} known patterns for fast pattern matching`);
            }

            // PHASE 4: Group files by similarity for better batch processing (optional)
            const useGrouping = options.groupBySimilarity !== false && files.length > 50;
            let fileGroups = [files];
            if (useGrouping) {
                fileGroups = await this.groupFilesBySimilarity(files, 50);
                console.log(`[Codebase Crawler] 📦 Grouped ${files.length} files into ${fileGroups.length} similarity groups`);
            }

            // Process files in batches for concurrency control
            // ENHANCED: Process groups separately for better cache locality
            for (const group of fileGroups) {
                for (let i = 0; i < group.length; i += optimalConcurrency) {
                    const batch = group.slice(i, i + optimalConcurrency);
                    const results = await Promise.allSettled(
                        batch.map(file => this.analyzeFile(file, { autoFix, maxFileSize, skipUnchanged: options.skipUnchanged !== false }))
                    );
                
                // Log any failures
                results.forEach((result, idx) => {
                    if (result.status === 'rejected') {
                        console.error(`[Codebase Crawler] Failed to analyze ${batch[idx]}:`, result.reason);
                        this.stats.errors++;
                    }
                });
                
                    // Progress update every 100 files
                    const totalProcessed = this.stats.filesScanned + (this.stats.filesSkipped || 0);
                    if (totalProcessed % 100 === 0 || i + optimalConcurrency >= group.length) {
                        const skipped = this.stats.filesSkipped || 0;
                        const scanned = this.stats.filesScanned || 0;
                        console.log(`[Codebase Crawler] Progress: ${scanned} scanned, ${skipped} skipped (${this.stats.issuesFound} issues found, ${this.stats.issuesAutoFixed} auto-fixed)`);
                    }
                }
            }

            this.stats.endTime = Date.now();
            const duration = ((this.stats.endTime - this.stats.startTime) / 1000).toFixed(2);

            console.log(`[Codebase Crawler] Crawl complete in ${duration}s`);
            console.log(`[Codebase Crawler] Stats:`, this.stats);
            
            // ENHANCEMENT: Keep file watcher running if enabled (don't stop it)
            // File watcher will continue monitoring for changes
            
            // Persist stats to disk
            await this.saveStats();
            
            // ROUND 10: Send notification on crawl complete
            try {
                const notificationService = require('./notificationService');
                await notificationService.notifyCrawlComplete(this.stats).catch(() => {});
            } catch (err) {
                // Notifications are optional
            }
            
            // ROUND 11: Record analytics
            try {
                const codeRoachAnalytics = require('./codeRoachAnalytics');
                await codeRoachAnalytics.recordCrawlComplete(this.stats);
            } catch (err) {
                // Analytics are optional
            }
            
            // Store issues in database if projectId provided
            if (options.projectId && this.scanResults.length > 0) {
                try {
                    for (const fileResult of this.scanResults) {
                        if (fileResult.issues && fileResult.issues.length > 0) {
                            await issueStorageService.storeIssues(
                                fileResult.issues.map(issue => ({
                                    ...issue,
                                    file: fileResult.filePath,
                                    filePath: fileResult.filePath
                                })),
                                options.projectId
                            );
                        }
                    }
                    console.log(`[Codebase Crawler] ✅ Stored ${this.stats.issuesFound} issues in database`);
                } catch (err) {
                    console.warn(`[Codebase Crawler] Failed to store issues:`, err.message);
                }
            }

            return {
                success: true,
                stats: this.stats,
                results: this.scanResults
            };
        } catch (err) {
            console.error('[Codebase Crawler] Error during crawl:', err);
            this.stats.errors++;
            throw err;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Find all code files recursively
     */
    async findCodeFiles(dir, extensions, excludeDirs, files = []) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                // Skip excluded directories
                if (entry.isDirectory()) {
                    if (!excludeDirs.includes(entry.name)) {
                        await this.findCodeFiles(fullPath, extensions, excludeDirs, files);
                    }
                    continue;
                }

                // Check if file matches extensions
                const ext = path.extname(entry.name);
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        } catch (err) {
            // Skip directories we can't read
            if (err.code !== 'EACCES' && err.code !== 'ENOENT') {
                console.warn(`[Codebase Crawler] Error reading ${dir}:`, err.message);
            }
        }

        return files;
    }

    /**
     * Calculate file hash for caching
     */
    async calculateFileHash(filePath, code) {
        return crypto.createHash('sha256').update(code).digest('hex');
    }

    /**
     * Get cached file info from Supabase or memory
     */
    async getCachedFileInfo(filePath) {
        // Try Supabase first
        if (this.supabase) {
            try {
                const relativePath = path.relative(process.cwd(), filePath);
                const { data, error } = await this.supabase
                    .from('code_roach_file_cache')
                    .select('file_hash, last_scanned, issue_count, last_modified')
                    .eq('file_path', relativePath)
                    .single();
                
                if (!error && data) {
                    return data;
                }
            } catch (err) {
                // Fall through to memory cache
            }
        }
        
        // Fallback to memory cache
        return this.fileCache.get(filePath) || null;
    }

    /**
     * Update file cache in Supabase or memory
     */
    async updateFileCache(filePath, fileHash, issueCount, lastModified) {
        const relativePath = path.relative(process.cwd(), filePath);
        const cacheData = {
            file_path: relativePath,
            file_hash: fileHash,
            last_scanned: new Date().toISOString(),
            issue_count: issueCount,
            last_modified: lastModified
        };
        
        // Try Supabase first
        if (this.supabase) {
            try {
                await this.supabase
                    .from('code_roach_file_cache')
                    .upsert(cacheData, { onConflict: 'file_path' });
                return;
            } catch (err) {
                console.warn(`[Codebase Crawler] Failed to update Supabase cache:`, err.message);
            }
        }
        
        // Fallback to memory cache
        this.fileCache.set(filePath, cacheData);
    }

    /**
     * Check if file should be scanned (has changed or not cached)
     * ENHANCEMENT: Added cache expiration/TTL support
     */
    async shouldScanFile(filePath, code, fileHash, cacheTTL = 24 * 60 * 60 * 1000) {
        const stats = await fs.stat(filePath);
        const lastModified = stats.mtime.toISOString();
        
        const cached = await this.getCachedFileInfo(filePath);
        
        if (!cached) {
            // Not cached, should scan
            return { shouldScan: true, reason: 'not_cached' };
        }
        
        // ENHANCEMENT: Check cache expiration
        if (cached.last_scanned) {
            const lastScanned = new Date(cached.last_scanned);
            const now = new Date();
            const age = now - lastScanned;
            
            if (age > cacheTTL) {
                // Cache expired, should scan
                return { shouldScan: true, reason: 'cache_expired', cached, age };
            }
        }
        
        // Check if file hash matches
        if (cached.file_hash === fileHash) {
            // File unchanged and cache valid, skip scan
            return { shouldScan: false, reason: 'unchanged', cached };
        }
        
        // File changed, should scan
        return { shouldScan: true, reason: 'changed', cached };
    }

    /**
     * Analyze a single file
     */
    async analyzeFile(filePath, options = {}) {
        const { autoFix = true, maxFileSize = 500000, skipUnchanged = true } = options;

        try {
            // Check file size
            const stats = await fs.stat(filePath);
            if (stats.size > maxFileSize) {
                console.log(`[Codebase Crawler] Skipping large file: ${filePath} (${(stats.size / 1024).toFixed(1)}KB)`);
                return;
            }

            // Read file
            const code = await fs.readFile(filePath, 'utf8');
            
            // PHASE 3: Check cache if enabled
            if (skipUnchanged) {
                const fileHash = await this.calculateFileHash(filePath, code);
                const scanCheck = await this.shouldScanFile(filePath, code, fileHash);
                
                if (!scanCheck.shouldScan) {
                    // File unchanged, skip analysis
                    if (this.stats.filesScanned % 100 === 0) {
                        console.log(`[Codebase Crawler] ⏭️  Skipping unchanged file (cached): ${path.basename(filePath)}`);
                    }
                    this.stats.filesSkipped = (this.stats.filesSkipped || 0) + 1;
                    return;
                }
            }
            
            // Skip empty or very small files
            if (code.trim().length < 10) {
                return;
            }
            
            this.stats.filesScanned++;
            
            // Periodically save stats (every 10 files)
            if (this.stats.filesScanned % 10 === 0) {
                await this.saveStats().catch(() => {}); // Don't block on save errors
            }

            // SPRINT 3: Check file risk before analyzing
            try {
                if (developerMetricsService && typeof developerMetricsService.calculateFileRisk === 'function') {
                    const riskScore = await developerMetricsService.calculateFileRisk(filePath);
                    if (riskScore > 70) {
                        console.log(`[Codebase Crawler] ⚠️  HIGH RISK FILE (${riskScore}): ${filePath}`);
                        // Create risk alert
                        if (riskAlertService && typeof riskAlertService.checkAndAlert === 'function') {
                            await riskAlertService.checkAndAlert(filePath, {
                                source: 'codebase-crawler',
                                action: 'file-scan',
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }
            } catch (err) {
                // Don't block scanning if risk check fails
                console.warn(`[Codebase Crawler] Risk check failed for ${filePath}:`, err.message);
            }

            // Initialize fileResult early (will be populated later if issues found)
            let fileResult = {
                file: filePath,
                filePath: filePath,
                issues: [],
                autoFixed: 0,
                needsReview: 0
            };

            // PHASE 2 OPTIMIZATION: Try pattern matching first (FAST - no LLM calls)
            const knownPatterns = options.knownPatterns || [];
            if (knownPatterns.length > 0) {
                const patternMatches = this.matchPatterns(code, filePath, knownPatterns);
                if (patternMatches.length > 0) {
                    // Found issues via pattern matching - apply known fixes immediately
                    for (const match of patternMatches) {
                        if (match.fix && match.confidence > 0.7) {
                            try {
                                const fixedCode = this.applyPatternFix(code, match);
                                if (fixedCode !== code) {
                                    await fs.writeFile(filePath, fixedCode, 'utf8');
                                    this.stats.issuesFound++;
                                    this.stats.issuesAutoFixed++;
                                    console.log(`[Codebase Crawler] ✅ Pattern fix applied: ${filePath} - ${match.pattern.fingerprint}`);
                                    return; // Skip full analysis - pattern fix worked
                                }
                            } catch (err) {
                                console.warn(`[Codebase Crawler] Pattern fix failed: ${err.message}`);
                            }
                        }
                    }
                }
            }

            // Analyze code (full analysis if pattern matching didn't work)
            let reviewResult;
            try {
                reviewResult = await codeReviewAssistant.reviewCode(code, filePath);
            } catch (err) {
                console.error(`[Codebase Crawler] Error calling reviewCode for ${filePath}:`, err.message);
                this.stats.errors++;
                return;
            }

            // Handle both direct review object and nested review structure
            if (!reviewResult || !reviewResult.success) {
                console.warn(`[Codebase Crawler] Review failed for ${filePath}:`, reviewResult?.error || 'Unknown error');
                this.stats.errors++;
                return;
            }

            const review = reviewResult.review || reviewResult;
            const issues = review?.issues || [];

            // Update fileResult with issues (always, even if empty)
            fileResult.issues = issues;

            if (issues.length > 0) {
                this.stats.filesWithIssues++;
                this.stats.issuesFound += issues.length;

                // ROUND 12: Use multi-agent fix teams for files with multiple issues
                // This is more efficient than processing one-by-one
                const useMultiAgentTeams = issues.length >= 3 && options.useMultiAgentTeams !== false;
                
                if (useMultiAgentTeams) {
                    try {
                        const multiAgentFixTeam = require('./multiAgentFixTeam');
                        if (multiAgentFixTeam && typeof multiAgentFixTeam.deployFixTeams === 'function') {
                            const teamResults = await multiAgentFixTeam.deployFixTeams(issues, code, filePath, options);
                            
                            // Process team results
                            let fixedCount = 0;
                            for (const result of teamResults) {
                                if (result.success) {
                                this.stats.issuesAutoFixed++;
                                fileResult.autoFixed++;
                                fixedCount++;
                                code = result.fixedCode; // Update code for next fix
                                
                                // Record analytics
                                try {
                                    const codeRoachAnalytics = require('./codeRoachAnalytics');
                                    await codeRoachAnalytics.recordFixApplied(
                                        result.issue,
                                        result.method,
                                        result.confidence
                                    );
                                } catch (err) {
                                    // Analytics optional
                                }
                                
                                // Learn from successful fix
                                try {
                                    const patternEvolutionService = require('./patternEvolutionService');
                                    const knownPatterns = await this.getKnownPatterns();
                                    if (knownPatterns && knownPatterns.length > 0) {
                                        const matchingPattern = knownPatterns.find(p => 
                                            p.error_type === result.issue.type
                                        );
                                        if (matchingPattern) {
                                            await patternEvolutionService.learnFromOutcome(
                                                matchingPattern,
                                                result.issue,
                                                { code: result.fixedCode, method: result.method, confidence: result.confidence },
                                                { success: true, applied: true }
                                            );
                                        }
                                    }
                                } catch (err) {
                                    // Pattern evolution optional
                                }
                                } else {
                                this.stats.issuesNeedingReview++;
                                fileResult.needsReview++;
                                fileResult.issues.push(result.issue);
                                }
                            }
                        }
                        
                        if (fixedCount > 0) {
                            console.log(`[Codebase Crawler] 🚀 Multi-agent teams fixed ${fixedCount}/${issues.length} issues in ${filePath}`);
                            // Teams processed all issues, skip individual processing
                            // Continue to file result processing below
                        } else {
                            // Teams didn't fix anything, fall through to individual processing
                        }
                    } catch (err) {
                        console.warn(`[Codebase Crawler] Multi-agent teams failed, falling back to individual processing:`, err.message);
                        // Fall through to individual processing
                    }
                }

                // Process each issue individually (if multi-agent teams not used or failed)
                // Only process individually if teams weren't used OR teams fixed nothing
                if (!useMultiAgentTeams || fileResult.autoFixed === 0) {
                    for (const issue of issues) {
                    // SPRINT 20: Use helper to determine if should auto-fix (reduces nesting)
                    const shouldAutoFix = fixHelpers.shouldAutoFix(issue, autoFix);

                    if (shouldAutoFix) {
                        try {
                        // INTEGRATION: Use orchestration service by default (System Architecture Expert - 2025-01-15)
                        // Orchestration coordinates all 12+ services through unified pipeline
                        // Services are now always available - orchestration is the default path
                        let orchestrationUsed = false;
                        
                        // Use orchestration unless explicitly disabled
                        if (options.useOrchestration !== false) {
                            try {
                                const context = {
                                    filePath,
                                    originalCode: code,
                                    fixedCode: null, // Will be generated
                                    issue,
                                    method: 'orchestration',
                                    confidence: 0.8,
                                    projectId: options.projectId
                                };

                                const orchestrationResult = await fixOrchestrationService.orchestrateFix(issue, context);
                                
                                if (orchestrationResult.success && orchestrationResult.decision.action === 'apply') {
                                    // Orchestration approved the fix
                                    const pipeline = orchestrationResult.pipeline;
                                    const applyStage = pipeline.stages.find(s => s.name === 'apply');
                                    
                                    if (applyStage && applyStage.result && applyStage.result.success) {
                                        // Fix was applied successfully
                                        orchestrationUsed = true;
                                        this.stats.issuesAutoFixed++;
                                        fileResult.autoFixed++;
                                        code = applyStage.result.fixedCode || code;
                                        
                                        // Monitoring is handled by orchestration pipeline
                                        // Documentation is handled by orchestration pipeline
                                        
                                        console.log(`[Codebase Crawler] ✅ Orchestrated fix applied: ${filePath}:${issue.line} (pipeline: ${orchestrationResult.pipelineId})`);
                                        continue; // Skip to next issue
                                    }
                                } else if (orchestrationResult.success && orchestrationResult.decision.action === 'skip') {
                                    // Orchestration decided to skip this fix
                                    console.log(`[Codebase Crawler] ⏭️ Orchestration skipped fix: ${filePath}:${issue.line} - ${orchestrationResult.decision.reason || 'Low priority'}`);
                                    continue; // Skip to next issue
                                }
                            } catch (err) {
                                // Orchestration failed, fall through to legacy fix flow
                                console.warn(`[Codebase Crawler] ⚠️ Orchestration failed, falling back to legacy fix flow:`, err.message);
                            }
                        } else {
                            // Explicitly disabled, use legacy path
                            console.log(`[Codebase Crawler] 📋 Using legacy fix flow (orchestration disabled)`);
                        }
                        
                        // Legacy fix flow (fallback if orchestration not used or failed)
                        if (!orchestrationUsed) {
                            // ENHANCED: Special handling for critical security issues
                            const isCriticalSecurity = issue.type === 'security' && issue.severity === 'critical';
                            
                            // ROUND 10: Notify on critical issue found
                            if (isCriticalSecurity || (issue.severity === 'critical')) {
                                try {
                                    const notificationService = require('./notificationService');
                                    await notificationService.notifyCriticalIssue(issue, filePath).catch(() => {});
                                } catch (err) {
                                    // Notifications are optional
                                }
                            }
                            
                            if (this.stats.issuesAutoFixed <= 10 || isCriticalSecurity) {
                                console.log(`[Codebase Crawler] 🔧 Attempting auto-fix: ${filePath}:${issue.line} - ${issue.type}/${issue.severity} - ${issue.message.substring(0, 60)}${isCriticalSecurity ? ' [CRITICAL SECURITY]' : ''}`);
                            }
                            try {
                            // SPRINT 20: Use helper functions to reduce nesting complexity
                            // Get meta-learning insights
                            const insights = await fixHelpers.getMetaLearningInsights(issue);
                            const languageKnowledge = await fixHelpers.getLanguageKnowledge(filePath, code);

                            // PHASE 5: Try to reuse fix from similar resolved issue first (fastest)
                            let reusedFix = await this.tryReuseFix(issue, code, filePath);
                            
                            if (reusedFix && reusedFix.confidence >= 0.85) {
                                // Use the reused fix directly
                                const validationResult = await fixApplication.applyFixWithValidation(
                                    { code: reusedFix.code, method: reusedFix.method, confidence: reusedFix.confidence },
                                    filePath,
                                    code
                                );
                                
                                if (validationResult.verified && fixApplication.shouldAutoApply(
                                    { method: reusedFix.method, confidence: reusedFix.confidence },
                                    validationResult
                                )) {
                                    const applyResult = await fixApplication.applyFixWithLearning(
                                        { code: reusedFix.code, method: reusedFix.method, confidence: reusedFix.confidence },
                                        issue,
                                        filePath,
                                        code
                                    );
                                    
                                    if (applyResult.success) {
                                        this.stats.issuesAutoFixed++;
                                        fileResult.autoFixed++;
                                        code = applyResult.code;
                                        
                                        // ROUND 10: Notify on critical fix applied
                                        if (issue.severity === 'critical' || issue.type === 'security') {
                                            try {
                                                const notificationService = require('./notificationService');
                                                await notificationService.notifyFixApplied(issue, reusedFix, filePath).catch(() => {});
                                            } catch (err) {
                                                // Notifications are optional
                                            }
                                        }
                                        
                                        if (this.stats.issuesAutoFixed <= 20) {
                                            console.log(`[Codebase Crawler] ✅ Reused fix from ${reusedFix.source} (${(reusedFix.confidence * 100).toFixed(0)}%): ${filePath}:${issue.line}`);
                                        }
                                        
                                        await fixApplication.recordSuccessfulFix(
                                            issue,
                                            { code: reusedFix.code, method: reusedFix.method, confidence: reusedFix.confidence },
                                            filePath,
                                            languageKnowledge,
                                            insights.issueDomain,
                                            code // Pass original code for documentation
                                        );
                                        continue; // Skip to next issue
                                    }
                                }
                            }
                            
                            // Try known pattern match next (fast)
                            let patternFixResult = null;
                            if (knownPatterns && knownPatterns.length > 0) {
                                const patternMatches = this.matchPatterns(code, filePath, knownPatterns);
                                if (patternMatches.length > 0) {
                                    // Sort by confidence (highest first)
                                    patternMatches.sort((a, b) => b.confidence - a.confidence);
                                    const bestMatch = patternMatches[0];
                                    if (bestMatch && bestMatch.confidence >= 0.7) {
                                        const fixedCode = this.applyPatternFix(code, bestMatch);
                                        if (fixedCode !== code) {
                                            patternFixResult = {
                                                code: fixedCode,
                                                method: 'pattern',
                                                confidence: bestMatch.confidence
                                            };
                                        }
                                    }
                                }
                            }
                            
                            // Fallback to simple pattern-based fix if no result
                            if (!patternFixResult) {
                                const simplePatternFix = await this.applyFixToCode(issue, code, filePath);
                                // applyFixToCode returns the fixed code string or null
                                if (simplePatternFix && typeof simplePatternFix === 'string' && simplePatternFix !== code) {
                                    patternFixResult = {
                                        code: simplePatternFix,
                                        method: 'simple-pattern',
                                        confidence: 0.75
                                    };
                                }
                            }
                            
                            // If we have a high-confidence pattern fix, use it directly
                            if (patternFixResult && patternFixResult.confidence >= 0.85) {
                                // Use the pattern fix directly
                                const validationResult = await fixApplication.applyFixWithValidation(
                                    { code: patternFixResult.code, method: patternFixResult.method, confidence: patternFixResult.confidence },
                                    filePath,
                                    code
                                );
                                
                                if (validationResult.verified && fixApplication.shouldAutoApply(
                                    { method: patternFixResult.method, confidence: patternFixResult.confidence },
                                    validationResult
                                )) {
                                    const applyResult = await fixApplication.applyFixWithLearning(
                                        { code: patternFixResult.code, method: patternFixResult.method, confidence: patternFixResult.confidence },
                                        issue,
                                        filePath,
                                        code
                                    );
                                    
                                    if (applyResult.success) {
                                        this.stats.issuesAutoFixed++;
                                        fileResult.autoFixed++;
                                        code = applyResult.code;
                                        
                                        if (this.stats.issuesAutoFixed <= 20) {
                                            console.log(`[Codebase Crawler] ✅ Pattern fix applied (
                                                ${(patternFixResult.confidence * 100).toFixed(0)}%): ${filePath}:${issue.line}`);
                                        }
                                        
                                        // ROUND 12: Learn from successful pattern fix
                                        try {
                                            const patternEvolutionService = require('./patternEvolutionService');
                                            const knownPatterns = await this.getKnownPatterns();
                                            if (knownPatterns && knownPatterns.length > 0) {
                                                const matchingPattern = knownPatterns.find(p => 
                                                    p.error_type === issue.type
                                                );
                                                if (matchingPattern) {
                                                    await patternEvolutionService.learnFromOutcome(
                                                        matchingPattern,
                                                        issue,
                                                        { code: patternFixResult.code, method: patternFixResult.method, confidence: patternFixResult.confidence },
                                                        { success: true, applied: true }
                                                    );
                                                }
                                            }
                                        } catch (err) {
                                            // Pattern evolution optional
                                        }
                                        
                                        await fixApplication.recordSuccessfulFix(
                                            issue,
                                            { code: patternFixResult.code, method: patternFixResult.method, confidence: patternFixResult.confidence },
                                            filePath,
                                            languageKnowledge,
                                            insights.issueDomain
                                        );
                                        continue; // Skip to next issue
                                    }
                                }
                            }
                            
                            // Fallback to simple pattern-based fix if no known pattern or pattern fix failed
                            const patternFix = patternFixResult?.code || await this.applyFixToCode(issue, code, filePath);
                            
                            // Generate fix using helper (handles all fix strategies)
                            // Pass applyLLMFix method for transformation
                            const fixResult = await fixHelpers.generateFix(issue, code, filePath, patternFix, insights, this.applyLLMFix.bind(this));
                            
                            if (!fixResult || !fixResult.success) {
                                // ENHANCED: Even if generateFix fails, try a simple fix attempt
                                // Don't give up - try to fix it anyway
                                try {
                                    const simpleFix = await this.applyFixToCode(issue, code, filePath);
                                    if (simpleFix && simpleFix !== code) {
                                        // We have a simple fix, use it
                                        const applyResult = await fixApplication.applyFixWithLearning(
                                            { code: simpleFix, method: 'simple', confidence: 0.5 },
                                            issue,
                                            filePath,
                                            code
                                        );
                                        
                                        if (applyResult.success) {
                                            this.stats.issuesAutoFixed++;
                                            fileResult.autoFixed++;
                                            code = applyResult.code;
                                            continue;
                                        }
                                    }
                                } catch (err) {
                                    // Ignore simple fix errors
                                }
                                
                            // Couldn't generate fix - try extreme issue router
                            // ENHANCED: Route to specialized background agents
                            const extremeIssueRouter = require('./extremeIssueRouter');
                            const extremeResult = await extremeIssueRouter.routeExtremeIssue(
                                issue,
                                code,
                                filePath,
                                { insights, languageKnowledge }
                            );
                            
                            if (extremeResult && extremeResult.success) {
                                // Extreme issue router succeeded!
                                const applyResult = await fixApplication.applyFixWithLearning(
                                    { code: extremeResult.fixedCode, method: extremeResult.agent, confidence: extremeResult.confidence || 0.7 },
                                    issue,
                                    filePath,
                                    code
                                );
                                
                                if (applyResult.success) {
                                    this.stats.issuesAutoFixed++;
                                    fileResult.autoFixed++;
                                    code = applyResult.code;
                                    
                                    console.log(`[Codebase Crawler] 🚀 Extreme issue fixed by ${extremeResult.agent} (confidence: ${((extremeResult.confidence || 0.7) * 100).toFixed(0)}%): ${filePath}:${issue.line}`);
                                    
                                    // ROUND 11: Record analytics
                                    try {
                                        const codeRoachAnalytics = require('./codeRoachAnalytics');
                                        await codeRoachAnalytics.recordFixApplied(issue, extremeResult.agent, extremeResult.confidence || 0.7);
                                    } catch (err) {
                                        // Analytics are optional
                                    }
                                    
                                    await fixApplication.recordSuccessfulFix(
                                        issue,
                                        { code: extremeResult.fixedCode, method: extremeResult.agent, confidence: extremeResult.confidence || 0.7 },
                                        filePath,
                                        languageKnowledge,
                                        insights.issueDomain
                                    );
                                    continue;
                                }
                            }
                            
                            // All attempts failed, mark for review
                            // ROUND 7: Calculate priority before adding to review queue
                            let priority = { level: 'medium', score: 50 };
                            if (issuePrioritizationService && typeof issuePrioritizationService.calculatePriority === 'function') {
                                try {
                                    priority = issuePrioritizationService.calculatePriority(issue, {
                                        filePath,
                                        lineCount: issue.endLine ? issue.endLine - issue.line : 1,
                                        extremeRouterAttempted: true,
                                        extremeRouterFailed: !extremeResult || !extremeResult.success
                                    });
                                } catch (err) {
                                    // Use default priority
                                }
                            }
                            issue.priority = priority;
                            issue.extremeRouterAttempted = true;
                            
                            this.stats.issuesNeedingReview++;
                            fileResult.needsReview++;
                            fileResult.issues.push(issue);
                            continue;
                            }

                            const { fixedCode, confidence: fixConfidence, method: fixMethod } = fixResult;
                            
                            // DEBUG: Log fix generation success
                            if (this.stats.issuesAutoFixed <= 5) {
                                console.log(`[Codebase Crawler] 🔧 Fix generated: ${filePath}:${issue.line} - method: ${fixMethod}, confidence: ${(fixConfidence * 100).toFixed(0)}%`);
                            }
                            
                            // ENHANCED: Build confidence for critical security fixes
                            let finalConfidence = fixConfidence;
                            let confidenceDetails = null;
                            const isCriticalSecurity = issue.type === 'security' && issue.severity === 'critical';
                            
                            if (isCriticalSecurity) {
                                const securityFixConfidenceBuilder = require('./securityFixConfidenceBuilder');
                                const confidenceResult = await securityFixConfidenceBuilder.buildConfidenceForSecurityFix(
                                    issue,
                                    code,
                                    filePath,
                                    { code: fixedCode, confidence: fixConfidence, method: fixMethod }
                                );
                                
                                finalConfidence = confidenceResult.confidence;
                                confidenceDetails = confidenceResult;
                                
                                console.log(`[Codebase Crawler] 🔒 Security fix confidence: ${(finalConfidence * 100).toFixed(0)}% (${confidenceResult.recommendation.action})`);
                            }
                            
                            if (this.stats.issuesAutoFixed <= 10 || isCriticalSecurity) {
                                console.log(`[Codebase Crawler] ✅ Fix generated (confidence: ${(finalConfidence * 100).toFixed(0)}%, method: ${fixMethod})${isCriticalSecurity ? ' [SECURITY]' : ''}`);
                            }
                            
                            // ROUND 6: Generate fix preview for complex fixes
                            let preview = null;
                            if (fixMethod === 'multi-step' || fixConfidence < 0.7) {
                                try {
                                    const fixPreviewService = require('./fixPreviewService');
                                    preview = await fixPreviewService.generatePreview(
                                        code,
                                        fixedCode,
                                        issue,
                                        filePath,
                                        { confidence: fixConfidence }
                                    );
                                } catch (err) {
                                    // Preview generation failed, continue without it
                                }
                            }
                            
                            // NEW: Predict impact before applying (December 2025)
                            let impactPrediction = null;
                            if (fixImpactPredictionService) {
                                try {
                                    impactPrediction = await fixImpactPredictionService.predictImpact(
                                        { code: fixedCode, confidence: finalConfidence },
                                        {
                                            filePath,
                                            originalCode: code,
                                            fixedCode,
                                            issue,
                                            projectId: options.projectId
                                        }
                                    );
                                    
                                    // Log high-risk fixes
                                    if (impactPrediction.success && impactPrediction.impact.riskLevel === 'high') {
                                        console.warn(`[Codebase Crawler] ⚠️  High-risk fix detected: ${impactPrediction.impact.affectedFiles.total} files affected, ${impactPrediction.impact.breakingChanges.length} breaking changes`);
                                    }
                                } catch (err) {
                                    // Impact prediction optional
                                }
                            }
                            
                            // NEW: Calibrate confidence (December 2025)
                            let calibratedConfidence = finalConfidence;
                            if (fixConfidenceCalibrationService) {
                                try {
                                    const calibration = await fixConfidenceCalibrationService.calibrateConfidence(
                                        finalConfidence,
                                        {
                                            method: fixMethod,
                                            domain: insights.issueDomain,
                                            filePath,
                                            issueType: issue.type
                                        }
                                    );
                                    calibratedConfidence = calibration.calibrated;
                                    
                                    if (Math.abs(calibratedConfidence - finalConfidence) > 0.1) {
                                        console.log(`[Codebase Crawler] 📊 Confidence calibrated: ${(finalConfidence * 100).toFixed(0)}% → ${(calibratedConfidence * 100).toFixed(0)}%`);
                                    }
                                } catch (err) {
                                    // Calibration optional
                                }
                            }
                            
                            // NEW: Cost-benefit analysis (December 2025)
                            let costBenefit = null;
                            if (fixCostBenefitAnalysisService && options.analyzeCostBenefit !== false) {
                                try {
                                    costBenefit = await fixCostBenefitAnalysisService.analyzeCostBenefit(
                                        { code: fixedCode, confidence: calibratedConfidence },
                                        {
                                            issue,
                                            filePath,
                                            originalCode: code,
                                            fixedCode,
                                            estimatedFixTime: 1, // Estimate
                                            projectId: options.projectId
                                        }
                                    );
                                    
                                    // Log low ROI fixes
                                    if (costBenefit.success && costBenefit.analysis.roi < 0) {
                                        console.warn(`[Codebase Crawler] 💰 Negative ROI fix: cost=$${costBenefit.analysis.fixCost.total.toFixed(2)}, benefit=$${costBenefit.analysis.benefit.total.toFixed(2)}`);
                                    }
                                } catch (err) {
                                    // Cost-benefit optional
                                }
                            }
                            
                            // SPRINT 20: Use helper for fix application (reduces nesting)
                            // ROUND 6: Enhanced validation with confidence scoring
                            // ENHANCED: Use calibrated confidence for decision making
                            const validationResult = await fixApplication.applyFixWithValidation(
                                { code: fixedCode, method: fixMethod, confidence: calibratedConfidence, type: issue.type, severity: issue.severity },
                                filePath,
                                code
                            );
                            
                            // DEBUG: Log validation results
                            if (this.stats.issuesAutoFixed <= 5) {
                                console.log(`[Codebase Crawler] 🔍 Validation: verified=${validationResult.verified}, applied=${validationResult.applied}, errors=${validationResult.errors?.length || 0}, method=${fixMethod}, confidence=${(finalConfidence * 100).toFixed(0)}%`);
                                if (validationResult.errors && validationResult.errors.length > 0) {
                                    console.log(`[Codebase Crawler] ⚠️  Validation errors: ${validationResult.errors.slice(0, 3).join(', ')}`);
                                }
                            }
                            
                            if (validationResult.errors.length > 0 && (this.stats.issuesAutoFixed <= 10 || isCriticalSecurity)) {
                                console.warn(`[Codebase Crawler] Fix validation failed: ${validationResult.errors.join(', ')}${isCriticalSecurity ? ' [SECURITY]' : ''}`);
                            }
                            
                            // ENHANCED: For critical security, use higher threshold but still attempt if confident enough
                            let shouldAutoApply;
                            if (isCriticalSecurity) {
                                const securityFixConfidenceBuilder = require('./securityFixConfidenceBuilder');
                                const minConfidence = securityFixConfidenceBuilder.getMinConfidenceForCritical();
                                
                                // Apply if confidence is high enough and validation passed
                                shouldAutoApply = finalConfidence >= minConfidence && 
                                                 (validationResult.verified || finalConfidence >= 0.85);
                                
                                if (shouldAutoApply) {
                                    console.log(`[Codebase Crawler] 🔒 Critical security fix approved (confidence: ${(finalConfidence * 100).toFixed(0)}% >= ${(minConfidence * 100).toFixed(0)}%)`);
                                }
                            } else {
                                // Use calibrated confidence for decision
                                shouldAutoApply = fixApplication.shouldAutoApply(
                                    { method: fixMethod, confidence: calibratedConfidence },
                                    validationResult
                                );
                                
                                // Consider impact prediction in decision
                                if (impactPrediction && impactPrediction.success) {
                                    if (impactPrediction.impact.riskLevel === 'high' && impactPrediction.impact.breakingChanges.length > 0) {
                                        // High risk with breaking changes - require higher confidence
                                        shouldAutoApply = shouldAutoApply && calibratedConfidence >= 0.9;
                                    }
                                }
                                
                                // Consider cost-benefit in decision
                                if (costBenefit && costBenefit.success) {
                                    if (costBenefit.analysis.roi < 0) {
                                        // Negative ROI - don't auto-apply
                                        shouldAutoApply = false;
                                    } else if (costBenefit.analysis.recommendation.action === 'fix_immediately') {
                                        // High ROI - more likely to apply
                                        shouldAutoApply = shouldAutoApply || calibratedConfidence >= 0.7;
                                    }
                                }
                                
                                // DEBUG: Log shouldAutoApply decision
                                if (this.stats.issuesAutoFixed <= 5) {
                                    console.log(`[Codebase Crawler] 🤔 shouldAutoApply: ${shouldAutoApply} (method: ${fixMethod}, confidence: ${(finalConfidence * 100).toFixed(0)}%)`);
                                }
                            }
                            
                            // ULTRA-AGGRESSIVE: Apply fixes even if validation has minor issues
                            // We have fallbacks and learning, so it's better to try than not
                            if (shouldAutoApply) {
                                // SPRINT 20: Use helper for fix application with learning
                                const applyResult = await fixApplication.applyFixWithLearning(
                                    { code: fixedCode, method: fixMethod, confidence: finalConfidence },
                                    issue,
                                    filePath,
                                    code
                                );
                                
                                // DEBUG: Log apply result
                                if (this.stats.issuesAutoFixed <= 5) {
                                    console.log(`[Codebase Crawler] 📝 Apply result: success=${applyResult.success}, applied=${applyResult.applied}, error=${applyResult.error || 'none'}, fallback=${applyResult.fallback || false}`);
                                }
                                
                                if (applyResult.success) {
                                    this.stats.issuesAutoFixed++;
                                    fileResult.autoFixed++;
                                    code = applyResult.code; // Update for next fix
                                    
                                    if (this.stats.issuesAutoFixed <= 20 || isCriticalSecurity) {
                                        const method = applyResult.fallback ? 'simple' : fixMethod;
                                        console.log(`[Codebase Crawler] ✅ Auto-fixed & validated (${method}, ${(finalConfidence * 100).toFixed(0)}%): ${filePath}:${issue.line} - ${issue.message.substring(0, 50)}${isCriticalSecurity ? ' [CRITICAL SECURITY FIXED]' : ''}`);
                                    }
                                    
                                    // ENHANCED: Record security fix result for confidence building
                                    if (isCriticalSecurity) {
                                        const securityFixConfidenceBuilder = require('./securityFixConfidenceBuilder');
                                        securityFixConfidenceBuilder.recordSecurityFixResult(issue, true, finalConfidence);
                                    }
                                    
                                    // SPRINT 20: Use helper to record successful fix
                                    await fixApplication.recordSuccessfulFix(
                                        issue,
                                        { code: fixedCode, method: fixMethod, confidence: calibratedConfidence },
                                        filePath,
                                        languageKnowledge,
                                        insights.issueDomain
                                    );
                                    
                                    // NEW: Record outcome for calibration (December 2025)
                                    if (fixConfidenceCalibrationService && applyResult.fixId) {
                                        try {
                                            await fixConfidenceCalibrationService.recordOutcome(
                                                applyResult.fixId,
                                                calibratedConfidence,
                                                true, // Success
                                                {
                                                    method: fixMethod,
                                                    domain: insights.issueDomain,
                                                    filePath,
                                                    issueType: issue.type
                                                }
                                            );
                                        } catch (err) {
                                            // Calibration recording optional
                                        }
                                    }
                                    
                                    // NEW: Start monitoring after successful fix (December 2025)
                                    if (fixMonitoringService && applyResult.fixId) {
                                        try {
                                            await fixMonitoringService.startMonitoring(
                                                applyResult.fixId,
                                                { code: fixedCode, method: fixMethod, confidence: calibratedConfidence },
                                                {
                                                    filePath,
                                                    originalCode: code,
                                                    fixedCode,
                                                    issue,
                                                    projectId: options.projectId
                                                }
                                            );
                                        } catch (err) {
                                            // Monitoring optional
                                        }
                                    }
                                    
                                    // NEW: Generate documentation for applied fix (December 2025)
                                    if (fixDocumentationGenerationService && applyResult.fixId) {
                                        try {
                                            const docs = await fixDocumentationGenerationService.generateDocumentation(
                                                { code: fixedCode, id: applyResult.fixId },
                                                {
                                                    issue,
                                                    filePath,
                                                    originalCode: code,
                                                    fixedCode,
                                                    method: fixMethod,
                                                    confidence: calibratedConfidence
                                                }
                                            );
                                            // Documentation generated, could be stored or logged
                                        } catch (err) {
                                            // Documentation optional
                                        }
                                    }
                                } else {
                                    // Learning cycle failed - try direct file write as fallback
                                    // ULTRA-AGGRESSIVE: Always try to apply the fix even if learning cycle fails
                                    try {
                                        await fs.writeFile(filePath, fixedCode, 'utf8');
                                        this.stats.issuesAutoFixed++;
                                        fileResult.autoFixed++;
                                        code = fixedCode;
                                        
                                        if (this.stats.issuesAutoFixed <= 20 || isCriticalSecurity) {
                                            console.log(`[Codebase Crawler] ✅ Direct fix applied (fallback after learning cycle failed): ${filePath}:${issue.line} - ${issue.message.substring(0, 50)}`);
                                        }
                                        
                                        // Record as successful even though learning cycle failed
                                        await fixApplication.recordSuccessfulFix(
                                            issue,
                                            { code: fixedCode, method: fixMethod, confidence: finalConfidence },
                                            filePath,
                                            languageKnowledge,
                                            insights.issueDomain
                                        );
                                        
                                        // Record security fix result
                                        if (isCriticalSecurity) {
                                            const securityFixConfidenceBuilder = require('./securityFixConfidenceBuilder');
                                            securityFixConfidenceBuilder.recordSecurityFixResult(issue, true, finalConfidence);
                                        }
                                    } catch (writeErr) {
                                        // All attempts failed
                                        if (isCriticalSecurity) {
                                            const securityFixConfidenceBuilder = require('./securityFixConfidenceBuilder');
                                            securityFixConfidenceBuilder.recordSecurityFixResult(issue, false, finalConfidence);
                                        }
                                        
                                        // ROUND 7: Calculate priority before adding to review queue
                                        let priority = { level: 'medium', score: 50 };
                                        if (issuePrioritizationService && typeof issuePrioritizationService.calculatePriority === 'function') {
                                            try {
                                                priority = issuePrioritizationService.calculatePriority(issue, {
                                                    filePath,
                                                    lineCount: issue.endLine ? issue.endLine - issue.line : 1,
                                                    fixConfidence: finalConfidence,
                                                    validationCycleFailed: true
                                                });
                                            } catch (err) {
                                                // Use default priority
                                            }
                                        }
                                        issue.priority = priority;
                                        
                                        this.stats.issuesNeedingReview++;
                                        fileResult.needsReview++;
                                        
                                        if (this.stats.issuesAutoFixed <= 10 || isCriticalSecurity) {
                                            console.log(`[Codebase Crawler] ⚠️  All fix attempts failed: ${writeErr.message}${isCriticalSecurity ? ' [SECURITY]' : ''}`);
                                        }
                                        
                                        // SPRINT 20: Use helper to record failed fix
                                        await fixApplication.recordFailedFix(
                                            issue,
                                            { code: fixedCode, method: fixMethod, confidence: finalConfidence },
                                            filePath,
                                            applyResult.error
                                        );
                                    }
                                }
                            } else {
                                // Fix validation failed or confidence too low
                                // ULTRA-AGGRESSIVE: Try to apply anyway if we have any fix at all
                                // Better to try than to leave issues unfixed
                                if (finalConfidence >= 0.25) {
                                    // Very low confidence but try it anyway
                                    try {
                                        const applyResult = await fixApplication.applyFixWithLearning(
                                            { code: fixedCode, method: fixMethod, confidence: finalConfidence },
                                            issue,
                                            filePath,
                                            code
                                        );
                                        
                                        if (applyResult.success) {
                                            this.stats.issuesAutoFixed++;
                                            fileResult.autoFixed++;
                                            code = applyResult.code;
                                            
                                            if (this.stats.issuesAutoFixed <= 20) {
                                                console.log(`[Codebase Crawler] ✅ Low-confidence fix applied (${(finalConfidence * 100).toFixed(0)}%): ${filePath}:${issue.line} - ${issue.message.substring(0, 50)}`);
                                            }
                                            
                                            await fixApplication.recordSuccessfulFix(
                                                issue,
                                                { code: fixedCode, method: fixMethod, confidence: finalConfidence },
                                                filePath,
                                                languageKnowledge,
                                                insights.issueDomain
                                            );
                                        } else {
                                            // Learning cycle failed, try direct write
                                            try {
                                                await fs.writeFile(filePath, fixedCode, 'utf8');
                                                this.stats.issuesAutoFixed++;
                                                fileResult.autoFixed++;
                                                code = fixedCode;
                                                
                                                if (this.stats.issuesAutoFixed <= 20) {
                                                    console.log(`[Codebase Crawler] ✅ Direct fix applied (low confidence, ${(finalConfidence * 100).toFixed(0)}%): ${filePath}:${issue.line}`);
                                                }
                                                
                                                await fixApplication.recordSuccessfulFix(
                                                    issue,
                                                    { code: fixedCode, method: fixMethod, confidence: finalConfidence },
                                                    filePath,
                                                    languageKnowledge,
                                                    insights.issueDomain
                                                );
                                            } catch (writeErr) {
                                                // All attempts failed - mark for review
                                                const priority = issuePrioritizationService.calculatePriority(issue, {
                                                    filePath,
                                                    lineCount: issue.endLine ? issue.endLine - issue.line : 1,
                                                    fixConfidence,
                                                    validationFailed: true
                                                });
                                                issue.priority = priority;
                                                
                                                this.stats.issuesNeedingReview++;
                                                fileResult.needsReview++;
                                                
                                                await fixApplication.recordFailedFix(
                                                    issue,
                                                    { code: fixedCode, method: fixMethod, confidence: fixConfidence },
                                                    filePath,
                                                    `All fix attempts failed: ${writeErr.message}`
                                                );
                                            }
                                        }
                                    } catch (err) {
                                        // Try direct write as last resort
                                        try {
                                            await fs.writeFile(filePath, fixedCode, 'utf8');
                                            this.stats.issuesAutoFixed++;
                                            fileResult.autoFixed++;
                                            code = fixedCode;
                                            
                                            if (this.stats.issuesAutoFixed <= 20) {
                                                console.log(`[Codebase Crawler] ✅ Direct fix applied (error fallback): ${filePath}:${issue.line}`);
                                            }
                                            
                                            await fixApplication.recordSuccessfulFix(
                                                issue,
                                                { code: fixedCode, method: fixMethod, confidence: finalConfidence },
                                                filePath,
                                                languageKnowledge,
                                                insights.issueDomain
                                            );
                                        } catch (writeErr) {
                                            // All attempts failed - mark for review
                                            const priority = issuePrioritizationService.calculatePriority(issue, {
                                                filePath,
                                                lineCount: issue.endLine ? issue.endLine - issue.line : 1,
                                                fixConfidence,
                                                validationFailed: true
                                            });
                                            issue.priority = priority;
                                            
                                            this.stats.issuesNeedingReview++;
                                            fileResult.needsReview++;
                                            
                                            await fixApplication.recordFailedFix(
                                                issue,
                                                { code: fixedCode, method: fixMethod, confidence: fixConfidence },
                                                filePath,
                                                `All fix attempts failed: ${writeErr.message}`
                                            );
                                        }
                                    }
                                } else {
                                    // Confidence too low - mark for review
                                    let priority = { level: 'medium', score: 50 };
                                    if (issuePrioritizationService && typeof issuePrioritizationService.calculatePriority === 'function') {
                                        try {
                                            priority = issuePrioritizationService.calculatePriority(issue, {
                                                filePath,
                                                lineCount: issue.endLine ? issue.endLine - issue.line : 1,
                                                fixConfidence,
                                                validationFailed: true
                                            });
                                        } catch (err) {
                                            // Use default priority
                                        }
                                    }
                                    issue.priority = priority;
                                    
                                    if (this.stats.issuesAutoFixed <= 10) {
                                        console.log(`[Codebase Crawler] ⚠️  Fix not applied (${fixMethod}, ${(fixConfidence * 100).toFixed(0)}% conf, verified: ${validationResult.verified}, shouldApply: ${shouldAutoApply}, priority: ${priority.level}): ${filePath}:${issue.line} - ${issue.message.substring(0, 50)}`);
                                    }
                                    
                                    this.stats.issuesNeedingReview++;
                                    fileResult.needsReview++;
                                    
                                    await fixApplication.recordFailedFix(
                                        issue,
                                        { code: fixedCode, method: fixMethod, confidence: fixConfidence },
                                        filePath,
                                        `Validation failed or low confidence (${(fixConfidence * 100).toFixed(0)}%, verified: ${validationResult.verified}, shouldApply: ${shouldAutoApply})`
                                    );
                                }
                            }
                            } catch (legacyFixErr) {
                                // Legacy fix flow error - log and continue
                                console.warn(`[Codebase Crawler] Legacy fix flow error: ${filePath}:${issue.line}:`, legacyFixErr.message);
                            } // End of try block for legacy fix flow
                        } // End of if (!orchestrationUsed)
                    } catch (fixErr) {
                            console.warn(`[Codebase Crawler] Failed to auto-fix ${filePath}:${issue.line}:`, fixErr.message);
                            // Mark for review if auto-fix fails
                            // ROUND 7: Calculate priority before adding to review queue
                            let priority = { level: 'medium', score: 50 };
                            if (issuePrioritizationService && typeof issuePrioritizationService.calculatePriority === 'function') {
                                try {
                                    priority = issuePrioritizationService.calculatePriority(issue, {
                                        filePath,
                                        lineCount: issue.endLine ? issue.endLine - issue.line : 1,
                                        fixError: fixErr.message
                                    });
                                } catch (err) {
                                    // Use default priority
                                }
                            }
                            issue.priority = priority;
                            
                            this.stats.issuesNeedingReview++;
                            fileResult.needsReview++;
                            
                            // SPRINT 20: Use helper to record failed fix
                            await fixApplication.recordFailedFix(issue, null, filePath, fixErr.message);
                        }
                    } else {
                        // Issue that can't be auto-fixed - try extreme issue router anyway
                        // ENHANCED: Even "can't auto-fix" issues get routed to specialized agents
                        const extremeIssueRouter = require('./extremeIssueRouter');
                        const extremeResult = await extremeIssueRouter.routeExtremeIssue(
                            issue,
                            code,
                            filePath,
                            { insights, languageKnowledge, cannotAutoFix: true }
                        );
                        
                        if (extremeResult && extremeResult.success) {
                            // Extreme issue router succeeded!
                            const applyResult = await fixApplication.applyFixWithLearning(
                                { code: extremeResult.fixedCode, method: extremeResult.agent, confidence: extremeResult.confidence || 0.7 },
                                issue,
                                filePath,
                                code
                            );
                            
                            if (applyResult.success) {
                                this.stats.issuesAutoFixed++;
                                fileResult.autoFixed++;
                                code = applyResult.code;
                                
                                console.log(`[Codebase Crawler] 🚀 Extreme issue fixed by ${extremeResult.agent} (confidence: ${((extremeResult.confidence || 0.7) * 100).toFixed(0)}%): ${filePath}:${issue.line}`);
                                
                                await fixApplication.recordSuccessfulFix(
                                    issue,
                                    { code: extremeResult.fixedCode, method: extremeResult.agent, confidence: extremeResult.confidence || 0.7 },
                                    filePath,
                                    languageKnowledge,
                                    insights.issueDomain
                                );
                                continue;
                            }
                        }
                        
                        // ROUND 7: Calculate priority - these are usually high priority
                        let priority = { level: 'high', score: 75 };
                        if (issuePrioritizationService && typeof issuePrioritizationService.calculatePriority === 'function') {
                            try {
                                priority = issuePrioritizationService.calculatePriority(issue, {
                                    filePath,
                                    lineCount: issue.endLine ? issue.endLine - issue.line : 1,
                                    cannotAutoFix: true,
                                    extremeRouterAttempted: true,
                                    extremeRouterFailed: !extremeResult || !extremeResult.success
                                });
                            } catch (err) {
                                // Use default priority
                            }
                        }
                        issue.priority = priority;
                        issue.extremeRouterAttempted = true;
                        
                        this.stats.issuesNeedingReview++;
                        fileResult.needsReview++;
                    }

                    fileResult.issues.push(issue);
                    }
                } // End of individual processing (if multi-agent teams not used)

                this.scanResults.push(fileResult);
            }
            
            // PHASE 3: Update cache after analysis
            if (skipUnchanged) {
                const fileHash = await this.calculateFileHash(filePath, code);
                const stats = await fs.stat(filePath);
                const issueCount = issues?.length || 0;
                await this.updateFileCache(filePath, fileHash, issueCount, stats.mtime.toISOString());
            }
        } catch (err) {
            this.stats.errors++;
            console.error(`[Codebase Crawler] Error analyzing ${filePath}:`, err.message);
        }
    }

    /**
     * Apply a fix to code and return the fixed code
     */
    async applyFixToCode(issue, code, filePath) {
        const lines = code.split('\n');
        const lineIndex = (issue.line || 1) - 1;
        
        if (lineIndex < 0 || lineIndex >= lines.length) {
            return null;
        }
        
        const originalLine = lines[lineIndex];
        let fixedLine = originalLine;
        let codeChanged = false;

        // Handle line length issues
        if ((issue.type === 'style' || issue.message?.toLowerCase().includes('line length') || issue.message?.toLowerCase().includes('exceeds')) &&
            issue.message && (issue.message.includes('exceeds 120 characters') || issue.message.includes('line length'))) {
            if (originalLine.length > 120) {
                // Find a good break point (prefer breaking after operators, commas, etc.)
                const breakPoints = [
                    originalLine.lastIndexOf(',', 100),
                    originalLine.lastIndexOf(' && ', 100),
                    originalLine.lastIndexOf(' || ', 100),
                    originalLine.lastIndexOf(' = ', 100),
                    originalLine.lastIndexOf(' ', 100),
                    originalLine.lastIndexOf('(', 100),
                    originalLine.lastIndexOf('.', 100)
                ].filter(pos => pos > 50 && pos < 110);

                if (breakPoints.length > 0) {
                    const breakPos = Math.max(...breakPoints);
                    const indent = originalLine.match(/^\s*/)[0];
                    const firstPart = originalLine.substring(0, breakPos + 1);
                    const secondPart = originalLine.substring(breakPos + 1).trim();
                    
                    // Only break if it makes sense
                    if (secondPart.length > 0 && firstPart.trim().length > 0) {
                        fixedLine = `${firstPart}\n${indent}    ${secondPart}`;
                        codeChanged = true;
                    }
                } else {
                    // No good break point found, try breaking at 100 chars anyway
                    const indent = originalLine.match(/^\s*/)[0];
                    const firstPart = originalLine.substring(0, 100);
                    const secondPart = originalLine.substring(100).trim();
                    if (secondPart.length > 0) {
                        fixedLine = `${firstPart}\n${indent}    ${secondPart}`;
                        codeChanged = true;
                    }
                }
            }
        }

        // Handle console.log removal
        if ((issue.type === 'style' || issue.message?.toLowerCase().includes('console')) && 
            issue.message && (issue.message.includes('console.log') || issue.message.toLowerCase().
                includes('console'))) {
            const before = fixedLine;
            fixedLine = fixedLine.replace(/console\.log\([^)]*\);?\s*/g, '');
            fixedLine = fixedLine.replace(/console\.(warn|error|debug|info)\([^)]*\);?\s*/g, '');
            // If line becomes empty, remove it
            if (fixedLine.trim().length === 0) {
                lines.splice(lineIndex, 1);
                return lines.join('\n');
            }
            if (fixedLine !== before) {
                codeChanged = true;
            }
        }

        // Handle unused variables
        if (issue.message && (issue.message.includes('unused') || issue.message.includes('defined but never used'))) {
            // Try to remove the unused variable declaration
            const unusedMatch = fixedLine.match(/(const|let|var)\s+(\w+)\s*=/);
            if (unusedMatch && !fixedLine.includes('//')) {
                // Comment out instead of removing (safer)
                fixedLine = `// ${fixedLine}`;
                codeChanged = true;
            }
        }

        // Handle missing semicolons
        if (issue.message && issue.message.includes('missing semicolon')) {
            if (!fixedLine.trim().endsWith(';') && !fixedLine.trim().endsWith('{') && !fixedLine.trim().endsWith('}')) {
                fixedLine = fixedLine.trim() + ';';
                codeChanged = true;
            }
        }

        // Handle trailing whitespace
        if (issue.message && (issue.message.includes('trailing') || issue.message.includes('whitespace'))) {
            const trimmed = fixedLine.replace(/\s+$/, '');
            if (trimmed !== fixedLine) {
                fixedLine = trimmed;
                codeChanged = true;
            }
        }

        // Only return fixed code if it changed
        if (codeChanged && fixedLine !== originalLine) {
            // Handle const declarations properly - if we're modifying a const line,
            // we need to ensure the fix doesn't break the const declaration
            if (originalLine.trim().startsWith('const ') && fixedLine.includes('\n')) {
                // Multi-line fix for const - ensure const is on first line
                const constMatch = originalLine.match(/^(\s*)(const\s+\w+\s*=\s*)(.*)/);
                if (constMatch) {
                    const [, indent, constDecl, value] = constMatch;
                    // If the fix broke the line, reconstruct it properly
                    if (!fixedLine.trim().startsWith('const')) {
                        // Reconstruct: const declaration on first line, value on second
                        const fixedLines = fixedLine.split('\n');
                        const firstLine = fixedLines[0];
                        const rest = fixedLines.slice(1).join('\n');
                        fixedLine = `${indent}${constDecl}${firstLine.replace(/^\s*/, '')}\n${rest}`;
                    }
                }
            }
            
            // For multi-line fixes, use splice to replace the line properly
            if (fixedLine.includes('\n')) {
                const fixedLines = fixedLine.split('\n');
                lines.splice(lineIndex, 1, ...fixedLines);
            } else {
                lines[lineIndex] = fixedLine;
            }
            return lines.join('\n');
        }

        return null;
    }

    /**
     * Apply LLM-generated fix to code
     */
    async applyLLMFix(issue, code, filePath, llmFix) {
        try {
            const fixedCode = llmFix.fixedCode;
            
            if (!fixedCode) {
                return null;
            }

            // If the fix is the entire file, use it directly
            if (fixedCode.split('\n').length > code.split('\n').length * 0.5) {
                // Fix is more than 50% of the file, likely a full replacement
                return fixedCode;
            }

            // Otherwise, try to apply the fix to the specific line/region
            const lines = code.split('\n');
            const lineIndex = (issue.line || 1) - 1;
            
            if (lineIndex < 0 || lineIndex >= lines.length) {
                // If line is out of bounds, try to find the pattern in the code
                if (fixedCode.includes('\n')) {
                    // Multi-line fix - try to find where it should go
                    const fixedLines = fixedCode.split('\n');
                    const firstFixedLine = fixedLines[0].trim();
                    
                    // Find matching line in code
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].trim().includes(firstFixedLine.substring(0, 20))) {
                            // Replace from this line
                            lines.splice(i, 1, ...fixedLines);
                            return lines.join('\n');
                        }
                    }
                }
                return null;
            }

            const originalLine = lines[lineIndex];

            // Handle const declarations properly
            if (originalLine.trim().startsWith('const ') && fixedCode.includes('const')) {
                // Preserve const declaration structure
                const constMatch = originalLine.match(/^(\s*)(const\s+\w+\s*=\s*)(.*)/);
                if (constMatch) {
                    const [, indent, constDecl] = constMatch;
                    // If fix includes const, ensure it matches the original structure
                    if (fixedCode.trim().startsWith('const')) {
                        // Fix already has const, use it but preserve indentation
                        const fixedLines = fixedCode.split('\n');
                        fixedLines[0] = indent + fixedLines[0].trim();
                        lines.splice(lineIndex, 1, ...fixedLines);
                        return lines.join('\n');
                    }
                }
            }

            // If fix is a complete replacement for the line
            if (fixedCode.includes('\n')) {
                // Multi-line fix - replace the line(s)
                const fixedLines = fixedCode.split('\n');
                // Preserve indentation of first line
                const indent = originalLine.match(/^\s*/)[0];
                if (fixedLines[0] && !fixedLines[0].match(/^\s/)) {
                    fixedLines[0] = indent + fixedLines[0];
                }
                lines.splice(lineIndex, 1, ...fixedLines);
                return lines.join('\n');
            } else {
                // Single-line fix - replace the line, preserve indentation
                const indent = originalLine.match(/^\s*/)[0];
                const fixedLine = fixedCode.trim().startsWith(indent) ? fixedCode : indent + fixedCode.trim();
                lines[lineIndex] = fixedLine;
                return lines.join('\n');
            }
        } catch (err) {
            console.error(`[Codebase Crawler] Error applying LLM fix:`, err);
            return null;
        }
    }

    /**
     * Validate fix before applying
     */
    async validateFix(fixedCode, filePath) {
        try {
            // Basic syntax validation
            // Check for balanced braces, parentheses, brackets
            const openBraces = (fixedCode.match(/\{/g) || []).length;
            const closeBraces = (fixedCode.match(/\}/g) || []).length;
            const openParens = (fixedCode.match(/\(/g) || []).length;
            const closeParens = (fixedCode.match(/\)/g) || []).length;
            const openBrackets = (fixedCode.match(/\[/g) || []).length;
            const closeBrackets = (fixedCode.match(/\]/g) || []).length;

            if (openBraces !== closeBraces || openParens !== closeParens || openBrackets !== closeBrackets) {
                console.warn(`[Codebase Crawler] Fix validation failed: unbalanced brackets/parens/braces`);
                return false;
            }

            // Check for dangerous patterns
            const dangerousPatterns = [
                /eval\s*\(/i,
                /Function\s*\(/i,
                /\.innerHTML\s*=/i,
                /document\.write/i
            ];

            for (const pattern of dangerousPatterns) {
                if (pattern.test(fixedCode)) {
                    console.warn(`[Codebase Crawler] Fix validation failed: dangerous pattern detected`);
                    return false;
                }
            }

            return true;
        } catch (err) {
            console.warn(`[Codebase Crawler] Fix validation error:`, err.message);
            return false; // Fail safe
        }
    }

    /**
     * Determine if an issue needs human review
     */
    issueNeedsReview(issue) {
        const severity = issue.severity || 'medium';
        const safety = issue.safety || 'medium';

        // Always review critical/high severity or risky/medium safety issues
        if (severity === 'critical' || severity === 'high') {
            return true;
        }

        if (safety === 'risky' || safety === 'medium') {
            return true;
        }

        // Low severity + safe = can auto-fix
        return false;
    }

    /**
     * Get current crawl status
     */
    async getStatus() {
        // If crawler is not running and stats are empty, try to load persisted stats
        if (!this.isRunning && this.stats.filesScanned === 0) {
            await this.loadStats();
        }
        
        // Ensure stats are never null
        const stats = {
            filesScanned: this.stats.filesScanned || 0,
            filesSkipped: this.stats.filesSkipped || 0, // PHASE 3: Cached files skipped
            filesWithIssues: this.stats.filesWithIssues || 0,
            issuesFound: this.stats.issuesFound || 0,
            issuesAutoFixed: this.stats.issuesAutoFixed || 0,
            issuesNeedingReview: this.stats.issuesNeedingReview || 0,
            errors: this.stats.errors || 0,
            startTime: this.stats.startTime,
            endTime: this.stats.endTime
        };

        return {
            success: true,
            isRunning: this.isRunning,
            stats: stats,
            progress: this.isRunning && this.stats.filesScanned > 0
                ? {
                    filesScanned: this.stats.filesScanned,
                    estimatedTotal: null, // Could be calculated if we pre-scan
                    percentage: null
                }
                : null
        };
    }

    /**
     * PHASE 2 OPTIMIZATION: Match code against known patterns
     * ENHANCEMENT: Batch pattern matching for better performance
     */
    matchPatterns(code, filePath, patterns) {
        const matches = [];
        
        // ENHANCEMENT: Pre-compile all regex patterns for batch matching
        const compiledPatterns = [];
        for (const pattern of patterns) {
            try {
                const errorPattern = pattern.error_pattern;
                if (!errorPattern || !errorPattern.pattern) continue;
                
                const regex = new RegExp(errorPattern.pattern, errorPattern.flags || 'g');
                compiledPatterns.push({
                    pattern,
                    regex,
                    errorPattern
                });
            } catch (err) {
                // Invalid regex, skip
                continue;
            }
        }
        
        // ENHANCEMENT: Batch match all patterns at once
        for (const compiled of compiledPatterns) {
            try {
                const matchesInCode = code.match(compiled.regex);
                
                if (matchesInCode && matchesInCode.length > 0) {
                    matches.push({
                        pattern: compiled.pattern,
                        matches: matchesInCode,
                        confidence: Math.min(0.9, 0.6 + (compiled.pattern.occurrence_count / 100) * 
                            0.3), // Higher confidence for frequent patterns
                        fix: compiled.pattern.best_fix
                    });
                }
            } catch (err) {
                // Match failed, skip
                continue;
            }
        }
        
        // Sort by confidence (highest first) for better fix selection
        matches.sort((a, b) => b.confidence - a.confidence);
        
        return matches;
    }

    /**
     * PHASE 2 OPTIMIZATION: Apply pattern fix to code
     */
    applyPatternFix(code, match) {
        if (!match || !match.pattern) {
            return code;
        }
        
        try {
            const fix = match.fix || match.pattern.best_fix;
            if (!fix) {
                return code;
            }
            
            // Handle different fix formats
            let replacement = null;
            if (typeof fix === 'string') {
                // Simple string replacement format: "before → after"
                if (fix.includes('→')) {
                    const parts = fix.split('→').map(s => s.trim());
                    if (parts.length === 2) {
                        replacement = parts[1];
                        const beforePattern = parts[0];
                        // Try to find and replace
                        if (code.includes(beforePattern)) {
                            return code.replace(beforePattern, replacement);
                        }
                    }
                } else {
                    // Assume it's a replacement string
                    replacement = fix;
                }
            } else if (fix.replacement) {
                // Object format with replacement property
                replacement = fix.replacement;
            }
            
            if (!replacement) {
                return code;
            }
            
            // Try to apply the fix using the pattern
            const errorPattern = match.pattern.error_pattern;
            if (errorPattern && errorPattern.pattern) {
                const regex = new RegExp(errorPattern.pattern, errorPattern.flags || 'g');
                return code.replace(regex, replacement);
            }
            
            // Fallback: try simple string replacement
            if (typeof fix === 'string' && code.includes(fix.split('→')[0]?.trim())) {
                const before = fix.split('→')[0].trim();
                return code.replace(before, replacement);
            }
            
            return code;
        } catch (err) {
            console.warn(`[Codebase Crawler] Failed to apply pattern fix: ${err.message}`);
            return code;
        }
    }
}

module.exports = new CodebaseCrawler();

