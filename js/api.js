/**
 * API Client
 * Frontend API service for backend communication
 */

const API = {
    baseUrl: typeof window !== 'undefined' && window.location.hostname !== ''
        ? `${window.location.protocol}//${window.location.host}/api`
        : 'http://localhost:3000/api',

    token: null,
    wsConnection: null,

    /**
     * Initialize API client
     */
    init() {
        // Load token from localStorage
        this.token = localStorage.getItem('auth_token');

        // Connect WebSocket
        this.connectWebSocket();
    },

    /**
     * Set authentication token
     */
    setToken(token) {
        this.token = token;
        localStorage.setItem('auth_token', token);
    },

    /**
     * Clear authentication
     */
    clearAuth() {
        this.token = null;
        localStorage.removeItem('auth_token');
    },

    /**
     * Make API request
     */
    async request(method, endpoint, data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Request failed');
            }

            return result;
        } catch (error) {
            // If server is not available, fall back to local store
            if (error.message.includes('Failed to fetch')) {
                console.log('API not available, using local store');
                return this.fallbackToLocal(method, endpoint, data);
            }
            throw error;
        }
    },

    /**
     * Fallback to local store when API is unavailable
     */
    fallbackToLocal(method, endpoint, data) {
        if (endpoint.startsWith('/rumors') && method === 'GET') {
            return { rumors: Store.getRumors() || [] };
        }
        if (endpoint.startsWith('/users/me') && method === 'GET') {
            return { user: Store.getUser() };
        }
        if (endpoint.startsWith('/users/leaderboard') && method === 'GET') {
            return { leaders: Store.generateLeaderboard() };
        }
        return { error: 'API unavailable', local: true };
    },

    // ============================================
    // Authentication
    // ============================================

    /**
     * Get PoW challenge
     */
    async getPowChallenge() {
        return this.request('POST', '/auth/pow-challenge');
    },

    /**
     * Register with PoW solution
     */
    async register(challenge, nonce, credentialHash) {
        const result = await this.request('POST', '/auth/register', {
            challenge,
            nonce,
            credentialHash
        });
        if (result.token) {
            this.setToken(result.token);
        }
        return result;
    },

    /**
     * Login with credential
     */
    async login(credentialHash) {
        const result = await this.request('POST', '/auth/login', { credentialHash });
        if (result.token) {
            this.setToken(result.token);
        }
        return result;
    },

    /**
     * Validate current token
     */
    async validateToken() {
        if (!this.token) return { valid: false };
        return this.request('GET', '/auth/validate');
    },

    // ============================================
    // Rumors
    // ============================================

    /**
     * Get rumors with filter
     */
    async getRumors(filter = 'trending', limit = 20, offset = 0) {
        return this.request('GET', `/rumors?filter=${filter}&limit=${limit}&offset=${offset}`);
    },

    /**
     * Get single rumor
     */
    async getRumor(id) {
        return this.request('GET', `/rumors/${id}`);
    },

    /**
     * Submit new rumor
     */
    async submitRumor(content, category, stakeAmount, evidenceType, evidenceDescription) {
        return this.request('POST', '/rumors', {
            content,
            category,
            stakeAmount,
            evidenceType,
            evidenceDescription
        });
    },

    // ============================================
    // Verifications
    // ============================================

    /**
     * Submit verification/vote
     */
    async verify(rumorId, voteType, stakeAmount, evidenceDescription) {
        return this.request('POST', '/verifications', {
            rumorId,
            voteType,
            stakeAmount,
            evidenceDescription
        });
    },

    /**
     * Get verifications for a rumor
     */
    async getVerifications(rumorId) {
        return this.request('GET', `/verifications/rumor/${rumorId}`);
    },

    // ============================================
    // Users
    // ============================================

    /**
     * Get current user profile
     */
    async getProfile() {
        return this.request('GET', '/users/me');
    },

    /**
     * Get activity history
     */
    async getActivities(limit = 20, offset = 0) {
        return this.request('GET', `/users/me/activities?limit=${limit}&offset=${offset}`);
    },

    /**
     * Get leaderboard
     */
    async getLeaderboard(period = 'week', limit = 10) {
        return this.request('GET', `/users/leaderboard?period=${period}&limit=${limit}`);
    },

    // ============================================
    // File Upload
    // ============================================

    /**
     * Upload evidence files
     */
    async uploadEvidence(files, rumorId = null) {
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        if (rumorId) formData.append('rumorId', rumorId);

        const response = await fetch(`${this.baseUrl}/upload/evidence`, {
            method: 'POST',
            headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {},
            body: formData
        });

        return response.json();
    },

    // ============================================
    // WebSocket
    // ============================================

    /**
     * Connect to WebSocket
     */
    connectWebSocket() {
        if (typeof window === 'undefined') return;

        try {
            const wsUrl = this.baseUrl.replace('http', 'ws').replace('/api', '');
            this.wsConnection = new WebSocket(wsUrl);

            this.wsConnection.onopen = () => {
                console.log('WebSocket connected');

                // Authenticate if we have a token
                if (this.token) {
                    this.wsConnection.send(JSON.stringify({
                        type: 'authenticate',
                        userId: this.getUserIdFromToken()
                    }));
                }

                // Subscribe to rumors channel
                this.wsConnection.send(JSON.stringify({
                    type: 'subscribe',
                    channel: 'rumors'
                }));
            };

            this.wsConnection.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            };

            this.wsConnection.onerror = (error) => {
                console.log('WebSocket not available');
            };

            this.wsConnection.onclose = () => {
                console.log('WebSocket closed, reconnecting in 5s...');
                setTimeout(() => this.connectWebSocket(), 5000);
            };
        } catch (error) {
            console.log('WebSocket connection failed');
        }
    },

    /**
     * Handle incoming WebSocket message
     */
    handleWebSocketMessage(message) {
        console.log('📨 WS Message:', message.type);

        switch (message.type) {
            case 'init':
                // Server sends all rumors on connect - load them
                if (message.data && Array.isArray(message.data) && typeof Store !== 'undefined') {
                    console.log('📥 Init: Loading', message.data.length, 'rumors from server');
                    localStorage.setItem(Store.KEYS.RUMORS, JSON.stringify(message.data));
                    Store.emit('rumors:updated', message.data);
                    if (typeof Feed !== 'undefined') {
                        Feed.render();
                    }
                }
                break;

            case 'rumor:added':
                // Add the new rumor to local store
                if (message.data && typeof Store !== 'undefined') {
                    const rumors = Store.getRumors() || [];
                    // Check if we already have this rumor
                    if (!rumors.find(r => r.id === message.data.id)) {
                        rumors.unshift(message.data);
                        localStorage.setItem(Store.KEYS.RUMORS, JSON.stringify(rumors));
                        Store.emit('rumors:updated', rumors);
                    }
                }
                if (typeof Feed !== 'undefined') {
                    Feed.render();
                }
                if (typeof App !== 'undefined') {
                    App.showToast('🆕 New rumor posted!', 'info');
                }
                break;

            case 'rumor:updated':
                // Update the rumor in local store
                if (message.data && typeof Store !== 'undefined') {
                    const rumors = Store.getRumors() || [];
                    const index = rumors.findIndex(r => r.id === message.data.id);
                    if (index !== -1) {
                        rumors[index] = message.data;
                        localStorage.setItem(Store.KEYS.RUMORS, JSON.stringify(rumors));
                        Store.emit('rumors:updated', rumors);
                    } else {
                        // Rumor not found locally, add it
                        rumors.unshift(message.data);
                        localStorage.setItem(Store.KEYS.RUMORS, JSON.stringify(rumors));
                        Store.emit('rumors:updated', rumors);
                    }
                }
                if (typeof Feed !== 'undefined') {
                    Feed.render();
                }
                break;

            case 'rumor:deleted':
                // Remove the deleted rumor from local store
                if (message.data && typeof Store !== 'undefined') {
                    const rumors = Store.getRumors() || [];
                    const filtered = rumors.filter(r => r.id !== message.data.id);
                    localStorage.setItem(Store.KEYS.RUMORS, JSON.stringify(filtered));
                    Store.emit('rumors:updated', filtered);
                }
                if (typeof Feed !== 'undefined') {
                    Feed.render();
                }
                if (typeof App !== 'undefined') {
                    App.showToast('A rumor was deleted', 'info');
                }
                break;

            case 'new_rumor':
                if (typeof Feed !== 'undefined') {
                    Feed.render();
                }
                App.showToast('New rumor posted!', 'info');
                break;

            case 'trust_score_update':
                if (typeof Feed !== 'undefined') {
                    Feed.render();
                }
                break;

            case 'achievement_unlocked':
                App.showToast(`🏆 Achievement unlocked: ${message.achievement.id}!`, 'success');
                break;

            case 'token_change':
                App.updateTokenDisplay();
                break;
        }
    },

    /**
     * Extract user ID from JWT token
     */
    getUserIdFromToken() {
        if (!this.token) return null;
        try {
            const payload = JSON.parse(atob(this.token.split('.')[1]));
            return payload.userId;
        } catch {
            return null;
        }
    }
};

// Initialize API when loaded
if (typeof window !== 'undefined') {
    window.API = API;
    API.init();
}
