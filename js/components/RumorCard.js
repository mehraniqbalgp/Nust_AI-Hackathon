/**
 * CampusVerify - Rumor Card Component
 * Renders individual rumor cards with trust scores
 */

const RumorCard = {
    /**
     * Render a rumor card
     */
    render(rumor) {
        const trustLevel = TrustEngine.getTrustLevel(rumor.finalTrustScore);
        const category = CATEGORIES[rumor.category] || CATEGORIES.other;
        const evidence = Store.getEvidenceForRumor(rumor.id);
        const timeAgo = this.getTimeAgo(rumor.createdAt);

        // Check if current user already voted or if it's their own rumor
        const user = Store.getUser();
        const isOwnRumor = rumor.submitterId === user?.id;
        const hasVoted = Store.hasUserVerified(rumor.id, user?.id);
        const userVote = hasVoted ? this.getUserVoteType(rumor.id, user?.id) : null;

        // Render appropriate action buttons/labels
        let actionsHtml;
        if (isOwnRumor) {
            actionsHtml = `
                <span class="already-voted own-rumor">📝 Your Rumor</span>
                <button class="action-btn delete" onclick="RumorCard.confirmDelete('${rumor.id}')">
                    🗑️ Delete
                </button>
            `;
        } else if (hasVoted) {
            actionsHtml = `
                <span class="already-voted ${userVote === 'support' ? 'voted-verify' : 'voted-dispute'}">
                    ${userVote === 'support' ? '✅ You Verified' : '❌ You Disputed'}
                </span>
            `;
        } else {
            actionsHtml = `
                <button class="action-btn verify" onclick="VerifyRumor.open('${rumor.id}', 'support')">
                    ✅ Verify
                </button>
                <button class="action-btn dispute" onclick="VerifyRumor.open('${rumor.id}', 'dispute')">
                    ❌ Dispute
                </button>
            `;
        }

        return `
            <article class="rumor-card" data-rumor-id="${rumor.id}">
                <div class="rumor-header">
                    <span class="rumor-category">
                        ${category.icon} ${category.label}
                    </span>
                    <div class="trust-badge" onclick="RumorCard.showTrustDetails('${rumor.id}')">
                        <span class="trust-score ${trustLevel.class}">${rumor.finalTrustScore}</span>
                        <span class="trust-label">${trustLevel.label}</span>
                        <span class="trust-stars">${'⭐'.repeat(trustLevel.stars)}</span>
                    </div>
                </div>
                
                <p class="rumor-content">${this.escapeHtml(rumor.content)}</p>
                
                ${this.renderEvidenceSection(rumor)}
                
                <div class="rumor-footer">
                    <div class="rumor-meta">
                        <span>⏰ ${timeAgo}</span>
                        <span>✅ ${rumor.supportCount} verify</span>
                        <span>❌ ${rumor.disputeCount} dispute</span>
                    </div>
                    <div class="rumor-actions">
                        ${actionsHtml}
                    </div>
                </div>
            </article>
        `;
    },

    /**
     * Render evidence section with files
     */
    renderEvidenceSection(rumor) {
        const evidenceType = rumor.evidenceType || 'testimony';
        const evidenceFiles = rumor.evidenceFiles || [];

        // Evidence type badge
        const typeIcons = {
            photo: '📸',
            documentary: '📧',
            video: '🎥',
            testimony: '👤'
        };
        const typeLabels = {
            photo: 'Photo Evidence',
            documentary: 'Document Evidence',
            video: 'Video Evidence',
            testimony: 'Testimony'
        };

        let html = `<div class="rumor-evidence">
            <span class="evidence-tag">${typeIcons[evidenceType] || '👤'} ${typeLabels[evidenceType] || 'Testimony'}</span>
        </div>`;

        // Add evidence files gallery if any
        if (evidenceFiles.length > 0) {
            html += `<div class="evidence-gallery">`;
            evidenceFiles.forEach((file, index) => {
                const fileId = `evidence_${rumor.id}_${index}`;
                if (file.type && file.type.startsWith('image/')) {
                    html += `<div class="evidence-item" data-file-id="${fileId}" onclick="RumorCard.viewEvidence('${rumor.id}', ${index})">
                        <img src="${file.data}" alt="${file.name}" loading="lazy">
                        <span class="evidence-overlay">🔍 View</span>
                    </div>`;
                } else if (file.type && file.type.startsWith('video/')) {
                    html += `<div class="evidence-item video" data-file-id="${fileId}" onclick="RumorCard.viewEvidence('${rumor.id}', ${index})">
                        <video src="${file.data}" muted></video>
                        <span class="play-icon">▶️</span>
                        <span class="evidence-overlay">🎬 Play</span>
                    </div>`;
                } else {
                    html += `<div class="evidence-item document" onclick="RumorCard.downloadEvidence('${rumor.id}', ${index})">
                        <span class="doc-icon">📄</span>
                        <span class="doc-name">${file.name || 'Document'}</span>
                        <span class="evidence-overlay">📥 Download</span>
                    </div>`;
                }
            });
            html += `</div>`;
        }

        // Add evidence description if any
        if (rumor.evidenceDescription) {
            html += `<p class="evidence-description">"${this.escapeHtml(rumor.evidenceDescription)}"</p>`;
        }

        return html;
    },

    /**
     * View evidence in modal
     */
    async viewEvidence(rumorId, fileIndex) {
        const rumors = Store.getRumors() || [];
        let rumor = rumors.find(r => r.id === rumorId);
        if (!rumor || !rumor.evidenceFiles || !rumor.evidenceFiles[fileIndex]) {
            App.showToast('Evidence not found', 'error');
            return;
        }

        let file = rumor.evidenceFiles[fileIndex];
        const modal = document.getElementById('verifyModal');
        const content = modal.querySelector('.modal-content');

        // If video data is missing, fetch from API
        if (file.type && file.type.startsWith('video/') && !file.data) {
            content.innerHTML = `
                <button class="modal-close" onclick="VerifyRumor.close()">×</button>
                <div class="evidence-modal-content">
                    <div style="text-align:center;padding:40px;">
                        <div class="loading-spinner"></div>
                        <p style="margin-top:20px;color:var(--text-secondary)">Loading video from server...</p>
                    </div>
                </div>
            `;
            modal.classList.add('active');

            try {
                const response = await fetch(`/api/rumors/${rumorId}`);
                if (response.ok) {
                    const fullRumor = await response.json();
                    if (fullRumor.evidenceFiles && fullRumor.evidenceFiles[fileIndex]) {
                        file = fullRumor.evidenceFiles[fileIndex];
                    }
                }
            } catch (error) {
                console.error('Failed to fetch video:', error);
                content.innerHTML = `
                    <button class="modal-close" onclick="VerifyRumor.close()">×</button>
                    <div class="evidence-modal-content">
                        <p style="color:var(--danger);">Failed to load video</p>
                    </div>
                `;
                return;
            }
        }

        if (file.type && file.type.startsWith('image/')) {
            content.innerHTML = `
                <button class="modal-close" onclick="VerifyRumor.close()">×</button>
                <div class="evidence-modal-content">
                    <img src="${file.data}" alt="${file.name}" style="max-width:100%;max-height:80vh;border-radius:8px;">
                    <div class="evidence-actions">
                        <button class="btn btn-primary" onclick="RumorCard.downloadEvidence('${rumorId}', ${fileIndex})">
                            📥 Download Image
                        </button>
                    </div>
                </div>
            `;
        } else if (file.type && file.type.startsWith('video/') && file.data) {
            content.innerHTML = `
                <button class="modal-close" onclick="VerifyRumor.close()">×</button>
                <div class="evidence-modal-content">
                    <video src="${file.data}" controls autoplay style="max-width:100%;max-height:80vh;border-radius:8px;"></video>
                    <div class="evidence-actions">
                        <button class="btn btn-primary" onclick="RumorCard.downloadEvidence('${rumorId}', ${fileIndex})">
                            📥 Download Video
                        </button>
                    </div>
                </div>
            `;
        } else {
            content.innerHTML = `
                <button class="modal-close" onclick="VerifyRumor.close()">×</button>
                <div class="evidence-modal-content">
                    <p>📄 ${file.name}</p>
                    <button class="btn btn-primary" onclick="RumorCard.downloadEvidence('${rumorId}', ${fileIndex})">
                        📥 Download File
                    </button>
                </div>
            `;
        }

        modal.classList.add('active');
    },

    /**
     * Download evidence file
     */
    async downloadEvidence(rumorId, fileIndex) {
        const rumors = Store.getRumors() || [];
        let rumor = rumors.find(r => r.id === rumorId);

        if (!rumor || !rumor.evidenceFiles || !rumor.evidenceFiles[fileIndex]) {
            App.showToast('Evidence not found', 'error');
            return;
        }

        let file = rumor.evidenceFiles[fileIndex];

        // If data is missing (video was stripped), fetch full rumor from API
        if (!file.data) {
            App.showToast('⏳ Fetching video from server...', 'info');
            try {
                const response = await fetch(`/api/rumors/${rumorId}`);
                if (response.ok) {
                    const fullRumor = await response.json();
                    if (fullRumor.evidenceFiles && fullRumor.evidenceFiles[fileIndex]) {
                        file = fullRumor.evidenceFiles[fileIndex];
                    }
                }
            } catch (error) {
                console.error('Failed to fetch full rumor:', error);
                App.showToast('❌ Failed to download video', 'error');
                return;
            }
        }

        if (!file.data) {
            App.showToast('❌ File data not available', 'error');
            return;
        }

        // Create download link
        const link = document.createElement('a');
        link.href = file.data;
        link.download = file.name || `evidence_${fileIndex}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        App.showToast(`📥 Downloading ${file.name}...`, 'success');
    },

    /**
     * Show evidence in modal (legacy - kept for compatibility)
     */
    showEvidenceModal(src, type) {
        const modal = document.getElementById('verifyModal');
        const content = modal.querySelector('.modal-content');

        if (type === 'image') {
            content.innerHTML = `
                <button class="modal-close" onclick="VerifyRumor.close()">×</button>
                <div class="evidence-modal-content">
                    <img src="${src}" alt="Evidence" style="max-width:100%;max-height:80vh;border-radius:8px;">
                </div>
            `;
        } else if (type === 'video') {
            content.innerHTML = `
                <button class="modal-close" onclick="VerifyRumor.close()">×</button>
                <div class="evidence-modal-content">
                    <video src="${src}" controls autoplay style="max-width:100%;max-height:80vh;border-radius:8px;"></video>
                </div>
            `;
        }

        modal.classList.add('active');
    },

    /**
     * Get user's vote type for a rumor
     */
    getUserVoteType(rumorId, userId) {
        const verifications = Store.getVerifications() || [];
        const vote = verifications.find(v => v.rumorId === rumorId && v.verifierId === userId);
        return vote?.voteType || null;
    },

    /**
     * Render evidence tags
     */
    renderEvidenceTags(evidence) {
        if (!evidence || evidence.length === 0) {
            return '<span class="evidence-tag">👤 Testimony only</span>';
        }

        const typeCounts = {};
        evidence.forEach(e => {
            typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
        });

        const icons = {
            photo: '📸',
            video: '🎥',
            documentary: '📧',
            testimony: '👤'
        };

        return Object.entries(typeCounts)
            .map(([type, count]) => {
                const icon = icons[type] || '📌';
                return `<span class="evidence-tag">${icon} ${count} ${type}</span>`;
            })
            .join('');
    },

    /**
     * Show trust score details modal
     */
    showTrustDetails(rumorId) {
        const rumor = Store.getRumorById(rumorId);
        if (!rumor) return;

        const modal = document.getElementById('trustModal');
        const body = document.getElementById('trustModalBody') || modal.querySelector('.modal-content');

        const components = [
            { key: 'V', label: 'Veracity', value: rumor.veracityScore, desc: 'Evidence-based truth assessment' },
            { key: 'C', label: 'Confidence', value: rumor.confidenceScore, desc: 'Certainty of assessment' },
            { key: 'T', label: 'Temporal', value: rumor.temporalRelevance, desc: 'Time relevance' },
            { key: 'S', label: 'Source', value: rumor.sourceReliability, desc: 'Submitter track record' },
            { key: 'N', label: 'Consensus', value: rumor.networkConsensus, desc: 'Verifier agreement' }
        ];

        body.innerHTML = `
            <button class="modal-close" onclick="RumorCard.closeTrustModal()">×</button>
            <div class="modal-header">
                <h2>Trust Score Breakdown</h2>
            </div>
            <div class="trust-details-content">
                <div class="trust-final">
                    <span class="trust-score-large ${TrustEngine.getTrustLevel(rumor.finalTrustScore).class}">
                        ${rumor.finalTrustScore}
                    </span>
                    <span class="trust-score-label">/100</span>
                </div>
                
                <div class="trust-components">
                    ${components.map(c => `
                        <div class="trust-component">
                            <div class="component-header">
                                <span class="component-key">${c.key}</span>
                                <span class="component-label">${c.label}</span>
                                <span class="component-value">${Math.round(c.value * 100)}%</span>
                            </div>
                            <div class="component-bar">
                                <div class="component-fill" style="width: ${c.value * 100}%"></div>
                            </div>
                            <span class="component-desc">${c.desc}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="trust-status">
                    <span class="status-label">Status:</span>
                    <span class="status-badge ${rumor.status}">${rumor.status.toUpperCase()}</span>
                </div>
            </div>
        `;

        modal.classList.add('active');
    },

    /**
     * Close trust modal
     */
    closeTrustModal() {
        document.getElementById('trustModal').classList.remove('active');
    },

    /**
     * Get human-readable time ago
     */
    getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Confirm before deleting a rumor
     */
    confirmDelete(rumorId) {
        if (confirm('Are you sure you want to delete this rumor? This action cannot be undone.')) {
            this.deleteRumor(rumorId);
        }
    },

    /**
     * Delete a rumor
     */
    async deleteRumor(rumorId) {
        try {
            const user = Store.getUser();

            // Try to delete from API
            const response = await fetch(`/api/rumors/${rumorId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id })
            });

            if (response.ok) {
                console.log('🗑️ Rumor deleted from database:', rumorId);
            }

            // Remove from local store
            const rumors = Store.getRumors() || [];
            const filtered = rumors.filter(r => r.id !== rumorId);
            localStorage.setItem(Store.KEYS.RUMORS, JSON.stringify(filtered));
            Store.emit('rumors:updated', filtered);

            App.showToast('🗑️ Rumor deleted successfully', 'success');
            Feed.render();
        } catch (error) {
            console.error('Delete error:', error);

            // Still remove locally
            const rumors = Store.getRumors() || [];
            const filtered = rumors.filter(r => r.id !== rumorId);
            localStorage.setItem(Store.KEYS.RUMORS, JSON.stringify(filtered));
            Store.emit('rumors:updated', filtered);

            App.showToast('🗑️ Rumor deleted', 'success');
            Feed.render();
        }
    }
};
