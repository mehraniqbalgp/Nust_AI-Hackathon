/**
 * Bot Detection Middleware
 * Integrates bot detection into request pipeline
 */

import botDetector, { THRESHOLDS } from '../services/botDetector.js';
import fingerprintService from '../services/fingerprint.js';

/**
 * Bot detection middleware
 * Analyzes requests for bot-like behavior
 */
export const detectBot = (actionType = 'general') => {
    return (req, res, next) => {
        const userId = req.user?.id || req.ip;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || '';

        // Record action and analyze
        const result = botDetector.recordAction(userId, actionType, {
            ip,
            userAgent,
            timestamp: Date.now()
        });

        // Attach bot status to request
        req.botStatus = result;

        // If blocked, deny request
        if (!result.allowed) {
            return res.status(403).json({
                success: false,
                error: 'Account suspended due to suspicious activity',
                code: 'BOT_DETECTED',
                flags: result.flags
            });
        }

        // If captcha required, return challenge requirement
        if (result.requiresCaptcha) {
            res.set('X-Captcha-Required', 'true');
            res.set('X-Bot-Score', result.score.toFixed(2));
        }

        next();
    };
};

/**
 * Fingerprint collection middleware
 * Analyzes device fingerprint from request headers
 */
export const collectFingerprint = (req, res, next) => {
    const userId = req.user?.id;
    const ip = req.ip || req.connection.remoteAddress;

    // Collect what we can from headers
    const fingerprintData = {
        userAgent: req.get('User-Agent'),
        language: req.get('Accept-Language'),
        encoding: req.get('Accept-Encoding'),
        // Client sends full fingerprint in this header (set by frontend)
        ...(req.get('X-Fingerprint') ? JSON.parse(req.get('X-Fingerprint')) : {})
    };

    const result = fingerprintService.recordFingerprint(userId, ip, fingerprintData);

    req.fingerprint = result;

    // If highly suspicious fingerprint, require additional verification
    if (result.suspiciousScore > 0.7) {
        res.set('X-Verification-Required', 'true');
        res.set('X-Suspicion-Score', result.suspiciousScore.toFixed(2));
    }

    next();
};

/**
 * Rate limit by bot score
 * Stricter limits for suspicious users
 */
export const adaptiveRateLimit = (baseLimit = 100) => {
    return (req, res, next) => {
        const botScore = req.botStatus?.score || 0;

        // Calculate adjusted limit based on bot score
        // Lower score = higher limit, higher score = stricter limit
        const adjustedLimit = Math.floor(baseLimit * (1 - botScore * 0.8));

        // Store for rate limiter
        req.adjustedRateLimit = Math.max(adjustedLimit, 5);

        next();
    };
};

/**
 * Require captcha for suspicious requests
 */
export const requireCaptchaIfSuspicious = (req, res, next) => {
    if (req.botStatus?.requiresCaptcha) {
        const captchaToken = req.get('X-Captcha-Token') || req.body.captchaToken;

        if (!captchaToken) {
            return res.status(428).json({
                success: false,
                error: 'Captcha verification required',
                code: 'CAPTCHA_REQUIRED',
                botScore: req.botStatus.score
            });
        }

        // Verify captcha token (in production, validate against stored tokens)
        if (!captchaToken.startsWith('captcha_')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid captcha token',
                code: 'INVALID_CAPTCHA'
            });
        }
    }

    next();
};

/**
 * Log suspicious activity for admin review
 */
export const logSuspiciousActivity = (req, res, next) => {
    if (req.botStatus?.isSuspicious || req.fingerprint?.suspiciousScore > 0.5) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            userId: req.user?.id,
            ip: req.ip,
            path: req.path,
            method: req.method,
            botScore: req.botStatus?.score,
            botFlags: req.botStatus?.flags,
            fingerprintScore: req.fingerprint?.suspiciousScore,
            fingerprintFlags: req.fingerprint?.flags,
            userAgent: req.get('User-Agent')
        };

        // In production, write to log file or monitoring service
        console.log('[SUSPICIOUS]', JSON.stringify(logEntry));
    }

    next();
};

export default {
    detectBot,
    collectFingerprint,
    adaptiveRateLimit,
    requireCaptchaIfSuspicious,
    logSuspiciousActivity
};
