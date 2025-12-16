/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/expertTrainingService.js
 * Last Sync: 2025-12-16T04:14:36.744Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Expert Training Service
 * Generates customer-specific expert guides based on codebase analysis
 * Similar to the 5-expert packages we created for Smugglers
 */

const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const llmService = require('./llmService');
const customerCodebaseAnalyzer = require('./customerCodebaseAnalyzer');

class ExpertTrainingService {
    constructor() {
        this.supabase = null;
        this.expertTemplates = new Map();
        
        if (config.supabase?.url && config.supabase?.serviceRoleKey) {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        }

        // Load expert templates (we'll create these based on our 5-expert packages)
        this.loadExpertTemplates();
    }

    /**
     * Generate experts for a customer project
     * @param {string} projectId - Project ID
     * @param {Object} analysis - Codebase analysis results
     * @returns {Promise<Object>} Generated experts
     */
    async generateExperts(projectId, analysis) {
        console.log(`[Expert Training Service] Generating experts for project ${projectId}...`);

        try {
            // Determine which experts to generate based on analysis
            const expertTypes = this.determineExpertTypes(analysis);

            // Generate each expert
            const experts = {};
            for (const expertType of expertTypes) {
                console.log(`[Expert Training Service] Generating ${expertType} expert...`);
                experts[expertType] = await this.generateExpert(projectId, expertType, analysis);
            }

            // Store experts
            await this.storeExperts(projectId, experts);

            // Update training status
            await this.updateTrainingStatus(projectId, {
                status: 'completed',
                experts_generated: Object.keys(experts).length,
                experts_total: expertTypes.length,
                completed_at: new Date().toISOString()
            });

            console.log(`[Expert Training Service] Generated ${Object.keys(experts).length} experts for project ${projectId}`);
            return experts;
        } catch (err) {
            console.error('[Expert Training Service] Error generating experts:', err);
            await this.updateTrainingStatus(projectId, {
                status: 'failed',
                error_message: err.message
            });
            throw err;
        }
    }

    /**
     * Determine which expert types to generate based on analysis
     */
    determineExpertTypes(analysis) {
        const expertTypes = [];

        // Always generate core experts
        expertTypes.push('code-style');
        expertTypes.push('architecture');

        // Stack-specific experts
        if (analysis.tech_stack?.databases?.length > 0) {
            expertTypes.push('database');
        }
        if (analysis.tech_stack?.frameworks?.length > 0) {
            analysis.tech_stack.frameworks.forEach(framework => {
                expertTypes.push(`framework-${framework.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
            });
        }
        if (analysis.tech_stack?.languages?.length > 0) {
            analysis.tech_stack.languages.forEach(language => {
                expertTypes.push(`language-${language.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
            });
        }

        // Testing expert
        if (analysis.testing_patterns?.frameworks?.length > 0) {
            expertTypes.push('testing');
        }

        // Security expert
        if (analysis.security_practices?.authentication || analysis.security_practices?.encryption?.length > 0) {
            expertTypes.push('security');
        }

        // API expert
        if (analysis.architecture_patterns?.api_style) {
            expertTypes.push('api');
        }

        // State management expert (for frontend frameworks)
        if (analysis.architecture_patterns?.state_management) {
            expertTypes.push('state-management');
        }

        return expertTypes;
    }

    /**
     * Generate a single expert guide
     */
    async generateExpert(projectId, expertType, analysis) {
        try {
            // Get template for expert type
            const template = this.getExpertTemplate(expertType);

            // Generate expert guide using LLM
            const guide = await this.generateExpertGuide(expertType, template, analysis);

            // Generate quick reference
            const quickReference = await this.generateQuickReference(expertType, guide, analysis);

            // Generate helper service code
            const helperService = await this.generateHelperService(expertType, guide, analysis);

            // Generate integration guide
            const integrationGuide = await this.generateIntegrationGuide(expertType, guide, analysis);

            // Calculate quality score
            const qualityScore = this.calculateQualityScore(guide, quickReference, helperService);

            return {
                expert_type: expertType,
                guide: guide,
                quick_reference: quickReference,
                helper_service: helperService,
                integration_guide: integrationGuide,
                quality_score: qualityScore,
                generated_at: new Date().toISOString()
            };
        } catch (err) {
            console.error(`[Expert Training Service] Error generating ${expertType} expert:`, err);
            throw err;
        }
    }

    /**
     * Generate expert guide using LLM
     */
    async generateExpertGuide(expertType, template, analysis) {
        const prompt = this.buildExpertGuidePrompt(expertType, template, analysis);

        try {
            // Ensure prompt is a string
            const promptString = typeof prompt === 'string' ? prompt : JSON.stringify(prompt, null, 2);
            
            // Use generateOpenAI directly with proper format
            const response = await llmService.generateOpenAI('', promptString, 'gpt-4o-mini');
            
            // Extract text from response
            const responseText = typeof response === 'string' ? response : (response.narrative || response.text || response.content || JSON.stringify(response));

            // Parse response into structured guide
            return this.parseExpertGuide(responseText, expertType);
        } catch (err) {
            console.warn(`[Expert Training Service] LLM generation failed for ${expertType}, using template:`, err.message);
            // Fallback to template-based generation
            return this.generateFromTemplate(expertType, template, analysis);
        }
    }

    /**
     * Build prompt for expert guide generation
     */
    buildExpertGuidePrompt(expertType, template, analysis) {
        const context = this.buildAnalysisContext(analysis, expertType);

        return `You are an expert technical writer creating a comprehensive expertise guide for AI development agents.

**Expert Type**: ${expertType}
**Customer Codebase Context**: ${JSON.stringify(context, null, 2)}

**Template Structure** (follow this format):
${template}

**Requirements**:
1. Create a comprehensive guide (similar to our 5-expert packages for Smugglers)
2. Include customer-specific patterns from their codebase
3. Provide actionable, programmatic tools (CLI/API/scripting focused)
4. Include code examples based on customer's actual stack
5. Cover best practices specific to their architecture
6. Include troubleshooting section

**Format**: Return a structured JSON object with:
- title: Guide title
- overview: Overview section
- sections: Array of section objects with title, content, code_examples
- best_practices: Array of best practices
- troubleshooting: Array of common issues and fixes
- programmatic_tools: Array of tool descriptions

Generate the expert guide now:`;
    }

    /**
     * Build analysis context for specific expert type
     */
    buildAnalysisContext(analysis, expertType) {
        const context = {
            tech_stack: analysis.tech_stack,
            architecture: analysis.architecture_patterns,
            code_organization: analysis.code_organization,
            testing: analysis.testing_patterns,
            security: analysis.security_practices
        };

        // Add expert-specific context
        if (expertType === 'database') {
            context.databases = analysis.tech_stack?.databases || [];
            context.database_patterns = this.extractDatabasePatterns(analysis);
        } else if (expertType.startsWith('framework-')) {
            const framework = expertType.replace('framework-', '').replace(/-/g, ' ');
            context.framework = framework;
            context.framework_patterns = this.extractFrameworkPatterns(analysis, framework);
        } else if (expertType === 'testing') {
            context.testing_frameworks = analysis.testing_patterns?.frameworks || [];
            context.test_patterns = analysis.testing_patterns;
        } else if (expertType === 'security') {
            context.security_practices = analysis.security_practices;
        } else if (expertType === 'api') {
            context.api_style = analysis.architecture_patterns?.api_style;
            context.api_patterns = this.extractAPIPatterns(analysis);
        }

        return context;
    }

    /**
     * Extract database patterns from analysis
     */
    extractDatabasePatterns(analysis) {
        // This would analyze the codebase for database usage patterns
        // For now, return basic patterns based on detected databases
        return {
            databases: analysis.tech_stack?.databases || [],
            orm: null, // Would detect ORM usage
            query_patterns: [] // Would analyze query patterns
        };
    }

    /**
     * Extract framework patterns
     */
    extractFrameworkPatterns(analysis, framework) {
        return {
            framework: framework,
            version: null, // Would detect version
            patterns: [] // Would analyze framework-specific patterns
        };
    }

    /**
     * Extract API patterns
     */
    extractAPIPatterns(analysis) {
        return {
            style: analysis.architecture_patterns?.api_style,
            routing: null, // Would detect routing patterns
            middleware: [] // Would detect middleware patterns
        };
    }

    /**
     * Parse expert guide from LLM response
     */
    parseExpertGuide(response, expertType) {
        try {
            // Try to parse as JSON
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            // Fallback: parse as markdown
            return this.parseMarkdownGuide(response, expertType);
        } catch (err) {
            console.warn('[Expert Training Service] Error parsing expert guide, using fallback:', err);
            return this.createFallbackGuide(expertType);
        }
    }

    /**
     * Parse markdown guide
     */
    parseMarkdownGuide(content, expertType) {
        // Simple markdown parser
        const sections = [];
        const lines = content.split('\n');
        let currentSection = null;

        for (const line of lines) {
            if (line.startsWith('# ')) {
                if (currentSection) sections.push(currentSection);
                currentSection = {
                    title: line.replace('# ', ''),
                    content: '',
                    code_examples: []
                };
            } else if (line.startsWith('## ')) {
                if (currentSection) sections.push(currentSection);
                currentSection = {
                    title: line.replace('## ', ''),
                    content: '',
                    code_examples: []
                };
            } else if (currentSection) {
                if (line.startsWith('```')) {
                    // Code block
                } else {
                    currentSection.content += line + '\n';
                }
            }
        }
        if (currentSection) sections.push(currentSection);

        return {
            title: `${expertType} Expert Guide`,
            overview: 'Comprehensive guide for AI development agents',
            sections: sections,
            best_practices: [],
            troubleshooting: [],
            programmatic_tools: []
        };
    }

    /**
     * Create fallback guide
     */
    createFallbackGuide(expertType) {
        return {
            title: `${expertType} Expert Guide`,
            overview: `Expert guide for ${expertType} based on customer codebase`,
            sections: [
                {
                    title: 'Overview',
                    content: `This guide provides expertise for ${expertType} in the customer's codebase.`,
                    code_examples: []
                }
            ],
            best_practices: [],
            troubleshooting: [],
            programmatic_tools: []
        };
    }

    /**
     * Generate from template (fallback)
     */
    generateFromTemplate(expertType, template, analysis) {
        // Use template and fill in customer-specific details
        return {
            title: `${expertType} Expert Guide`,
            overview: template.overview || `Expert guide for ${expertType}`,
            sections: template.sections || [],
            best_practices: template.best_practices || [],
            troubleshooting: template.troubleshooting || [],
            programmatic_tools: template.programmatic_tools || []
        };
    }

    /**
     * Generate quick reference
     */
    async generateQuickReference(expertType, guide, analysis) {
        // Extract key information from guide for quick reference
        return {
            expert_type: expertType,
            common_operations: this.extractCommonOperations(guide),
            quick_commands: this.extractQuickCommands(guide),
            common_patterns: this.extractCommonPatterns(guide),
            common_issues: this.extractCommonIssues(guide)
        };
    }

    /**
     * Generate helper service code
     */
    async generateHelperService(expertType, guide, analysis) {
        // Generate helper service similar to our databaseHelper.js, testingHelper.js, etc.
        const serviceCode = this.generateHelperServiceCode(expertType, guide, analysis);
        return {
            service_name: `${expertType}Helper`,
            file_name: `${expertType}Helper.js`,
            code: serviceCode,
            methods: this.extractHelperMethods(guide)
        };
    }

    /**
     * Generate helper service code
     */
    generateHelperServiceCode(expertType, guide, analysis) {
        // Generate CommonJS service module
        const className = this.toPascalCase(expertType) + 'Helper';
        const methods = this.extractHelperMethods(guide);

        let code = `/**
 * ${className}
 * Customer-specific helper service for ${expertType}
 * Generated by Expert Training Service
 */

const config = require('../config');

class ${className} {
    constructor() {
        // Initialize based on customer's stack
    }

`;

        // Generate methods
        methods.forEach(method => {
            code += `    /**
     * ${method.description || method.name}
     */
    async ${method.name}(${method.params || ''}) {
        // Implementation based on customer's patterns
        throw new Error('Method not yet implemented');
    }

`;
        });

        code += `}

module.exports = new ${className}();
`;

        return code;
    }

    /**
     * Generate integration guide
     */
    async generateIntegrationGuide(expertType, guide, analysis) {
        return {
            expert_type: expertType,
            integration_patterns: this.extractIntegrationPatterns(guide),
            service_integration: this.generateServiceIntegration(expertType),
            script_integration: this.generateScriptIntegration(expertType),
            api_integration: this.generateAPIIntegration(expertType)
        };
    }

    /**
     * Extract common operations from guide
     */
    extractCommonOperations(guide) {
        // Extract from guide sections
        return guide.programmatic_tools?.map(tool => ({
            name: tool.name,
            description: tool.description,
            example: tool.example
        })) || [];
    }

    /**
     * Extract quick commands
     */
    extractQuickCommands(guide) {
        return guide.sections
            ?.filter(section => section.title?.toLowerCase().includes('command'))
            .map(section => section.content)
            || [];
    }

    /**
     * Extract common patterns
     */
    extractCommonPatterns(guide) {
        return guide.sections
            ?.filter(section => section.title?.toLowerCase().includes('pattern'))
            .map(section => ({
                title: section.title,
                pattern: section.content
            }))
            || [];
    }

    /**
     * Extract common issues
     */
    extractCommonIssues(guide) {
        return guide.troubleshooting || [];
    }

    /**
     * Extract helper methods from guide
     */
    extractHelperMethods(guide) {
        // Extract methods from programmatic_tools
        if (!guide || !guide.programmatic_tools || !Array.isArray(guide.programmatic_tools)) {
            return [];
        }
        
        return guide.programmatic_tools.map(tool => {
            const toolName = tool.name || tool.title || 'method';
            return {
                name: typeof toolName === 'string' ? this.toCamelCase(toolName) : 'method',
                description: tool.description || '',
                params: tool.params || ''
            };
        });
    }

    /**
     * Extract integration patterns
     */
    extractIntegrationPatterns(guide) {
        return guide.sections
            ?.filter(section => section.title?.toLowerCase().includes('integration'))
            .map(section => section.content)
            || [];
    }

    /**
     * Generate service integration patterns
     */
    generateServiceIntegration(expertType) {
        return {
            import: `const ${expertType}Helper = require('./services/${expertType}Helper');`,
            usage: `await ${expertType}Helper.methodName(params);`
        };
    }

    /**
     * Generate script integration patterns
     */
    generateScriptIntegration(expertType) {
        return {
            cli_command: `npm run ${expertType}:operation`,
            script_example: `const ${expertType}Helper = require('./server/services/${expertType}Helper');`
        };
    }

    /**
     * Generate API integration patterns
     */
    generateAPIIntegration(expertType) {
        return {
            endpoint: `/api/${expertType}/*`,
            example: `GET /api/${expertType}/operation`
        };
    }

    /**
     * Calculate quality score
     */
    calculateQualityScore(guide, quickReference, helperService) {
        let score = 0;
        let maxScore = 0;

        // Guide completeness
        maxScore += 5;
        if (guide.title) score += 1;
        if (guide.overview) score += 1;
        if (guide.sections?.length > 0) score += 1;
        if (guide.best_practices?.length > 0) score += 1;
        if (guide.troubleshooting?.length > 0) score += 1;

        // Quick reference completeness
        maxScore += 3;
        if (quickReference.common_operations?.length > 0) score += 1;
        if (quickReference.quick_commands?.length > 0) score += 1;
        if (quickReference.common_patterns?.length > 0) score += 1;

        // Helper service completeness
        maxScore += 2;
        if (helperService.code) score += 1;
        if (helperService.methods?.length > 0) score += 1;

        return score / maxScore;
    }

    /**
     * Store experts in database
     */
    async storeExperts(projectId, experts) {
        if (!this.supabase) return;

        try {
            for (const [expertType, expert] of Object.entries(experts)) {
                const { error } = await this.supabase
                    .from('customer_expert_guides')
                    .upsert({
                        project_id: projectId,
                        expert_type: expertType,
                        guide_content: expert.guide,
                        quick_reference: expert.quick_reference,
                        helper_service_code: expert.helper_service.code,
                        integration_guide: expert.integration_guide,
                        quality_score: expert.quality_score,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'project_id,expert_type'
                    });

                if (error) {
                    console.warn(`[Expert Training Service] Error storing ${expertType} expert:`, error);
                }
            }
        } catch (err) {
            console.warn('[Expert Training Service] Error storing experts:', err);
        }
    }

    /**
     * Update training status
     */
    async updateTrainingStatus(projectId, status) {
        if (!this.supabase) return;

        try {
            const { error } = await this.supabase
                .from('expert_training_status')
                .upsert({
                    project_id: projectId,
                    ...status,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'project_id'
                });

            if (error) throw error;
        } catch (err) {
            console.warn('[Expert Training Service] Error updating training status:', err);
        }
    }

    /**
     * Load expert templates
     */
    loadExpertTemplates() {
        // Load templates based on our 5-expert packages
        // For now, use basic templates
        this.expertTemplates.set('database', {
            overview: 'Database expertise guide',
            sections: []
        });
        this.expertTemplates.set('testing', {
            overview: 'Testing expertise guide',
            sections: []
        });
        // Add more templates as needed
    }

    /**
     * Get expert template
     */
    getExpertTemplate(expertType) {
        // Try to get specific template
        if (this.expertTemplates.has(expertType)) {
            return this.expertTemplates.get(expertType);
        }

        // Try base type (e.g., 'framework-react' -> 'framework')
        const baseType = expertType.split('-')[0];
        if (this.expertTemplates.has(baseType)) {
            return this.expertTemplates.get(baseType);
        }

        // Return default template
        return {
            overview: `Expert guide for ${expertType}`,
            sections: []
        };
    }

    /**
     * Train agents on customer experts
     */
    async trainAgents(projectId, experts) {
        console.log(`[Expert Training Service] Training agents on experts for project ${projectId}...`);
        // This would integrate with Code Roach's fix generation services
        // to use customer-specific experts
        return {
            trained: true,
            experts_used: Object.keys(experts).length
        };
    }

    /**
     * Validate expert training
     */
    async validateTraining(projectId) {
        if (!this.supabase) {
            return { valid: false, reason: 'No database connection' };
        }

        try {
            const { data, error } = await this.supabase
                .from('expert_training_status')
                .select('*')
                .eq('project_id', projectId)
                .single();

            if (error || !data) {
                return { valid: false, reason: 'No training status found' };
            }

            const { data: experts } = await this.supabase
                .from('customer_expert_guides')
                .select('quality_score')
                .eq('project_id', projectId);

            const avgQuality = experts?.length > 0
                ? experts.reduce((sum, e) => sum + (e.quality_score || 0), 0) / experts.length
                : 0;

            return {
                valid: data.status === 'completed',
                status: data.status,
                experts_generated: data.experts_generated,
                quality_score: avgQuality,
                completed_at: data.completed_at
            };
        } catch (err) {
            return { valid: false, reason: err.message };
        }
    }

    /**
     * Utility: Convert to PascalCase
     */
    toPascalCase(str) {
        return str.split(/[-_]/).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('');
    }

    /**
     * Utility: Convert to camelCase
     */
    toCamelCase(str) {
        const pascal = this.toPascalCase(str);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }
}

module.exports = new ExpertTrainingService();

