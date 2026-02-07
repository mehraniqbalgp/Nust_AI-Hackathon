/**
 * Device/Browser Fingerprinting Service
 * Collects and analyzes client fingerprints for bot detection
 */

import crypto from 'crypto';

// Fingerprint storage (in production, use Redis with TTL)
const fingerprints = new Map();      // fingerprintId -> data
const userFingerprints = new Map();  // userId -> Set of fingerprintIds
const ipFingerprints = new Map();    // IP -> Set of fingerprintIds

// Suspicious patterns
const SUSPICIOUS_PATTERNS = {
    headless: ['HeadlessChrome', 'PhantomJS', 'Nightmare', 'Puppeteer'],
    automation: ['Selenium', 'WebDriver', 'webdriver'],
    noPlugins: true,
    noWebGL: true,
    noCanvas: true,
    suspiciousUA: [
        /bot/i, /crawler/i, /spider/i, /scraper/i,
        /python/i, /curl/i, /wget/i, /java\//i
    ]
};

class FingerprintService {

    /**
     * Generate fingerprint hash from client data
     * @param {object} data - Client fingerprint components
     * @returns {string} - Fingerprint ID
     */
    generateFingerprint(data) {
        const components = [
            data.userAgent || '',
            data.language || '',
            data.platform || '',
            data.screenResolution || '',
            data.timezone || '',
            data.colorDepth || '',
            data.hardwareConcurrency || '',
            data.deviceMemory || '',
            data.webglVendor || '',
            data.webglRenderer || '',
            data.canvasHash || '',
            data.audioHash || '',
            data.fonts?.join(',') || '',
            data.plugins?.join(',') || ''
        ];

        const hash = crypto
            .createHash('sha256')
            .update(components.join('|'))
            .digest('hex')
            .substring(0, 32);

        return hash;
    }

    /**
     * Record and analyze a fingerprint
     * @param {string} userId - User ID (optional)
     * @param {string} ip - Client IP
     * @param {object} data - Fingerprint components
     * @returns {object} - { fingerprintId, suspiciousScore, flags }
     */
    recordFingerprint(userId, ip, data) {
        const fingerprintId = this.generateFingerprint(data);
        const flags = [];
        let suspiciousScore = 0;

        // === Analyze fingerprint ===

        // 1. Check for headless browser indicators
        for (const pattern of SUSPICIOUS_PATTERNS.headless) {
            if (data.userAgent?.includes(pattern)) {
                flags.push(`HEADLESS:${pattern}`);
                suspiciousScore += 0.4;
            }
        }

        // 2. Check for automation tools
        for (const pattern of SUSPICIOUS_PATTERNS.automation) {
            if (data.userAgent?.includes(pattern) || data.webdriver) {
                flags.push('AUTOMATION_DETECTED');
                suspiciousScore += 0.5;
            }
        }

        // 3. Check for suspicious user agents
        for (const regex of SUSPICIOUS_PATTERNS.suspiciousUA) {
            if (regex.test(data.userAgent)) {
                flags.push('SUSPICIOUS_UA');
                suspiciousScore += 0.3;
            }
        }

        // 4. Check for missing browser features
        if (!data.plugins || data.plugins.length === 0) {
            flags.push('NO_PLUGINS');
            suspiciousScore += 0.1;
        }

        if (!data.webglVendor || !data.webglRenderer) {
            flags.push('NO_WEBGL');
            suspiciousScore += 0.15;
        }

        if (!data.canvasHash) {
            flags.push('NO_CANVAS');
            suspiciousScore += 0.15;
        }

        // 5. Check for inconsistencies
        if (data.platform && data.userAgent) {
            const platformInUA = data.userAgent.toLowerCase().includes(data.platform.toLowerCase());
            if (!platformInUA && !data.userAgent.includes('Mobile')) {
                flags.push('PLATFORM_MISMATCH');
                suspiciousScore += 0.2;
            }
        }

        // 6. Check screen resolution
        if (data.screenResolution) {
            const [width, height] = data.screenResolution.split('x').map(Number);
            if (width < 100 || height < 100 || width > 10000 || height > 10000) {
                flags.push('INVALID_RESOLUTION');
                suspiciousScore += 0.2;
            }
        }

        // 7. Check for known bot timing patterns
        if (data.loadTime && data.loadTime < 50) {
            flags.push('INSTANT_LOAD');
            suspiciousScore += 0.25;
        }

        // Store fingerprint
        fingerprints.set(fingerprintId, {
            data,
            flags,
            suspiciousScore,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            hitCount: (fingerprints.get(fingerprintId)?.hitCount || 0) + 1
        });

        // Track fingerprint-user relationship
        if (userId) {
            if (!userFingerprints.has(userId)) {
                userFingerprints.set(userId, new Set());
            }
            userFingerprints.get(userId).add(fingerprintId);

            // Multiple fingerprints per user is suspicious
            if (userFingerprints.get(userId).size > 3) {
                flags.push('MULTIPLE_FINGERPRINTS');
                suspiciousScore += 0.3;
            }
        }

        // Track fingerprint-IP relationship
        if (!ipFingerprints.has(ip)) {
            ipFingerprints.set(ip, new Set());
        }
        ipFingerprints.get(ip).add(fingerprintId);

        // Multiple fingerprints from same IP is suspicious
        if (ipFingerprints.get(ip).size > 5) {
            flags.push('SHARED_IP_MULTIPLE_FINGERPRINTS');
            suspiciousScore += 0.2;
        }

        return {
            fingerprintId,
            suspiciousScore: Math.min(suspiciousScore, 1),
            flags,
            isNew: fingerprints.get(fingerprintId)?.hitCount === 1
        };
    }

    /**
     * Check if a fingerprint is known and trusted
     */
    isTrusted(fingerprintId) {
        const fp = fingerprints.get(fingerprintId);
        if (!fp) return false;

        return fp.suspiciousScore < 0.3 && fp.hitCount > 5;
    }

    /**
     * Get all fingerprints for a user
     */
    getUserFingerprints(userId) {
        const fpIds = userFingerprints.get(userId);
        if (!fpIds) return [];

        return Array.from(fpIds).map(id => ({
            fingerprintId: id,
            ...fingerprints.get(id)
        }));
    }

    /**
     * Check if IP has suspicious fingerprint patterns
     */
    analyzeIP(ip) {
        const fpIds = ipFingerprints.get(ip);
        if (!fpIds || fpIds.size === 0) {
            return { suspicious: false, count: 0 };
        }

        const fps = Array.from(fpIds)
            .map(id => fingerprints.get(id))
            .filter(Boolean);

        const avgScore = fps.reduce((sum, fp) => sum + fp.suspiciousScore, 0) / fps.length;
        const allFlags = fps.flatMap(fp => fp.flags);

        return {
            suspicious: avgScore > 0.4 || fpIds.size > 5,
            count: fpIds.size,
            avgScore,
            flags: [...new Set(allFlags)]
        };
    }

    /**
     * Generate client-side fingerprint collection script
     */
    getClientScript() {
        return `
        (function() {
            const fp = {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                screenResolution: screen.width + 'x' + screen.height,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                colorDepth: screen.colorDepth,
                hardwareConcurrency: navigator.hardwareConcurrency,
                deviceMemory: navigator.deviceMemory,
                webdriver: navigator.webdriver,
                plugins: Array.from(navigator.plugins || []).map(p => p.name),
                loadTime: performance.now()
            };
            
            // Canvas fingerprint
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillText('CampusVerify', 0, 0);
                fp.canvasHash = canvas.toDataURL().slice(-50);
            } catch(e) {}
            
            // WebGL fingerprint
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl');
                if (gl) {
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (debugInfo) {
                        fp.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                        fp.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    }
                }
            } catch(e) {}
            
            return fp;
        })();
        `;
    }
}

export default new FingerprintService();
