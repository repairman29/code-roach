/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codebaseWatcher.js
 * Last Sync: 2025-12-20T22:26:03.320Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Codebase Watcher Service
 * Monitors file changes and automatically re-indexes updated files
 */

const fs = require('fs').promises;
const path = require('path');
const codebaseIndexer = require('./codebaseIndexer');

// Log to console and file for resilience/review
const LOG_PATH = process.env.CODEBASE_WATCHER_LOG || '/tmp/codebase-watcher.log';
const writeLog = (level, args) => {
    const line = `[${new Date().toISOString()}] [WATCHER ${level}] ${args.join(' ')}\n`;
    fs.appendFile(LOG_PATH, line).catch(() => {});
};
const log = {
    info: (...args) => {
        console.log('[WATCHER]', ...args);
        writeLog('INFO', args);
    },
    error: (...args) => {
        console.error('[WATCHER ERROR]', ...args);
        writeLog('ERROR', args);
    },
    warn: (...args) => {
        console.warn('[WATCHER WARN]', ...args);
        writeLog('WARN', args);
    }
};

class CodebaseWatcher {
    constructor(options = {}) {
        this.rootPath = options.rootPath || process.cwd();
        this.watchPaths = options.watchPaths || ['server', 'public', 'docs', 'scripts'];
        this.debounceMs = options.debounceMs || 2000; // Wait 2s after last change before reindexing
        this.isWatching = false;
        this.pendingFiles = new Set();
        this.debounceTimer = null;
        this.watchers = new Map();
        this.indexedFiles = new Map(); // Track file modification times
        this.onFileChange = options.onFileChange || null; // Callback for file changes
        this.detectIssues = options.detectIssues !== false; // Auto-detect issues by default
    }

    /**
     * Start watching for file changes
     */
    async start() {
        if (this.isWatching) {
            log.warn('Watcher is already running');
            return;
        }

        log.info('Starting codebase watcher...');
        log.info(`Watching paths: ${this.watchPaths.join(', ')}`);
        
        // Load current file modification times
        await this.loadIndexedFiles();

        // Start watching each path
        for (const watchPath of this.watchPaths) {
            const fullPath = path.join(this.rootPath, watchPath);
            try {
                await fs.access(fullPath);
                this.watchDirectory(fullPath, watchPath);
            } catch (error) {
                log.warn(`Path not found, skipping: ${watchPath}`);
            }
        }

        this.isWatching = true;
        log.info('✅ Watcher started. Monitoring for file changes...');
    }

    /**
     * Stop watching
     */
    stop() {
        if (!this.isWatching) {
            return;
        }

        log.info('Stopping watcher...');
        
        // Close all watchers
        for (const [path, watcher] of this.watchers) {
            watcher.close();
        }
        this.watchers.clear();

        // Clear debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        this.isWatching = false;
        log.info('✅ Watcher stopped');
    }

    /**
     * Watch a directory recursively
     */
    watchDirectory(dirPath, relativePath) {
        // Use Node's fs.watch (works on all platforms)
        const fsSync = require('fs');
        const watcher = fsSync.watch(dirPath, { recursive: true }, async (eventType, filename) => {
            if (!filename) return;

            const fullPath = path.join(dirPath, filename);
            const relativeFilePath = path.join(relativePath, filename).replace(/\\/g, '/');

            // Check if file should be indexed
            if (!this.shouldIndexFile(relativeFilePath)) {
                return;
            }

            // Handle file changes
            if (eventType === 'change' || eventType === 'rename') {
                try {
                    const stats = await fs.stat(fullPath).catch(() => null);
                    if (stats && stats.isFile()) {
                        this.handleFileChange(relativeFilePath, stats.mtimeMs);
                    }
                } catch (error) {
                    // File might have been deleted, ignore
                }
            }
        });

        this.watchers.set(dirPath, watcher);
        log.info(`Watching: ${relativePath}`);
    }

    /**
     * Check if file should be indexed
     */
    shouldIndexFile(filePath) {
        // Use same exclusion patterns as indexer
        const excludePatterns = [
            /node_modules/, /\.git/, /coverage/, /\.next/, /dist/, /build/, /\.cache/,
            /playwright-report/, /\.env/, /package-lock\.json/, /yarn\.lock/, /\.log$/,
            /\.tmp$/, /\.DS_Store$/, /\.swp$/, /\.swo$/, /archive/, /bug-reports/,
            /bot-learning/, /test-results/, /logs/, /\.xss-fix-backups/
        ];

        for (const pattern of excludePatterns) {
            if (pattern.test(filePath)) {
                return false;
            }
        }

        // Check extension
        const ext = path.extname(filePath);
        const includeExtensions = [
            '.js', '.ts', '.jsx', '.tsx', '.md', '.mdx', '.sql', '.json', '.html', '.css',
            '.py', '.java', '.go', '.rs'
        ];

        return includeExtensions.includes(ext);
    }

    /**
     * Handle file change with debouncing
     */
    handleFileChange(filePath, mtimeMs) {
        // Check if file actually changed
        const lastIndexed = this.indexedFiles.get(filePath);
        if (lastIndexed && lastIndexed >= mtimeMs) {
            return; // File hasn't changed since last index
        }

        // Add to pending files
        this.pendingFiles.add(filePath);

        // Clear existing debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Set new debounce timer
        this.debounceTimer = setTimeout(() => {
            this.processPendingFiles();
        }, this.debounceMs);
    }

    /**
     * Process all pending file changes
     */
    async processPendingFiles() {
        if (this.pendingFiles.size === 0) {
            return;
        }

        const filesToReindex = Array.from(this.pendingFiles);
        this.pendingFiles.clear();

        log.info(`Re-indexing ${filesToReindex.length} changed file(s)...`);

        for (const filePath of filesToReindex) {
            try {
                const fullPath = path.join(this.rootPath, filePath);
                const stats = await fs.stat(fullPath).catch(() => null);
                
                if (!stats) {
                    // File was deleted, remove from index
                    log.info(`File deleted, removing from index: ${filePath}`);
                    if (!config.supabase?.serviceRoleKey) {
                        log.warn('Supabase not configured, cannot remove from index');
                        continue;
                    }
                    const { createClient } = require('@supabase/supabase-js');
                    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
                    await supabase
                        .from('codebase_index')
                        .delete()
                        .eq('file_path', filePath);
                    this.indexedFiles.delete(filePath);
                    continue;
                }

                // Re-index file
                log.info(`Re-indexing: ${filePath}`);
                const result = await codebaseIndexer.reindexFile(filePath);
                
                if (result && result.chunks.length > 0) {
                    this.indexedFiles.set(filePath, stats.mtimeMs);
                    log.info(`✅ Re-indexed: ${filePath} (${result.chunks.length} chunks)`);
                } else {
                    log.warn(`⚠️  No chunks indexed for: ${filePath}`);
                }
                
                // Call custom callback if provided
                if (this.onFileChange) {
                    try {
                        await this.onFileChange(fullPath);
                    } catch (err) {
                        log.warn(`Error in onFileChange callback for ${filePath}:`, err.message);
                    }
                }
                
                // Auto-detect issues if enabled
                if (this.detectIssues && (filePath.endsWith('.js') || filePath.endsWith('.ts'))) {
                    try {
                        const codeReviewAssistant = require('./codeReviewAssistant');
                        const code = await fs.readFile(fullPath, 'utf8');
                        const review = await codeReviewAssistant.reviewCode(code, filePath);
                        
                        if (review && review.issues && review.issues.length > 0) {
                            log.info(`🔍 Detected ${review.issues.length} issue(s) in ${filePath}`);
                        }
                    } catch (err) {
                        // Silent fail - don't spam logs
                    }
                }
            } catch (error) {
                log.error(`Failed to re-index ${filePath}:`, error.message);
            }
        }

        log.info(`✅ Finished re-indexing ${filesToReindex.length} file(s)`);
    }

    /**
     * Load current indexed files and their modification times
     */
    async loadIndexedFiles() {
        try {
            if (!config.supabase?.serviceRoleKey) {
                log.warn('Supabase not configured, cannot load indexed files');
                return;
            }
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
            
            const { data: chunks } = await supabase
                .from('codebase_index')
                .select('file_path, updated_at')
                .limit(10000);

            if (chunks) {
                const fileMap = new Map();
                for (const chunk of chunks) {
                    const existing = fileMap.get(chunk.file_path);
                    const updated = new Date(chunk.updated_at).getTime();
                    
                    if (!existing || updated > existing) {
                        fileMap.set(chunk.file_path, updated);
                    }
                }

                // Get actual file modification times
                for (const [filePath] of fileMap) {
                    try {
                        const fullPath = path.join(this.rootPath, filePath);
                        const stats = await fs.stat(fullPath).catch(() => null);
                        if (stats) {
                            this.indexedFiles.set(filePath, stats.mtimeMs);
                        }
                    } catch (error) {
                        // File might not exist, ignore
                    }
                }

                log.info(`Loaded ${this.indexedFiles.size} indexed files`);
            }
        } catch (error) {
            log.warn('Could not load indexed files:', error.message);
        }
    }

    /**
     * Check for changed files and re-index them (for scheduled jobs)
     */
    async checkForChanges() {
        log.info('Checking for changed files...');
        
        try {
            if (!config.supabase?.serviceRoleKey) {
                log.warn('Supabase not configured, cannot check for changes');
                return;
            }
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
            
            // Get all indexed files
            const { data: chunks } = await supabase
                .from('codebase_index')
                .select('file_path')
                .limit(10000);

            if (!chunks) {
                return;
            }

            const uniqueFiles = new Set(chunks.map(c => c.file_path));
            const changedFiles = [];

            for (const filePath of uniqueFiles) {
                try {
                    const fullPath = path.join(this.rootPath, filePath);
                    const stats = await fs.stat(fullPath);
                    
                    const lastIndexed = this.indexedFiles.get(filePath);
                    if (!lastIndexed || stats.mtimeMs > lastIndexed) {
                        changedFiles.push(filePath);
                    }
                } catch (error) {
                    // File might have been deleted
                    changedFiles.push(filePath);
                }
            }

            if (changedFiles.length > 0) {
                log.info(`Found ${changedFiles.length} changed file(s)`);
                for (const filePath of changedFiles) {
                    this.pendingFiles.add(filePath);
                }
                await this.processPendingFiles();
            } else {
                log.info('No changes detected');
            }
        } catch (error) {
            log.error('Error checking for changes:', error.message);
        }
    }
}

module.exports = CodebaseWatcher;

