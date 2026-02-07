/**
 * Authentication Routes
 * ZK-based anonymous authentication with PoW challenge
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, transaction } from '../services/database.js';
import { setCache, getCache, deleteCache } from '../services/redis.js';

const router = Router();

/**
 * Generate anonymous username
 */
function generateUsername() {
    const adjectives = ['Anonymous', 'Hidden', 'Secret', 'Unknown', 'Mystery', 'Shadow', 'Silent', 'Phantom'];
    const nouns = ['Eagle', 'Hawk', 'Falcon', 'Phoenix', 'Raven', 'Owl', 'Wolf', 'Bear', 'Tiger', 'Lion'];
    const suffix = Math.floor(Math.random() * 1000);
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}_${nouns[Math.floor(Math.random() * nouns.length)]}${suffix}`;
}

/**
 * Generate Proof-of-Work challenge
 */
router.post('/pow-challenge', async (req, res) => {
    try {
        const challenge = crypto.randomBytes(32).toString('hex');
        const difficulty = parseInt(process.env.POW_DIFFICULTY) || 4;

        // Store challenge in Redis (expires in 5 minutes)
        await setCache(`pow:${challenge}`, { difficulty, createdAt: Date.now() }, 300);

        res.json({
            challenge,
            difficulty,
            hint: `Find a nonce where SHA256(challenge + nonce) starts with ${difficulty} zeros`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate challenge' });
    }
});

/**
 * Verify PoW and create account
 */
router.post('/register', async (req, res) => {
    try {
        const { challenge, nonce, credentialHash } = req.body;

        // Verify PoW
        const powData = await getCache(`pow:${challenge}`);
        if (!powData) {
            return res.status(400).json({ error: 'Invalid or expired challenge' });
        }

        // Check hash meets difficulty
        const hash = crypto.createHash('sha256').update(challenge + nonce).digest('hex');
        const requiredPrefix = '0'.repeat(powData.difficulty);

        if (!hash.startsWith(requiredPrefix)) {
            return res.status(400).json({ error: 'Invalid proof-of-work solution' });
        }

        // Delete used challenge
        await deleteCache(`pow:${challenge}`);

        // Generate credential if not provided
        const credential = credentialHash || crypto.randomBytes(32).toString('hex');

        // Create user
        const username = generateUsername();

        const result = await query(
            `INSERT INTO users (username, credential_hash, pow_completed)
             VALUES ($1, $2, true)
             RETURNING id, username, token_balance, reputation_score, created_at`,
            [username, credential]
        );

        const user = result.rows[0];

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET || 'dev-secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            user: {
                id: user.id,
                username: user.username,
                tokenBalance: user.token_balance,
                reputationScore: parseFloat(user.reputation_score)
            },
            token,
            message: 'Account created successfully'
        });
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Credential already registered' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

/**
 * Anonymous login with credential
 */
router.post('/login', async (req, res) => {
    try {
        const { credentialHash } = req.body;

        if (!credentialHash) {
            return res.status(400).json({ error: 'Credential hash required' });
        }

        const result = await query(
            `SELECT id, username, token_balance, staked_tokens, reputation_score, 
                    total_submissions, verified_accurate, verified_false, achievements, status
             FROM users WHERE credential_hash = $1`,
            [credentialHash]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credential' });
        }

        const user = result.rows[0];

        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account suspended' });
        }

        // Update last active
        await query('UPDATE users SET last_active = NOW() WHERE id = $1', [user.id]);

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username },
            process.env.JWT_SECRET || 'dev-secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            user: {
                id: user.id,
                username: user.username,
                tokenBalance: user.token_balance,
                stakedTokens: user.staked_tokens,
                reputationScore: parseFloat(user.reputation_score),
                totalSubmissions: user.total_submissions,
                verifiedAccurate: user.verified_accurate,
                verifiedFalse: user.verified_false,
                achievements: user.achievements || []
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * Validate JWT token
 */
router.get('/validate', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ valid: false });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

        // Get fresh user data
        const result = await query(
            `SELECT id, username, token_balance, staked_tokens, reputation_score
             FROM users WHERE id = $1 AND status = 'active'`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ valid: false });
        }

        const user = result.rows[0];

        res.json({
            valid: true,
            user: {
                id: user.id,
                username: user.username,
                tokenBalance: user.token_balance,
                stakedTokens: user.staked_tokens,
                reputationScore: parseFloat(user.reputation_score)
            }
        });
    } catch (error) {
        res.status(401).json({ valid: false });
    }
});

/**
 * Refresh token
 */
router.post('/refresh', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const oldToken = authHeader.split(' ')[1];
        const decoded = jwt.verify(oldToken, process.env.JWT_SECRET || 'dev-secret', {
            ignoreExpiration: true
        });

        // Check user still exists and active
        const result = await query(
            'SELECT id, username FROM users WHERE id = $1 AND status = $2',
            [decoded.userId, 'active']
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Generate new token
        const newToken = jwt.sign(
            { userId: decoded.userId, username: decoded.username },
            process.env.JWT_SECRET || 'dev-secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({ token: newToken });
    } catch (error) {
        res.status(401).json({ error: 'Token refresh failed' });
    }
});

export default router;
