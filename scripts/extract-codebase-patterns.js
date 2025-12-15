/**
 * Extract Codebase Patterns for Knowledge Base
 * Sprint 2: Knowledge Base & Cross-Agent Learning
 * 
 * Scans codebase and extracts common patterns to add to knowledge base
 */

const fs = require('fs').promises;
const path = require('path');
const codebaseSearch = require('../server/services/codebaseSearch');
const agentKnowledgeService = require('../server/services/agentKnowledgeService');
const { glob } = require('glob');

const PATTERNS_TO_EXTRACT = [
    {
        name: 'Service Pattern',
        pattern: /module\.exports\s*=\s*new\s+\w+\(\)/,
        type: 'pattern',
        description: 'Service singleton export pattern',
        tags: ['service', 'pattern', 'architecture']
    },
    {
        name: 'Error Handling Pattern',
        pattern: /try\s*\{[\s\S]*?\}\s*catch\s*\([^)]+\)\s*\{[\s\S]*?console\.(error|warn)/,
        type: 'pattern',
        description: 'Try-catch error handling with logging',
        tags: ['error-handling', 'pattern', 'best-practice']
    },
    {
        name: 'Async Function Pattern',
        pattern: /async\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?await\s+/,
        type: 'pattern',
        description: 'Async function with await',
        tags: ['async', 'pattern', 'javascript']
    },
    {
        name: 'Supabase Query Pattern',
        pattern: /supabase\.(from|rpc)\([^)]+\)/,
        type: 'pattern',
        description: 'Supabase database query pattern',
        tags: ['supabase', 'database', 'pattern']
    },
    {
        name: 'Express Route Pattern',
        pattern: /router\.(get|post|put|delete)\([^)]+,\s*async\s*\(/,
        type: 'pattern',
        description: 'Express route handler pattern',
        tags: ['express', 'route', 'pattern']
    },
    {
        name: 'RLS Policy Pattern',
        pattern: /CREATE\s+POLICY\s+[^O]+ON\s+[^F]+FOR\s+\w+\s+TO\s+/,
        type: 'pattern',
        description: 'Supabase RLS policy pattern',
        tags: ['supabase', 'security', 'rls', 'pattern']
    },
    {
        name: 'Agent Session Pattern',
        pattern: /agentSessionService\.(getOrCreateSession|recordDecision)/,
        type: 'pattern',
        description: 'Agent session memory pattern',
        tags: ['agent', 'memory', 'pattern']
    },
    {
        name: 'Knowledge Base Query Pattern',
        pattern: /agentKnowledgeService\.(searchKnowledge|getBestKnowledge)/,
        type: 'pattern',
        description: 'Knowledge base query pattern',
        tags: ['knowledge-base', 'pattern', 'agent']
    }
];

async function extractPatternsFromFile(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        const patterns = [];

        for (const patternDef of PATTERNS_TO_EXTRACT) {
            const matches = content.matchAll(new RegExp(patternDef.pattern.source, 'g'));
            for (const match of matches) {
                const context = extractContext(content, match.index, 200);
                patterns.push({
                    ...patternDef,
                    filePath: filePath,
                    context: context,
                    example: match[0].substring(0, 300)
                });
            }
        }

        return patterns;
    } catch (err) {
        console.warn(`Error reading ${filePath}:`, err.message);
        return [];
    }
}

function extractContext(content, index, length) {
    const start = Math.max(0, index - length);
    const end = Math.min(content.length, index + length);
    return content.substring(start, end);
}

async function scanCodebase() {
    const rootPath = process.cwd();
    const files = [];

    // Scan key directories
    const dirs = ['server/services', 'server/routes', 'supabase/migrations'];
    
    for (const dir of dirs) {
        const dirPath = path.join(rootPath, dir);
        try {
            const dirFiles = glob.sync('**/*.js', { cwd: dirPath, absolute: true });
            files.push(...dirFiles);
        } catch (err) {
            console.warn(`Error scanning ${dir}:`, err.message);
        }
    }

    return files;
}

async function extractAndAddPatterns() {
    console.log('🔍 Extracting codebase patterns...\n');

    const files = await scanCodebase();
    console.log(`📁 Found ${files.length} files to scan\n`);

    const allPatterns = [];
    let processed = 0;

    for (const file of files) {
        const patterns = await extractPatternsFromFile(file);
        allPatterns.push(...patterns);
        processed++;
        
        if (processed % 10 === 0) {
            console.log(`   Processed ${processed}/${files.length} files...`);
        }
    }

    console.log(`\n✅ Extracted ${allPatterns.length} pattern instances\n`);

    // Group by pattern type
    const grouped = {};
    for (const pattern of allPatterns) {
        const key = pattern.name;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(pattern);
    }

    // Add unique patterns to knowledge base
    let added = 0;
    let skipped = 0;

    for (const [patternName, instances] of Object.entries(grouped)) {
        // Use the first instance as the canonical example
        const canonical = instances[0];
        
        // Build comprehensive example from multiple instances
        const examples = instances.slice(0, 3).map(i => i.example).join('\n\n---\n\n');

        try {
            const result = await agentKnowledgeService.addKnowledge({
                type: canonical.type,
                content: `${canonical.description}\n\nExample:\n${examples}\n\nContext: ${canonical.context?.substring(0, 500)}`,
                sourceAgent: 'pattern-extractor',
                confidence: 0.85,
                tags: canonical.tags,
                metadata: {
                    extracted: true,
                    fileCount: instances.length,
                    files: instances.slice(0, 5).map(i => i.filePath),
                    timestamp: new Date().toISOString()
                }
            });

            if (result) {
                added++;
                console.log(`✅ Added: ${patternName} (${instances.length} instances found)`);
            } else {
                skipped++;
            }
        } catch (err) {
            console.error(`❌ Error adding ${patternName}:`, err.message);
            skipped++;
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Added: ${added} patterns`);
    console.log(`   ⏭️  Skipped: ${skipped} patterns`);
    console.log(`\n🎉 Pattern extraction complete!`);
}

if (require.main === module) {
    extractAndAddPatterns().catch(console.error);
}

module.exports = { extractAndAddPatterns };
