/**
 * CampusVerify - Dashboard Component
 * User dashboard with stats, achievements, and activity
 */

const Dashboard = {
    /**
     * Initialize dashboard
     */
    init() {
        this.render();
        Store.on('user:updated', () => this.render());
    },

    /**
     * Render dashboard
     */
    render() {
        const page = document.getElementById('dashboardPage');
        if (!page) return;

        const user = Store.getUser();
        const activities = Store.getUserActivities(user.id);
        const accuracy = user.totalSubmissions > 0
            ? Math.round((user.verifiedAccurate / Math.max(1, user.verifiedAccurate + user.verifiedFalse)) * 100)
            : 0;

        page.innerHTML = `
            <div class="dashboard-header">
                <h1>Your Dashboard</h1>
                <div class="user-stats-card">
                    <div class="stat-item">
                        <span class="stat-value">${user.tokenBalance}</span>
                        <span class="stat-label">Tokens</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-value">${accuracy}%</span>
                        <span class="stat-label">Accuracy</span>
                    </div>
                    <div class="stat-divider"></div>
                    <div class="stat-item">
                        <span class="stat-value">${user.reputationScore.toFixed(2)}</span>
                        <span class="stat-label">Reputation</span>
                    </div>
                </div>
            </div>

            <div class="dashboard-grid">
                <div class="dashboard-card">
                    <h3>📊 Activity Summary</h3>
                    <div class="activity-stats">
                        <div class="activity-row">
                            <span>Rumors Submitted</span>
                            <span>${user.totalSubmissions}</span>
                        </div>
                        <div class="activity-row">
                            <span>Verified Accurate</span>
                            <span class="positive">${user.verifiedAccurate}</span>
                        </div>
                        <div class="activity-row">
                            <span>Verified False</span>
                            <span class="negative">${user.verifiedFalse}</span>
                        </div>
                        <div class="activity-row">
                            <span>Tokens Staked</span>
                            <span>${user.stakedTokens || 0}</span>
                        </div>
                    </div>
                </div>

                <div class="dashboard-card">
                    <h3>🏆 Achievements</h3>
                    <div class="achievements-grid">
                        ${this.renderAchievements(user)}
                    </div>
                </div>

                <div class="dashboard-card full-width">
                    <h3>📜 Recent Activity</h3>
                    <div class="activity-feed">
                        ${this.renderActivityFeed(activities)}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render achievements
     */
    renderAchievements(user) {
        const unlocked = user.unlockedAchievements || [];

        return Object.values(ACHIEVEMENTS).map(ach => {
            const isUnlocked = unlocked.includes(ach.id);
            return `
                <div class="achievement ${isUnlocked ? 'unlocked' : 'locked'}">
                    <span class="achievement-icon">${ach.icon}</span>
                    <span class="achievement-name">${ach.name}</span>
                    <span class="achievement-desc">${ach.description}</span>
                </div>
            `;
        }).join('');
    },

    /**
     * Render activity feed
     */
    renderActivityFeed(activities) {
        if (!activities || activities.length === 0) {
            return `<div class="activity-empty"><span>No activity yet. Start by verifying some rumors!</span></div>`;
        }

        return activities.slice(0, 10).map(act => {
            const icon = this.getActivityIcon(act.type);
            const timeAgo = RumorCard.getTimeAgo(act.timestamp);
            const changeClass = act.tokenChange > 0 ? 'positive' : act.tokenChange < 0 ? 'negative' : '';
            const changeText = act.tokenChange !== 0
                ? `<span class="${changeClass}">${act.tokenChange > 0 ? '+' : ''}${act.tokenChange}</span>`
                : '';

            return `
                <div class="activity-item">
                    <span class="activity-icon">${icon}</span>
                    <span class="activity-details">${act.details}</span>
                    ${changeText}
                    <span class="activity-time">${timeAgo}</span>
                </div>
            `;
        }).join('');
    },

    /**
     * Get activity icon
     */
    getActivityIcon(type) {
        const icons = {
            submitted: '📝',
            verified: '✅',
            disputed: '❌',
            earned: '💰',
            lost: '💸',
            achievement: '🏆'
        };
        return icons[type] || '📌';
    }
};
