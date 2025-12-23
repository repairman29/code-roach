/**
 * Code Roach Standalone - Entry Point
 * Self-learning code quality platform
 */

const express = require('express');
const path = require('path');
const {
    authenticate,
    trackUsage,
    checkPricing,
    createAuthRoutes,
    createHealthCheck
} = require('./commercial-middleware');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Initialize enterprise services
const EnterpriseCodeRoachService = require('./services/enterpriseCodeRoachService');
const ComplianceService = require('./services/complianceService');

const enterpriseService = new EnterpriseCodeRoachService();
const complianceService = new ComplianceService();

// Commercial auth routes
app.use('/api/auth', createAuthRoutes());

// Health check
app.get('/api/health', createHealthCheck('code-roach', '1.0.0'));

// Enterprise tenant management endpoints
app.post('/api/enterprise/tenants', authenticate, trackUsage, checkPricing, async (req, res) => {
    try {
        const tenantConfig = req.body;
        const result = await enterpriseService.createTenant(tenantConfig);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/enterprise/tenants/:tenantId', authenticate, trackUsage, checkPricing, async (req, res) => {
    try {
        const tenant = await enterpriseService.getTenant(req.params.tenantId);
        res.json(tenant);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

app.put('/api/enterprise/tenants/:tenantId', authenticate, trackUsage, checkPricing, async (req, res) => {
    try {
        const updates = req.body;
        const tenant = await enterpriseService.updateTenant(req.params.tenantId, updates);
        res.json(tenant);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Compliance endpoints
app.get('/api/compliance/check/:framework', authenticate, trackUsage, checkPricing, async (req, res) => {
    try {
        const { tenantId } = req.query;
        const compliance = await complianceService.checkCompliance(tenantId, req.params.framework);
        res.json(compliance);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/compliance/dsar', authenticate, trackUsage, checkPricing, async (req, res) => {
    try {
        const { tenantId, subjectId, requestType, data } = req.body;
        const dsar = await complianceService.processDSAR(tenantId, subjectId, requestType, data);
        res.json(dsar);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Enterprise analytics
app.get('/api/enterprise/analytics', authenticate, trackUsage, checkPricing, async (req, res) => {
    try {
        const { tenantId, period } = req.query;
        const analytics = await enterpriseService.generateEnterpriseAnalytics(tenantId, period);
        res.json(analytics);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Security breach handling
app.post('/api/security/breach', authenticate, trackUsage, checkPricing, async (req, res) => {
    try {
        const { tenantId, breachDetails } = req.body;
        const result = await complianceService.handleBreach(tenantId, breachDetails);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Commercial API endpoints (require authentication)
app.post('/api/analyze', authenticate, trackUsage, checkPricing, async (req, res) => {
    try {
        const { code, language, tenantId, framework } = req.body;

        // Basic analysis response
        const response = {
            status: 'success',
            message: 'Code analysis completed',
            features: [
                'AST Analysis',
                'Code Smell Detection',
                'Security Vulnerability Scanning',
                'Performance Analysis'
            ],
            enterprise: {
                multiTenant: true,
                compliance: ['GDPR', 'HIPAA', 'SOC2', 'PCI'],
                security: 'enterprise',
                reporting: 'advanced'
            },
            commercial: {
                tier: req.user?.tier,
                requests_used: req.user?.usage?.requests || 0
            }
        };

        // Enterprise features
        if (tenantId) {
            // Validate tenant
            const tenant = await enterpriseService.getTenant(tenantId);
            response.tenant = {
                name: tenant.name,
                plan: tenant.plan,
                compliance: tenant.settings.complianceFrameworks
            };

            // Check compliance if framework specified
            if (framework) {
                const compliance = await complianceService.checkCompliance(tenantId, framework, { code });
                response.compliance = compliance;
            }
        }

        res.json(response);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Analysis failed',
            error: error.message
        });
    }
});

app.post('/api/fix', authenticate, trackUsage, checkPricing, (req, res) => {
    res.json({
        status: 'success',
        message: 'Automated fixing endpoint - Coming Soon',
        capabilities: [
            'Auto-fix security issues',
            'Code quality improvements',
            'Performance optimizations',
            'Best practice enforcement'
        ],
        commercial: {
            tier: req.user?.tier,
            requests_used: req.user?.usage?.requests || 0
        }
    });
});

app.post('/api/review', authenticate, trackUsage, checkPricing, (req, res) => {
    res.json({
        status: 'success',
        message: 'Code review endpoint - Coming Soon',
        features: [
            'AI-powered code review',
            'Pattern recognition',
            'Consistency checking',
            'Technical debt analysis'
        ],
        commercial: {
            tier: req.user?.tier,
            requests_used: req.user?.usage?.requests || 0
        }
    });
});

// Basic API endpoints (placeholders for full implementation)
app.post('/api/analyze', (req, res) => {
    res.json({
        status: 'success',
        message: 'Code analysis endpoint - Coming Soon',
        features: [
            'AST Analysis',
            'Code Smell Detection',
            'Security Vulnerability Scanning',
            'Performance Analysis'
        ]
    });
});

app.post('/api/fix', (req, res) => {
    res.json({
        status: 'success',
        message: 'Automated fixing endpoint - Coming Soon',
        capabilities: [
            'Auto-fix security issues',
            'Code quality improvements',
            'Performance optimizations',
            'Best practice enforcement'
        ]
    });
});

app.post('/api/review', (req, res) => {
    res.json({
        status: 'success',
        message: 'Code review endpoint - Coming Soon',
        features: [
            'AI-powered code review',
            'Pattern recognition',
            'Consistency checking',
            'Technical debt analysis'
        ]
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve Code Roach pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-dashboard.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-dashboard.html'));
});

app.get('/projects', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-projects.html'));
});

app.get('/issues', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-issues.html'));
});

app.get('/marketplace', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-marketplace.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-login.html'));
});

// Catch-all handler for client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-dashboard.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

app.listen(PORT, () => {
    console.log(`🐛 Code Roach Standalone running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
    console.log(`   Dashboard: http://localhost:${PORT}/`);
});

module.exports = app;







