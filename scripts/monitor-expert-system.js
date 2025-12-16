#!/usr/bin/env node
/**
 * Monitor Expert System Performance
 * Shows usage statistics, learning progress, and effectiveness metrics
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../server/config');
const expertLearningService = require('../server/services/expertLearningService');
const expertUsageTracker = require('../server/services/expertUsageTracker');

async function monitorExpertSystem(projectId = null) {
    console.log('📊 Expert System Monitoring Dashboard');
    console.log('='.repeat(70));
    console.log('');

    const supabase = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey
    );

    // Get all projects with experts
    let projects = [];
    if (projectId) {
        projects = [{ id: projectId }];
    } else {
        const { data: projectsData } = await supabase
            .from('customer_expert_guides')
            .select('project_id')
            .limit(10);
        
        if (projectsData) {
            const uniqueProjects = [...new Set(projectsData.map(p => p.project_id))];
            projects = uniqueProjects.map(id => ({ id }));
        }
    }

    if (projects.length === 0) {
        console.log('⚠️  No projects with experts found');
        return;
    }

    for (const project of projects) {
        console.log(`📁 Project: ${project.id}`);
        console.log('-'.repeat(70));
        console.log('');

        // Get experts
        const { data: experts } = await supabase
            .from('customer_expert_guides')
            .select('expert_type, quality_score, generated_at, updated_at')
            .eq('project_id', project.id)
            .order('expert_type');

        if (!experts || experts.length === 0) {
            console.log('   ⚠️  No experts found for this project');
            continue;
        }

        console.log(`   📚 Experts: ${experts.length}`);
        console.log('');

        // Get usage statistics
        const usageStats = await expertUsageTracker.getUsageStats(project.id);
        
        // Get learning statistics
        const learningStats = await expertLearningService.getLearningStats(project.id);

        // Display expert performance
        console.log('   📈 Expert Performance:');
        console.log('');

        for (const expert of experts) {
            const usage = usageStats?.find(u => u.expert_type === expert.expert_type);
            const learning = learningStats?.byExpertType?.[expert.expert_type];

            const qualityIcon = expert.quality_score >= 0.8 ? '✅' : expert.quality_score >= 0.5 ? '⚠️' : '❌';
            
            console.log(`   ${qualityIcon} ${expert.expert_type}:`);
            console.log(`      Quality Score: ${expert.quality_score || 'N/A'}`);
            
            if (usage) {
                console.log(`      Usage Count: ${usage.usage_count || 0}`);
                console.log(`      Last Used: ${usage.last_used_at ? new Date(usage.last_used_at).toLocaleDateString() : 'Never'}`);
                
                if (usage.success_count !== undefined || usage.failure_count !== undefined) {
                    const total = (usage.success_count || 0) + (usage.failure_count || 0);
                    if (total > 0) {
                        const successRate = (usage.success_count || 0) / total;
                        const successIcon = successRate >= 0.8 ? '✅' : successRate >= 0.6 ? '⚠️' : '❌';
                        console.log(`      Success Rate: ${successIcon} ${(successRate * 100).toFixed(1)}% (${usage.success_count || 0}/${total})`);
                    }
                }
            } else {
                console.log(`      Usage: Not yet used`);
            }

            if (learning) {
                console.log(`      Learning Data: ${learning.total} outcomes recorded`);
                if (learning.total > 0) {
                    const learningRate = learning.success / learning.total;
                    console.log(`      Learning Success Rate: ${(learningRate * 100).toFixed(1)}%`);
                }
            }

            console.log('');
        }

        // Overall statistics
        if (learningStats) {
            console.log('   📊 Overall Statistics:');
            console.log(`      Total Fix Outcomes: ${learningStats.total}`);
            console.log(`      Success Rate: ${(learningStats.successRate * 100).toFixed(1)}%`);
            console.log(`      Successes: ${learningStats.success}`);
            console.log(`      Failures: ${learningStats.failure}`);
            console.log('');
        }

        // Learning recommendations
        console.log('   💡 Learning Recommendations:');
        console.log('');

        if (learningStats && learningStats.total < 10) {
            console.log('      ⚠️  Need more data: Only', learningStats.total, 'outcomes recorded');
            console.log('         The system needs at least 10 outcomes to start learning');
        } else if (learningStats && learningStats.successRate < 0.6) {
            console.log('      🔴 Low success rate detected:', (learningStats.successRate * 100).toFixed(1) + '%');
            console.log('         Experts may need updating based on failure patterns');
        } else if (learningStats && learningStats.successRate >= 0.8) {
            console.log('      ✅ Excellent success rate:', (learningStats.successRate * 100).toFixed(1) + '%');
            console.log('         Experts are performing well!');
        } else {
            console.log('      ℹ️  System is learning from outcomes');
            console.log('         Continue using experts to improve quality');
        }
        console.log('');
    }

    // Summary
    console.log('='.repeat(70));
    console.log('📋 Summary');
    console.log('='.repeat(70));
    console.log('');
    console.log('   • Projects Monitored:', projects.length);
    console.log('   • Total Experts:', projects.reduce((sum, p) => {
        // Would need to query for each project
        return sum;
    }, 0));
    console.log('');
    console.log('💡 To improve learning:');
    console.log('   1. Use experts in fix generation (pass project_id in context)');
    console.log('   2. Record fix outcomes (success/failure)');
    console.log('   3. System will automatically improve experts over time');
    console.log('');
}

if (require.main === module) {
    const projectId = process.argv[2] || null;
    monitorExpertSystem(projectId).then(() => {
        process.exit(0);
    }).catch(err => {
        console.error('❌ Monitoring failed:', err);
        process.exit(1);
    });
}

module.exports = { monitorExpertSystem };

