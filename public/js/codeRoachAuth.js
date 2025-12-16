/**
 * Code Roach Authentication Helper
 * Handles authentication for Code Roach frontend
 */

class CodeRoachAuth {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.authListeners = [];
        this.initialize();
    }

    async initialize() {
        try {
            // Get Supabase client from global function if available
            if (typeof window !== 'undefined' && window.getSupabaseClient) {
                this.supabase = window.getSupabaseClient();
            } else if (typeof window !== 'undefined' && window.supabase) {
                this.supabase = window.supabase;
            } else {
                // Try to create client directly
                const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
                const supabaseUrl = window.SUPABASE_URL || process.env.SUPABASE_URL;
                const supabaseKey = window.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
                
                if (supabaseUrl && supabaseKey) {
                    this.supabase = createClient(supabaseUrl, supabaseKey);
                } else {
                    console.warn('[Code Roach Auth] Supabase not configured');
                }
            }

            // Get current session
            if (this.supabase) {
                const { data: { session } } = await this.supabase.auth.getSession();
                this.currentUser = session?.user || null;

                // Listen for auth changes
                this.supabase.auth.onAuthStateChange((event, session) => {
                    this.currentUser = session?.user || null;
                    this.notifyListeners(event, session);
                });
            }
        } catch (error) {
            console.warn('[Code Roach Auth] Initialization failed:', error);
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
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }

        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });

        if (error) throw error;
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

