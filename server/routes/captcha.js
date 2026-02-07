/**
 * Captcha Routes
 * API endpoints for captcha verification
 */

import { Router } from 'express';
import captchaService, { CAPTCHA_TYPES } from '../services/captcha.js';

const router = Router();

/**
 * GET /api/captcha/challenge
 * Get a new captcha challenge
 */
router.get('/challenge', (req, res) => {
    const type = req.query.type || CAPTCHA_TYPES.MATH;

    try {
        const challenge = captchaService.generateChallenge(type);
        res.json({
            success: true,
            challenge
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate captcha'
        });
    }
});

/**
 * POST /api/captcha/verify
 * Verify a captcha answer
 */
router.post('/verify', (req, res) => {
    const { challengeId, answer } = req.body;

    if (!challengeId || answer === undefined) {
        return res.status(400).json({
            success: false,
            message: 'Missing challengeId or answer'
        });
    }

    const result = captchaService.verify(challengeId, answer);

    if (result.success) {
        // Generate a verification token
        const verificationToken = `captcha_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Store token in session/cache (in production)
        res.json({
            success: true,
            message: result.message,
            verificationToken
        });
    } else {
        res.status(400).json(result);
    }
});

/**
 * GET /api/captcha/types
 * Get available captcha types
 */
router.get('/types', (req, res) => {
    res.json({
        success: true,
        types: Object.values(CAPTCHA_TYPES)
    });
});

export default router;
