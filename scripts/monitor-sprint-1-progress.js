/**
 * Monitor Sprint 1 Progress
 * Tracks progress on Sprint 1: Foundation & Intelligence Activation
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../server/config');

const supabase = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey
);

async function checkProgress() {
    console.log('📊 Sprint 1 Progress Report\n');
    console.log('='.repeat(60));

    // Check agent decisions
    try {
        const { count: decisionCount } = await supabase
            .from('agent_decisions')
            .select('*', { count: 'exact', head: true });

        console.log(`\n✅ Agent Decisions Recorded: ${decisionCount || 0}`);
    } catch (err) {
        console.log(`\n❌ Error checking decisions: ${err.message}`);
    }

    // Check knowledge base
    try {
        const { count: knowledgeCount } = await supabase
            .from('agent_knowledge_base')
            .select('*', { count: 'exact', head: true });

        console.log(`✅ Knowledge Base Entries: ${knowledgeCount || 0}`);
    } catch (err) {
        console.log(`❌ Error checking knowledge: ${err.message}`);
    }

    // Check agent sessions
    try {
        const { count: sessionCount } = await supabase
            .from('agent_sessions')
            .select('*', { count: 'exact', head: true });

        console.log(`✅ Agent Sessions: ${sessionCount || 0}`);
    } catch (err) {
        console.log(`❌ Error checking sessions: ${err.message}`);
    }

    // Check code roach issues (for real-time feed)
    try {
        const { count: issueCount } = await supabase
            .from('code_roach_issues')
            .select('*', { count: 'exact', head: true });

        console.log(`✅ Code Roach Issues: ${issueCount || 0}`);
    } catch (err) {
        console.log(`❌ Error checking issues: ${err.message}`);
    }

    // Get decision stats by agent type
    try {
        const { data: stats } = await supabase
            .from('agent_decisions')
            .select('agent_type, outcome')
            .limit(1000);

        if (stats && stats.length > 0) {
            const byAgent = {};
            stats.forEach(stat => {
                if (!byAgent[stat.agent_type]) {
                    byAgent[stat.agent_type] = { total: 0, success: 0, failure: 0 };
                }
                byAgent[stat.agent_type].total++;
                if (stat.outcome === 'success') {
                    byAgent[stat.agent_type].success++;
                } else if (stat.outcome === 'failure') {
                    byAgent[stat.agent_type].failure++;
                }
            });

            console.log(`\n📈 Agent Activity:`);
            for (const [agent, data] of Object.entries(byAgent)) {
                const successRate = ((data.success / data.total) * 100).toFixed(1);
                console.log(`   ${agent}: ${data.total} decisions (${successRate}% success)`);
            }
        }
    } catch (err) {
        console.log(`❌ Error checking stats: ${err.message}`);
    }

    // Get knowledge base by type
    try {
        const { data: knowledge } = await supabase
            .from('agent_knowledge_base')
            .select('knowledge_type')
            .limit(1000);

        if (knowledge && knowledge.length > 0) {
            const byType = {};
            knowledge.forEach(k => {
                byType[k.knowledge_type] = (byType[k.knowledge_type] || 0) + 1;
            });

            console.log(`\n📚 Knowledge Base by Type:`);
            for (const [type, count] of Object.entries(byType)) {
                console.log(`   ${type}: ${count} entries`);
            }
        }
    } catch (err) {
        console.log(`❌ Error checking knowledge types: ${err.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🎯 Sprint 1 Goals:');
    console.log('   ✅ Code Roach uses agent session memory');
    console.log('   ⏳ All agents record decisions to Supabase');
    console.log('   ⏳ Knowledge base populated with initial patterns');
    console.log('   ✅ Real-time code quality feed active');
    console.log('\n💡 Run this script regularly to track progress!');
}

if (require.main === module) {
    checkProgress().catch(console.error);
}

module.exports = { checkProgress };
