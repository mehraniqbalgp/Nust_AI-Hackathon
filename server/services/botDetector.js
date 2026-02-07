/**
 * Enhanced Bot Detection Service
 * Stricter thresholds, behavior analysis, and fingerprinting
 */

import crypto from 'crypto';

// Bot detection thresholds (stricter)
const THRESHOLDS = {
    // Timing thresholds
    MIN_ACTION_INTERVAL_MS: 500,       // Minimum time between actions
    SUSPICIOUS_BURST_COUNT: 5,          // Actions in rapid succession
    SUSPICIOUS_BURST_WINDOW_MS: 3000,   // Window for burst detection

    // Pattern thresholds
    MAX_IDENTICAL_ACTIONS: 3,           // Same action repeated
    MAX_ACTIONS_PER_MINUTE: 20,         // Overall rate limit
    MAX_VOTES_PER_HOUR: 30,             // Voting rate limit
    MAX_SUBMISSIONS_PER_HOUR: 5,        // Submission rate limit

    // Score thresholds
    BOT_SCORE_WARNING: 0.5,             // Flag for review
    BOT_SCORE_BLOCK: 0.8,               // Block account

    // Session thresholds
    MIN_SESSION_DURATION_MS: 5000,      // Too fast = suspicious
    SUSPICIOUS_IP_CHANGES: 3            // IP changes per session
};

// Action type weights for bot score
const ACTION_WEIGHTS = {
    vote: 0.3,
    submit_rumor: 0.5,
    verify: 0.4,
    comment: 0.2,
    view: 0.1
};

class BotDetector {
    constructor() {
        this.userBehavior = new Map(); // userId -> behavior data
        this.ipBehavior = new Map();   // IP -> behavior data
        this.suspiciousUsers = new Set();
        this.blockedUsers = new Set();
    }

    /**
     * Record a user action and analyze for bot behavior
     * @param {string} userId 
     * @param {string} actionType 
     * @param {object} context - IP, userAgent, timestamp, etc.
     * @returns {object} - { allowed: boolean, score: number, flags: string[] }
     */
    recordAction(userId, actionType, context) {
        const now = Date.now();
        const { ip, userAgent } = context;

        // Get or create user behavior record
        if (!this.userBehavior.has(userId)) {
            this.userBehavior.set(userId, {
                actions: [],
                ips: new Set(),
                userAgents: new Set(),
                firstSeen: now,
                botScore: 0,
                flags: []
            });
        }

        const behavior = this.userBehavior.get(userId);
        const flags = [];

        // Record action
        behavior.actions.push({
            type: actionType,
            timestamp: now,
            ip
        });

        behavior.ips.add(ip);
        behavior.userAgents.add(userAgent);

        // Clean old actions (keep last hour)
        const oneHourAgo = now - 60 * 60 * 1000;
        behavior.actions = behavior.actions.filter(a => a.timestamp > oneHourAgo);

        // === ANALYSIS ===

        // 1. Rapid action detection
        const recentActions = behavior.actions.filter(
            a => now - a.timestamp < THRESHOLDS.SUSPICIOUS_BURST_WINDOW_MS
        );
        if (recentActions.length >= THRESHOLDS.SUSPICIOUS_BURST_COUNT) {
            flags.push('RAPID_ACTIONS');
        }

        // 2. Check action interval
        if (behavior.actions.length >= 2) {
            const lastTwo = behavior.actions.slice(-2);
            const interval = lastTwo[1].timestamp - lastTwo[0].timestamp;
            if (interval < THRESHOLDS.MIN_ACTION_INTERVAL_MS) {
                flags.push('TOO_FAST');
            }
        }

        // 3. Check identical actions
        const recentSameType = behavior.actions
            .slice(-10)
            .filter(a => a.type === actionType);
        if (recentSameType.length > THRESHOLDS.MAX_IDENTICAL_ACTIONS) {
            flags.push('REPETITIVE_ACTIONS');
        }

        // 4. Rate limiting checks
        const actionsLastMinute = behavior.actions.filter(
            a => now - a.timestamp < 60 * 1000
        );
        if (actionsLastMinute.length > THRESHOLDS.MAX_ACTIONS_PER_MINUTE) {
            flags.push('RATE_LIMIT_EXCEEDED');
        }

        // 5. Vote rate check
        const votesLastHour = behavior.actions.filter(
            a => a.type === 'vote' && now - a.timestamp < 60 * 60 * 1000
        );
        if (votesLastHour.length > THRESHOLDS.MAX_VOTES_PER_HOUR) {
            flags.push('VOTE_SPAM');
        }

        // 6. Submission rate check
        const submissionsLastHour = behavior.actions.filter(
            a => a.type === 'submit_rumor' && now - a.timestamp < 60 * 60 * 1000
        );
        if (submissionsLastHour.length > THRESHOLDS.MAX_SUBMISSIONS_PER_HOUR) {
            flags.push('SUBMISSION_SPAM');
        }

        // 7. IP switching detection
        if (behavior.ips.size > THRESHOLDS.SUSPICIOUS_IP_CHANGES) {
            flags.push('IP_SWITCHING');
        }

        // 8. Session duration check
        const sessionDuration = now - behavior.firstSeen;
        if (sessionDuration < THRESHOLDS.MIN_SESSION_DURATION_MS && behavior.actions.length > 5) {
            flags.push('FAST_SESSION');
        }

        // Calculate bot score
        let botScore = 0;
        const flagScores = {
            'RAPID_ACTIONS': 0.25,
            'TOO_FAST': 0.15,
            'REPETITIVE_ACTIONS': 0.2,
            'RATE_LIMIT_EXCEEDED': 0.3,
            'VOTE_SPAM': 0.35,
            'SUBMISSION_SPAM': 0.35,
            'IP_SWITCHING': 0.2,
            'FAST_SESSION': 0.15
        };

        for (const flag of flags) {
            botScore += flagScores[flag] || 0.1;
        }

        // Apply action weight
        botScore *= ACTION_WEIGHTS[actionType] || 0.2;

        // Accumulate with decay
        behavior.botScore = behavior.botScore * 0.9 + botScore * 0.1;
        behavior.flags = [...new Set([...behavior.flags, ...flags])].slice(-20);

        // Determine if blocked
        const isBlocked = behavior.botScore >= THRESHOLDS.BOT_SCORE_BLOCK ||
            this.blockedUsers.has(userId);
        const isSuspicious = behavior.botScore >= THRESHOLDS.BOT_SCORE_WARNING;

        if (isBlocked) {
            this.blockedUsers.add(userId);
        } else if (isSuspicious) {
            this.suspiciousUsers.add(userId);
        }

        return {
            allowed: !isBlocked,
            score: behavior.botScore,
            flags,
            isSuspicious,
            requiresCaptcha: isSuspicious && !isBlocked
        };
    }

    /**
     * Get user's current bot score and status
     */
    getUserStatus(userId) {
        const behavior = this.userBehavior.get(userId);
        if (!behavior) {
            return { score: 0, flags: [], status: 'clean' };
        }

        let status = 'clean';
        if (this.blockedUsers.has(userId)) {
            status = 'blocked';
        } else if (this.suspiciousUsers.has(userId)) {
            status = 'suspicious';
        }

        return {
            score: behavior.botScore,
            flags: behavior.flags,
            status,
            actionCount: behavior.actions.length,
            ipCount: behavior.ips.size
        };
    }

    /**
     * Manually flag a user for review
     */
    flagUser(userId, reason) {
        const behavior = this.userBehavior.get(userId) || {
            actions: [],
            ips: new Set(),
            userAgents: new Set(),
            firstSeen: Date.now(),
            botScore: 0.5,
            flags: []
        };
        behavior.flags.push(`MANUAL:${reason}`);
        this.suspiciousUsers.add(userId);
        this.userBehavior.set(userId, behavior);
    }

    /**
     * Clear user's bot status (e.g., after passing captcha)
     */
    clearUser(userId) {
        const behavior = this.userBehavior.get(userId);
        if (behavior) {
            behavior.botScore = 0;
            behavior.flags = [];
        }
        this.suspiciousUsers.delete(userId);
        this.blockedUsers.delete(userId);
    }

    /**
     * Get all suspicious users for admin review
     */
    getSuspiciousUsers() {
        return Array.from(this.suspiciousUsers).map(userId => ({
            userId,
            ...this.getUserStatus(userId)
        }));
    }
}

export default new BotDetector();
export { THRESHOLDS };
