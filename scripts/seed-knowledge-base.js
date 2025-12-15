/**
 * Seed Knowledge Base with Initial Patterns
 * Sprint 1: Foundation & Intelligence Activation
 * 
 * Populates the knowledge base with common patterns and best practices
 */

const agentKnowledgeService = require('../server/services/agentKnowledgeService');
const codebaseSearch = require('../server/services/codebaseSearch');

const commonPatterns = [
    {
        type: 'fix',
        content: 'Always wrap async operations in try-catch blocks',
        tags: ['async', 'error-handling', 'best-practice'],
        confidence: 0.9
    },
    {
        type: 'fix',
        content: 'Use const for variables that do not change, let only when reassignment is needed',
        tags: ['javascript', 'best-practice', 'code-style'],
        confidence: 0.95
    },
    {
        type: 'fix',
        content: 'Always handle errors with try-catch in async functions',
        tags: ['async', 'error-handling', 'javascript'],
        confidence: 0.9
    },
    {
        type: 'pattern',
        content: 'Service pattern: Export singleton instances, keep services focused and single-purpose',
        tags: ['architecture', 'pattern', 'service'],
        confidence: 0.85
    },
    {
        type: 'pattern',
        content: 'Use CommonJS (require/module.exports) - NO ES6 modules',
        tags: ['javascript', 'module-system', 'code-style'],
        confidence: 0.95
    },
    {
        type: 'fix',
        content: 'Never hardcode secrets - use environment variables through config',
        tags: ['security', 'best-practice', 'configuration'],
        confidence: 0.95
    },
    {
        type: 'pattern',
        content: 'Use Supabase service role key for server-side operations, anon key for client-side',
        tags: ['supabase', 'security', 'best-practice'],
        confidence: 0.9
    },
    {
        type: 'fix',
        content: 'Always use RLS (Row Level Security) policies for database tables',
        tags: ['supabase', 'security', 'database'],
        confidence: 0.95
    },
    {
        type: 'pattern',
        content: 'Use codebase search FIRST before manually searching files',
        tags: ['workflow', 'best-practice', 'codebase-search'],
        confidence: 0.85
    },
    {
        type: 'fix',
        content: 'Always handle errors appropriately - log errors, provide meaningful messages, never silently swallow',
        tags: ['error-handling', 'best-practice', 'logging'],
        confidence: 0.9
    }
];

async function seedKnowledgeBase() {
    console.log('🌱 Seeding Knowledge Base with Initial Patterns...\n');

    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const pattern of commonPatterns) {
        try {
            // Generate embedding for content
            const embedding = await codebaseSearch.generateQueryEmbedding(pattern.content);

            const result = await agentKnowledgeService.addKnowledge({
                type: pattern.type,
                content: pattern.content,
                sourceAgent: 'system-seed',
                confidence: pattern.confidence,
                tags: pattern.tags,
                metadata: {
                    seeded: true,
                    timestamp: new Date().toISOString()
                }
            });

            if (result) {
                added++;
                console.log(`✅ Added: ${pattern.content.substring(0, 60)}...`);
            } else {
                skipped++;
                console.log(`⏭️  Skipped: ${pattern.content.substring(0, 60)}...`);
            }
        } catch (err) {
            errors++;
            console.error(`❌ Error adding pattern: ${err.message}`);
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Added: ${added}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`\n🎉 Knowledge base seeding complete!`);
}

if (require.main === module) {
    seedKnowledgeBase().catch(console.error);
}

module.exports = { seedKnowledgeBase };
