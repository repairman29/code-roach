/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/documentationGenerator.js
 * Last Sync: 2025-12-14T07:30:45.630Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Documentation Generator Service
 * Sprint 7: Generates documentation from code patterns
 */

const agentKnowledgeService = require('./agentKnowledgeService');
const codebaseSearch = require('./codebaseSearch');
const llmService = require('./llmService');

class DocumentationGenerator {
    constructor() {
        // Service initialization
    }

    /**
     * Generate JSDoc comments for a function
     */
    async generateJSDoc(functionCode, context = null) {
        try {
            // Get documentation patterns from knowledge base
            const docPatterns = await agentKnowledgeService.searchKnowledge(
                'JSDoc documentation comment pattern',
                { knowledgeType: 'pattern', limit: 3, threshold: 0.6 }
            );

            // Find similar functions for style reference
            const similarCode = await codebaseSearch.semanticSearch(
                functionCode.substring(0, 200),
                { limit: 3 }
            );

            const prompt = `Generate JSDoc documentation for this function:

\`\`\`javascript
${functionCode}
\`\`\`

${context ? `Context: ${context}` : ''}

${docPatterns.length > 0 ? `Documentation patterns from codebase:\n${docPatterns.map(p => p.content).join('\n\n---\n\n')}` : ''}

${similarCode.results && similarCode.results.length > 0 ? `Similar functions for style reference:\n${similarCode.results.slice(0, 2).map(r => r.content).join('\n\n---\n\n')}` : ''}

Generate JSDoc comments that:
1. Describe what the function does
2. Document all parameters
3. Document return value
4. Include examples if helpful
5. Match the codebase documentation style

Return only the JSDoc comment block.`;

            const response = await llmService.generateOpenAI({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are an expert at writing JSDoc documentation that matches codebase style.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                max_tokens: 1000
            });

            return response.content || response.text || '';
        } catch (error) {
            console.error('[DocumentationGenerator] Error generating JSDoc:', error);
            return null;
        }
    }

    /**
     * Generate API documentation from route patterns
     */
    async generateAPIDocumentation(routeCode) {
        try {
            // Get API documentation patterns
            const apiPatterns = await agentKnowledgeService.searchKnowledge(
                'API endpoint documentation route handler',
                { knowledgeType: 'pattern', limit: 3, threshold: 0.6 }
            );

            const prompt = `Generate API documentation for this route handler:

\`\`\`javascript
${routeCode}
\`\`\`

${apiPatterns.length > 0 ? `API documentation patterns:\n${apiPatterns.map(p => p.content).join('\n\n---\n\n')}` : ''}

Generate documentation that includes:
1. Endpoint path and method
2. Request parameters
3. Response format
4. Example requests/responses
5. Error cases

Return formatted API documentation.`;

            const response = await llmService.generateOpenAI({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are an expert at writing API documentation.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                max_tokens: 1500
            });

            return response.content || response.text || '';
        } catch (error) {
            console.error('[DocumentationGenerator] Error generating API docs:', error);
            return null;
        }
    }

    /**
     * Generate README section from service patterns
     */
    async generateServiceDocumentation(serviceCode, serviceName) {
        try {
            const servicePatterns = await agentKnowledgeService.searchKnowledge(
                'service documentation README',
                { knowledgeType: 'pattern', limit: 2, threshold: 0.6 }
            );

            const prompt = `Generate README documentation for this service:

Service Name: ${serviceName}

\`\`\`javascript
${serviceCode.substring(0, 1000)}
\`\`\`

${servicePatterns.length > 0 ? `Documentation patterns:\n${servicePatterns.map(p => p.content).join('\n\n---\n\n')}` : ''}

Generate documentation that includes:
1. Service description
2. Main methods/functions
3. Usage examples
4. Configuration if needed

Return formatted markdown documentation.`;

            const response = await llmService.generateOpenAI({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are an expert at writing service documentation.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                max_tokens: 1500
            });

            return response.content || response.text || '';
        } catch (error) {
            console.error('[DocumentationGenerator] Error generating service docs:', error);
            return null;
        }
    }
}

module.exports = new DocumentationGenerator();
