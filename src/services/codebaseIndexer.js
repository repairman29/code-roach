/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codebaseIndexer.js
 * Last Sync: 2025-12-25T05:17:15.748Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/* eslint-disable no-undef */
/**
 * Codebase Indexing Service
 * Scans, parses, and indexes all codebase files for semantic search
 */

const fs = require("fs").promises;
const path = require("path");
const config = require("../config");
const { createLogger } = require("../utils/logger");

const log = createLogger("CodebaseIndexer");

const agentSessionService = require("./agentSessionService");
const performanceTrackingService = require("./performanceTrackingService");

class CodebaseIndexer {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[codebaseIndexer] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[codebaseIndexer] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }

    this.excludePatterns = [
      /node_modules/,
      /\.git/,
      /coverage/,
      /\.next/,
      /dist/,
      /build/,
      /\.cache/,
      /playwright-report/,
      /archive/, // Exclude archive directories
      /bug-reports/, // Exclude bug reports
      /\.xss-fix-backups/, // Exclude backup directories
      /\.env/,
      /package-lock\.json/,
      /yarn\.lock/,
      /\.log$/,
      /\.tmp$/,
      /\.DS_Store$/,
      /\.swp$/,
      /\.swo$/,
      /bot-learning/, // Exclude bot learning data
      /test-results/, // Exclude test results
      /logs/, // Exclude log files
      /data\/bot-learning/, // Exclude bot learning data
      /bot-feedback-results/, // Exclude feedback results
      /bot-survey-results/, // Exclude survey results
      /expert-survey-results/, // Exclude expert results
      /gamer-research-results/, // Exclude research results
      /user-survey-results/, // Exclude user survey results
      /code-reviewer-results/, // Exclude reviewer results
      /design-ux-analysis/, // Exclude analysis results
      /documentation-lead-results/, // Exclude documentation results
      /integration-specialist-results/, // Exclude integration results
      /performance-engineer-results/, // Exclude performance results
      /product-manager-results/, // Exclude product manager results
      /qa-lead-results/, // Exclude QA results
      /release-manager-results/, // Exclude release manager results
      /security-audit-results/, // Exclude security results
      /security-lead-results/, // Exclude security lead results
      /technical-lead-results/, // Exclude technical lead results
      /accessibility-lead-results/, // Exclude accessibility results
      /ai-gm-test-results/, // Exclude AI GM test results
      /pixel-solo-mode-experience/, // Exclude solo mode experience
      /demo-video-output/, // Exclude demo videos
      /ui-visualizations/, // Exclude UI visualizations
      /landing-page-evaluation/, // Exclude landing page evaluation
      // Additional optimizations for faster indexing
      /applied-fixes/, // Exclude temporary fix results (major time saver)
      /temp-results/, // Exclude temporary results
      /\.cursor/, // Exclude Cursor IDE files
      /\.vscode\/settings\.json/, // Exclude VS Code settings (keep extension code)
      /\.vscode\/extensions\.json/, // Exclude VS Code extensions list
      /documentation-index\.json/, // Exclude large generated index files
      /\.min\.js$/, // Exclude minified files
      /\.min\.css$/, // Exclude minified CSS
      /vgreenwood/, // Exclude vgreenwood directories
      /\.bundle/, // Exclude bundle directories
      /\.parcel-cache/, // Exclude Parcel cache
      /\.turbo/, // Exclude Turbo cache
      /\.vercel/, // Exclude Vercel cache
      /\.railway/, // Exclude Railway files
      /\.github\/workflows/, // Exclude GitHub workflow files (not code)
      /\.github\/ISSUE_TEMPLATE/, // Exclude GitHub templates
      /\.github\/PULL_REQUEST_TEMPLATE/, // Exclude PR templates
      /\.idea/, // Exclude IntelliJ IDEA files
      /\.vscode-extension\/out/, // Exclude compiled extension output
      /\.vscode-extension\/node_modules/, // Exclude extension node_modules
      // Exclude large result/summary/test JSON files
      /temp-.*\.json$/i, // Exclude temp JSON files
      /.*-results.*\.json$/i, // Exclude results JSON files
      /.*-output.*\.json$/i, // Exclude output JSON files
      /.*-test.*\.json$/i, // Exclude test JSON files (keep test JS files)
      /.*-summary.*\.json$/i, // Exclude summary JSON files
      /.*-data.*\.json$/i, // Exclude data JSON files
      /.*-stats.*\.json$/i, // Exclude stats JSON files
      /.*-metrics.*\.json$/i, // Exclude metrics JSON files
      /.*-report.*\.json$/i, // Exclude report JSON files
      /.*-evaluation.*\.json$/i, // Exclude evaluation JSON files
      /.*-survey.*\.json$/i, // Exclude survey JSON files
      /.*-research.*\.json$/i, // Exclude research JSON files
      /.*-audit.*\.json$/i, // Exclude audit JSON files
      /.*-review.*\.json$/i, // Exclude review JSON files
      /.*-feedback.*\.json$/i, // Exclude feedback JSON files
      /.*-analysis.*\.json$/i, // Exclude analysis JSON files
      // Exclude non-essential documentation files
      /^docs\/.*-(RESULTS|SUMMARY|ANALYSIS|FEEDBACK|REPORT|TEST|EVALUATION|SURVEY|RESEARCH|AUDIT|REVIEW|METRICS|STATS|DATA|OUTPUT|LOGS|BACKUP|ARCHIVE|OLD|DEPRECATED|TEMP|DRAFT|WIP|TODO|NOTES|SCRATCH|EXPERIMENT|PROTOTYPE|TESTING|DEBUG|HISTORY|CHANGELOG).*\.md$/i,
    ];
    this.includeExtensions = [
      ".js",
      ".ts",
      ".jsx",
      ".tsx", // JavaScript/TypeScript
      ".md",
      ".mdx", // Markdown (but filtered by exclude patterns)
      ".sql", // SQL files
      // Only include essential JSON files (package.json, tsconfig.json, etc.)
      // Large data JSON files are excluded by patterns above
      ".html",
      ".css", // Web files
      ".py",
      ".java",
      ".go",
      ".rs", // Other languages (if any)
    ];
  }

  /**
   * Check if file should be indexed
   */
  shouldIndexFile(filePath) {
    // Check exclude patterns first (most restrictive)
    for (const pattern of this.excludePatterns) {
      if (pattern.test(filePath)) {
        return false;
      }
    }

    // Check extension
    const ext = path.extname(filePath).toLowerCase();
    if (!this.includeExtensions.includes(ext)) {
      return false;
    }

    // For JSON files, only index essential config files
    if (ext === ".json") {
      const fileName = path.basename(filePath).toLowerCase();
      const essentialJsonFiles = [
        "package.json",
        "tsconfig.json",
        "jsconfig.json",
        "eslintrc.json",
        ".eslintrc.json",
        "tsconfig.base.json",
        "package-lock.json", // Actually, this is excluded above, but just in case
      ];
      // Only index if it's an essential config file
      if (
        !essentialJsonFiles.some(
          (name) => fileName === name || fileName.includes(name),
        )
      ) {
        // Check if it's in a config directory
        const dirName = path.dirname(filePath).toLowerCase();
        if (
          !dirName.includes("config") &&
          !dirName.includes("server") &&
          !dirName.includes("public")
        ) {
          return false; // Skip non-essential JSON files
        }
      }
    }

    return true;
  }

  /**
   * Scan directory recursively for files
   */
  async scanDirectory(dirPath, basePath = dirPath) {
    const files = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = await this.scanDirectory(fullPath, basePath);
          files.push(...subFiles);
        } else if (entry.isFile() && this.shouldIndexFile(relativePath)) {
          files.push({
            path: relativePath,
            fullPath: fullPath,
            extension: path.extname(entry.name).toLowerCase(),
          });
        }
      }
    } catch (error) {
      log.error(`Error scanning directory ${dirPath}:`, error.message);
    }

    return files;
  }

  /**
   * Get maximum file size for a given file type
   */
  getMaxFileSize(extension) {
    const ext = extension.toLowerCase();

    // File type specific size limits
    const sizeLimits = {
      // Code files - more lenient (legitimate large code files)
      ".js": 5 * 1024 * 1024, // 5MB for JavaScript
      ".ts": 5 * 1024 * 1024, // 5MB for TypeScript
      ".jsx": 5 * 1024 * 1024, // 5MB for JSX
      ".tsx": 5 * 1024 * 1024, // 5MB for TSX
      ".py": 5 * 1024 * 1024, // 5MB for Python
      ".java": 5 * 1024 * 1024, // 5MB for Java
      ".go": 5 * 1024 * 1024, // 5MB for Go
      ".rs": 5 * 1024 * 1024, // 5MB for Rust

      // Markdown - medium limit (documentation can be long)
      ".md": 2 * 1024 * 1024, // 2MB for Markdown
      ".mdx": 2 * 1024 * 1024, // 2MB for MDX

      // SQL - medium limit
      ".sql": 2 * 1024 * 1024, // 2MB for SQL

      // Web files - smaller limit
      ".html": 1 * 1024 * 1024, // 1MB for HTML
      ".css": 1 * 1024 * 1024, // 1MB for CSS

      // JSON - strict limit (usually data files, not code)
      ".json": 500 * 1024, // 500KB for JSON (config files are small)
    };

    // Default to 1MB for unknown types
    return sizeLimits[ext] || 1 * 1024 * 1024;
  }

  /**
   * Read and parse file content
   */
  async readFile(fileInfo) {
    try {
      const stats = await fs.stat(fileInfo.fullPath);

      // Get file-type specific size limit
      const maxSize = this.getMaxFileSize(fileInfo.extension);

      if (stats.size > maxSize) {
        log.warn(
          `Skipping large ${fileInfo.extension} file: ${fileInfo.path} (${(stats.size / 1024 / 1024).toFixed(2)}MB, limit: ${(maxSize / 1024 / 1024).toFixed(2)}MB)`,
        );
        return null;
      }

      const content = await fs.readFile(fileInfo.fullPath, "utf-8");

      return {
        path: fileInfo.path,
        content: content,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        extension: fileInfo.extension,
        language: this.detectLanguage(fileInfo.extension),
      };
    } catch (error) {
      log.error(`Error reading file ${fileInfo.path}:`, error.message);
      return null;
    }
  }

  /**
   * Detect programming language from extension
   */
  detectLanguage(extension) {
    const langMap = {
      ".js": "javascript",
      ".ts": "typescript",
      ".jsx": "javascript",
      ".tsx": "typescript",
      ".md": "markdown",
      ".mdx": "markdown",
      ".sql": "sql",
      ".json": "json",
      ".html": "html",
      ".css": "css",
      ".py": "python",
      ".java": "java",
      ".go": "go",
      ".rs": "rust",
    };
    return langMap[extension] || "text";
  }

  /**
   * Parse code file to extract structure
   * Now uses optimal chunking algorithm when available
   */
  parseCodeFile(fileData) {
    const { content, language, path: filePath } = fileData;

    // Try optimal chunking first
    try {
      const optimalChunker = require("./optimalChunker");
      if (
        optimalChunker &&
        (language === "javascript" || language === "typescript")
      ) {
        const optimalChunks = optimalChunker.chunkWithBoundaries(
          content,
          language,
        );

        // Convert to expected format
        const chunks = optimalChunks.map((chunk) => ({
          type: chunk.type,
          content: chunk.content,
          lineStart: chunk.startLine,
          lineEnd: chunk.endLine,
          filePath: filePath,
          context: chunk.context,
        }));

        // Extract metadata
        const functions = [];
        const classes = [];
        const constants = [];

        for (const chunk of optimalChunks) {
          if (chunk.type === "function") {
            // Extract function name from context
            const funcMatch = chunk.content.match(/(?:function|const)\s+(\w+)/);
            if (funcMatch) functions.push(funcMatch[1]);
          } else if (chunk.type === "class") {
            const classMatch = chunk.content.match(/class\s+(\w+)/);
            if (classMatch) classes.push(classMatch[1]);
          }
        }

        return {
          metadata: {
            functions,
            classes,
            constants,
            lineCount: content.split("\n").length,
          },
          chunks,
        };
      }
    } catch (err) {
      // Fallback to original parsing
      log.warn(
        "[Codebase Indexer] Optimal chunking not available, using fallback:",
        err.message,
      );
    }

    // Fallback to original parsing
    const chunks = [];

    if (language === "javascript" || language === "typescript") {
      // Extract functions, classes, exports
      const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
      const classRegex = /(?:export\s+)?class\s+(\w+)/g;
      const constRegex = /(?:export\s+)?const\s+(\w+)\s*=/g;

      let match;
      const functions = [];
      const classes = [];
      const constants = [];

      while ((match = functionRegex.exec(content)) !== null) {
        functions.push(match[1]);
      }
      while ((match = classRegex.exec(content)) !== null) {
        classes.push(match[1]);
      }
      while ((match = constRegex.exec(content)) !== null) {
        constants.push(match[1]);
      }

      // Split into logical chunks (by function/class)
      const lines = content.split("\n");
      let currentChunk = { type: "header", content: "", lineStart: 1 };
      let inFunction = false;
      let braceCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Detect function/class start
        if (functionRegex.test(line) || classRegex.test(line)) {
          if (currentChunk.content.trim()) {
            chunks.push({ ...currentChunk, lineEnd: i });
          }
          currentChunk = {
            type: "code",
            content: line,
            lineStart: lineNum,
            filePath: filePath,
          };
          inFunction = true;
          braceCount =
            (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        } else if (inFunction) {
          currentChunk.content += "\n" + line;
          braceCount +=
            (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

          if (braceCount === 0 && line.trim().endsWith("}")) {
            currentChunk.lineEnd = lineNum;
            chunks.push(currentChunk);
            currentChunk = {
              type: "code",
              content: "",
              lineStart: lineNum + 1,
            };
            inFunction = false;
          }
        } else {
          currentChunk.content += "\n" + line;
        }
      }

      if (currentChunk.content.trim()) {
        chunks.push({ ...currentChunk, lineEnd: lines.length });
      }

      return {
        metadata: {
          functions,
          classes,
          constants,
          lineCount: lines.length,
        },
        chunks,
      };
    } else if (language === "markdown") {
      // Split markdown by headers
      const headerRegex = /^(#{1,6})\s+(.+)$/gm;
      const sections = [];
      let lastIndex = 0;
      let match;

      while ((match = headerRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          sections.push({
            type: "section",
            content: content.substring(lastIndex, match.index),
            lineStart: content.substring(0, lastIndex).split("\n").length,
          });
        }
        lastIndex = match.index;
      }

      if (lastIndex < content.length) {
        sections.push({
          type: "section",
          content: content.substring(lastIndex),
          lineStart: content.substring(0, lastIndex).split("\n").length,
        });
      }

      return {
        metadata: { sections: sections.length },
        chunks: sections.map((s, i) => ({
          ...s,
          filePath: filePath,
          lineEnd: s.lineStart + s.content.split("\n").length,
        })),
      };
    } else {
      // Generic chunking for other file types
      const maxChunkSize = 2000; // characters
      const chunks = [];

      for (let i = 0; i < content.length; i += maxChunkSize) {
        const chunk = content.substring(i, i + maxChunkSize);
        const lineStart = content.substring(0, i).split("\n").length;
        chunks.push({
          type: "text",
          content: chunk,
          filePath: filePath,
          lineStart: lineStart,
          lineEnd: lineStart + chunk.split("\n").length,
        });
      }

      return {
        metadata: {},
        chunks,
      };
    }
  }

  /**
   * Generate embeddings for multiple texts in batch (much faster!)
   * OpenAI supports up to 2048 inputs per request
   */
  async generateEmbeddingsBatch(texts, retries = 3) {
    if (!this.openaiApiKey) {
      log.warn("OpenAI API key not found, skipping embedding generation");
      return texts.map(() => null);
    }

    const startTime = Date.now();
    const metricsCollector = require("./metricsCollector");
const { getSupabaseClient } = require('../utils/supabaseClient');
    const { getSupabaseService } = require("../utils/supabaseClient");

    // Limit batch size to avoid token limits (2048 inputs max, but we'll use 100 for safety)
    const batchSize = 100;
    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchStartTime = Date.now();
      const batchEmbeddings = await this._generateBatch(batch, retries);
      const batchTime = Date.now() - batchStartTime;

      // Record metrics
      metricsCollector.recordEmbeddingGeneration(
        batchTime,
        batch.length,
        false,
      );

      allEmbeddings.push(...batchEmbeddings);
    }

    const totalTime = Date.now() - startTime;
    metricsCollector.recordEmbeddingGeneration(totalTime, texts.length, false);

    return allEmbeddings;
  }

  /**
   * Generate a single batch of embeddings
   */
  async _generateBatch(texts, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: texts.map((t) => t.substring(0, 8000)), // Limit each to 8k tokens
          }),
          signal: AbortSignal.timeout(60000), // 60 second timeout for batches
        });

        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));

          // Rate limit - wait longer
          if (response.status === 429) {
            const waitTime = Math.pow(2, attempt) * 1000;
            log.warn(
              `Rate limited, waiting ${waitTime}ms before retry ${attempt}/${retries}`,
            );
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }

          throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        return data.data.map((item) => item.embedding);
      } catch (error) {
        if (attempt === retries) {
          log.error(
            `Error generating batch embeddings after ${retries} attempts:`,
            error.message,
          );
          return texts.map(() => null);
        }

        const waitTime = Math.pow(2, attempt) * 1000;
        log.warn(
          `Batch embedding failed (attempt ${attempt}/${retries}), retrying in ${waitTime}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    return texts.map(() => null);
  }

  /**
   * Generate embedding for single text (backward compatibility)
   * Now includes similarity-based caching
   */
  async generateEmbedding(text, retries = 3) {
    const embeddingCache = require("./embeddingCache");
    const metricsCollector = require("./metricsCollector");

    // Check cache first
    const cached = embeddingCache.get(text);
    if (cached) {
      metricsCollector.recordEmbeddingGeneration(0, 1, true); // 0ms, from cache
      return cached.embedding;
    }

    // Generate new embedding
    const startTime = Date.now();
    const results = await this.generateEmbeddingsBatch([text], retries);
    const time = Date.now() - startTime;

    const embedding = results[0];
    if (embedding) {
      // Store in cache
      embeddingCache.set(text, embedding);
      metricsCollector.recordEmbeddingGeneration(time, 1, false);
    }

    return embedding;
  }

  /**
   * Index a single file (optimized with batch embeddings)
   */
  async indexFile(fileInfo) {
    const fileData = await this.readFile(fileInfo);
    if (!fileData) {
      return null;
    }

    const parsed = this.parseCodeFile(fileData);

    if (parsed.chunks.length === 0) {
      return {
        file: fileData.path,
        chunks: [],
        metadata: parsed.metadata,
      };
    }

    // Prepare all search texts for batch processing
    const searchTexts = parsed.chunks.map((chunk) =>
      [
        `File: ${fileData.path}`,
        `Language: ${fileData.language}`,
        chunk.content,
      ].join("\n\n"),
    );

    // Check cache for existing embeddings
    const embeddingCache = require("./embeddingCache");
    const embeddings = [];
    const textsToGenerate = [];
    const textIndices = [];

    for (let i = 0; i < searchTexts.length; i++) {
      const cached = embeddingCache.get(searchTexts[i]);
      if (cached) {
        embeddings[i] = cached.embedding;
      } else {
        textsToGenerate.push(searchTexts[i]);
        textIndices.push(i);
      }
    }

    // Generate embeddings for uncached texts
    if (textsToGenerate.length > 0) {
      const startTime = Date.now();
      const newEmbeddings = await this.generateEmbeddingsBatch(textsToGenerate);
      const time = Date.now() - startTime;

      // Store in cache and populate results
      for (let j = 0; j < newEmbeddings.length; j++) {
        const idx = textIndices[j];
        const embedding = newEmbeddings[j];
        if (embedding) {
          embeddings[idx] = embedding;
          embeddingCache.set(textsToGenerate[j], embedding);
        }
      }

      // Record metrics
      const metricsCollector = require("./metricsCollector");
      metricsCollector.recordEmbeddingGeneration(
        time,
        textsToGenerate.length,
        false,
      );
    }

    // Build indexed chunks
    const indexedChunks = [];
    for (let i = 0; i < parsed.chunks.length; i++) {
      const chunk = parsed.chunks[i];
      const embedding = embeddings[i];

      if (embedding) {
        const searchText = searchTexts[i];
        indexedChunks.push({
          file_path: fileData.path,
          content: chunk.content.substring(0, 10000),
          search_text: searchText.substring(0, 10000),
          embedding: embedding,
          metadata: {
            language: fileData.language,
            type: chunk.type,
            line_start: chunk.lineStart,
            line_end: chunk.lineEnd,
            file_size: fileData.size,
            modified: fileData.modified,
            ...parsed.metadata,
          },
        });
      }
    }

    return {
      file: fileData.path,
      chunks: indexedChunks,
      metadata: parsed.metadata,
    };
  }

  /**
   * Store indexed chunks in database
   */
  async storeChunks(chunks) {
    if (chunks.length === 0) return;

    try {
      // Insert chunks in batches (larger batches = faster)
      const batchSize = 50;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        const { error } = await this.supabase
          .from("codebase_index")
          .upsert(batch, {
            onConflict: "file_path,line_start",
            ignoreDuplicates: false,
          });

        if (error) {
          log.error("Error storing chunks:", error);
        } else {
          log.info(
            `Stored ${batch.length} chunks (${i + 1}-${Math.min(i + batchSize, chunks.length)}/${chunks.length})`,
          );
        }
      }
    } catch (error) {
      log.error("Error storing chunks in database:", error);
    }
  }

  /**
   * Index entire codebase
   */
  async indexCodebase(rootPath = process.cwd(), options = {}) {
    log.info("Starting codebase indexing...");
    const startTime = Date.now();

    try {
      // Scan all files
      log.info("Scanning codebase...");

      // Focus on core directories for better performance
      const coreDirs = options.coreOnly
        ? ["server", "public", "docs", "scripts"]
        : null;

      let files = [];
      if (coreDirs) {
        // Only scan core directories
        for (const dir of coreDirs) {
          const dirPath = path.join(rootPath, dir);
          try {
            await fs.access(dirPath);
            const dirFiles = await this.scanDirectory(dirPath, rootPath);
            files.push(...dirFiles);
          } catch (err) {
            // Directory doesn't exist, skip
          }
        }
      } else {
        // Scan everything
        files = await this.scanDirectory(rootPath);
      }

      log.info(`Found ${files.length} files to index`);

      // Check which files are already indexed (skip them)
      log.info("Checking for already indexed files...");
      const { data: existingChunks } = await this.supabase
        .from("codebase_index")
        .select("file_path")
        .limit(10000);

      const indexedFiles = new Set(
        existingChunks?.map((c) => c.file_path) || [],
      );
      const filesToIndex = files.filter((f) => !indexedFiles.has(f.path));

      log.info(
        `Skipping ${indexedFiles.size} already indexed files. ${filesToIndex.length} files to index.`,
      );

      // Load agent session for learning
      const session = await agentSessionService.getOrCreateSession(
        "codebase-indexer",
        this.sessionId,
      );
      if (session) {
        const learned = await agentSessionService.getLearnedPatterns(
          "codebase-indexer",
          this.sessionId,
        );
        log.info(
          `Loaded ${learned.patterns.length} learned patterns from previous sessions`,
        );
      }

      // Index files with parallel processing
      let indexed = 0;
      let failed = 0;
      let skipped = files.length - filesToIndex.length;
      const allChunks = [];
      const startTime = Date.now();
      const concurrency = 5; // Process 5 files in parallel

      for (let i = 0; i < filesToIndex.length; i += concurrency) {
        const batch = filesToIndex.slice(i, i + concurrency);

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(async (file) => {
            try {
              log.info(
                `Indexing ${file.path}... (${indexed + failed + skipped + 1}/${files.length})`,
              );
              const result = await this.indexFile(file);
              return { file: file.path, result, error: null };
            } catch (error) {
              return { file: file.path, result: null, error: error.message };
            }
          }),
        );

        // Process results
        for (const outcome of results) {
          if (outcome.status === "fulfilled") {
            const { result, error } = outcome.value;
            if (error) {
              log.error(`Error indexing ${outcome.value.file}:`, error);
              failed++;
            } else if (result && result.chunks.length > 0) {
              allChunks.push(...result.chunks);
              indexed++;
            } else {
              failed++;
            }
          } else {
            failed++;
          }
        }

        // Progress update every 10 files with time estimate
        if ((indexed + failed) % 10 === 0) {
          const elapsed = (Date.now() - startTime) / 1000;
          const rate = (indexed + failed) / elapsed;
          const remaining = filesToIndex.length - (indexed + failed);
          const eta = remaining / rate;
          log.info(
            `Progress: ${indexed} indexed, ${failed} failed, ${skipped} skipped (${Math.round(rate * 60)} files/min, ~${Math.round(eta / 60)} min remaining)`,
          );
        }

        // Store chunks periodically (every 200 chunks) instead of all at once
        if (allChunks.length >= 200) {
          log.info(`Storing ${allChunks.length} chunks...`);
          await this.storeChunks(allChunks);
          allChunks.length = 0; // Clear array
        }

        // Small delay between batches to avoid overwhelming the API
        if (i + concurrency < filesToIndex.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Store all chunks
      log.info(`Storing ${allChunks.length} chunks in database...`);
      await this.storeChunks(allChunks);

      // Store remaining chunks
      if (allChunks.length > 0) {
        log.info(`Storing final ${allChunks.length} chunks...`);
        await this.storeChunks(allChunks);
      }

      const duration = Date.now() - startTime;
      log.info(`Indexing complete! ${indexed} files indexed, ${failed} failed, ${skipped} 
                skipped, ${allChunks.length} chunks stored in ${(duration / 1000).toFixed(1)}s`);

      // Record session success
      await agentSessionService.recordSuccess(
        "codebase-indexer",
        this.sessionId,
        {
          filesIndexed: indexed,
          chunksStored: allChunks.length,
          duration: duration,
          timestamp: new Date().toISOString(),
        },
      );

      // Record decision
      await agentSessionService.recordDecision({
        agentType: "codebase-indexer",
        sessionId: this.sessionId,
        decisionType: "index",
        outcome: failed === 0 ? "success" : "partial",
        timeTakenMs: duration,
        metadata: {
          filesIndexed: indexed,
          chunksStored: allChunks.length,
        },
      });

      return {
        success: true,
        filesIndexed: indexed,
        filesFailed: failed,
        filesSkipped: skipped,
        chunksStored: allChunks.length,
        duration: duration,
      };
    } catch (error) {
      log.error("Error indexing codebase:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Re-index a single file (for incremental updates)
   */
  async reindexFile(filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    const fileInfo = {
      path: filePath,
      fullPath: fullPath,
      extension: path.extname(filePath),
    };

    // Delete existing chunks for this file
    await this.supabase
      .from("codebase_index")
      .delete()
      .eq("file_path", filePath);

    // Re-index
    const result = await this.indexFile(fileInfo);
    if (result && result.chunks.length > 0) {
      await this.storeChunks(result.chunks);
    }

    return result;
  }
}

module.exports = new CodebaseIndexer();
