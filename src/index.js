/**
 * Code Roach Standalone - Entry Point
 * Self-learning code quality platform
 */

const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'code-roach',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// API Routes
const codeRoachAPI = require('./routes/codeRoachAPI');
app.use('/api/code-roach', codeRoachAPI);

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve Code Roach pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-dashboard.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-dashboard.html'));
});

app.get('/issues', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-issues.html'));
});

app.get('/projects', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-projects.html'));
});

app.get('/marketplace', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'code-roach-marketplace.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error('[Code Roach] Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        status: 'error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Code Roach] SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('[Code Roach] Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('[Code Roach] SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('[Code Roach] Server closed');
        process.exit(0);
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`🚀 Code Roach Standalone running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`🐛 Issues: http://localhost:${PORT}/issues`);
    console.log(`🏪 Marketplace: http://localhost:${PORT}/marketplace`);
});

module.exports = app;
