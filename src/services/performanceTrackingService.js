/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/performanceTrackingService.js
 * Last Sync: 2025-12-14T07:30:45.704Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Performance Tracking Service
 * Tracks query performance, API costs, and system resources
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class PerformanceTrackingService {
    constructor() {
        this.supabase = createClient(
            config.supabase.url,
            config.supabase.serviceRoleKey
        );
    }

    /**
     * Log slow query
     */
    async logSlowQuery(queryData) {
        try {
            const { error } = await this.supabase.rpc('log_slow_query', {
                query_type_param: queryData.queryType,
                execution_time_ms_param: queryData.executionTimeMs,
                rows_returned_param: queryData.rowsReturned,
                cache_hit_param: queryData.cacheHit || false,
                query_text_param: queryData.queryText,
                error_message_param: queryData.errorMessage
            });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[PerformanceTrackingService] Error logging query:', error);
            return false;
        }
    }

    /**
     * Get slow queries
     */
    async getSlowQueries(hours = 24, minMs = 1000) {
        try {
            const { data, error } = await this.supabase.rpc('get_slow_queries', {
                p_hours: hours,
                p_min_ms: minMs
            });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[PerformanceTrackingService] Error getting slow queries:', error);
            return [];
        }
    }

    /**
     * Track API cost
     */
    async trackAPICost(costData) {
        try {
            const { error } = await this.supabase
                .from('api_cost_tracking')
                .insert({
                    service: costData.service,
                    operation_type: costData.operationType,
                    cost_usd: costData.costUsd,
                    tokens_used: costData.tokensUsed,
                    cache_used: costData.cacheUsed || false,
                    request_id: costData.requestId,
                    metadata: costData.metadata || {}
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[PerformanceTrackingService] Error tracking API cost:', error);
            return false;
        }
    }

    /**
     * Get API costs summary
     */
    async getAPICostsSummary(days = 7, service = null) {
        try {
            const { data, error } = await this.supabase.rpc('get_api_costs_summary', {
                p_days: days,
                p_service: service
            });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[PerformanceTrackingService] Error getting costs:', error);
            return [];
        }
    }

    /**
     * Track cache metrics
     */
    async trackCacheMetrics(metrics) {
        try {
            const { error } = await this.supabase
                .from('cache_metrics')
                .insert({
                    cache_type: metrics.cacheType,
                    hit_rate: metrics.hitRate,
                    avg_hit_time_ms: metrics.avgHitTimeMs,
                    avg_miss_time_ms: metrics.avgMissTimeMs,
                    cache_size_mb: metrics.cacheSizeMb,
                    eviction_count: metrics.evictionCount || 0,
                    metadata: metrics.metadata || {}
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[PerformanceTrackingService] Error tracking cache:', error);
            return false;
        }
    }

    /**
     * Get cache effectiveness
     */
    async getCacheEffectiveness(cacheType = null, hours = 24) {
        try {
            const { data, error } = await this.supabase.rpc('get_cache_effectiveness', {
                p_cache_type: cacheType,
                p_hours: hours
            });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[PerformanceTrackingService] Error getting cache stats:', error);
            return [];
        }
    }

    /**
     * Track system resource
     */
    async trackSystemResource(resource) {
        try {
            const { error } = await this.supabase
                .from('system_resources')
                .insert({
                    metric_type: resource.metricType,
                    value: resource.value,
                    unit: resource.unit,
                    host: resource.host,
                    metadata: resource.metadata || {}
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[PerformanceTrackingService] Error tracking resource:', error);
            return false;
        }
    }
}

module.exports = new PerformanceTrackingService();
