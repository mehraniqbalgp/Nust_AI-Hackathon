/**
 * CampusVerify - Token Economy System
 * Game-theoretic incentive design for truth-telling
 */

const TokenEconomy = {
    // Configuration
    CONFIG: {
        INITIAL_BALANCE: 100,
        MAX_BALANCE: 500,

        // Stake limits
        MIN_SUBMIT_STAKE: 5,
        MAX_SUBMIT_STAKE: 50,
        MIN_VERIFY_STAKE: 2,
        MAX_VERIFY_STAKE: 20,

        // Reward multipliers
        WIN_BONUS_RATE: 0.5,        // 50% bonus on stake when correct
        DISPUTED_RETURN_RATE: 0.5,  // 50% return if disputed

        // Resolution thresholds
        VERIFIED_THRESHOLD: 0.7,
        REFUTED_THRESHOLD: 0.3,
        RESOLUTION_TIME_HOURS: 48
    },

    /**
     * Submit a new rumor with stake
     */
    submitRumor(content, category, stakeAmount, evidenceType, evidenceDescription) {
        const user = Store.getUser();

        // Validate stake
        if (stakeAmount < this.CONFIG.MIN_SUBMIT_STAKE || stakeAmount > this.CONFIG.MAX_SUBMIT_STAKE) {
            return { success: false, error: `Stake must be between ${this.CONFIG.MIN_SUBMIT_STAKE} and ${this.CONFIG.MAX_SUBMIT_STAKE}` };
        }

        if (user.tokenBalance < stakeAmount) {
            return { success: false, error: 'Insufficient token balance' };
        }

        // Deduct stake
        Store.updateUser({
            tokenBalance: user.tokenBalance - stakeAmount,
            stakedTokens: (user.stakedTokens || 0) + stakeAmount,
            totalSubmissions: user.totalSubmissions + 1
        });

        // Create rumor
        const rumor = createRumor(user.id, content, category, stakeAmount);
        Store.addRumor(rumor);

        // Add evidence if provided
        if (evidenceDescription) {
            const evidence = createEvidence(rumor.id, user.id, evidenceType || 'testimony', evidenceDescription);
            Store.addEvidence(evidence);

            // Update rumor with evidence
            Store.updateRumor(rumor.id, {
                evidenceIds: [evidence.id]
            });
        }

        // Log activity
        Store.addActivity(createActivityEntry(
            user.id,
            'submitted',
            `Submitted: "${content.substring(0, 50)}..."`,
            -stakeAmount
        ));

        // Record action timestamp for behavioral fingerprinting
        this.recordUserAction(user.id, 'submit');

        // Recalculate trust score
        this.updateRumorTrustScore(rumor.id);

        return { success: true, rumor };
    },

    /**
     * Verify or dispute a rumor
     */
    verify(rumorId, voteType, stakeAmount, evidenceDescription = null) {
        const user = Store.getUser();
        const rumor = Store.getRumorById(rumorId);

        if (!rumor) {
            return { success: false, error: 'Rumor not found' };
        }

        // Check if already verified
        if (Store.hasUserVerified(rumorId, user.id)) {
            return { success: false, error: 'You have already verified this rumor' };
        }

        // Validate stake
        if (stakeAmount < this.CONFIG.MIN_VERIFY_STAKE || stakeAmount > this.CONFIG.MAX_VERIFY_STAKE) {
            return { success: false, error: `Stake must be between ${this.CONFIG.MIN_VERIFY_STAKE} and ${this.CONFIG.MAX_VERIFY_STAKE}` };
        }

        if (user.tokenBalance < stakeAmount) {
            return { success: false, error: 'Insufficient token balance' };
        }

        // Deduct stake
        Store.updateUser({
            tokenBalance: user.tokenBalance - stakeAmount,
            stakedTokens: (user.stakedTokens || 0) + stakeAmount
        });

        // Calculate vote weight based on reputation
        const voteWeight = this.calculateVoteWeight(user);

        // Create verification
        let evidenceId = null;
        if (evidenceDescription) {
            const evidence = createEvidence(rumorId, user.id, 'testimony', evidenceDescription);
            Store.addEvidence(evidence);
            evidenceId = evidence.id;
        }

        const verification = createVerification(rumorId, user.id, voteType, stakeAmount, evidenceId, { voteWeight });
        Store.addVerification(verification);

        // Update rumor counts
        const updates = voteType === 'support'
            ? { supportCount: rumor.supportCount + 1 }
            : { disputeCount: rumor.disputeCount + 1 };

        Store.updateRumor(rumorId, updates);

        // Log activity
        Store.addActivity(createActivityEntry(
            user.id,
            voteType === 'support' ? 'verified' : 'disputed',
            `${voteType === 'support' ? 'Verified' : 'Disputed'}: "${rumor.content.substring(0, 40)}..."`,
            -stakeAmount
        ));

        // Record action for fingerprinting
        this.recordUserAction(user.id, voteType);

        // Recalculate trust score
        this.updateRumorTrustScore(rumorId);

        return { success: true, verification };
    },

    /**
     * Calculate vote weight based on user reputation
     */
    calculateVoteWeight(user) {
        // Base weight
        let weight = 1.0;

        // Reputation multiplier (0.5 to 2.0)
        const reputationMultiplier = 0.5 + user.reputationScore * 1.5;
        weight *= reputationMultiplier;

        // Activity recency factor
        const hoursSinceActive = (Date.now() - user.lastActive) / (1000 * 60 * 60);
        const recencyFactor = hoursSinceActive < 168 ? 1.0 : // Active in last week
            hoursSinceActive < 720 ? 0.7 :  // Active in last month
                0.4;                             // Inactive
        weight *= recencyFactor;

        // New user penalty
        if (user.totalSubmissions + (user.verifiedAccurate || 0) < 5) {
            weight *= 0.6; // New users have reduced weight
        }

        return Math.max(0.3, Math.min(2.0, weight));
    },

    /**
     * Update rumor trust score
     */
    updateRumorTrustScore(rumorId) {
        const rumor = Store.getRumorById(rumorId);
        if (!rumor) return;

        const trustResult = TrustEngine.calculateTrustScore(rumor);

        Store.updateRumor(rumorId, {
            veracityScore: trustResult.components.V,
            confidenceScore: trustResult.components.C,
            temporalRelevance: trustResult.components.T,
            sourceReliability: trustResult.components.S,
            networkConsensus: trustResult.components.N,
            finalTrustScore: trustResult.final,
            status: trustResult.status
        });

        // Check if rumor should be resolved
        this.checkResolution(rumorId);
    },

    /**
     * Check if rumor should be resolved and distribute rewards
     */
    checkResolution(rumorId) {
        const rumor = Store.getRumorById(rumorId);
        if (!rumor || rumor.resolved) return;

        const hoursSinceCreation = (Date.now() - rumor.createdAt) / (1000 * 60 * 60);
        const verifications = Store.getVerificationsForRumor(rumorId);

        // Need minimum verifications and time for resolution
        const hasEnoughVotes = verifications.length >= 5;
        const hasEnoughTime = hoursSinceCreation >= 24;

        // Strong consensus can resolve early
        const normalizedScore = rumor.finalTrustScore / 100;
        const strongConsensus = normalizedScore >= this.CONFIG.VERIFIED_THRESHOLD ||
            normalizedScore <= this.CONFIG.REFUTED_THRESHOLD;

        if ((hasEnoughVotes && hasEnoughTime) || (hasEnoughVotes && strongConsensus)) {
            this.resolveRumor(rumorId);
        }
    },

    /**
     * Resolve rumor and distribute rewards/penalties
     */
    resolveRumor(rumorId) {
        const rumor = Store.getRumorById(rumorId);
        if (!rumor || rumor.resolved) return;

        const normalizedScore = rumor.finalTrustScore / 100;
        const isVerified = normalizedScore >= this.CONFIG.VERIFIED_THRESHOLD;
        const isRefuted = normalizedScore <= this.CONFIG.REFUTED_THRESHOLD;
        const isDisputed = !isVerified && !isRefuted;

        const verifications = Store.getVerificationsForRumor(rumorId);

        // Calculate loser pool
        let loserPool = 0;
        const winners = [];
        const losers = [];

        verifications.forEach(v => {
            const isCorrect = (v.voteType === 'support' && isVerified) ||
                (v.voteType === 'dispute' && isRefuted);

            if (isCorrect) {
                winners.push(v);
            } else if (!isDisputed) {
                losers.push(v);
                loserPool += v.stakeAmount;
            }
        });

        // Distribute rewards
        if (!isDisputed) {
            const bonusPerWinner = winners.length > 0 ? loserPool / winners.length : 0;

            winners.forEach(v => {
                if (v.verifierId !== Store.getUser().id) return;

                const returnAmount = v.stakeAmount +
                    Math.round(v.stakeAmount * this.CONFIG.WIN_BONUS_RATE) +
                    Math.round(bonusPerWinner);

                const user = Store.getUser();
                Store.updateUser({
                    tokenBalance: Math.min(this.CONFIG.MAX_BALANCE, user.tokenBalance + returnAmount),
                    stakedTokens: user.stakedTokens - v.stakeAmount,
                    verifiedAccurate: user.verifiedAccurate + 1
                });

                Store.addActivity(createActivityEntry(
                    user.id,
                    'earned',
                    `Won verification: +${returnAmount} tokens`,
                    returnAmount
                ));
            });

            losers.forEach(v => {
                if (v.verifierId !== Store.getUser().id) return;

                const user = Store.getUser();
                Store.updateUser({
                    stakedTokens: user.stakedTokens - v.stakeAmount,
                    verifiedFalse: user.verifiedFalse + 1
                });

                Store.addActivity(createActivityEntry(
                    user.id,
                    'lost',
                    `Lost verification: -${v.stakeAmount} tokens`,
                    0
                ));
            });
        } else {
            // Disputed - partial refund
            verifications.forEach(v => {
                if (v.verifierId !== Store.getUser().id) return;

                const refund = Math.round(v.stakeAmount * this.CONFIG.DISPUTED_RETURN_RATE);
                const user = Store.getUser();

                Store.updateUser({
                    tokenBalance: user.tokenBalance + refund,
                    stakedTokens: user.stakedTokens - v.stakeAmount
                });
            });
        }

        // Handle submitter reward/penalty
        this.resolveSubmitterStake(rumor, isVerified, isRefuted, isDisputed);

        // Update rumor as resolved
        Store.updateRumor(rumorId, { resolved: true });
    },

    /**
     * Handle submitter stake resolution
     */
    resolveSubmitterStake(rumor, isVerified, isRefuted, isDisputed) {
        if (rumor.submitterId !== Store.getUser().id) return;

        const user = Store.getUser();

        if (isVerified) {
            // Winner! Return stake + bonus
            const returnAmount = rumor.stakeAmount + Math.round(rumor.stakeAmount * this.CONFIG.WIN_BONUS_RATE);

            Store.updateUser({
                tokenBalance: Math.min(this.CONFIG.MAX_BALANCE, user.tokenBalance + returnAmount),
                stakedTokens: user.stakedTokens - rumor.stakeAmount,
                verifiedAccurate: user.verifiedAccurate + 1,
                reputationScore: Math.min(1, user.reputationScore + 0.02)
            });

            Store.addActivity(createActivityEntry(
                user.id,
                'earned',
                `Rumor verified! +${returnAmount} tokens`,
                returnAmount
            ));
        } else if (isRefuted) {
            // Lost stake
            Store.updateUser({
                stakedTokens: user.stakedTokens - rumor.stakeAmount,
                verifiedFalse: user.verifiedFalse + 1,
                reputationScore: Math.max(0, user.reputationScore - 0.05)
            });

            Store.addActivity(createActivityEntry(
                user.id,
                'lost',
                `Rumor refuted! Lost ${rumor.stakeAmount} tokens`,
                0
            ));
        } else {
            // Disputed - partial refund
            const refund = Math.round(rumor.stakeAmount * this.CONFIG.DISPUTED_RETURN_RATE);

            Store.updateUser({
                tokenBalance: user.tokenBalance + refund,
                stakedTokens: user.stakedTokens - rumor.stakeAmount
            });
        }
    },

    /**
     * Record user action for behavioral fingerprinting
     */
    recordUserAction(userId, actionType) {
        const user = Store.getUser();
        if (user.id !== userId) return;

        const timestamps = user.actionTimestamps || [];
        timestamps.push({
            type: actionType,
            time: Date.now()
        });

        // Keep only last 100 actions
        if (timestamps.length > 100) {
            timestamps.shift();
        }

        Store.updateUser({ actionTimestamps: timestamps });
    },

    /**
     * Calculate potential reward for verification
     */
    calculatePotentialReward(stakeAmount) {
        // Simple estimation
        const minReward = stakeAmount; // Return stake
        const maxReward = stakeAmount + Math.round(stakeAmount * this.CONFIG.WIN_BONUS_RATE) + 5; // Plus bonus and share

        return {
            stake: stakeAmount,
            potentialWin: maxReward,
            potentialLoss: stakeAmount
        };
    }
};
