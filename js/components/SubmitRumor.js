/**
 * CampusVerify - Submit Rumor Component
 * 3-step wizard for submitting rumors
 */

const SubmitRumor = {
    currentStep: 1,
    formData: {
        content: '',
        category: null,
        confidence: 'medium',
        stakeAmount: 10,
        evidenceType: 'testimony',
        evidenceDescription: ''
    },

    /**
     * Initialize submit form
     */
    init() {
        this.renderPage();
        this.bindEvents();
    },

    /**
     * Render the submit page content
     */
    renderPage() {
        const page = document.getElementById('submitPage');
        if (!page) return;

        page.innerHTML = `
            <div class="submit-container">
                <div class="step-indicators">
                    <div class="step ${this.currentStep >= 1 ? 'active' : ''}" data-step="1">
                        <span class="step-number">1</span>
                        <span class="step-label">Content</span>
                    </div>
                    <div class="step-line ${this.currentStep >= 2 ? 'active' : ''}"></div>
                    <div class="step ${this.currentStep >= 2 ? 'active' : ''}" data-step="2">
                        <span class="step-number">2</span>
                        <span class="step-label">Evidence</span>
                    </div>
                    <div class="step-line ${this.currentStep >= 3 ? 'active' : ''}"></div>
                    <div class="step ${this.currentStep >= 3 ? 'active' : ''}" data-step="3">
                        <span class="step-number">3</span>
                        <span class="step-label">Confirm</span>
                    </div>
                </div>
                
                ${this.renderCurrentStep()}
            </div>
        `;
    },

    /**
     * Render current step content
     */
    renderCurrentStep() {
        switch (this.currentStep) {
            case 1: return this.renderStep1();
            case 2: return this.renderStep2();
            case 3: return this.renderStep3();
            default: return '';
        }
    },

    /**
     * Step 1: Content
     */
    renderStep1() {
        return `
            <div class="submit-step active" id="submitStep1">
                <h2>Share Campus News</h2>
                <div class="form-group">
                    <label for="rumorContent">What's happening?</label>
                    <textarea id="rumorContent" placeholder="Describe the rumor or news..." rows="4">${this.formData.content}</textarea>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <div class="category-grid">
                        ${Object.entries(CATEGORIES).map(([key, cat]) => `
                            <button class="category-btn ${this.formData.category === key ? 'active' : ''}" 
                                    data-category="${key}" onclick="SubmitRumor.selectCategory('${key}')">
                                ${cat.icon} ${cat.label}
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label>How confident are you?</label>
                    <div class="confidence-options">
                        <label class="confidence-option">
                            <input type="radio" name="confidence" value="high" ${this.formData.confidence === 'high' ? 'checked' : ''}>
                            <span class="option-card">
                                <span class="option-icon">💯</span>
                                <span class="option-title">Very Sure</span>
                                <span class="option-stake">Stake 20 tokens</span>
                            </span>
                        </label>
                        <label class="confidence-option">
                            <input type="radio" name="confidence" value="medium" ${this.formData.confidence === 'medium' ? 'checked' : ''}>
                            <span class="option-card">
                                <span class="option-icon">👍</span>
                                <span class="option-title">Pretty Sure</span>
                                <span class="option-stake">Stake 10 tokens</span>
                            </span>
                        </label>
                        <label class="confidence-option">
                            <input type="radio" name="confidence" value="low" ${this.formData.confidence === 'low' ? 'checked' : ''}>
                            <span class="option-card">
                                <span class="option-icon">🤔</span>
                                <span class="option-title">Heard It</span>
                                <span class="option-stake">Stake 5 tokens</span>
                            </span>
                        </label>
                    </div>
                </div>
                <button class="btn btn-primary btn-next" onclick="SubmitRumor.nextStep()">
                    Next: Add Evidence →
                </button>
            </div>
        `;
    },

    /**
     * Step 2: Evidence
     */
    renderStep2() {
        return `
            <div class="submit-step active" id="submitStep2">
                <h2>Make Your Claim Stronger</h2>
                <p class="step-subtitle">Adding evidence increases trust and protects your tokens!</p>
                
                <div class="evidence-types">
                    ${['photo', 'documentary', 'video', 'testimony'].map(type => `
                        <div class="evidence-type ${this.formData.evidenceType === type ? 'active' : ''}" 
                             data-type="${type}" onclick="SubmitRumor.selectEvidence('${type}')">
                            <span class="evidence-icon">${this.getEvidenceIcon(type)}</span>
                            <span class="evidence-label">${this.getEvidenceLabel(type)}</span>
                            <span class="evidence-boost">+${this.getEvidenceBoost(type)}% trust</span>
                        </div>
                    `).join('')}
                </div>
                
                <!-- File Upload -->
                <div class="form-group" id="fileUploadGroup" style="display: ${this.formData.evidenceType !== 'testimony' ? 'block' : 'none'}">
                    <label>Upload Evidence</label>
                    <div class="file-upload" id="fileUploadZone">
                        <input type="file" id="evidenceFiles" multiple 
                               accept="image/*,video/*,.pdf"
                               onchange="SubmitRumor.handleFileSelect(event)">
                        <span class="file-upload-icon">📁</span>
                        <span class="file-upload-text">Drop files here or click to upload</span>
                        <span class="file-upload-hint">Max 10MB per file • JPG, PNG, MP4, PDF</span>
                    </div>
                    <div class="file-preview" id="filePreview"></div>
                </div>
                
                <div class="form-group">
                    <label for="evidenceDescription">Describe your evidence</label>
                    <textarea id="evidenceDescription" placeholder="What did you see, hear, or receive?" rows="3">${this.formData.evidenceDescription}</textarea>
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="SubmitRumor.prevStep()">← Back</button>
                    <button class="btn btn-primary" onclick="SubmitRumor.nextStep()">Review & Submit →</button>
                </div>
            </div>
        `;
    },

    /**
     * Get allowed file types for current evidence type
     */
    getAllowedTypes() {
        switch (this.formData.evidenceType) {
            case 'photo':
                return { accept: 'image/*', types: ['image/'], label: 'images (JPG, PNG, GIF)' };
            case 'video':
                return { accept: 'video/*', types: ['video/'], label: 'videos (MP4, WebM, MOV)' };
            case 'documentary':
                return { accept: 'image/*,.pdf,.doc,.docx', types: ['image/', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats'], label: 'documents (PDF, screenshots, DOC)' };
            default:
                return null;
        }
    },

    /**
     * Handle file selection with type validation
     */
    handleFileSelect(event) {
        const files = Array.from(event.target.files || []);
        if (!this.formData.files) this.formData.files = [];

        const allowed = this.getAllowedTypes();
        if (!allowed) {
            App.showToast('Please select an evidence type first', 'error');
            return;
        }

        files.forEach(file => {
            // Validate file type
            const isValidType = allowed.types.some(type => file.type.startsWith(type) || file.type === type);
            if (!isValidType) {
                App.showToast(`${file.name} is not a valid file type. Please upload ${allowed.label}`, 'error');
                return;
            }

            // Validate file size (10MB max)
            if (file.size > 10 * 1024 * 1024) {
                App.showToast(`${file.name} is too large (max 10MB)`, 'error');
                return;
            }

            // Show progress indicator
            this.showUploadProgress(file.name, 0);

            const reader = new FileReader();

            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    this.showUploadProgress(file.name, percent);
                }
            };

            reader.onload = (e) => {
                this.formData.files.push({
                    file,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    preview: e.target.result
                });
                this.hideUploadProgress();
                this.updateFilePreview();
                App.showToast(`✅ ${file.name} uploaded!`, 'success');
            };

            reader.onerror = () => {
                this.hideUploadProgress();
                App.showToast(`Failed to read ${file.name}`, 'error');
            };

            reader.readAsDataURL(file);
        });
    },

    /**
     * Show upload progress
     */
    showUploadProgress(fileName, percent) {
        let progressEl = document.getElementById('uploadProgress');
        if (!progressEl) {
            progressEl = document.createElement('div');
            progressEl.id = 'uploadProgress';
            progressEl.className = 'upload-progress';
            const uploadZone = document.getElementById('fileUploadZone');
            if (uploadZone) uploadZone.appendChild(progressEl);
        }
        progressEl.innerHTML = `
            <div class="progress-info">
                <span class="progress-name">📤 ${fileName}</span>
                <span class="progress-percent">${percent}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${percent}%"></div>
            </div>
        `;
        progressEl.style.display = 'block';
    },

    /**
     * Hide upload progress
     */
    hideUploadProgress() {
        const progressEl = document.getElementById('uploadProgress');
        if (progressEl) progressEl.style.display = 'none';
    },

    /**
     * Remove uploaded file
     */
    removeFile(index) {
        if (this.formData.files) {
            this.formData.files.splice(index, 1);
            this.updateFilePreview();
        }
    },

    /**
     * Update file preview
     */
    updateFilePreview() {
        const preview = document.getElementById('filePreview');
        if (!preview) return;

        preview.innerHTML = (this.formData.files || []).map((f, i) => `
            <div class="file-preview-item">
                ${f.type.startsWith('image/')
                ? `<img src="${f.preview}" alt="${f.name}">`
                : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:1.5rem;">📄</div>`
            }
                <button class="file-preview-remove" onclick="SubmitRumor.removeFile(${i})">×</button>
            </div>
        `).join('');
    },


    /**
     * Step 3: Confirm
     */
    renderStep3() {
        const stake = this.formData.stakeAmount;
        const user = Store.getUser();
        const prediction = TrustEngine.predictTrustScore(
            this.formData.category,
            this.formData.evidenceType,
            this.formData.confidence
        );

        return `
            <div class="submit-step active" id="submitStep3">
                <h2>Review & Submit</h2>
                
                <div class="review-card">
                    <div class="review-section">
                        <h4>Your Claim</h4>
                        <p>${this.formData.content || 'No content entered'}</p>
                    </div>
                    <div class="review-section">
                        <h4>Evidence</h4>
                        <p>${this.formData.evidenceDescription || 'No additional evidence'}</p>
                    </div>
                    <div class="review-section">
                        <h4>Predicted Trust Score</h4>
                        <div class="predicted-score">
                            <span class="score-range">~${prediction.min}-${prediction.max}</span>
                            <span class="score-label">/100</span>
                        </div>
                    </div>
                </div>
                
                <div class="stake-summary">
                    <h4>Token Stake Summary</h4>
                    <div class="stake-breakdown">
                        <div class="stake-row">
                            <span>You're staking:</span>
                            <span class="stake-amount">${stake} tokens</span>
                        </div>
                        <div class="stake-row positive">
                            <span>If verified TRUE:</span>
                            <span>+${Math.round(stake * 0.5)} tokens</span>
                        </div>
                        <div class="stake-row negative">
                            <span>If verified FALSE:</span>
                            <span>-${stake} tokens</span>
                        </div>
                        <div class="stake-row neutral">
                            <span>If disputed:</span>
                            <span>+${Math.round(stake * 0.25)} tokens</span>
                        </div>
                    </div>
                    <div class="balance-preview">
                        <span>Your balance:</span>
                        <span>${user.tokenBalance} → ${user.tokenBalance - stake} (staked)</span>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="SubmitRumor.prevStep()">← Back</button>
                    <button class="btn btn-success" onclick="SubmitRumor.submit()">✓ Confirm & Submit</button>
                </div>
            </div>
        `;
    },

    /**
     * Bind form events
     */
    bindEvents() {
        // Will be called after each render
        setTimeout(() => {
            const contentInput = document.getElementById('rumorContent');
            if (contentInput) {
                contentInput.addEventListener('input', (e) => {
                    this.formData.content = e.target.value;
                });
            }

            const evidenceInput = document.getElementById('evidenceDescription');
            if (evidenceInput) {
                evidenceInput.addEventListener('input', (e) => {
                    this.formData.evidenceDescription = e.target.value;
                });
            }

            document.querySelectorAll('input[name="confidence"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.formData.confidence = e.target.value;
                    this.formData.stakeAmount = e.target.value === 'high' ? 20 :
                        e.target.value === 'medium' ? 10 : 5;
                });
            });
        }, 100);
    },

    /**
     * Select category
     */
    selectCategory(category) {
        this.formData.category = category;
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
    },

    /**
     * Select evidence type
     */
    selectEvidence(type) {
        this.formData.evidenceType = type;
        // Clear any existing files when changing type
        this.formData.files = [];

        document.querySelectorAll('.evidence-type').forEach(el => {
            el.classList.toggle('active', el.dataset.type === type);
        });

        // Toggle file upload visibility and update accept attribute
        const fileUploadGroup = document.getElementById('fileUploadGroup');
        const fileInput = document.getElementById('evidenceFiles');

        if (fileUploadGroup) {
            fileUploadGroup.style.display = type !== 'testimony' ? 'block' : 'none';
        }

        if (fileInput) {
            const allowed = this.getAllowedTypes();
            if (allowed) {
                fileInput.accept = allowed.accept;
            }
        }

        // Clear file preview
        this.updateFilePreview();
    },

    /**
     * Navigate to next step
     */
    nextStep() {
        // Validate current step
        if (this.currentStep === 1) {
            if (!this.formData.content.trim()) {
                App.showToast('Please enter rumor content', 'error');
                return;
            }
            if (this.formData.content.trim().length < 10) {
                App.showToast('Content must be at least 10 characters', 'error');
                return;
            }
            if (!this.formData.category) {
                App.showToast('Please select a category', 'error');
                return;
            }
        }

        if (this.currentStep < 3) {
            this.currentStep++;
            this.renderPage();
            this.bindEvents();
        }
    },

    /**
     * Navigate to previous step
     */
    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.renderPage();
            this.bindEvents();
        }
    },

    /**
     * Submit the rumor
     */
    async submit() {
        try {
            // Check token balance first
            const user = Store.getUser();
            if (user && user.tokenBalance < this.formData.stakeAmount) {
                App.showToast(`❌ Not enough credits! You need ${this.formData.stakeAmount} 💎 but only have ${user.tokenBalance}`, 'error');
                return;
            }

            // 🤖 BOT DETECTION - Check for spam bot behavior before allowing submission
            const botAnalysis = AnomalyDetector.analyzeUserBehavior(user?.id);

            // Track this submission for bot detection
            if (!user.actionTimestamps) user.actionTimestamps = [];
            user.actionTimestamps.push({
                time: Date.now(),
                type: 'submit_rumor'
            });
            if (user.actionTimestamps.length > 100) {
                user.actionTimestamps = user.actionTimestamps.slice(-100);
            }
            Store.setUser(user);

            // Handle bot detection - block spam bots
            if (botAnalysis.isBot || botAnalysis.botScore >= 0.7) {
                App.showToast('🚫 Spam detection: Your submission has been blocked.', 'error');
                console.warn('🤖 SPAM BOT BLOCKED:', botAnalysis);
                return;
            } else if (botAnalysis.botScore >= 0.5) {
                App.showToast('⚠️ Unusual activity detected. Your account is under review.', 'warning');
            }

            // Prepare evidence files as base64 array
            const evidenceFiles = (this.formData.files || []).map(f => ({
                name: f.name,
                type: f.type,
                data: f.preview // Already base64 from FileReader
            }));

            // Show loading indicator for large uploads
            if (evidenceFiles.length > 0) {
                App.showToast('⏳ Uploading evidence... please wait', 'info');
            }

            // Create abort controller with 60 second timeout for large files
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            // First, try to POST to the API (for database storage)
            const response = await fetch('/api/rumors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: this.formData.content,
                    category: this.formData.category,
                    stakeAmount: this.formData.stakeAmount,
                    userId: Store.getUser()?.id || 'anonymous',
                    evidenceType: this.formData.evidenceType,
                    evidenceDescription: this.formData.evidenceDescription,
                    evidenceFiles: evidenceFiles
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const rumor = await response.json();
                console.log('📝 Rumor saved to database:', rumor.id);

                // Also update local store for immediate display
                Store.addRumor(rumor);

                // Only deduct tokens on successful submission
                const currentUser = Store.getUser();
                if (currentUser) {
                    currentUser.tokenBalance -= this.formData.stakeAmount;
                    currentUser.stakedTokens += this.formData.stakeAmount;
                    currentUser.totalSubmissions++;
                    Store.setUser(currentUser);
                }

                App.showToast('✅ Rumor submitted successfully!', 'success');
                App.updateTokenDisplay();

                // Reset form
                this.formData = {
                    content: '',
                    category: null,
                    confidence: 'medium',
                    stakeAmount: 10,
                    evidenceType: 'testimony',
                    evidenceDescription: '',
                    files: []
                };
                this.currentStep = 1;

                // Navigate to feed
                App.navigateTo('feed');
            } else {
                // API failed - show error, don't deduct tokens
                const errorData = await response.text();
                console.error('API Error:', response.status, errorData);
                App.showToast('❌ Failed to submit rumor. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Submit error:', error.name, error.message);

            if (error.name === 'AbortError') {
                App.showToast('⏱️ Upload timed out. Try a smaller video file.', 'error');
            } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                // This could be CORS, network, or server down
                App.showToast('❌ Server unavailable. Please try again.', 'error');
            } else {
                App.showToast(`❌ Error: ${error.message}`, 'error');
            }
        }
    },

    // Helper methods
    getEvidenceIcon(type) {
        const icons = { photo: '📸', documentary: '📧', video: '🎥', testimony: '👁️' };
        return icons[type] || '📌';
    },

    getEvidenceLabel(type) {
        const labels = { photo: 'Photo', documentary: 'Email/Doc', video: 'Video', testimony: 'Testimony' };
        return labels[type] || type;
    },

    getEvidenceBoost(type) {
        const boosts = { photo: 15, documentary: 25, video: 20, testimony: 8 };
        return boosts[type] || 5;
    }
};
