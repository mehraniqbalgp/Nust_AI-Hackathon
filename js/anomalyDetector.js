/**
 * CampusVerify - Anomaly Detection System
 * Detects suspicious voting patterns and bot behavior
 */

const AnomalyDetector = {
    // Detection thresholds
    THRESHOLDS: {
        TEMPORAL_CLUSTER_WINDOW: 2 * 60 * 1000,  // 2 minutes
        TEMPORAL_CLUSTER_MIN_VOTES: 5,
        VELOCITY_SPIKE_MULTIPLIER: 5,
        CORRELATION_THRESHOLD: 0.8,
        BOT_SCORE_THRESHOLD: 0.7
    },

    // Severity levels
    SEVERITY: {
        MINOR: 1,
        MODERATE: 2,
        SEVERE: 3,
        CRITICAL: 4
    },

    /**
     * Analyze a rumor's verifications for anomalies
     */
    analyzeRumor(rumorId) {
        const verifications = Store.getVerificationsForRumor(rumorId);

        if (verifications.length < 3) {
            return { isAnomalous: false, score: 0, flags: [] };
        }

        const flags = [];
        let anomalyScore = 0;

        // 1. Check temporal clustering
        const temporalResult = this.detectTemporalClustering(verifications);
        if (temporalResult.detected) {
            flags.push({
                type: 'temporal_clustering',
                severity: this.SEVERITY.MODERATE,
                description: 'Votes detected within short time window'
            });
            anomalyScore += 0.3;
        }

        // 2. Check unnatural patterns (regular intervals)
        const patternResult = this.detectUnnaturalPatterns(verifications);
        if (patternResult.detected) {
            flags.push({
                type: 'unnatural_pattern',
                severity: this.SEVERITY.SEVERE,
                description: 'Bot-like voting pattern detected'
            });
            anomalyScore += 0.4;
        }

        // 3. Check vote velocity spike
        const velocityResult = this.detectVelocitySpike(rumorId, verifications);
        if (velocityResult.detected) {
            flags.push({
                type: 'velocity_spike',
                severity: this.SEVERITY.MODERATE,
                description: 'Sudden spike in voting activity'
            });
            anomalyScore += 0.25;
        }

        // 4. Check one-sided voting (all same direction)
        const biasResult = this.detectOneSidedVoting(verifications);
        if (biasResult.detected) {
            flags.push({
                type: 'one_sided_voting',
                severity: this.SEVERITY.MINOR,
                description: 'All verifications in same direction'
            });
            anomalyScore += 0.15;
        }

        return {
            isAnomalous: anomalyScore > 0.3,
            score: Math.min(1, anomalyScore),
            flags,
            recommendation: this.getRecommendation(anomalyScore)
        };
    },

    /**
     * Detect temporal clustering (all votes in short window)
     */
    detectTemporalClustering(verifications) {
        if (verifications.length < this.THRESHOLDS.TEMPORAL_CLUSTER_MIN_VOTES) {
            return { detected: false };
        }

        const timestamps = verifications.map(v => v.createdAt).sort((a, b) => a - b);
        const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];

        return {
            detected: timeSpan < this.THRESHOLDS.TEMPORAL_CLUSTER_WINDOW,
            timeSpan,
            voteCount: verifications.length
        };
    },

    /**
     * Detect unnatural voting patterns (bot behavior)
     */
    detectUnnaturalPatterns(verifications) {
        if (verifications.length < 5) {
            return { detected: false };
        }

        const timestamps = verifications.map(v => v.createdAt).sort((a, b) => a - b);

        // Calculate intervals between votes
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
        }

        // Check for suspiciously regular intervals
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);

        // Coefficient of variation - low value means very regular intervals
        const cv = avgInterval > 0 ? stdDev / avgInterval : 0;

        // If CV is very low and intervals are significant (not just rapid clicks)
        const isSuspicious = cv < 0.1 && avgInterval > 1000 && avgInterval < 600000; // 1s to 10min intervals

        return {
            detected: isSuspicious,
            cv,
            avgInterval,
            pattern: isSuspicious ? 'regular_interval' : 'natural'
        };
    },

    /**
     * Detect velocity spike (sudden increase in votes)
     */
    detectVelocitySpike(rumorId, verifications) {
        // Get baseline voting rate for similar rumors
        const allRumors = Store.getRumors() || [];
        const avgVotesPerHour = this.calculateBaselineVoteRate(allRumors);

        // Calculate current rumor's rate
        const rumor = Store.getRumorById(rumorId);
        if (!rumor) return { detected: false };

        const hoursSinceCreation = Math.max(1, (Date.now() - rumor.createdAt) / (1000 * 60 * 60));
        const currentRate = verifications.length / hoursSinceCreation;

        return {
            detected: currentRate > avgVotesPerHour * this.THRESHOLDS.VELOCITY_SPIKE_MULTIPLIER,
            currentRate,
            baseline: avgVotesPerHour,
            multiplier: avgVotesPerHour > 0 ? currentRate / avgVotesPerHour : 0
        };
    },

    /**
     * Detect one-sided voting (all support or all dispute)
     */
    detectOneSidedVoting(verifications) {
        if (verifications.length < 5) {
            return { detected: false };
        }

        const supports = verifications.filter(v => v.voteType === 'support').length;
        const disputes = verifications.filter(v => v.voteType === 'dispute').length;

        const ratio = Math.max(supports, disputes) / verifications.length;

        return {
            detected: ratio === 1.0, // 100% one-sided
            supportRatio: supports / verifications.length,
            disputeRatio: disputes / verifications.length
        };
    },

    /**
     * Calculate baseline vote rate across all rumors
     */
    calculateBaselineVoteRate(rumors) {
        if (rumors.length === 0) return 5; // Default

        let totalVotes = 0;
        let totalHours = 0;

        rumors.forEach(rumor => {
            totalVotes += rumor.supportCount + rumor.disputeCount;
            totalHours += Math.max(1, (Date.now() - rumor.createdAt) / (1000 * 60 * 60));
        });

        return totalHours > 0 ? totalVotes / totalHours : 5;
    },

    /**
     * Analyze user for bot-like behavior
     */
    analyzeUserBehavior(userId) {
        const user = Store.getUser();
        if (user.id !== userId) return { botScore: 0 };

        const timestamps = user.actionTimestamps || [];

        if (timestamps.length < 5) {
            return { botScore: 0, reason: 'insufficient_data' };
        }

        let botScore = 0;
        const flags = [];

        // 1. Temporal regularity
        const times = timestamps.map(t => t.time).sort((a, b) => a - b);
        const intervals = [];
        for (let i = 1; i < times.length; i++) {
            intervals.push(times[i] - times[i - 1]);
        }

        if (intervals.length > 3) {
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
            const stdDev = Math.sqrt(variance);
            const cv = avgInterval > 0 ? stdDev / avgInterval : 1;

            if (cv < 0.1) {
                botScore += 0.3;
                flags.push('regular_timing');
            }
        }

        // 2. Activity pattern (humans follow circadian rhythms)
        const hourDistribution = new Array(24).fill(0);
        timestamps.forEach(t => {
            const hour = new Date(t.time).getHours();
            hourDistribution[hour]++;
        });

        const activeHours = hourDistribution.filter(h => h > 0).length;
        if (activeHours > 20) { // Active 20+ hours = suspicious
            botScore += 0.2;
            flags.push('24_7_activity');
        }

        // 3. Action diversity
        const actionTypes = new Set(timestamps.map(t => t.type));
        if (actionTypes.size === 1 && timestamps.length > 10) {
            botScore += 0.2; // Only does one type of action
            flags.push('single_action_type');
        }

        return {
            botScore: Math.min(1, botScore),
            flags,
            isBot: botScore > this.THRESHOLDS.BOT_SCORE_THRESHOLD
        };
    },

    /**
     * Get recommendation based on anomaly score
     */
    getRecommendation(score) {
        if (score >= 0.7) {
            return {
                severity: this.SEVERITY.CRITICAL,
                action: 'freeze',
                message: 'Critical anomaly detected. Score frozen for investigation.'
            };
        } else if (score >= 0.5) {
            return {
                severity: this.SEVERITY.SEVERE,
                action: 'warn',
                message: 'Suspicious activity detected. Trust score reduced.'
            };
        } else if (score >= 0.3) {
            return {
                severity: this.SEVERITY.MODERATE,
                action: 'monitor',
                message: 'Unusual pattern detected. Enhanced monitoring active.'
            };
        }
        return {
            severity: this.SEVERITY.MINOR,
            action: 'none',
            message: 'No significant anomalies detected.'
        };
    },

    /**
     * Calculate consensus penalty based on patterns
     */
    calculateConsensusPenalty(verifications) {
        let penalty = 0;

        const temporalResult = this.detectTemporalClustering(verifications);
        if (temporalResult.detected) penalty += 0.3;

        const patternResult = this.detectUnnaturalPatterns(verifications);
        if (patternResult.detected) penalty += 0.6;

        const biasResult = this.detectOneSidedVoting(verifications);
        if (biasResult.detected && verifications.length >= 5) penalty += 0.2;

        return Math.min(0.8, penalty);
    }
};
