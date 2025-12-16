/**
 * Code Roach API Client
 * Frontend client for interacting with Code Roach API
 */

class CodeRoachApiClient {
    constructor(baseUrl = '/api/code-roach') {
        this.baseUrl = baseUrl;
        this.authToken = null;
    }

    /**
     * Set authentication token
     */
    setAuthToken(token) {
        this.authToken = token;
    }

    /**
     * Initialize with auth (auto-detect from codeRoachAuth)
     */
    async initializeAuth() {
        if (typeof window !== 'undefined' && window.codeRoachAuth) {
            const token = await window.codeRoachAuth.getAuthToken();
            if (token) {
                this.setAuthToken(token);
            }
        }
    }

    /**
     * Get auth headers
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        return headers;
    }

    /**
     * Make API request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error(`[Code Roach API] Error: ${endpoint}`, error);
            throw error;
        }
    }

    // Health & Status
    async getHealth() {
        return this.request('/health');
    }

    async getStatus() {
        return this.request('/crawl/status');
    }

    // Crawl Operations
    async startCrawl(options = {}) {
        return this.request('/crawl', {
            method: 'POST',
            body: JSON.stringify({ options })
        });
    }

    async getJobStatus(jobId) {
        return this.request(`/jobs/${jobId}`);
    }

    // Projects
    async getProjects() {
        return this.request('/projects');
    }

    async getProject(projectId) {
        return this.request(`/projects/${projectId}`);
    }

    async createProject(data) {
        return this.request('/projects', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async updateProject(projectId, updates) {
        return this.request(`/projects/${projectId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    async deleteProject(projectId) {
        return this.request(`/projects/${projectId}`, {
            method: 'DELETE'
        });
    }

    // Organizations
    async getOrganizations() {
        return this.request('/organizations');
    }

    async createOrganization(name, slug = null) {
        return this.request('/organizations', {
            method: 'POST',
            body: JSON.stringify({ name, slug })
        });
    }

    // Issues
    async getIssues(filters = {}) {
        const params = new URLSearchParams();
        if (filters.projectId) params.append('projectId', filters.projectId);
        if (filters.status) params.append('status', filters.status);
        if (filters.severity) params.append('severity', filters.severity);
        if (filters.type) params.append('type', filters.type);
        if (filters.filePath) params.append('filePath', filters.filePath);
        if (filters.limit) params.append('limit', filters.limit);
        if (filters.offset) params.append('offset', filters.offset);

        const query = params.toString();
        return this.request(`/issues${query ? '?' + query : ''}`);
    }

    async getIssue(issueId) {
        return this.request(`/issues/${issueId}`);
    }

    async updateIssue(issueId, updates) {
        return this.request(`/issues/${issueId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    // Statistics
    async getStats(projectId = null) {
        const query = projectId ? `?projectId=${projectId}` : '';
        return this.request(`/stats${query}`);
    }

    // Queue
    async getQueueStats() {
        return this.request('/queue/stats');
    }

    // Cache
    async getCacheStats() {
        return this.request('/cache/stats');
    }

    async clearCache() {
        return this.request('/cache/clear', {
            method: 'POST'
        });
    }

    // ============================================
    // New Services API Methods
    // ============================================

    // Fix Impact Prediction
    async predictFixImpact(fix, context) {
        return this.request('/fixes/predict-impact', {
            method: 'POST',
            body: JSON.stringify({ fix, context })
        });
    }

    // Fix Confidence Calibration
    async calibrateConfidence(confidence, context) {
        return this.request('/fixes/calibrate-confidence', {
            method: 'POST',
            body: JSON.stringify({ confidence, context })
        });
    }

    async recordFixOutcome(fixId, predictedConfidence, actualSuccess, context) {
        return this.request('/fixes/record-outcome', {
            method: 'POST',
            body: JSON.stringify({ fixId, predictedConfidence, actualSuccess, context })
        });
    }

    async getCalibrationReport(method = null, domain = null) {
        const params = new URLSearchParams();
        if (method) params.append('method', method);
        if (domain) params.append('domain', domain);
        const query = params.toString();
        return this.request(`/fixes/calibration-report${query ? '?' + query : ''}`);
    }

    // Fix Rollback Intelligence
    async startMonitoringFix(fixId, fixData, context) {
        return this.request(`/fixes/${fixId}/monitor`, {
            method: 'POST',
            body: JSON.stringify({ fixData, context })
        });
    }

    async checkRollback(fixId) {
        return this.request(`/fixes/${fixId}/rollback-check`);
    }

    async rollbackFix(fixId, strategy = null) {
        return this.request(`/fixes/${fixId}/rollback`, {
            method: 'POST',
            body: JSON.stringify({ strategy })
        });
    }

    async getRollbackStats(projectId = null) {
        const query = projectId ? `?projectId=${projectId}` : '';
        return this.request(`/fixes/rollback-stats${query}`);
    }

    // Fix Cost-Benefit Analysis
    async analyzeCostBenefit(fix, context) {
        return this.request('/fixes/analyze-cost-benefit', {
            method: 'POST',
            body: JSON.stringify({ fix, context })
        });
    }

    async prioritizeFixes(issues, context) {
        return this.request('/fixes/prioritize', {
            method: 'POST',
            body: JSON.stringify({ issues, context })
        });
    }

    // Fix Orchestration
    async orchestrateFix(issue, context) {
        return this.request('/fixes/orchestrate', {
            method: 'POST',
            body: JSON.stringify({ issue, context })
        });
    }

    async getPipelineStatus(pipelineId) {
        return this.request(`/fixes/pipelines/${pipelineId}`);
    }

    async getAllPipelines() {
        return this.request('/fixes/pipelines');
    }

    // Fix Monitoring
    async startFixMonitoring(fixId, fixData, context) {
        return this.request(`/fixes/${fixId}/start-monitoring`, {
            method: 'POST',
            body: JSON.stringify({ fixData, context })
        });
    }

    async getFixMonitoringStatus(fixId) {
        return this.request(`/fixes/${fixId}/monitoring-status`);
    }

    async stopFixMonitoring(fixId) {
        return this.request(`/fixes/${fixId}/stop-monitoring`, {
            method: 'POST'
        });
    }

    async getMonitoringDashboard() {
        return this.request('/fixes/monitoring/dashboard');
    }

    // Fix Marketplace
    async listMarketplacePatterns(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);
        if (options.sortBy) params.append('sortBy', options.sortBy);
        if (options.minRating) params.append('minRating', options.minRating);
        if (options.category) params.append('category', options.category);
        if (options.search) params.append('search', options.search);
        const query = params.toString();
        return this.request(`/marketplace/patterns${query ? '?' + query : ''}`);
    }

    async submitPattern(pattern, projectId, options = {}) {
        return this.request('/marketplace/patterns', {
            method: 'POST',
            body: JSON.stringify({ pattern, projectId, options })
        });
    }

    async ratePattern(patternId, rating, comment = null) {
        return this.request(`/marketplace/patterns/${patternId}/rate`, {
            method: 'POST',
            body: JSON.stringify({ rating, comment })
        });
    }

    async getPatternDetails(patternId) {
        return this.request(`/marketplace/patterns/${patternId}`);
    }

    async getFeaturedPatterns(limit = 10) {
        return this.request(`/marketplace/featured?limit=${limit}`);
    }

    async getTrendingPatterns(limit = 10) {
        return this.request(`/marketplace/trending?limit=${limit}`);
    }

    // Fix Quality Metrics & SLAs
    async getQualityMetrics(projectId = null, days = 30) {
        const params = new URLSearchParams();
        if (projectId) params.append('projectId', projectId);
        params.append('days', days);
        return this.request(`/quality/metrics?${params.toString()}`);
    }

    async getSLAReport(projectId = null, days = 30) {
        const params = new URLSearchParams();
        if (projectId) params.append('projectId', projectId);
        params.append('days', days);
        return this.request(`/quality/sla-report?${params.toString()}`);
    }

    // Fix Personalization
    async personalizeFix(fix, context) {
        return this.request('/fixes/personalize', {
            method: 'POST',
            body: JSON.stringify({ fix, context })
        });
    }

    async updateTeamPreferences(teamId, preferences, projectId = null) {
        const query = projectId ? `?projectId=${projectId}` : '';
        return this.request(`/teams/${teamId}/preferences${query}`, {
            method: 'PUT',
            body: JSON.stringify({ preferences })
        });
    }

    // Fix Documentation Generation
    async generateFixDocumentation(fixId, fix, context) {
        return this.request(`/fixes/${fixId}/documentation`, {
            method: 'POST',
            body: JSON.stringify({ fix, context })
        });
    }

    // Enhanced Explainability
    async explainFixEnhanced(fix, context) {
        return this.request('/fixes/explain-enhanced', {
            method: 'POST',
            body: JSON.stringify({ fix, context })
        });
    }

    async getFixSummary(fix, context) {
        return this.request('/fixes/explain-summary', {
            method: 'POST',
            body: JSON.stringify({ fix, context })
        });
    }

    // Cross-Project Learning
    async getCrossProjectRecommendations(issue, projectId) {
        const params = new URLSearchParams();
        params.append('issue', JSON.stringify(issue));
        if (projectId) params.append('projectId', projectId);
        return this.request(`/learning/cross-project/recommendations?${params.toString()}`);
    }

    async getPatternMarketplace(limit = 50) {
        return this.request(`/learning/marketplace?limit=${limit}`);
    }
}

// Export singleton instance
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeRoachApiClient;
} else {
    window.CodeRoachApiClient = CodeRoachApiClient;
}

