/**
 * CampusVerify - Trust Score Engine
 * Calculates multi-dimensional trust scores for rumors
 * 
 * Trust Score Components:
 * V = Veracity (35%) - Evidence-based truth assessment
 * C = Confidence (25%) - Certainty of assessment
 * T = Temporal Relevance (20%) - Time decay
 * S = Source Reliability (10%) - Submitter track record
 * N = Network Consensus (10%) - Verifier agreement
 */

const TrustEngine = {
    // Component weights
    WEIGHTS: {
        veracity: 0.35,
        confidence: 0.25,
        temporal: 0.20,
        source: 0.10,
        consensus: 0.10
    },

    // Thresholds for status
    THRESHOLDS: {
        verified: 70,
        disputed: 30
    },

    /**
     * Calculate complete trust score for a rumor
     */
    calculateTrustScore(rumor) {
        const evidence = Store.getEvidenceForRumor(rumor.id);
        const verifications = Store.getVerificationsForRumor(rumor.id);
        const submitter = this.getSubmitterInfo(rumor.submitterId);

        // Calculate each component
        const V = this.calculateVeracity(evidence, verifications);
        const C = this.calculateConfidence(evidence, verifications);
        const T = this.calculateTemporalRelevance(rumor);
        const S = this.calculateSourceReliability(submitter);
        const N = this.calculateNetworkConsensus(verifications);

        // Weighted sum
        let score = (
            this.WEIGHTS.veracity * V +
            this.WEIGHTS.confidence * C +
            this.WEIGHTS.temporal * T +
            this.WEIGHTS.source * S +
            this.WEIGHTS.consensus * N
        ) * 100;

        // Apply boosts and penalties
        score += this.calculateBoosts(rumor, evidence);
        score -= this.calculatePenalties(rumor, verifications);

        // Clamp to 0-100
        score = Math.max(0, Math.min(100, Math.round(score)));

        return {
            final: score,
            components: { V, C, T, S, N },
            status: this.getStatus(score)
        };
    },

    /**
     * V - Veracity Score
     * Based on evidence quality and quantity
     */
    calculateVeracity(evidence, verifications) {
        if (!evidence || evidence.length === 0) {
            // No evidence, rely on votes
            const supports = verifications.filter(v => v.voteType === 'support').length;
            const disputes = verifications.filter(v => v.voteType === 'dispute').length;
            const total = supports + disputes;

            if (total === 0) return 0.5; // Neutral
            return supports / total;
        }

        // Calculate evidence contribution
        let evidenceScore = 0;
        let recencySum = 0;

        evidence.forEach((e, index) => {
            const weight = EVIDENCE_WEIGHTS[e.type] || 0.3;
            const quality = e.qualityScore || 0.8;
            const hoursSinceSubmission = (Date.now() - e.createdAt) / (1000 * 60 * 60);
            const recencyFactor = Math.exp(-0.01 * hoursSinceSubmission);

            // Diminishing returns for same type
            const dimFactor = 1 / (1 + index * 0.2);

            evidenceScore += weight * quality * recencyFactor * dimFactor;
            recencySum += recencyFactor;
        });

        // Factor in contradiction from disputes
        const disputes = verifications.filter(v => v.voteType === 'dispute').length;
        const contradictionPenalty = disputes * 0.15;

        // Calculate final veracity
        const rawScore = evidenceScore / (1 + contradictionPenalty);

        // Normalize to 0-1 (cap at 2.0 raw score = 1.0 normalized)
        return Math.min(rawScore / 2, 1.0);
    },

    /**
     * C - Confidence Score
     * How certain we are about our veracity assessment
     */
    calculateConfidence(evidence, verifications) {
        // Base confidence from evidence type
        let baseConfidence = 0.5;
        if (evidence && evidence.length > 0) {
            const hasDocumentary = evidence.some(e => e.type === 'documentary');
            const hasMedia = evidence.some(e => e.type === 'photo' || e.type === 'video');

            if (hasDocumentary) baseConfidence = 0.9;
            else if (hasMedia) baseConfidence = 0.7;
            else baseConfidence = 0.5;
        }

        // Sample size factor (more verifiers = more confidence)
        const n = verifications.length;
        const sampleSizeFactor = 1 - Math.exp(-n / 10);

        // Time factor (recent verifications more reliable)
        let timeFactor = 0.5;
        if (verifications.length > 0) {
            const latestVerification = Math.max(...verifications.map(v => v.createdAt));
            const hoursSince = (Date.now() - latestVerification) / (1000 * 60 * 60);
            timeFactor = 0.5 + 0.5 * Math.exp(-hoursSince / 24);
        }

        // Diversity factor (are verifiers clustered or diverse?)
        const diversityFactor = this.calculateDiversityFactor(verifications);

        return baseConfidence * sampleSizeFactor * timeFactor * diversityFactor;
    },

    /**
     * T - Temporal Relevance
     * How current/relevant the information is
     */
    calculateTemporalRelevance(rumor) {
        const hoursSinceCreation = (Date.now() - rumor.createdAt) / (1000 * 60 * 60);

        // Different decay curves based on category
        switch (rumor.category) {
            case 'events':
            case 'food':
                // Rapid decay for time-sensitive content
                return Math.exp(-0.5 * hoursSinceCreation);

            case 'academic':
            case 'facilities':
                // Slower decay for policy/schedule info
                return 1 / (1 + 0.01 * hoursSinceCreation);

            case 'tech':
            case 'other':
            default:
                // Medium decay
                return 0.5 + 0.5 * Math.exp(-0.1 * hoursSinceCreation);
        }
    },

    /**
     * S - Source Reliability
     * Track record of the submitter
     */
    calculateSourceReliability(submitter) {
        if (!submitter || submitter.id === 'system') {
            return 0.7; // Default for system-generated content
        }

        const { totalSubmissions, verifiedAccurate, verifiedFalse } = submitter;

        if (totalSubmissions === 0) {
            return 0.5; // New user, neutral
        }

        // Penalize false claims twice as much
        const rawScore = (verifiedAccurate - 2 * verifiedFalse) / totalSubmissions;

        // Apply recency weight (would need activity history for full implementation)
        const recencyWeight = 1.0;

        // Normalize to 0-1
        return Math.max(0, Math.min(1, (rawScore + 1) / 2));
    },

    /**
     * N - Network Consensus
     * Agreement across independent verifiers
     */
    calculateNetworkConsensus(verifications) {
        if (verifications.length === 0) return 0.5;

        const supports = verifications.filter(v => v.voteType === 'support');
        const disputes = verifications.filter(v => v.voteType === 'dispute');

        const supportWeight = supports.reduce((sum, v) => sum + (v.voteWeight || 1), 0);
        const disputeWeight = disputes.reduce((sum, v) => sum + (v.voteWeight || 1), 0);
        const totalWeight = supportWeight + disputeWeight;

        if (totalWeight === 0) return 0.5;

        // Raw consensus (1 = all support, 0 = all dispute)
        const rawConsensus = supportWeight / totalWeight;

        // Apply suspicious pattern penalty
        const penalty = this.detectSuspiciousPatterns(verifications);

        return rawConsensus * (1 - penalty);
    },

    /**
     * Calculate diversity factor for verifications
     */
    calculateDiversityFactor(verifications) {
        if (verifications.length < 2) return 0.5;

        // Check temporal clustering (all votes within short window = suspicious)
        const timestamps = verifications.map(v => v.createdAt).sort((a, b) => a - b);
        const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];
        const avgInterval = timeSpan / (timestamps.length - 1);

        // If all votes within 2 minutes, low diversity
        if (timeSpan < 2 * 60 * 1000) {
            return 0.3;
        }

        // Good distribution
        return Math.min(1, avgInterval / (30 * 60 * 1000)); // 30 min intervals = 1.0
    },

    /**
     * Detect suspicious voting patterns
     */
    detectSuspiciousPatterns(verifications) {
        if (verifications.length < 3) return 0;

        let penalty = 0;

        // 1. Temporal clustering
        const timestamps = verifications.map(v => v.createdAt).sort((a, b) => a - b);
        const timeSpan = timestamps[timestamps.length - 1] - timestamps[0];

        if (timeSpan < 2 * 60 * 1000 && verifications.length >= 5) {
            penalty += 0.3; // All votes within 2 minutes
        }

        // 2. Regular intervals (bot-like)
        if (verifications.length >= 5) {
            const intervals = [];
            for (let i = 1; i < timestamps.length; i++) {
                intervals.push(timestamps[i] - timestamps[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
            const stdDev = Math.sqrt(variance);

            // Low variance = too regular = suspicious
            if (stdDev < avgInterval * 0.1 && avgInterval > 1000) {
                penalty += 0.4;
            }
        }

        return Math.min(0.8, penalty);
    },

    /**
     * Calculate boost factors
     */
    calculateBoosts(rumor, evidence) {
        let boost = 0;

        // Official document boost
        if (evidence && evidence.some(e => e.type === 'documentary')) {
            boost += 10;
        }

        // Expert consensus boost (5+ high-rep verifiers)
        // Would need reputation data for full implementation

        return boost;
    },

    /**
     * Calculate penalty factors
     */
    calculatePenalties(rumor, verifications) {
        let penalty = 0;

        // Bot detection penalty
        if (this.detectSuspiciousPatterns(verifications) > 0.5) {
            penalty += 20;
        }

        // Strong contradiction penalty
        const disputes = verifications.filter(v => v.voteType === 'dispute');
        const supports = verifications.filter(v => v.voteType === 'support');

        if (disputes.length > supports.length * 0.5 && disputes.length >= 3) {
            penalty += 15;
        }

        return penalty;
    },

    /**
     * Get status based on score
     */
    getStatus(score) {
        if (score >= this.THRESHOLDS.verified) return 'verified';
        if (score <= this.THRESHOLDS.disputed) return 'disputed';
        return 'unverified';
    },

    /**
     * Get submitter info
     */
    getSubmitterInfo(submitterId) {
        if (submitterId === 'system') {
            return { id: 'system', totalSubmissions: 10, verifiedAccurate: 9, verifiedFalse: 0 };
        }
        return Store.getUser();
    },

    /**
     * Get trust level label and color
     */
    getTrustLevel(score) {
        if (score >= 80) return { label: 'HIGH CONFIDENCE', class: 'high', stars: 4 };
        if (score >= 60) return { label: 'MODERATE', class: 'medium', stars: 3 };
        if (score >= 40) return { label: 'UNVERIFIED', class: 'unverified', stars: 2 };
        return { label: 'LOW TRUST', class: 'low', stars: 1 };
    },

    /**
     * Predict trust score for new submission
     */
    predictTrustScore(category, evidenceType, confidence) {
        // Base prediction
        let base = 50;

        // Evidence type bonus
        if (evidenceType === 'documentary') base += 15;
        else if (evidenceType === 'photo' || evidenceType === 'video') base += 10;
        else if (evidenceType === 'testimony') base += 5;

        // Confidence bonus
        if (confidence === 'high') base += 10;
        else if (confidence === 'medium') base += 5;

        // User reputation bonus (simplified)
        const user = Store.getUser();
        if (user && user.reputationScore > 0.7) base += 10;

        return {
            min: Math.max(30, base - 15),
            max: Math.min(90, base + 15)
        };
    }
};
