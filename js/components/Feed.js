/**
 * CampusVerify - Feed Component
 * Renders and manages the rumor feed
 */

const Feed = {
    currentFilter: 'trending',

    /**
     * Initialize feed
     */
    init() {
        this.bindEvents();

        // Fetch rumors from API (database) on startup only
        this.fetchFromAPI();

        // Also render from local store initially
        this.render();

        // Listen for updates (WebSocket will trigger these)
        Store.on('rumors:updated', () => this.render());
        Store.on('verifications:updated', () => this.render());
    },

    /**
     * Fetch rumors from API and merge with local store
     */
    async fetchFromAPI() {
        try {
            const response = await fetch('/api/rumors');
            if (response.ok) {
                const apiRumors = await response.json();
                console.log('📥 Fetched', apiRumors.length, 'rumors from database');

                if (apiRumors.length > 0) {
                    // Merge API data with local data (API takes priority)
                    const localRumors = Store.getRumors() || [];
                    const mergedMap = new Map();

                    // Add local rumors first
                    localRumors.forEach(r => mergedMap.set(r.id, r));

                    // Override with API rumors (they are the source of truth)
                    apiRumors.forEach(r => mergedMap.set(r.id, r));

                    const merged = Array.from(mergedMap.values())
                        .sort((a, b) => b.createdAt - a.createdAt);

                    localStorage.setItem(Store.KEYS.RUMORS, JSON.stringify(merged));
                    Store.emit('rumors:updated', merged);
                }
            } else {
                console.log('API returned', response.status, '- keeping local data');
            }
        } catch (error) {
            console.log('API not available, using local data');
        }
    },

    /**
     * Bind filter tab events
     */
    bindEvents() {
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                // Use closest to ensure we get the button even if clicking on icon/text
                const clickedTab = e.target.closest('.filter-tab');
                if (!clickedTab) return;

                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                clickedTab.classList.add('active');
                this.currentFilter = clickedTab.dataset.filter;
                console.log('📋 Filter changed to:', this.currentFilter);
                this.render();
            });
        });
    },

    /**
     * Render the feed
     */
    render() {
        const container = document.getElementById('rumorsFeed');
        if (!container) return;

        const rumors = this.getFilteredRumors();

        if (rumors.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <h3>No rumors found</h3>
                    <p>${this.getEmptyMessage()}</p>
                    <button class="btn btn-primary" onclick="App.navigateTo('submit')">
                        Submit a Rumor
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = rumors.map(r => RumorCard.render(r)).join('');
    },

    /**
     * Get empty state message based on filter
     */
    getEmptyMessage() {
        switch (this.currentFilter) {
            case 'verified': return 'No verified rumors yet. Be the first to verify one!';
            case 'disputed': return 'No disputed rumors yet.';
            case 'recent': return 'No recent rumors. Share some news!';
            default: return 'Be the first to share campus news!';
        }
    },

    /**
     * Get filtered and sorted rumors
     */
    getFilteredRumors() {
        let rumors = Store.getRumors() || [];

        // Apply filter
        switch (this.currentFilter) {
            case 'trending':
                // Sort by engagement and trust score
                rumors = [...rumors].sort((a, b) => this.calculateFeedScore(b) - this.calculateFeedScore(a));
                break;
            case 'recent':
                // Sort by creation time (newest first)
                rumors = [...rumors].sort((a, b) => b.createdAt - a.createdAt);
                break;
            case 'verified':
                // Filter to only verified rumors, then sort by trust score
                rumors = rumors.filter(r => r.status === 'verified' || r.finalTrustScore >= 70);
                rumors = [...rumors].sort((a, b) => b.finalTrustScore - a.finalTrustScore);
                break;
            case 'disputed':
                // Filter to rumors with at least 1 dispute, then sort by dispute count
                rumors = rumors.filter(r => r.status === 'disputed' || r.disputeCount >= 1);
                rumors = [...rumors].sort((a, b) => b.disputeCount - a.disputeCount);
                break;
        }

        return rumors.slice(0, 20); // Limit to 20 items
    },

    /**
     * Calculate feed ranking score
     */
    calculateFeedScore(rumor) {
        const trustScore = rumor.finalTrustScore / 100;
        const relevance = rumor.temporalRelevance || 1;

        // Personalization would use user preferences
        const personalization = 1;

        // Fatigue penalty for old content
        const hoursSinceCreation = (Date.now() - rumor.createdAt) / (1000 * 60 * 60);
        const fatiguePenalty = Math.min(0.5, hoursSinceCreation / 48);

        return (trustScore * relevance * personalization) - fatiguePenalty;
    }
};
