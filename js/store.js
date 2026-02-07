/**
 * CampusVerify - Data Store
 * LocalStorage-backed state management with CRUD operations
 * Now with real-time sync across tabs/windows
 */

const Store = {
    // Storage keys
    KEYS: {
        USER: 'campusverify_user',
        RUMORS: 'campusverify_rumors',
        EVIDENCE: 'campusverify_evidence',
        VERIFICATIONS: 'campusverify_verifications',
        ACTIVITIES: 'campusverify_activities',
        LEADERBOARD: 'campusverify_leaderboard'
    },

    // Event listeners for state changes
    listeners: {},

    // BroadcastChannel for real-time sync
    channel: null,

    /**
     * Initialize store with default data if empty
     */
    init() {
        // Initialize current user if not exists
        if (!this.getUser()) {
            const user = createUser();
            this.setUser(user);
        } else {
            // Sync existing user to server on page load
            this._syncUserToServer(this.getUser());
        }

        // Initialize collections if not exists
        if (!this.getRumors()) {
            this.setRumors([]);
            // Sample data removed - using real database only
        }

        if (!this.getEvidence()) {
            this.setEvidence([]);
        }

        if (!this.getVerifications()) {
            this.setVerifications([]);
        }

        if (!this.getActivities()) {
            this.setActivities([]);
        }

        // Initialize real-time sync
        this.initSync();

        console.log('🔍 CampusVerify Store initialized with real-time sync');
    },

    /**
     * Initialize real-time synchronization
     */
    initSync() {
        // Use BroadcastChannel for same-origin tabs
        if ('BroadcastChannel' in window) {
            this.channel = new BroadcastChannel('campusverify_sync');
            this.channel.onmessage = (event) => {
                this.handleSyncMessage(event.data);
            };
        }

        // Listen for storage events (cross-tab sync)
        window.addEventListener('storage', (event) => {
            if (event.key && event.key.startsWith('campusverify_')) {
                this.handleStorageChange(event);
            }
        });

        console.log('📡 Real-time sync enabled');
    },

    /**
     * Handle sync messages from other tabs
     */
    handleSyncMessage(data) {
        console.log('📥 Sync message received:', data.type);

        switch (data.type) {
            case 'rumor:added':
                // Refresh the feed if we're not the sender
                if (data.senderId !== this.getUser()?.id) {
                    this.emit('rumors:updated', this.getRumors());
                    this.showSyncNotification('New rumor posted!');
                }
                break;
            case 'rumor:updated':
                this.emit('rumors:updated', this.getRumors());
                break;
            case 'verification:added':
                if (data.senderId !== this.getUser()?.id) {
                    this.emit('verifications:updated', this.getVerifications());
                    this.showSyncNotification('Someone verified a rumor!');
                }
                break;
        }
    },

    /**
     * Handle localStorage changes from other tabs
     */
    handleStorageChange(event) {
        if (!event.newValue) return;

        const key = event.key.replace('campusverify_', '');
        console.log('📥 Storage change detected:', key);

        switch (key) {
            case 'rumors':
                this.emit('rumors:updated', JSON.parse(event.newValue));
                break;
            case 'verifications':
                this.emit('verifications:updated', JSON.parse(event.newValue));
                break;
        }
    },

    /**
     * Broadcast a sync message to other tabs
     */
    broadcast(type, payload = {}) {
        const message = {
            type,
            payload,
            senderId: this.getUser()?.id,
            timestamp: Date.now()
        };

        if (this.channel) {
            this.channel.postMessage(message);
        }
    },

    /**
     * Show notification for sync updates
     */
    showSyncNotification(message) {
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(message, 'info');
        }
        // Refresh feed automatically
        if (typeof Feed !== 'undefined' && Feed.render) {
            Feed.render();
        }
    },

    /**
     * Seed sample rumors for demonstration
     */
    seedSampleData() {
        const sampleRumors = [
            {
                content: 'The campus WiFi will be down tomorrow from 2-4 PM for scheduled maintenance. IT department confirmed via email.',
                category: 'tech',
                stakeAmount: 20,
                veracityScore: 0.82,
                confidenceScore: 0.65,
                temporalRelevance: 0.95,
                sourceReliability: 0.71,
                networkConsensus: 0.58,
                finalTrustScore: 87,
                supportCount: 12,
                disputeCount: 1,
                status: 'verified'
            },
            {
                content: 'Free pizza at the Student Union today from 12-2 PM! First come, first served.',
                category: 'food',
                stakeAmount: 10,
                veracityScore: 0.68,
                confidenceScore: 0.55,
                temporalRelevance: 0.90,
                sourceReliability: 0.60,
                networkConsensus: 0.45,
                finalTrustScore: 72,
                supportCount: 8,
                disputeCount: 0,
                status: 'active'
            },
            {
                content: 'Professor Smith cancelled tomorrow\'s quiz. Check your email!',
                category: 'academic',
                stakeAmount: 5,
                veracityScore: 0.40,
                confidenceScore: 0.30,
                temporalRelevance: 0.85,
                sourceReliability: 0.45,
                networkConsensus: 0.35,
                finalTrustScore: 45,
                supportCount: 2,
                disputeCount: 3,
                status: 'disputed'
            },
            {
                content: 'The library will extend hours to 24/7 during finals week starting next Monday.',
                category: 'facilities',
                stakeAmount: 15,
                veracityScore: 0.75,
                confidenceScore: 0.60,
                temporalRelevance: 0.80,
                sourceReliability: 0.65,
                networkConsensus: 0.55,
                finalTrustScore: 78,
                supportCount: 15,
                disputeCount: 2,
                status: 'verified'
            },
            {
                content: 'Campus parking lot B closed next week for repaving. Use lot C instead.',
                category: 'facilities',
                stakeAmount: 10,
                veracityScore: 0.55,
                confidenceScore: 0.40,
                temporalRelevance: 0.90,
                sourceReliability: 0.50,
                networkConsensus: 0.40,
                finalTrustScore: 58,
                supportCount: 5,
                disputeCount: 2,
                status: 'active'
            }
        ];

        const rumors = sampleRumors.map((data, index) => {
            const rumor = createRumor(
                'system',
                data.content,
                data.category,
                data.stakeAmount,
                {
                    ...data,
                    createdAt: Date.now() - (index * 3600000) // Stagger creation times
                }
            );
            return rumor;
        });

        this.setRumors(rumors);
    },

    // ============================================
    // User Operations
    // ============================================

    getUser() {
        const data = localStorage.getItem(this.KEYS.USER);
        return data ? JSON.parse(data) : null;
    },

    setUser(user) {
        localStorage.setItem(this.KEYS.USER, JSON.stringify(user));
        this.emit('user:updated', user);

        // Sync user data to server for live leaderboard
        this._syncUserToServer(user);
    },

    // Debounced sync to avoid flooding the server
    _syncTimeout: null,
    _syncUserToServer(user) {
        if (!user || !user.id) return;

        clearTimeout(this._syncTimeout);
        this._syncTimeout = setTimeout(() => {
            fetch('/api/users/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    username: user.username,
                    tokenBalance: user.tokenBalance,
                    reputationScore: user.reputationScore,
                    totalSubmissions: user.totalSubmissions,
                    verifiedAccurate: user.verifiedAccurate,
                    verifiedFalse: user.verifiedFalse,
                    stakedTokens: user.stakedTokens
                })
            }).catch(err => console.log('User sync failed:', err));
        }, 300); // 300ms debounce
    },

    updateUser(updates) {
        const user = this.getUser();
        const updated = { ...user, ...updates, lastActive: Date.now() };
        this.setUser(updated);
        return updated;
    },

    // ============================================
    // Rumors CRUD
    // ============================================

    getRumors() {
        const data = localStorage.getItem(this.KEYS.RUMORS);
        return data ? JSON.parse(data) : null;
    },

    setRumors(rumors) {
        localStorage.setItem(this.KEYS.RUMORS, JSON.stringify(rumors));
        this.emit('rumors:updated', rumors);
    },

    getRumorById(id) {
        const rumors = this.getRumors() || [];
        return rumors.find(r => r.id === id);
    },

    addRumor(rumor) {
        const rumors = this.getRumors() || [];
        rumors.unshift(rumor);
        this.setRumors(rumors);
        // Broadcast to other tabs
        this.broadcast('rumor:added', { rumorId: rumor.id });
        return rumor;
    },

    updateRumor(id, updates) {
        const rumors = this.getRumors() || [];
        const index = rumors.findIndex(r => r.id === id);
        if (index !== -1) {
            rumors[index] = { ...rumors[index], ...updates };
            this.setRumors(rumors);
            // Broadcast to other tabs
            this.broadcast('rumor:updated', { rumorId: id });
            return rumors[index];
        }
        return null;
    },

    // ============================================
    // Evidence CRUD
    // ============================================

    getEvidence() {
        const data = localStorage.getItem(this.KEYS.EVIDENCE);
        return data ? JSON.parse(data) : null;
    },

    setEvidence(evidence) {
        localStorage.setItem(this.KEYS.EVIDENCE, JSON.stringify(evidence));
    },

    addEvidence(evidence) {
        const all = this.getEvidence() || [];
        all.push(evidence);
        this.setEvidence(all);
        return evidence;
    },

    getEvidenceForRumor(rumorId) {
        const all = this.getEvidence() || [];
        return all.filter(e => e.rumorId === rumorId);
    },

    // ============================================
    // Verifications CRUD
    // ============================================

    getVerifications() {
        const data = localStorage.getItem(this.KEYS.VERIFICATIONS);
        return data ? JSON.parse(data) : null;
    },

    setVerifications(verifications) {
        localStorage.setItem(this.KEYS.VERIFICATIONS, JSON.stringify(verifications));
    },

    addVerification(verification) {
        const all = this.getVerifications() || [];
        all.push(verification);
        this.setVerifications(all);
        this.emit('verifications:updated', all);
        // Broadcast to other tabs
        this.broadcast('verification:added', { rumorId: verification.rumorId });
        return verification;
    },

    getVerificationsForRumor(rumorId) {
        const all = this.getVerifications() || [];
        return all.filter(v => v.rumorId === rumorId);
    },

    hasUserVerified(rumorId, userId) {
        const all = this.getVerifications() || [];
        return all.some(v => v.rumorId === rumorId && v.verifierId === userId);
    },

    // ============================================
    // Activities CRUD
    // ============================================

    getActivities() {
        const data = localStorage.getItem(this.KEYS.ACTIVITIES);
        return data ? JSON.parse(data) : null;
    },

    setActivities(activities) {
        localStorage.setItem(this.KEYS.ACTIVITIES, JSON.stringify(activities));
    },

    addActivity(activity) {
        const all = this.getActivities() || [];
        all.unshift(activity);
        // Keep only last 100 activities
        if (all.length > 100) all.pop();
        this.setActivities(all);
        return activity;
    },

    getUserActivities(userId) {
        const all = this.getActivities() || [];
        return all.filter(a => a.userId === userId);
    },

    // ============================================
    // Leaderboard
    // ============================================

    generateLeaderboard() {
        // Only show real connected users - no fake data
        const leaders = [];

        // Add current user (the only real user we know about)
        const user = this.getUser();
        if (user) {
            const totalVotes = (user.verifiedAccurate || 0) + (user.verifiedFalse || 0);
            const accuracy = totalVotes > 0
                ? Math.round((user.verifiedAccurate / totalVotes) * 100)
                : 0;
            leaders.push({
                username: user.username,
                accuracy,
                verifications: totalVotes,
                tokensEarned: (user.tokenBalance || 100) - 100 + (user.stakedTokens || 0),
                isCurrentUser: true
            });
        }

        // Add any other real users from cached leaderboard data
        try {
            const rawData = localStorage.getItem(this.KEYS.LEADERBOARD);
            const cached = rawData ? JSON.parse(rawData) : null;
            if (cached && Array.isArray(cached)) {
                cached.forEach(entry => {
                    // Avoid duplicating current user
                    if (user && entry.username === user.username) return;
                    leaders.push(entry);
                });
            }
        } catch (e) {
            // Ignore parse errors
        }

        return leaders.sort((a, b) => b.tokensEarned - a.tokensEarned);
    },

    // ============================================
    // Event System
    // ============================================

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    },

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    },

    // ============================================
    // Utility
    // ============================================

    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('🗑️ All data cleared');
    }
};
