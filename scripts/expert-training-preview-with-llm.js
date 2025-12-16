#!/usr/bin/env node
/**
 * Expert Training System - Preview with LLM Generation
 * Analyzes codebase, generates real expert guides using OpenAI
 * WITHOUT making any changes (no database writes, no file changes)
 */

const path = require('path');
const customerCodebaseAnalyzer = require('../server/services/customerCodebaseAnalyzer');
const expertTrainingService = require('../server/services/expertTrainingService');
const llmService = require('../server/services/llmService');

const CODEBASE_PATH = path.join(__dirname, '..');
const PREVIEW_PROJECT_ID = 'preview-smugglers-' + Date.now();

async function generateExpertPreview(expertType, analysis) {
    console.log(`\n   🔨 Generating ${expertType} expert guide...`);
    
    try {
        // Get template
        const template = expertTrainingService.getExpertTemplate(expertType);
        
        // Build context
        const context = expertTrainingService.buildAnalysisContext(analysis, expertType);
        
        // Build prompt
        const prompt = expertTrainingService.buildExpertGuidePrompt(expertType, template, analysis);
        
        // Call LLM - ensure prompt is a string
        let fixedPrompt = prompt;
        if (typeof prompt !== 'string') {
            fixedPrompt = JSON.stringify(prompt, null, 2);
        }
        
        // Use generateText with proper format
        let response;
        try {
            const result = await llmService.generateText({
                prompt: fixedPrompt,
                maxTokens: 4000,
                temperature: 0.7
            });
            // Extract text from response object if needed
            response = typeof result === 'string' ? result : (result.narrative || result.text || result.content || JSON.stringify(result));
        } catch (err) {
            // If generateText fails, try generateOpenAI directly
            console.log(`      ⚠️  generateText failed, trying direct OpenAI call...`);
            const openaiResult = await llmService.generateOpenAI('', fixedPrompt, 'gpt-4o-mini');
            // Extract text from OpenAI response
            response = typeof openaiResult === 'string' ? openaiResult : (openaiResult.narrative || openaiResult.text || openaiResult.content || JSON.stringify(openaiResult));
        }
        
        // Ensure response is a string for parsing
        if (typeof response !== 'string') {
            response = JSON.stringify(response);
        }
        
        // Parse response
        const guide = expertTrainingService.parseExpertGuide(response, expertType);
        
        // Generate quick reference and helper service
        const quickRef = await expertTrainingService.generateQuickReference(expertType, guide, analysis);
        const helperService = await expertTrainingService.generateHelperService(expertType, guide, analysis);
        const qualityScore = expertTrainingService.calculateQualityScore(guide, quickRef, helperService);
        
        return {
            expert_type: expertType,
            guide,
            quick_reference: quickRef,
            helper_service: helperService,
            quality_score: qualityScore
        };
    } catch (err) {
        console.log(`      ⚠️  LLM generation failed, using template fallback: ${err.message.substring(0, 100)}`);
        // Use fallback
        const guide = expertTrainingService.createFallbackGuide(expertType);
        const quickRef = await expertTrainingService.generateQuickReference(expertType, guide, analysis);
        const helperService = await expertTrainingService.generateHelperService(expertType, guide, analysis);
        const qualityScore = expertTrainingService.calculateQualityScore(guide, quickRef, helperService);
        
        return {
            expert_type: expertType,
            guide,
            quick_reference: quickRef,
            helper_service: helperService,
            quality_score: qualityScore
        };
    }
}

async function generatePreviewReportWithLLM() {
    console.log('🔍 Expert Training System - Preview with LLM Generation');
    console.log('='.repeat(70));
    console.log('');
    console.log('📁 Analyzing codebase:', CODEBASE_PATH);
    console.log('⚙️  Mode: PREVIEW (LLM calls enabled, no database/file changes)');
    console.log('');
    console.log('='.repeat(70));
    console.log('');

    try {
        // Step 1: Analyze codebase
        console.log('📊 Step 1: Analyzing Codebase...');
        console.log('-'.repeat(70));
        const analysis = await customerCodebaseAnalyzer.analyzeCodebase(
            PREVIEW_PROJECT_ID,
            CODEBASE_PATH
        );

        console.log('');
        console.log('✅ Analysis Complete!');
        console.log('');

        // Display tech stack summary
        console.log('🔧 Tech Stack:');
        console.log('   Languages:', analysis.tech_stack?.languages?.join(', ') || 'None');
        console.log('   Frameworks:', analysis.tech_stack?.frameworks?.join(', ') || 'None');
        console.log('   Databases:', analysis.tech_stack?.databases?.join(', ') || 'None');
        console.log('   Testing:', analysis.testing_patterns?.frameworks?.join(', ') || 'None');
        console.log('');

        // Step 2: Determine expert types
        console.log('='.repeat(70));
        console.log('📚 Step 2: Generating Expert Guides (Using OpenAI)');
        console.log('-'.repeat(70));
        console.log('');

        const expertTypes = expertTrainingService.determineExpertTypes(analysis);
        console.log(`Generating ${expertTypes.length} expert guides...`);
        console.log('(This may take a few moments)');
        console.log('');

        // Generate top 3 most important experts (to save tokens/time)
        const priorityExperts = [
            'database',
            'testing',
            'security',
            'code-style',
            'architecture'
        ].filter(type => expertTypes.includes(type)).slice(0, 3);

        const generatedExperts = {};

        for (const expertType of priorityExperts) {
            const expert = await generateExpertPreview(expertType, analysis);
            generatedExperts[expertType] = expert;
            
            const qualityIcon = expert.quality_score >= 0.8 ? '✅' : expert.quality_score >= 0.5 ? '⚠️' : '❌';
            console.log(`   ${qualityIcon} ${expertType}: Quality ${expert.quality_score.toFixed(2)}`);
        }

        console.log('');
        console.log('✅ Expert generation complete!');
        console.log('');

        // Step 3: Display generated experts
        console.log('='.repeat(70));
        console.log('📖 Step 3: Generated Expert Guides Preview');
        console.log('='.repeat(70));
        console.log('');

        for (const [expertType, expert] of Object.entries(generatedExperts)) {
            console.log(`\n📚 ${expertType.toUpperCase()} Expert`);
            console.log('-'.repeat(70));
            console.log(`Quality Score: ${expert.quality_score.toFixed(2)}`);
            console.log('');

            // Display guide overview
            if (expert.guide?.overview) {
                console.log('📋 Overview:');
                console.log(`   ${expert.guide.overview.substring(0, 200)}${expert.guide.overview.length > 200 ? '...' : ''}`);
                console.log('');
            }

            // Display sections
            if (expert.guide?.sections && expert.guide.sections.length > 0) {
                console.log(`📑 Sections (${expert.guide.sections.length}):`);
                expert.guide.sections.slice(0, 3).forEach((section, idx) => {
                    console.log(`   ${idx + 1}. ${section.title || 'Untitled'}`);
                    if (section.content) {
                        const preview = section.content.substring(0, 100).replace(/\n/g, ' ');
                        console.log(`      ${preview}...`);
                    }
                });
                if (expert.guide.sections.length > 3) {
                    console.log(`   ... and ${expert.guide.sections.length - 3} more sections`);
                }
                console.log('');
            }

            // Display best practices
            if (expert.guide?.best_practices && expert.guide.best_practices.length > 0) {
                console.log('✅ Best Practices:');
                expert.guide.best_practices.slice(0, 3).forEach((practice, idx) => {
                    const practiceText = typeof practice === 'string' ? practice : practice.title || practice.description || JSON.stringify(practice);
                    console.log(`   ${idx + 1}. ${practiceText.substring(0, 80)}${practiceText.length > 80 ? '...' : ''}`);
                });
                if (expert.guide.best_practices.length > 3) {
                    console.log(`   ... and ${expert.guide.best_practices.length - 3} more`);
                }
                console.log('');
            }

            // Display helper service methods
            if (expert.helper_service?.methods && expert.helper_service.methods.length > 0) {
                console.log('🔧 Helper Service Methods:');
                expert.helper_service.methods.slice(0, 5).forEach((method, idx) => {
                    console.log(`   ${idx + 1}. ${method.name}(${method.params || ''})`);
                    if (method.description) {
                        console.log(`      ${method.description.substring(0, 60)}...`);
                    }
                });
                if (expert.helper_service.methods.length > 5) {
                    console.log(`   ... and ${expert.helper_service.methods.length - 5} more methods`);
                }
                console.log('');
            }

            // Display quick reference
            if (expert.quick_reference?.common_operations && expert.quick_reference.common_operations.length > 0) {
                console.log('⚡ Quick Reference - Common Operations:');
                expert.quick_reference.common_operations.slice(0, 3).forEach((op, idx) => {
                    console.log(`   ${idx + 1}. ${op.name || op.title || 'Operation'}`);
                });
                console.log('');
            }
        }

        // Step 4: Summary
        console.log('='.repeat(70));
        console.log('📊 Step 4: Summary');
        console.log('='.repeat(70));
        console.log('');

        const avgQuality = Object.values(generatedExperts).reduce((sum, e) => sum + e.quality_score, 0) / Object.keys(generatedExperts).length;
        const highQuality = Object.values(generatedExperts).filter(e => e.quality_score >= 0.8).length;

        console.log(`   • Experts Generated: ${Object.keys(generatedExperts).length} (of ${expertTypes.length} total)`);
        console.log(`   • Average Quality Score: ${avgQuality.toFixed(2)}`);
        console.log(`   • High Quality (≥0.8): ${highQuality}/${Object.keys(generatedExperts).length}`);
        console.log('');

        // Step 5: What would happen next
        console.log('='.repeat(70));
        console.log('🚀 Step 5: What Would Happen Next');
        console.log('='.repeat(70));
        console.log('');

        console.log('If you proceed with onboarding, the system would:');
        console.log('');
        console.log('   1. ✅ Generate all remaining expert types');
        console.log(`      (${expertTypes.length - Object.keys(generatedExperts).length} more experts)`);
        console.log('');
        console.log('   2. ✅ Store experts in database');
        console.log('      - customer_expert_guides table');
        console.log('      - With full guide content, quick references, helper services');
        console.log('');
        console.log('   3. ✅ Train Code Roach agents');
        console.log('      - Agents will use these experts when generating fixes');
        console.log('      - Fixes will respect your codebase patterns');
        console.log('');
        console.log('   4. ✅ Update fix generation');
        console.log('      - llmFixGenerator will include expert context in prompts');
        console.log('      - Better, more accurate fixes');
        console.log('');

        // Recommendations
        console.log('='.repeat(70));
        console.log('💡 Recommendations');
        console.log('='.repeat(70));
        console.log('');

        if (avgQuality >= 0.8) {
            console.log('✅ Expert quality is excellent! Ready to proceed with onboarding.');
        } else if (avgQuality >= 0.6) {
            console.log('⚠️  Expert quality is good, but could be improved.');
            console.log('   Consider:');
            console.log('   - Providing more codebase context');
            console.log('   - Reviewing generated guides before storing');
        } else {
            console.log('❌ Expert quality is below threshold.');
            console.log('   Consider:');
            console.log('   - Improving codebase analysis');
            console.log('   - Adjusting LLM prompts');
            console.log('   - Using template-based generation');
        }
        console.log('');

        return {
            analysis,
            expertTypes,
            generatedExperts,
            summary: {
                totalExperts: expertTypes.length,
                generated: Object.keys(generatedExperts).length,
                avgQuality,
                highQuality
            }
        };

    } catch (err) {
        console.error('❌ Error generating preview:', err);
        throw err;
    }
}

// Run if called directly
if (require.main === module) {
    generatePreviewReportWithLLM().then(() => {
        console.log('✅ Preview with LLM complete!');
        console.log('');
        console.log('💡 Note: This was a preview - no changes were made.');
        console.log('   To actually generate and store experts, use:');
        console.log('   npm run code-roach:preview-experts (for analysis only)');
        console.log('   or start onboarding via API');
        console.log('');
        process.exit(0);
    }).catch(err => {
        console.error('💥 Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { generatePreviewReportWithLLM };

