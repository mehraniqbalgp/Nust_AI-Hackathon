/**
 * CampusVerify - Verify Rumor Component
 * Modal for verifying or disputing rumors
 */

const VerifyRumor = {
    currentRumorId: null,
    voteType: null,
    stakeAmount: 5,

    /**
     * Open verification modal
     */
    open(rumorId, suggestedVote = null) {
        const rumor = Store.getRumorById(rumorId);
        if (!rumor) return;

        const user = Store.getUser();
        if (Store.hasUserVerified(rumorId, user.id)) {
            App.showToast('You have already verified this rumor', 'warning');
            return;
        }

        this.currentRumorId = rumorId;
        this.voteType = suggestedVote;

        const modal = document.getElementById('verifyModal');
        const content = modal.querySelector('.modal-content');

        content.innerHTML = `
            <button class="modal-close" onclick="VerifyRumor.close()">×</button>
            <div class="modal-header">
                <h2>Verify This Rumor</h2>
            </div>
            <div class="modal-body">
                <div class="rumor-preview">
                    <div class="preview-header">
                        <span class="rumor-category">${CATEGORIES[rumor.category]?.icon || '📌'} ${CATEGORIES[rumor.category]?.label || 'Other'}</span>
                        <span class="trust-score ${TrustEngine.getTrustLevel(rumor.finalTrustScore).class}">
                            ${rumor.finalTrustScore}/100
                        </span>
                    </div>
                    <p class="preview-content">${rumor.content}</p>
                    <div class="preview-meta">
                        <span>✅ ${rumor.supportCount} verify</span>
                        <span>❌ ${rumor.disputeCount} dispute</span>
                    </div>
                </div>
                
                <div class="verify-options" id="verifyOptions">
                    <button class="verify-btn verify ${this.voteType === 'support' ? 'selected' : ''}" 
                            onclick="VerifyRumor.selectVote('support')">
                        <span class="verify-icon">✅</span>
                        <span class="verify-label">I can VERIFY</span>
                        <span class="verify-desc">I have evidence this is true</span>
                    </button>
                    <button class="verify-btn dispute ${this.voteType === 'dispute' ? 'selected' : ''}" 
                            onclick="VerifyRumor.selectVote('dispute')">
                        <span class="verify-icon">❌</span>
                        <span class="verify-label">I can DISPUTE</span>
                        <span class="verify-desc">I have evidence this is false</span>
                    </button>
                    <button class="verify-btn skip" onclick="VerifyRumor.close()">
                        <span class="verify-icon">🤷</span>
                        <span class="verify-label">DON'T KNOW</span>
                        <span class="verify-desc">Skip this rumor</span>
                    </button>
                </div>
                
                <div class="verify-evidence-section" id="verifyEvidenceSection" style="display: ${this.voteType ? 'block' : 'none'}">
                    <h4>Add Your Evidence</h4>
                    <textarea id="verifyEvidenceText" placeholder="Describe what you know..."></textarea>
                    
                    <div class="stake-selector">
                        <label>Stake amount:</label>
                        <div class="stake-options">
                            <button class="stake-opt ${this.stakeAmount === 2 ? 'active' : ''}" 
                                    onclick="VerifyRumor.setStake(2)">2 🪙</button>
                            <button class="stake-opt ${this.stakeAmount === 5 ? 'active' : ''}" 
                                    onclick="VerifyRumor.setStake(5)">5 🪙</button>
                            <button class="stake-opt ${this.stakeAmount === 10 ? 'active' : ''}" 
                                    onclick="VerifyRumor.setStake(10)">10 🪙</button>
                        </div>
                        <span class="potential-reward">
                            Win up to <span id="potentialReward">${this.calculateReward()}</span> tokens!
                        </span>
                    </div>
                    
                    <button class="btn btn-success" onclick="VerifyRumor.submit()">
                        Submit ${this.voteType === 'support' ? 'Verification' : 'Dispute'}
                    </button>
                </div>
            </div>
        `;

        modal.classList.add('active');
    },

    /**
     * Close modal
     */
    close() {
        document.getElementById('verifyModal').classList.remove('active');
        this.currentRumorId = null;
        this.voteType = null;
        this.stakeAmount = 5;
    },

    /**
     * Select vote type
     */
    selectVote(type) {
        this.voteType = type;

        // Update button states
        document.querySelectorAll('.verify-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelector(`.verify-btn.${type}`).classList.add('selected');

        // Show evidence section
        document.getElementById('verifyEvidenceSection').style.display = 'block';
    },

    /**
     * Set stake amount
     */
    setStake(amount) {
        this.stakeAmount = amount;

        document.querySelectorAll('.stake-opt').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.textContent) === amount);
        });

        document.getElementById('potentialReward').textContent = this.calculateReward();
    },

    /**
     * Calculate potential reward
     */
    calculateReward() {
        const reward = TokenEconomy.calculatePotentialReward(this.stakeAmount);
        return reward.potentialWin;
    },

    /**
     * Submit verification
     */
    async submit() {
        if (!this.voteType) {
            App.showToast('Please select verify or dispute', 'error');
            return;
        }

        // Check again for duplicate votes
        const user = Store.getUser();
        if (Store.hasUserVerified(this.currentRumorId, user?.id)) {
            App.showToast('You have already voted on this rumor', 'warning');
            this.close();
            return;
        }

        // 🤖 BOT DETECTION CHECK - Analyze user behavior before allowing vote
        const botAnalysis = AnomalyDetector.analyzeUserBehavior(user?.id);
        const rumorAnalysis = AnomalyDetector.analyzeRumor(this.currentRumorId);

        // Track this action for future bot detection
        if (!user.actionTimestamps) user.actionTimestamps = [];
        user.actionTimestamps.push({
            time: Date.now(),
            type: this.voteType === 'support' ? 'verify' : 'dispute'
        });
        // Keep only last 100 actions
        if (user.actionTimestamps.length > 100) {
            user.actionTimestamps = user.actionTimestamps.slice(-100);
        }
        Store.setUser(user);

        // Handle bot detection responses
        if (botAnalysis.isBot || botAnalysis.botScore >= 0.7) {
            // CRITICAL: Block the vote entirely
            App.showToast('🚫 Suspicious activity detected. Your vote has been blocked.', 'error');
            console.warn('🤖 BOT DETECTED:', botAnalysis);

            // Log the blocked attempt
            console.log('📊 Bot Analysis:', {
                botScore: botAnalysis.botScore,
                flags: botAnalysis.flags,
                action: 'BLOCKED'
            });

            this.close();
            return;
        } else if (botAnalysis.botScore >= 0.5) {
            // SEVERE: Allow vote but reduce its weight
            App.showToast('⚠️ Unusual activity detected. Your vote weight has been reduced.', 'warning');
            console.warn('⚠️ SUSPICIOUS USER:', botAnalysis);
            // Vote will proceed but with reduced stake
            this.stakeAmount = Math.max(1, Math.floor(this.stakeAmount * 0.5));
        } else if (botAnalysis.botScore >= 0.3) {
            // MODERATE: Enhanced monitoring - vote proceeds normally but logged
            console.log('👁️ Enhanced monitoring for user:', user?.id, botAnalysis);
        }

        // Check for rumor-level anomalies
        if (rumorAnalysis.isAnomalous && rumorAnalysis.score >= 0.7) {
            App.showToast('⚠️ This rumor is under investigation for suspicious voting patterns.', 'warning');
        }

        const evidenceText = document.getElementById('verifyEvidenceText')?.value || '';
        const isSupport = this.voteType === 'support';

        try {
            // POST to API for database storage
            const response = await fetch(`/api/rumors/${this.currentRumorId}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voteType: isSupport ? 'support' : 'dispute',
                    userId: user?.id || 'anonymous',
                    evidence: evidenceText,
                    stakeAmount: this.stakeAmount
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Verification saved to database:', data);

                // Update local store with the updated rumor
                if (data.rumor) {
                    Store.updateRumor(this.currentRumorId, data.rumor);
                }

                // Record verification locally to prevent duplicate votes
                Store.addVerification({
                    id: Date.now().toString(),
                    rumorId: this.currentRumorId,
                    verifierId: user?.id || 'anonymous',
                    voteType: isSupport ? 'support' : 'dispute',
                    createdAt: Date.now()
                });
            } else {
                // Fallback to local
                TokenEconomy.verify(
                    this.currentRumorId,
                    this.voteType,
                    this.stakeAmount,
                    evidenceText
                );
            }

            // Update user tokens locally
            if (user) {
                user.tokenBalance -= this.stakeAmount;
                user.stakedTokens += this.stakeAmount;
                Store.setUser(user);
            }

            // Show appropriate toast message
            const message = isSupport ? '✅ Verification submitted!' : '❌ Dispute submitted!';
            App.showToast(message, 'success');
            App.updateTokenDisplay();
            this.close();
        } catch (error) {
            console.error('Verification error:', error);
            // Fallback to local
            TokenEconomy.verify(
                this.currentRumorId,
                this.voteType,
                this.stakeAmount,
                evidenceText
            );
            const message = isSupport ? '✅ Verification submitted!' : '❌ Dispute submitted!';
            App.showToast(message, 'success');
            this.close();
        }
    }
};
