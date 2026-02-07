/**
 * CampusVerify - Leaderboard Component
 * Weekly leaderboard of top verifiers - fetches real users from server
 */

const Leaderboard = {
    /**
     * Initialize leaderboard
     */
    init() {
        this.render();
    },

    /**
     * Render leaderboard
     */
    async render() {
        const page = document.getElementById('leaderboardPage');
        if (!page) return;

        const user = Store.getUser();

        // Fetch real leaderboard from server
        let serverLeaders = [];
        try {
            const response = await fetch('/api/leaderboard');
            if (response.ok) {
                serverLeaders = await response.json();
            }
        } catch (e) {
            console.log('Could not fetch leaderboard from server');
        }

        // Build leaders list: server users + current local user
        const leaders = [];

        // Add server users first
        serverLeaders.forEach(entry => {
            // Check if this is the current user
            if (user && (entry.username === user.username || entry.username === user.id)) {
                entry.isCurrentUser = true;
            }
            leaders.push(entry);
        });

        // Add current user if not already in the list
        const currentUserInList = leaders.some(l => l.isCurrentUser);
        if (user && !currentUserInList) {
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

        // Sort by verifications descending
        leaders.sort((a, b) => b.verifications - a.verifications);

        const userRank = leaders.findIndex(l => l.isCurrentUser) + 1;

        page.innerHTML = `
            <div class="page-header">
                <h1>🏆 Campus Truth Leaders</h1>
                <span class="leaderboard-period">This Week</span>
            </div>
            
            <div class="leaderboard-container">
                ${leaders.length > 0 ?
                leaders.slice(0, 10).map((leader, index) => this.renderLeaderEntry(leader, index + 1, user)).join('') :
                `<div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
                        <div style="font-size:48px;margin-bottom:16px;">🏆</div>
                        <h3 style="margin-bottom:8px;color:var(--text-primary);">No Leaders Yet</h3>
                        <p>Start verifying rumors to appear on the leaderboard!</p>
                    </div>`
            }
            </div>
            
            ${userRank > 10 ? `
                <div class="user-rank-banner">
                    <span>Your Rank: #${userRank}</span>
                    <span>Keep verifying to climb the leaderboard!</span>
                </div>
            ` : ''}
        `;
    },

    /**
     * Render single leaderboard entry
     */
    renderLeaderEntry(leader, rank, currentUser) {
        const isCurrentUser = leader.isCurrentUser;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

        return `
            <div class="leaderboard-entry ${isCurrentUser ? 'current-user' : ''} ${rank <= 3 ? 'top-three' : ''}">
                <div class="rank-badge">
                    ${medal || `#${rank}`}
                </div>
                <div class="leader-info">
                    <span class="leader-name">${leader.username} ${isCurrentUser ? '(You)' : ''}</span>
                    <div class="leader-stats">
                        <span class="stat">🎯 ${leader.accuracy}% accuracy</span>
                        <span class="stat">✅ ${leader.verifications} verifications</span>
                    </div>
                </div>
                <div class="tokens-earned">
                    <span class="tokens-value ${leader.tokensEarned >= 0 ? 'positive' : 'negative'}">
                        ${leader.tokensEarned >= 0 ? '+' : ''}${leader.tokensEarned}
                    </span>
                    <span class="tokens-label">tokens</span>
                </div>
            </div>
        `;
    }
};
