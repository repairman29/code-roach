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

// Commercial auth routes
app.use('/api/auth', createAuthRoutes());

// Health check
app.get('/api/health', createHealthCheck('code-roach', '1.0.0'));

// Commercial API endpoints (require authentication)
app.post('/api/analyze', authenticate, trackUsage, checkPricing, (req, res) => {
    res.json({
        status: 'success',
        message: 'Code analysis endpoint - Coming Soon',
        features: [
            'AST Analysis',
            'Code Smell Detection',
            'Security Vulnerability Scanning',
            'Performance Analysis'
        ],
        commercial: {
            tier: req.user?.tier,
            requests_used: req.user?.usage?.requests || 0
        }
    });
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







