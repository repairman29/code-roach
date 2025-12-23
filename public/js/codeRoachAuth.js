/**
 * Code Roach Authentication Helper
 * Handles authentication for Code Roach frontend
 */

class CodeRoachAuth {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.authListeners = [];
        this.initializing = false;
        this.initialize();
    }
    
    /**
     * Get Supabase configuration
     */
    async getSupabaseConfig() {
        // Try to get from window first
        if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
            return {
                url: window.SUPABASE_URL,
                key: window.SUPABASE_ANON_KEY
            };
        }
        
        // Try to fetch from API
        try {
            const response = await fetch('/api/supabase/config');
            if (response.ok) {
                const config = await response.json();
                return {
                    url: config.url || config.SUPABASE_URL,
                    key: config.anonKey || config.SUPABASE_ANON_KEY || config.key
                };
            }
        } catch (err) {
            // Continue to fallback
        }
        
        // Fallback - return nulls
        return {
            url: null,
            key: null
        };
    }

    async initialize() {
        // Prevent multiple simultaneous initializations
        if (this.initializing) {
            return;
        }
        this.initializing = true;
        
        try {
            // Wait for Supabase client to be ready (with timeout)
            let attempts = 0;
            const maxAttempts = 20; // Increased attempts
            
            while (attempts < maxAttempts && !this.supabase) {
                // Try window.supabase first (might be set directly by supabaseClient.js)
                if (typeof window !== 'undefined' && window.supabase) {
                    // Check if it's a client instance or a createClient function
                    if (window.supabase.auth) {
                        // It's already a client instance
                        this.supabase = window.supabase;
                        break;
                    } else if (window.supabase.createClient) {
                        // It's the createClient function, need to create client
                        const config = await this.getSupabaseConfig();
                        if (config.url && config.key) {
                            this.supabase = window.supabase.createClient(config.url, config.key);
                            break;
                        }
                    }
                }
                
                // Try to get Supabase client from global function
                if (!this.supabase && typeof window !== 'undefined' && window.getSupabaseClient) {
                    try {
                        const client = await window.getSupabaseClient();
                        if (client && client.auth) {
                            this.supabase = client;
                            break;
                        }
                    } catch (err) {
                        // Continue trying
                    }
                }
                
                // Wait a bit before retrying
                if (attempts < maxAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
                attempts++;
            }
            
            // If still not found, try to create client directly
            if (!this.supabase) {
                try {
                    const config = await this.getSupabaseConfig();
                    if (config.url && config.key) {
                        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
                        this.supabase = createClient(config.url, config.key);
                    } else {
                        console.warn('[Code Roach Auth] Supabase not configured - URL or key missing');
                    }
                } catch (err) {
                    console.warn('[Code Roach Auth] Failed to create Supabase client:', err);
                }
            }
            
            // Final check
            if (this.supabase && !this.supabase.auth) {
                console.warn('[Code Roach Auth] Supabase client exists but auth is not available');
                this.supabase = null;
            }

            // Get current session
            if (this.supabase && this.supabase.auth) {
                try {
                    const { data: { session } } = await this.supabase.auth.getSession();
                    this.currentUser = session?.user || null;

                    // Listen for auth changes
                    this.supabase.auth.onAuthStateChange((event, session) => {
                        this.currentUser = session?.user || null;
                        this.notifyListeners(event, session);
                    });
                } catch (error) {
                    console.warn('[Code Roach Auth] Session check failed:', error);
                    this.currentUser = null;
                }
            } else {
                console.warn('[Code Roach Auth] Supabase client not available, running without auth');
                this.currentUser = null;
            }
        } catch (error) {
            console.warn('[Code Roach Auth] Initialization failed:', error);
        } finally {
            this.initializing = false;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.currentUser !== null;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Get auth token
     */
    async getAuthToken() {
        if (!this.supabase) return null;
        
        try {
            const { data: { session } } = await this.supabase.auth.getSession();
            return session?.access_token || null;
        } catch (error) {
            console.warn('[Code Roach Auth] Failed to get token:', error);
            return null;
        }
    }

    /**
     * Sign in
     */
    async signIn(email, password) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    }

    /**
     * Sign up
     */
    async signUp(email, password, metadata = {}) {
        if (!this.supabase || !this.supabase.auth) {
            // Try to initialize if not already done
            await this.initialize();
            if (!this.supabase || !this.supabase.auth) {
                throw new Error('Supabase not initialized. Please refresh the page.');
            }
        }

        // Validate inputs
        if (!email || !email.includes('@')) {
            throw new Error('Please enter a valid email address');
        }
        
        // Strong password validation for sign-up
        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        
        // Check password complexity
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
            throw new Error('Password must contain uppercase, lowercase, number, and special character');
        }

        const { data, error } = await this.supabase.auth.signUp({
            email: email.trim(),
            password: password,
            options: {
                data: metadata,
                emailRedirectTo: window.location.origin + '/code-roach-dashboard.html'
            }
        });

        if (error) {
            console.error('[Code Roach Auth] Sign up error:', error);
            throw error;
        }
        
        // Update current user if session exists (auto-confirmed)
        if (data.session) {
            this.currentUser = data.user;
        }
        
        return data;
    }

    /**
     * Sign in with OAuth provider (Google, GitHub, etc.)
     */
    async signInWithOAuth(provider = 'google', options = {}) {
        if (!this.supabase || !this.supabase.auth) {
            await this.initialize();
            if (!this.supabase || !this.supabase.auth) {
                throw new Error('Supabase not initialized. Please refresh the page.');
            }
        }

        // Normalize redirect URL before passing to Supabase
        let redirectTo = options.redirectTo || window.location.origin + '/code-roach-dashboard.html';
        if (redirectTo.includes('/code-roach-projects.html')) {
            redirectTo = redirectTo.replace('/code-roach-projects.html', '/code-roach-projects');
        }
        
        const { data, error } = await this.supabase.auth.signInWithOAuth({
            provider: provider,
            options: {
                redirectTo: redirectTo,
                ...options
            }
        });

        if (error) {
            console.error('[Code Roach Auth] OAuth error:', error);
            throw error;
        }

        // OAuth redirects, so we won't get here, but return data anyway
        return data;
    }

    /**
     * Sign out
     */
    async signOut() {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        const { error } = await this.supabase.auth.signOut();
        if (error) throw error;
        this.currentUser = null;
    }

    /**
     * Add auth state listener
     */
    onAuthStateChange(callback) {
        this.authListeners.push(callback);
        
        // Return unsubscribe function
        return () => {
            const index = this.authListeners.indexOf(callback);
            if (index > -1) {
                this.authListeners.splice(index, 1);
            }
        };
    }

    /**
     * Notify all listeners
     */
    notifyListeners(event, session) {
        this.authListeners.forEach(callback => {
            try {
                callback(event, session);
            } catch (error) {
                console.warn('[Code Roach Auth] Listener error:', error);
            }
        });
    }

    /**
     * Require authentication - redirect if not authenticated
     */
    requireAuth(redirectTo = '/code-roach-login.html') {
        if (!this.isAuthenticated()) {
            window.location.href = redirectTo;
            return false;
        }
        return true;
    }
}

// Export singleton instance
if (typeof window !== 'undefined') {
    window.codeRoachAuth = new CodeRoachAuth();
}

// Also export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeRoachAuth;
}

