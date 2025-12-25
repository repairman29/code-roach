/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/multiFileFixGenerator.js
 * Last Sync: 2025-12-25T04:53:21.501Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Multi-File Fix Generator Service
 * Handles fixes that span multiple files (imports, exports, refactoring)
 */

const fs = require("fs").promises;
const path = require("path");
const { createLogger } = require("../utils/logger");
const log = createLogger("MultiFileFixGenerator");
const codebaseSearch = require("./codebaseSearch");
const llmFixGenerator = require("./llmFixGenerator");

class MultiFileFixGenerator {
  constructor() {
    this.fileDependencies = new Map();
    this.importCache = new Map();
  }

  /**
   * Generate and apply multi-file fix
   */
  async generateMultiFileFix(issue, code, filePath) {
    try {
      // Detect if this is a multi-file issue
      const isMultiFile = await this.detectMultiFileIssue(
        issue,
        code,
        filePath,
      );

      if (!isMultiFile) {
        return {
          success: false,
          isMultiFile: false,
          message: "Not a multi-file issue",
        };
      }

      // Analyze dependencies
      const dependencies = await this.analyzeDependencies(filePath);

      // Generate fix plan
      const fixPlan = await this.generateFixPlan(
        issue,
        code,
        filePath,
        dependencies,
      );

      // Apply fixes to all affected files
      const results = await this.applyMultiFileFix(fixPlan);

      return results;
    } catch (err) {
      console.error("[Multi-File Fix] Error:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Detect if issue requires multi-file fix
   */
  async detectMultiFileIssue(issue, code, filePath) {
    const message = (issue.message || "").toLowerCase();

    // Check for common multi-file issues
    const multiFileIndicators = [
      "import",
      "export",
      "dependency",
      "module",
      "refactor",
      "rename",
      "move",
      "extract",
    ];

    const hasIndicator = multiFileIndicators.some((indicator) =>
      message.includes(indicator),
    );

    if (hasIndicator) {
      return true;
    }

    // Check for import/export issues
    if (
      code.includes("require(") ||
      code.includes("import ") ||
      code.includes("export ")
    ) {
      // Check if imports/exports are broken
      const brokenImports = await this.detectBrokenImports(code, filePath);
      if (brokenImports.length > 0) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect broken imports
   */
  async detectBrokenImports(code, filePath) {
    const broken = [];
    const projectRoot = this.getProjectRoot(filePath);

    // Extract require statements
    const requireMatches = code.matchAll(/require\(['"]([^'"]+)['"]\)/g);
    for (const match of requireMatches) {
      const modulePath = match[1];
      const resolvedPath = await this.resolveModulePath(
        modulePath,
        filePath,
        projectRoot,
      );

      if (!resolvedPath || !(await this.fileExists(resolvedPath))) {
        broken.push({
          type: "require",
          module: modulePath,
          line: this.getLineNumber(code, match.index),
        });
      }
    }

    // Extract import statements
    const importMatches = code.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      const modulePath = match[1];
      const resolvedPath = await this.resolveModulePath(
        modulePath,
        filePath,
        projectRoot,
      );

      if (!resolvedPath || !(await this.fileExists(resolvedPath))) {
        broken.push({
          type: "import",
          module: modulePath,
          line: this.getLineNumber(code, match.index),
        });
      }
    }

    return broken;
  }

  /**
   * Analyze file dependencies
   */
  async analyzeDependencies(filePath) {
    try {
      const code = await fs.readFile(filePath, "utf8");
      const projectRoot = this.getProjectRoot(filePath);

      const dependencies = {
        imports: [],
        exports: [],
        requires: [],
      };

      // Extract requires
      const requireMatches = code.matchAll(/require\(['"]([^'"]+)['"]\)/g);
      for (const match of requireMatches) {
        const modulePath = match[1];
        const resolved = await this.resolveModulePath(
          modulePath,
          filePath,
          projectRoot,
        );
        if (resolved) {
          dependencies.requires.push({
            module: modulePath,
            path: resolved,
            line: this.getLineNumber(code, match.index),
          });
        }
      }

      // Extract imports
      const importMatches = code.matchAll(
        /import\s+.*?from\s+['"]([^'"]+)['"]/g,
      );
      for (const match of importMatches) {
        const modulePath = match[1];
        const resolved = await this.resolveModulePath(
          modulePath,
          filePath,
          projectRoot,
        );
        if (resolved) {
          dependencies.imports.push({
            module: modulePath,
            path: resolved,
            line: this.getLineNumber(code, match.index),
          });
        }
      }

      // Extract exports
      const exportMatches = code.matchAll(
        /export\s+(?:default\s+)?(?:function|const|let|var|class)\s+(\w+)/g,
      );
      for (const match of exportMatches) {
        dependencies.exports.push({
          name: match[1],
          line: this.getLineNumber(code, match.index),
        });
      }

      return dependencies;
    } catch (err) {
      log.warn(
        "[Multi-File Fix] Error analyzing dependencies:",
        err.message,
      );
      return { imports: [], exports: [], requires: [] };
    }
  }

  /**
   * Generate fix plan for multi-file changes
   */
  async generateFixPlan(issue, code, filePath, dependencies) {
    const plan = {
      primaryFile: filePath,
      issue: issue,
      changes: [],
      affectedFiles: [filePath],
    };

    // If broken imports, fix them
    const brokenImports = await this.detectBrokenImports(code, filePath);
    for (const broken of brokenImports) {
      // Try to find the correct path
      const correctPath = await this.findCorrectPath(broken.module, filePath);

      if (correctPath) {
        plan.changes.push({
          file: filePath,
          type: "fix-import",
          line: broken.line,
          original: broken.module,
          fixed: correctPath,
        });
      }
    }

    // If refactoring, check for files that use this module
    if (
      issue.type === "refactoring" ||
      issue.message?.toLowerCase().includes("refactor")
    ) {
      const dependentFiles = await this.findDependentFiles(filePath);
      plan.affectedFiles.push(...dependentFiles);

      for (const depFile of dependentFiles) {
        plan.changes.push({
          file: depFile,
          type: "update-usage",
          description: "Update usage after refactoring",
        });
      }
    }

    return plan;
  }

  /**
   * Apply multi-file fix
   */
  async applyMultiFileFix(fixPlan) {
    const results = {
      success: true,
      filesModified: [],
      errors: [],
    };

    for (const change of fixPlan.changes) {
      try {
        const fileCode = await fs.readFile(change.file, "utf8");
        let fixedCode = fileCode;

        switch (change.type) {
          case "fix-import":
            fixedCode = this.fixImport(
              fileCode,
              change.original,
              change.fixed,
              change.line,
            );
            break;
          case "update-usage":
            // Use LLM to update usage
            const llmFix = await llmFixGenerator.generateFix(
              change.issue || fixPlan.issue,
              fileCode,
              change.file,
            );
            if (llmFix.success && llmFix.fixedCode) {
              fixedCode = llmFix.fixedCode;
            }
            break;
        }

        if (fixedCode !== fileCode) {
          await fs.writeFile(change.file, fixedCode, "utf8");
          results.filesModified.push(change.file);
        }
      } catch (err) {
        results.errors.push({
          file: change.file,
          error: err.message,
        });
        results.success = false;
      }
    }

    return results;
  }

  /**
   * Fix import statement
   */
  fixImport(code, originalPath, fixedPath, lineNumber) {
    const lines = code.split("\n");
    const lineIndex = lineNumber - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return code;
    }

    const line = lines[lineIndex];
    const fixedLine = line.replace(originalPath, fixedPath);
    lines[lineIndex] = fixedLine;

    return lines.join("\n");
  }

  /**
   * Find correct path for module
   */
  async findCorrectPath(modulePath, fromFile) {
    const projectRoot = this.getProjectRoot(fromFile);
    const fromDir = path.dirname(fromFile);

    // Try different resolution strategies
    const strategies = [
      // Relative path
      path.join(fromDir, modulePath),
      // With .js extension
      path.join(fromDir, modulePath + ".js"),
      // Node modules
      path.join(projectRoot, "node_modules", modulePath),
      // Project root
      path.join(projectRoot, modulePath),
      // With index.js
      path.join(projectRoot, modulePath, "index.js"),
    ];

    for (const candidate of strategies) {
      if (await this.fileExists(candidate)) {
        // Return relative path from fromFile
        return path.relative(fromDir, candidate).replace(/\\/g, "/");
      }
    }

    // Try semantic search
    const searchResults = await codebaseSearch.semanticSearch(
      `file or module ${modulePath}`,
      { limit: 5, threshold: 0.7 },
    );

    if (
      searchResults &&
      searchResults.results &&
      searchResults.results.length > 0
    ) {
      const bestMatch = searchResults.results[0];
      const relativePath = path
        .relative(fromDir, bestMatch.file_path)
        .replace(/\\/g, "/");
      return relativePath.startsWith(".") ? relativePath : "./" + relativePath;
    }

    return null;
  }

  /**
   * Find files that depend on this file
   */
  async findDependentFiles(filePath) {
    try {
      // Search for files that import/require this file
      const fileName = path.basename(filePath, path.extname(filePath));
      const relativePath = path.relative(
        this.getProjectRoot(filePath),
        filePath,
      );

      const query = `import or require ${fileName} or ${relativePath}`;
      const results = await codebaseSearch.semanticSearch(query, {
        limit: 20,
        threshold: 0.6,
      });

      if (results && results.results) {
        return results.results
          .map((r) => r.file_path)
          .filter((p) => p !== filePath);
      }

      return [];
    } catch (err) {
      log.warn(
        "[Multi-File Fix] Error finding dependent files:",
        err.message,
      );
      return [];
    }
  }

  /**
   * Resolve module path
   */
  async resolveModulePath(modulePath, fromFile, projectRoot) {
    // Handle relative paths
    if (modulePath.startsWith(".")) {
      const resolved = path.resolve(path.dirname(fromFile), modulePath);
      // Try with .js extension
      if (await this.fileExists(resolved)) return resolved;
      if (await this.fileExists(resolved + ".js")) return resolved + ".js";
      if (await this.fileExists(path.join(resolved, "index.js")))
        return path.join(resolved, "index.js");
    }

    // Handle node_modules
    const nodeModulesPath = path.join(projectRoot, "node_modules", modulePath);
    if (await this.fileExists(nodeModulesPath)) return nodeModulesPath;

    // Handle project files
    const projectPath = path.join(projectRoot, modulePath);
    if (await this.fileExists(projectPath)) return projectPath;
    if (await this.fileExists(projectPath + ".js")) return projectPath + ".js";

    return null;
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get line number from index
   */
  getLineNumber(code, index) {
    return code.substring(0, index).split("\n").length;
  }

  /**
   * Get project root
   */
  getProjectRoot(filePath) {
    let current = path.dirname(filePath);
    const root = path.parse(filePath).root;

    while (current !== root) {
      try {
        if (
          require("fs").existsSync(path.join(current, "package.json")) ||
          require("fs").existsSync(path.join(current, ".git"))
        ) {
          return current;
        }
      } catch (err) {
        // Continue
      }
      current = path.dirname(current);
    }

    return path.dirname(filePath);
  }
}

module.exports = new MultiFileFixGenerator();
