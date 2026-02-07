/**
 * Users Routes
 * User profile and leaderboard
 */

import { Router } from 'express';
import { query } from '../services/database.js';
import { cache } from '../services/redis.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

/**
 * Get current user profile
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        const result = await query(`
            SELECT id, username, token_balance, staked_tokens, 
                   total_submissions, verified_accurate, verified_false,
                   reputation_score, achievements, status, created_at, last_active
            FROM users WHERE id = $1
        `, [req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Calculate accuracy
        const totalVerifications = user.verified_accurate + user.verified_false;
        const accuracy = totalVerifications > 0
            ? Math.round((user.verified_accurate / totalVerifications) * 100)
            : 0;

        res.json({
            user: {
                id: user.id,
                username: user.username,
                tokenBalance: user.token_balance,
                stakedTokens: user.staked_tokens,
                totalSubmissions: user.total_submissions,
                verifiedAccurate: user.verified_accurate,
                verifiedFalse: user.verified_false,
                reputationScore: parseFloat(user.reputation_score),
                accuracy,
                achievements: user.achievements || [],
                createdAt: user.created_at,
                lastActive: user.last_active
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

/**
 * Get user activity history
 */
router.get('/me/activities', authenticate, async (req, res) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        const result = await query(`
            SELECT * FROM activities
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        `, [req.user.userId, parseInt(limit), parseInt(offset)]);

        res.json({ activities: result.rows });
    } catch (error) {
        console.error('Get activities error:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

/**
 * Get leaderboard
 */
router.get('/leaderboard', async (req, res) => {
    try {
        const { period = 'week', limit = 10 } = req.query;

        // Calculate period start
        let periodStart;
        switch (period) {
            case 'day':
                periodStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case 'month':
                periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'week':
            default:
                periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }

        const cacheKey = `leaderboard:${period}:${limit}`;

        const leaders = await cache(cacheKey, 60, async () => {
            const result = await query(`
                SELECT 
                    u.id,
                    u.username,
                    u.reputation_score,
                    COUNT(v.id) as verifications,
                    SUM(CASE WHEN v.was_correct = true THEN 1 ELSE 0 END) as correct_verifications,
                    COALESCE(SUM(CASE WHEN a.token_change > 0 THEN a.token_change ELSE 0 END), 0) as tokens_earned
                FROM users u
                LEFT JOIN verifications v ON v.verifier_id = u.id AND v.created_at >= $1
                LEFT JOIN activities a ON a.user_id = u.id AND a.created_at >= $1
                WHERE u.status = 'active'
                GROUP BY u.id, u.username, u.reputation_score
                HAVING COUNT(v.id) > 0
                ORDER BY tokens_earned DESC, verifications DESC
                LIMIT $2
            `, [periodStart, parseInt(limit)]);

            return result.rows.map((row, index) => ({
                rank: index + 1,
                username: row.username,
                accuracy: row.verifications > 0
                    ? Math.round((row.correct_verifications / row.verifications) * 100)
                    : 0,
                verifications: parseInt(row.verifications),
                tokensEarned: parseInt(row.tokens_earned),
                reputationScore: parseFloat(row.reputation_score)
            }));
        });

        res.json({ leaders, period });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

/**
 * Get user behavioral analysis (for bot detection)
 */
router.get('/me/behavior', authenticate, async (req, res) => {
    try {
        const result = await query(`
            SELECT action_timestamps, bot_score
            FROM users WHERE id = $1
        `, [req.user.userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { action_timestamps, bot_score } = result.rows[0];
        const timestamps = action_timestamps || [];

        // Analyze patterns
        let analysis = {
            totalActions: timestamps.length,
            botScore: parseFloat(bot_score),
            patterns: {
                regularIntervals: false,
                suspiciousActivity: false
            }
        };

        if (timestamps.length >= 5) {
            const times = timestamps.map(t => t.time).sort((a, b) => a - b);
            const intervals = [];
            for (let i = 1; i < times.length; i++) {
                intervals.push(times[i] - times[i - 1]);
            }

            if (intervals.length > 3) {
                const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avg, 2), 0) / intervals.length;
                const stdDev = Math.sqrt(variance);
                const cv = avg > 0 ? stdDev / avg : 1;

                analysis.patterns.regularIntervals = cv < 0.1;
                analysis.patterns.suspiciousActivity = cv < 0.1 && avg > 1000;
            }
        }

        res.json({ analysis });
    } catch (error) {
        console.error('Get behavior error:', error);
        res.status(500).json({ error: 'Failed to fetch behavior analysis' });
    }
});

export default router;
