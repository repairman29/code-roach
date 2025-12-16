#!/usr/bin/env node
/**
 * Expert Training System - Preview/Dry Run
 * Analyzes codebase and shows what experts would be generated
 * WITHOUT taking any actions (no database writes, no LLM calls)
 */

const path = require('path');
const customerCodebaseAnalyzer = require('../server/services/customerCodebaseAnalyzer');
const expertTrainingService = require('../server/services/expertTrainingService');

const CODEBASE_PATH = path.join(__dirname, '..');
const PREVIEW_PROJECT_ID = 'preview-smugglers-' + Date.now();

async function generatePreviewReport() {
    console.log('🔍 Expert Training System - Preview Mode');
    console.log('='.repeat(70));
    console.log('');
    console.log('📁 Analyzing codebase:', CODEBASE_PATH);
    console.log('⚙️  Mode: DRY RUN (no actions will be taken)');
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

        // Display tech stack
        console.log('🔧 Tech Stack Detected:');
        console.log('   Languages:', analysis.tech_stack?.languages?.join(', ') || 'None');
        console.log('   Frameworks:', analysis.tech_stack?.frameworks?.join(', ') || 'None');
        console.log('   Databases:', analysis.tech_stack?.databases?.join(', ') || 'None');
        console.log('   Build Tools:', analysis.tech_stack?.build_tools?.join(', ') || 'None');
        console.log('   Cloud Providers:', analysis.tech_stack?.cloud_providers?.join(', ') || 'None');
        console.log('');

        // Display architecture
        console.log('🏗️  Architecture Patterns:');
        console.log('   Pattern:', analysis.architecture_patterns?.pattern || 'Unknown');
        console.log('   API Style:', analysis.architecture_patterns?.api_style || 'Unknown');
        console.log('   State Management:', analysis.architecture_patterns?.state_management || 'Unknown');
        console.log('   File Structure:', analysis.architecture_patterns?.file_structure || 'Unknown');
        console.log('');

        // Display testing
        console.log('🧪 Testing Patterns:');
        console.log('   Frameworks:', analysis.testing_patterns?.frameworks?.join(', ') || 'None');
        console.log('   Test Location:', analysis.testing_patterns?.test_location || 'Unknown');
        console.log('   Coverage Tool:', analysis.testing_patterns?.coverage_tool || 'None');
        console.log('');

        // Display security
        console.log('🔒 Security Practices:');
        console.log('   Authentication:', analysis.security_practices?.authentication || 'None');
        console.log('   Encryption:', analysis.security_practices?.encryption?.join(', ') || 'None');
        console.log('');

        // Display code organization
        console.log('📁 Code Organization:');
        console.log('   Structure:', analysis.code_organization?.structure || 'Unknown');
        console.log('   Naming Convention:', analysis.code_organization?.naming || 'Unknown');
        console.log('   Module System:', analysis.code_organization?.module_system || 'Unknown');
        console.log('');

        // Step 2: Determine expert types
        console.log('='.repeat(70));
        console.log('📚 Step 2: Expert Types That Would Be Generated');
        console.log('-'.repeat(70));
        console.log('');

        const expertTypes = expertTrainingService.determineExpertTypes(analysis);
        
        console.log(`✅ Would generate ${expertTypes.length} expert types:`);
        console.log('');

        // Group by category
        const categories = {
            'Core': expertTypes.filter(t => ['code-style', 'architecture'].includes(t)),
            'Stack-Specific': expertTypes.filter(t => t.startsWith('language-') || t.startsWith('framework-')),
            'Domain': expertTypes.filter(t => ['database', 'testing', 'security', 'api', 'state-management'].includes(t))
        };

        for (const [category, types] of Object.entries(categories)) {
            if (types.length > 0) {
                console.log(`   ${category}:`);
                types.forEach(type => {
                    const displayName = type
                        .replace('framework-', '')
                        .replace('language-', '')
                        .split('-')
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ');
                    console.log(`      • ${displayName} (${type})`);
                });
                console.log('');
            }
        }

        // Step 3: Recommendations
        console.log('='.repeat(70));
        console.log('💡 Step 3: Recommendations');
        console.log('-'.repeat(70));
        console.log('');

        const recommendations = [];

        // Check for missing experts
        const hasDatabase = analysis.tech_stack?.databases?.length > 0;
        const hasTesting = analysis.testing_patterns?.frameworks?.length > 0;
        const hasSecurity = analysis.security_practices?.authentication || analysis.security_practices?.encryption?.length > 0;

        if (hasDatabase) {
            recommendations.push({
                priority: 'High',
                category: 'Database',
                recommendation: `Generate database expert for: ${analysis.tech_stack.databases.join(', ')}`,
                benefit: 'Improves database-related fix quality and pattern matching'
            });
        }

        if (hasTesting) {
            recommendations.push({
                priority: 'High',
                category: 'Testing',
                recommendation: `Generate testing expert for: ${analysis.testing_patterns.frameworks.join(', ')}`,
                benefit: 'Better test generation and test-related fixes'
            });
        }

        if (hasSecurity) {
            recommendations.push({
                priority: 'Critical',
                category: 'Security',
                recommendation: 'Generate security expert to ensure secure code patterns',
                benefit: 'Prevents security vulnerabilities in generated fixes'
            });
        }

        // Framework-specific recommendations
        if (analysis.tech_stack?.frameworks?.length > 0) {
            analysis.tech_stack.frameworks.forEach(framework => {
                recommendations.push({
                    priority: 'Medium',
                    category: 'Framework',
                    recommendation: `Generate ${framework} expert for framework-specific patterns`,
                    benefit: `Fixes will respect ${framework} conventions and best practices`
                });
            });
        }

        // Architecture recommendations
        if (analysis.architecture_patterns?.pattern) {
            recommendations.push({
                priority: 'Medium',
                category: 'Architecture',
                recommendation: `Generate architecture expert for ${analysis.architecture_patterns.pattern} pattern`,
                benefit: 'Fixes will maintain architectural consistency'
            });
        }

        // Display recommendations
        recommendations.forEach((rec, index) => {
            const priorityIcon = rec.priority === 'Critical' ? '🔴' : rec.priority === 'High' ? '🟠' : '🟡';
            console.log(`${priorityIcon} ${rec.priority} Priority - ${rec.category}:`);
            console.log(`   Recommendation: ${rec.recommendation}`);
            console.log(`   Benefit: ${rec.benefit}`);
            console.log('');
        });

        // Step 4: Expected Impact
        console.log('='.repeat(70));
        console.log('📈 Step 4: Expected Impact');
        console.log('-'.repeat(70));
        console.log('');

        console.log('After generating experts, you can expect:');
        console.log('');
        console.log('   ✅ Better Fix Quality');
        console.log('      - Fixes will match your codebase patterns');
        console.log('      - Respects your architecture and conventions');
        console.log('      - Uses your preferred libraries and frameworks');
        console.log('');
        console.log('   ✅ Faster Onboarding');
        console.log('      - Code Roach understands your stack immediately');
        console.log('      - No manual configuration needed');
        console.log('');
        console.log('   ✅ Context-Aware Suggestions');
        console.log('      - Suggestions follow your coding style');
        console.log('      - Recommendations match your patterns');
        console.log('');
        console.log('   ✅ Improved Accuracy');
        console.log('      - Fewer false positives');
        console.log('      - More relevant fixes');
        console.log('');

        // Step 5: Next Steps
        console.log('='.repeat(70));
        console.log('🚀 Step 5: Next Steps');
        console.log('-'.repeat(70));
        console.log('');

        console.log('To actually generate experts:');
        console.log('');
        console.log('   1. Ensure database migration is applied:');
        console.log('      - Run migration: supabase/migrations/20250115000000_code_roach_expert_training.sql');
        console.log('');
        console.log('   2. Start onboarding for a project:');
        console.log('      POST /api/expert-training/onboard');
        console.log('      {');
        console.log('        "project_id": "your-project-uuid",');
        console.log('        "repository_url": "/path/to/codebase"');
        console.log('      }');
        console.log('');
        console.log('   3. Or use the service directly:');
        console.log('      const customerOnboardingService = require("./server/services/customerOnboardingService");');
        console.log('      await customerOnboardingService.startOnboarding(projectId, codebasePath);');
        console.log('');

        // Summary
        console.log('='.repeat(70));
        console.log('📋 Summary');
        console.log('='.repeat(70));
        console.log('');
        console.log(`   • Tech Stack: ${analysis.tech_stack?.languages?.length || 0} languages, ${analysis.tech_stack?.frameworks?.length || 0} frameworks`);
        console.log(`   • Expert Types: ${expertTypes.length} experts would be generated`);
        console.log(`   • Recommendations: ${recommendations.length} recommendations`);
        console.log(`   • Priority: ${recommendations.filter(r => r.priority === 'Critical' || r.priority === 'High').length} high-priority items`);
        console.log('');

        return {
            analysis,
            expertTypes,
            recommendations,
            summary: {
                languages: analysis.tech_stack?.languages?.length || 0,
                frameworks: analysis.tech_stack?.frameworks?.length || 0,
                databases: analysis.tech_stack?.databases?.length || 0,
                expertTypes: expertTypes.length,
                recommendations: recommendations.length
            }
        };

    } catch (err) {
        console.error('❌ Error generating preview:', err);
        throw err;
    }
}

// Run if called directly
if (require.main === module) {
    generatePreviewReport().then(() => {
        console.log('✅ Preview complete!');
        console.log('');
        process.exit(0);
    }).catch(err => {
        console.error('💥 Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { generatePreviewReport };

