/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/connectionManager.js
 * Last Sync: 2025-12-14T07:30:45.645Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Connection Manager
 * Handles connection limits, queuing, and resource management for 1000+ concurrent users
 */

class ConnectionManager {
    constructor(io, config = {}) {
        this.io = io;
        
        // Configuration
        this.config = {
            maxConnections: config.maxConnections || 2000, // Max total connections (2x target for headroom)
            maxConnectionsPerIP: config.maxConnectionsPerIP || 50, // Max connections per IP
            connectionQueueSize: config.connectionQueueSize || 500, // Max queued connections
            connectionTimeout: config.connectionTimeout || 30000, // 30 seconds to establish
            cleanupInterval: config.cleanupInterval || 60000, // Cleanup every minute
            resourceCheckInterval: config.resourceCheckInterval || 10000, // Check resources every 10s
            ...config
        };
        
        // Connection tracking
        this.connections = new Map(); // socketId -> connection data
        this.connectionsByIP = new Map(); // ip -> Set of socketIds
        this.connectionQueue = []; // Queued connection requests
        this.activeConnections = 0;
        
        // Resource tracking
        this.resourceStats = {
            cpuUsage: 0,
            memoryUsage: 0,
            connectionCount: 0,
            queueLength: 0,
            rejectedConnections: 0,
            lastUpdate: Date.now()
        };
        
        // Start monitoring
        this.startMonitoring();
    }
    
    /**
     * Check if new connection should be accepted
     */
    canAcceptConnection(socket) {
        const ip = this.getClientIP(socket);
        
        // Check total connection limit
        if (this.activeConnections >= this.config.maxConnections) {
            return {
                allowed: false,
                reason: 'max_connections_reached',
                message: 'Server at capacity. Please try again in a moment.'
            };
        }
        
        // Check per-IP limit
        const ipConnections = this.connectionsByIP.get(ip) || new Set();
        if (ipConnections.size >= this.config.maxConnectionsPerIP) {
            return {
                allowed: false,
                reason: 'max_connections_per_ip',
                message: 'Too many connections from this IP address.'
            };
        }
        
        // Check resource availability
        if (!this.hasAvailableResources()) {
            // Queue connection if queue not full
            if (this.connectionQueue.length < this.config.connectionQueueSize) {
                return {
                    allowed: false,
                    reason: 'queued',
                    message: 'Server busy. Your connection is queued.',
                    queued: true
                };
            } else {
                return {
                    allowed: false,
                    reason: 'queue_full',
                    message: 'Server at capacity. Please try again later.'
                };
            }
        }
        
        return { allowed: true };
    }
    
    /**
     * Register a new connection
     */
    registerConnection(socket) {
        const check = this.canAcceptConnection(socket);
        
        if (!check.allowed) {
            if (check.queued) {
                // Add to queue
                this.queueConnection(socket, check);
                return false;
            } else {
                // Reject connection
                this.rejectConnection(socket, check);
                return false;
            }
        }
        
        const ip = this.getClientIP(socket);
        const connectionData = {
            socketId: socket.id,
            ip: ip,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            sessionCode: null,
            playerId: null
        };
        
        // Track connection
        this.connections.set(socket.id, connectionData);
        
        // Track by IP
        if (!this.connectionsByIP.has(ip)) {
            this.connectionsByIP.set(ip, new Set());
        }
        this.connectionsByIP.get(ip).add(socket.id);
        
        this.activeConnections++;
        this.updateResourceStats();
        
        // Set up connection handlers
        this.setupConnectionHandlers(socket);
        
        return true;
    }
    
    /**
     * Queue a connection for later
     */
    queueConnection(socket, check) {
        const queueEntry = {
            socket: socket,
            queuedAt: Date.now(),
            check: check
        };
        
        this.connectionQueue.push(queueEntry);
        this.updateResourceStats();
        
        // Notify client
        socket.emit('connection_queued', {
            position: this.connectionQueue.length,
            estimatedWait: this.estimateWaitTime()
        });
        
        // Set timeout for queued connection
        setTimeout(() => {
            const index = this.connectionQueue.findIndex(e => e.socket.id === socket.id);
            if (index !== -1) {
                this.connectionQueue.splice(index, 1);
                this.rejectConnection(socket, {
                    reason: 'queue_timeout',
                    message: 'Connection timeout while in queue.'
                });
            }
        }, this.config.connectionTimeout);
    }
    
    /**
     * Process queued connections
     */
    processQueue() {
        if (this.connectionQueue.length === 0) return;
        if (!this.hasAvailableResources()) return;
        
        // Process up to 10 connections at a time
        let processed = 0;
        const maxProcess = 10;
        
        while (this.connectionQueue.length > 0 && processed < maxProcess) {
            const entry = this.connectionQueue.shift();
            const socket = entry.socket;
            
            // Check again if connection is still valid
            if (socket && socket.connected) {
                const check = this.canAcceptConnection(socket);
                if (check.allowed) {
                    this.registerConnection(socket);
                    socket.emit('connection_accepted', {
                        message: 'Connection accepted from queue.'
                    });
                    processed++;
                } else if (!check.queued) {
                    // Re-queue if still can't accept but not rejected
                    this.connectionQueue.push(entry);
                    break;
                }
            }
        }
        
        this.updateResourceStats();
    }
    
    /**
     * Reject a connection
     */
    rejectConnection(socket, check) {
        this.resourceStats.rejectedConnections++;
        
        socket.emit('connection_rejected', {
            reason: check.reason,
            message: check.message || 'Connection rejected.'
        });
        
        setTimeout(() => {
            if (socket.connected) {
                socket.disconnect(true);
            }
        }, 1000);
    }
    
    /**
     * Unregister a connection
     */
    unregisterConnection(socket) {
        const connectionData = this.connections.get(socket.id);
        if (!connectionData) return;
        
        // Remove from IP tracking
        const ipConnections = this.connectionsByIP.get(connectionData.ip);
        if (ipConnections) {
            ipConnections.delete(socket.id);
            if (ipConnections.size === 0) {
                this.connectionsByIP.delete(connectionData.ip);
            }
        }
        
        // Remove from connections
        this.connections.delete(socket.id);
        this.activeConnections--;
        this.updateResourceStats();
        
        // Process queue now that we have space
        this.processQueue();
    }
    
    /**
     * Update connection activity
     */
    updateActivity(socketId) {
        const connection = this.connections.get(socketId);
        if (connection) {
            connection.lastActivity = Date.now();
        }
    }
    
    /**
     * Set up connection handlers
     */
    setupConnectionHandlers(socket) {
        // Track activity
        socket.onAny(() => {
            this.updateActivity(socket.id);
        });
        
        // Handle disconnect
        socket.on('disconnect', () => {
            this.unregisterConnection(socket);
        });
        
        // Handle errors
        socket.on('error', (error) => {
            console.error(`Connection error for ${socket.id}:`, error);
            this.unregisterConnection(socket);
        });
    }
    
    /**
     * Check if server has available resources
     */
    hasAvailableResources() {
        // Check memory usage (if available)
        if (this.resourceStats.memoryUsage > 0.9) { // 90% memory usage
            return false;
        }
        
        // Check CPU usage (if available)
        if (this.resourceStats.cpuUsage > 0.9) { // 90% CPU usage
            return false;
        }
        
        return true;
    }
    
    /**
     * Get client IP address
     */
    getClientIP(socket) {
        return socket.handshake.address || 
               socket.handshake.headers['x-forwarded-for']?.split(',')[0] ||
               socket.request.connection.remoteAddress ||
               'unknown';
    }
    
    /**
     * Estimate wait time in queue
     */
    estimateWaitTime() {
        if (this.connectionQueue.length === 0) return 0;
        
        // Estimate based on average connection duration and current processing rate
        const avgConnectionDuration = 300000; // 5 minutes average
        const processingRate = Math.max(1, this.activeConnections / 10); // Connections per second
        const waitTime = (this.connectionQueue.length / processingRate) * 1000;
        
        return Math.min(waitTime, 60000); // Max 60 seconds estimate
    }
    
    /**
     * Start monitoring
     */
    startMonitoring() {
        // Process queue periodically
        setInterval(() => {
            this.processQueue();
        }, 2000); // Every 2 seconds
        
        // Cleanup stale connections
        setInterval(() => {
            this.cleanupStaleConnections();
        }, this.config.cleanupInterval);
        
        // Update resource stats
        setInterval(() => {
            this.updateResourceStats();
        }, this.config.resourceCheckInterval);
        
        // Log stats periodically
        setInterval(() => {
            this.logStats();
        }, 60000); // Every minute
    }
    
    /**
     * Cleanup stale connections
     */
    cleanupStaleConnections() {
        const now = Date.now();
        const staleThreshold = 300000; // 5 minutes without activity
        
        let cleaned = 0;
        this.connections.forEach((connection, socketId) => {
            if (now - connection.lastActivity > staleThreshold) {
                const socket = this.io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.disconnect(true);
                    this.unregisterConnection(socket);
                    cleaned++;
                }
            }
        });
        
        if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} stale connections`);
        }
    }
    
    /**
     * Update resource statistics
     */
    updateResourceStats() {
        // Update connection count
        this.resourceStats.connectionCount = this.activeConnections;
        this.resourceStats.queueLength = this.connectionQueue.length;
        this.resourceStats.lastUpdate = Date.now();
        
        // Try to get CPU/memory usage (Node.js doesn't have built-in CPU monitoring)
        // This would require external tools or process monitoring
        try {
            const usage = process.memoryUsage();
            this.resourceStats.memoryUsage = usage.heapUsed / usage.heapTotal;
        } catch (err) {
            // Ignore if not available
        }
    }
    
    /**
     * Log statistics
     */
    logStats() {
        const stats = {
            activeConnections: this.activeConnections,
            queuedConnections: this.connectionQueue.length,
            uniqueIPs: this.connectionsByIP.size,
            rejectedConnections: this.resourceStats.rejectedConnections,
            memoryUsage: (this.resourceStats.memoryUsage * 100).toFixed(1) + '%'
        };
        
        console.log('[ConnectionManager Stats]', stats);
    }
    
    /**
     * Get current statistics
     */
    getStats() {
        return {
            activeConnections: this.activeConnections,
            maxConnections: this.config.maxConnections,
            queuedConnections: this.connectionQueue.length,
            uniqueIPs: this.connectionsByIP.size,
            rejectedConnections: this.resourceStats.rejectedConnections,
            resourceStats: { ...this.resourceStats }
        };
    }
    
    /**
     * Get connections by IP
     */
    getConnectionsByIP(ip) {
        return this.connectionsByIP.get(ip) || new Set();
    }
    
    /**
     * Get connection data
     */
    getConnection(socketId) {
        return this.connections.get(socketId);
    }
}

module.exports = ConnectionManager;

