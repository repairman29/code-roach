/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/customerOnboardingService.js
 * Last Sync: 2025-12-16T04:14:36.744Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Customer Onboarding Service
 * Orchestrates the expert training workflow during customer onboarding
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const customerCodebaseAnalyzer = require('./customerCodebaseAnalyzer');
const expertTrainingService = require('./expertTrainingService');

class CustomerOnboardingService {
    constructor() {
        this.supabase = null;
        
        if (config.supabase?.url && config.supabase?.serviceRoleKey) {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        }
    }

    /**
     * Start onboarding process for a new customer project
     * @param {string} projectId - Project ID
     * @param {string} repositoryUrl - Repository URL or codebase path
     * @param {Object} options - Onboarding options
     * @returns {Promise<Object>} Onboarding result
     */
    async startOnboarding(projectId, repositoryUrl, options = {}) {
        console.log(`[Customer Onboarding] Starting onboarding for project ${projectId}...`);

        try {
            // Initialize training status
            await this.initializeTrainingStatus(projectId);

            // Step 1: Analyze codebase
            console.log('[Customer Onboarding] Step 1: Analyzing codebase...');
            const analysis = await customerCodebaseAnalyzer.analyzeCodebase(projectId, repositoryUrl);

            // Step 2: Generate experts
            console.log('[Customer Onboarding] Step 2: Generating experts...');
            await this.updateTrainingStatus(projectId, {
                status: 'in_progress',
                started_at: new Date().toISOString()
            });

            const experts = await expertTrainingService.generateExperts(projectId, analysis);

            // Step 3: Train agents
            console.log('[Customer Onboarding] Step 3: Training agents...');
            await expertTrainingService.trainAgents(projectId, experts);

            // Step 4: Validate training
            console.log('[Customer Onboarding] Step 4: Validating training...');
            const validation = await expertTrainingService.validateTraining(projectId);

            // Step 5: Complete onboarding
            console.log('[Customer Onboarding] Step 5: Completing onboarding...');
            await this.completeOnboarding(projectId, {
                analysis,
                experts,
                validation
            });

            console.log(`[Customer Onboarding] Onboarding complete for project ${projectId}`);
            return {
                success: true,
                project_id: projectId,
                experts_generated: Object.keys(experts).length,
                validation,
                analysis_summary: {
                    tech_stack: analysis.tech_stack,
                    architecture: analysis.architecture_patterns
                }
            };
        } catch (err) {
            console.error('[Customer Onboarding] Error during onboarding:', err);
            await this.updateTrainingStatus(projectId, {
                status: 'failed',
                error_message: err.message
            });
            throw err;
        }
    }

    /**
     * Initialize training status
     */
    async initializeTrainingStatus(projectId) {
        if (!this.supabase) return;

        try {
            const { error } = await this.supabase
                .from('expert_training_status')
                .upsert({
                    project_id: projectId,
                    training_status: 'pending',
                    experts_generated: 0,
                    experts_total: 0,
                    started_at: new Date().toISOString()
                }, {
                    onConflict: 'project_id'
                });

            if (error) throw error;
        } catch (err) {
            console.warn('[Customer Onboarding] Error initializing training status:', err);
        }
    }

    /**
     * Update training status
     */
    async updateTrainingStatus(projectId, updates) {
        if (!this.supabase) return;

        try {
            const { error } = await this.supabase
                .from('expert_training_status')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('project_id', projectId);

            if (error) throw error;
        } catch (err) {
            console.warn('[Customer Onboarding] Error updating training status:', err);
        }
    }

    /**
     * Complete onboarding
     */
    async completeOnboarding(projectId, results) {
        await this.updateTrainingStatus(projectId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
            quality_score: results.validation?.quality_score || 0
        });

        // Store onboarding results
        if (this.supabase) {
            try {
                const { error } = await this.supabase
                    .from('projects')
                    .update({
                        onboarding_completed: true,
                        onboarding_completed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', projectId);

                if (error) throw error;
            } catch (err) {
                console.warn('[Customer Onboarding] Error updating project:', err);
            }
        }
    }

    /**
     * Get onboarding status
     */
    async getOnboardingStatus(projectId) {
        if (!this.supabase) {
            return { status: 'unknown', reason: 'No database connection' };
        }

        try {
            const { data, error } = await this.supabase
                .from('expert_training_status')
                .select('*')
                .eq('project_id', projectId)
                .single();

            if (error || !data) {
                return { status: 'not_started' };
            }

            return {
                status: data.training_status,
                experts_generated: data.experts_generated,
                experts_total: data.experts_total,
                quality_score: data.quality_score,
                started_at: data.started_at,
                completed_at: data.completed_at,
                error_message: data.error_message
            };
        } catch (err) {
            return { status: 'error', error: err.message };
        }
    }

    /**
     * Retry failed onboarding
     */
    async retryOnboarding(projectId, repositoryUrl) {
        console.log(`[Customer Onboarding] Retrying onboarding for project ${projectId}...`);
        return await this.startOnboarding(projectId, repositoryUrl);
    }

    /**
     * Re-analyze and update experts (for codebase changes)
     */
    async updateExperts(projectId, repositoryUrl) {
        console.log(`[Customer Onboarding] Updating experts for project ${projectId}...`);

        try {
            // Re-analyze codebase
            const analysis = await customerCodebaseAnalyzer.analyzeCodebase(projectId, repositoryUrl);

            // Update experts
            const experts = await expertTrainingService.generateExperts(projectId, analysis);

            // Re-train agents
            await expertTrainingService.trainAgents(projectId, experts);

            return {
                success: true,
                experts_updated: Object.keys(experts).length
            };
        } catch (err) {
            console.error('[Customer Onboarding] Error updating experts:', err);
            throw err;
        }
    }
}

module.exports = new CustomerOnboardingService();

