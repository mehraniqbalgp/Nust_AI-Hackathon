/**
 * CampusVerify - Main Application
 * Entry point and navigation controller with API integration
 */

const App = {
    currentPage: 'feed',
    isOnline: false,
    credential: null,

    /**
     * Initialize the application
     */
    async init() {
        console.log('🔍 CampusVerify Starting...');

        // Check for saved credential
        this.credential = localStorage.getItem('user_credential');

        // Initialize store (local fallback)
        Store.init();

        // Check if API is available
        if (typeof API !== 'undefined') {
            try {
                const validation = await API.validateToken();
                this.isOnline = validation.valid;
            } catch {
                this.isOnline = false;
            }
        }

        // Show PoW if new user
        if (!this.credential && !Store.getUser()) {
            this.showPowChallenge();
        }

        // Initialize components
        Feed.init();
        SubmitRumor.init();
        Dashboard.init();
        Leaderboard.init();

        // Bind navigation
        this.bindNavigation();

        // Update token display
        this.updateTokenDisplay();

        // Close modals on backdrop click
        this.bindModalClose();

        // Keyboard navigation
        this.bindKeyboard();

        console.log('✅ CampusVerify Ready!', this.isOnline ? '(Online)' : '(Offline)');
    },

    /**
     * Show Proof-of-Work challenge modal
     */
    async showPowChallenge() {
        const modal = document.getElementById('powModal');
        if (!modal) return;

        modal.classList.add('active');

        // Start simulated PoW
        const progressBar = document.getElementById('powProgress');
        const status = document.getElementById('powStatus');

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                this.completePowChallenge(modal);
            }
            progressBar.style.width = `${progress}%`;

            if (progress < 30) {
                status.textContent = 'Mining nonce...';
            } else if (progress < 60) {
                status.textContent = 'Computing hash...';
            } else if (progress < 90) {
                status.textContent = 'Verifying proof...';
            } else {
                status.textContent = 'Complete!';
            }
        }, 200);
    },

    /**
     * Complete PoW challenge
     */
    async completePowChallenge(modal) {
        // Generate credential
        const credential = this.generateCredential();
        this.credential = credential;
        localStorage.setItem('user_credential', credential);

        // Initialize user in local store
        Store.init();

        setTimeout(() => {
            modal.classList.remove('active');
            this.showToast('Welcome to CampusVerify! 🎉', 'success');
            this.updateTokenDisplay();
        }, 500);
    },

    /**
     * Generate anonymous credential
     */
    generateCredential() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Bind navigation events
     */
    bindNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                if (page) {
                    this.navigateTo(page);
                }
            });
        });
    },

    /**
     * Navigate to a page
     */
    navigateTo(page) {
        this.currentPage = page;

        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            const isActive = link.dataset.page === page;
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-current', isActive ? 'page' : 'false');
        });

        // Update pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        const pageElement = document.getElementById(`${page}Page`);
        if (pageElement) {
            pageElement.classList.add('active');
            // Focus for accessibility
            pageElement.focus();
        }

        // Re-render page components
        switch (page) {
            case 'feed':
                Feed.render();
                break;
            case 'submit':
                SubmitRumor.init();
                break;
            case 'dashboard':
                Dashboard.render();
                break;
            case 'leaderboard':
                Leaderboard.render();
                break;
        }
    },

    /**
     * Update token display in navbar
     */
    updateTokenDisplay() {
        const user = Store.getUser();
        const tokenElement = document.getElementById('tokenBalance');
        if (tokenElement && user) {
            // Animate token change
            const current = parseInt(tokenElement.textContent) || 0;
            const target = user.tokenBalance;

            if (current !== target) {
                this.animateValue(tokenElement, current, target, 500);
            }
        }
    },

    /**
     * Animate numeric value change
     */
    animateValue(element, start, end, duration) {
        const startTime = performance.now();
        const diff = end - start;

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + diff * eased);

            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    },

    /**
     * Bind modal close on backdrop click
     */
    bindModalClose() {
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', () => {
                const modal = backdrop.closest('.modal');
                // Don't close PoW modal
                if (modal && modal.id !== 'powModal') {
                    modal.classList.remove('active');
                }
            });
        });

        // ESC key closes modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    if (modal.id !== 'powModal') {
                        modal.classList.remove('active');
                    }
                });
            }
        });
    },

    /**
     * Bind keyboard shortcuts
     */
    bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Alt + number for navigation
            if (e.altKey && !e.ctrlKey && !e.metaKey) {
                switch (e.key) {
                    case '1': this.navigateTo('feed'); break;
                    case '2': this.navigateTo('submit'); break;
                    case '3': this.navigateTo('dashboard'); break;
                    case '4': this.navigateTo('leaderboard'); break;
                }
            }
        });
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'status');
        toast.innerHTML = `
            <span class="toast-icon">${this.getToastIcon(type)}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    /**
     * Get toast icon
     */
    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    },

    /**
     * Format number with K/M suffix
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
};

// Auto-initialize is handled in HTML now
