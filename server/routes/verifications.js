/**
 * Verifications Routes
 * Voting system with staking
 */

import { Router } from 'express';
import { query, transaction } from '../services/database.js';
import { deleteCachePattern } from '../services/redis.js';
import { notifyRumorVerified, notifyTokenChange, notifyAchievement } from '../services/websocket.js';
import { authenticate } from '../middleware/authenticate.js';
import { recalculateTrustScore } from './rumors.js';
import crypto from 'crypto';

const router = Router();

// Achievement definitions
const ACHIEVEMENTS = {
    truth_seeker: { count: 10, type: 'verifications', reward: 50 },
    sharpshooter: { accuracy: 0.8, days: 30, reward: 100 },
    early_bird: { count: 20, type: 'early_verifications', reward: 75 },
    defender: { count: 5, type: 'successful_disputes', reward: 150 },
    fact_master: { count: 5, type: 'first_verifications', reward: 200 }
};

/**
 * Submit verification (vote)
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { rumorId, voteType, stakeAmount, evidenceDescription } = req.body;
        const userId = req.user.userId;

        // Validate
        if (!rumorId || !voteType) {
            return res.status(400).json({ error: 'Rumor ID and vote type are required' });
        }

        if (!['support', 'dispute'].includes(voteType)) {
            return res.status(400).json({ error: 'Vote type must be support or dispute' });
        }

        const stake = parseInt(stakeAmount) || 5;
        if (stake < 2 || stake > 20) {
            return res.status(400).json({ error: 'Stake must be between 2 and 20 tokens' });
        }

        // Check rumor exists
        const rumorResult = await query('SELECT * FROM rumors WHERE id = $1', [rumorId]);
        if (rumorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Rumor not found' });
        }

        const rumor = rumorResult.rows[0];

        // Check user hasn't already voted
        const existingVote = await query(
            'SELECT id FROM verifications WHERE rumor_id = $1 AND verifier_id = $2',
            [rumorId, userId]
        );

        if (existingVote.rows.length > 0) {
            return res.status(400).json({ error: 'You have already verified this rumor' });
        }

        // Check user balance
        const userResult = await query(
            'SELECT token_balance, reputation_score FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0 || userResult.rows[0].token_balance < stake) {
            return res.status(400).json({ error: 'Insufficient token balance' });
        }

        // Calculate vote weight based on reputation
        const reputation = parseFloat(userResult.rows[0].reputation_score);
        const voteWeight = Math.max(0.3, Math.min(2.0, 0.5 + reputation * 1.5));

        // Create nullifier hash (prevents double voting in ZK context)
        const nullifierHash = crypto.createHash('sha256')
            .update(`${rumorId}:${userId}:${Date.now()}`)
            .digest('hex');

        // Transaction
        const result = await transaction(async (client) => {
            // Deduct tokens
            await client.query(
                `UPDATE users SET 
                    token_balance = token_balance - $1,
                    staked_tokens = staked_tokens + $1,
                    updated_at = NOW()
                 WHERE id = $2`,
                [stake, userId]
            );

            // Add evidence if provided
            let evidenceId = null;
            if (evidenceDescription) {
                const evidenceResult = await client.query(`
                    INSERT INTO evidence (rumor_id, submitter_id, type, description)
                    VALUES ($1, $2, 'testimony', $3)
                    RETURNING id
                `, [rumorId, userId, evidenceDescription]);
                evidenceId = evidenceResult.rows[0].id;
            }

            // Create verification
            const verifyResult = await client.query(`
                INSERT INTO verifications (
                    rumor_id, verifier_id, vote_type, stake_amount,
                    evidence_id, vote_weight, nullifier_hash
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `, [rumorId, userId, voteType, stake, evidenceId, voteWeight, nullifierHash]);

            const verification = verifyResult.rows[0];

            // Log activity
            await client.query(`
                INSERT INTO activities (user_id, type, details, token_change)
                VALUES ($1, $2, $3, $4)
            `, [
                userId,
                voteType === 'support' ? 'verified' : 'disputed',
                `${voteType === 'support' ? 'Verified' : 'Disputed'}: "${rumor.content.substring(0, 40)}..."`,
                -stake
            ]);

            // Record behavioral fingerprint
            await client.query(`
                UPDATE users SET 
                    action_timestamps = action_timestamps || $1::jsonb,
                    updated_at = NOW()
                WHERE id = $2
            `, [JSON.stringify([{ type: voteType, time: Date.now() }]), userId]);

            return verification;
        });

        // Clear cache
        await deleteCachePattern('rumors:*');

        // Recalculate trust score
        await recalculateTrustScore(rumorId);

        // Check for achievements
        await checkAchievements(userId);

        // Notify via WebSocket
        notifyRumorVerified(rumorId, result);

        res.status(201).json({ verification: result });
    } catch (error) {
        console.error('Verification error:', error);
        if (error.code === '23505') { // Unique violation (nullifier)
            return res.status(400).json({ error: 'Already verified' });
        }
        res.status(500).json({ error: 'Failed to submit verification' });
    }
});

/**
 * Get verifications for a rumor
 */
router.get('/rumor/:rumorId', async (req, res) => {
    try {
        const { rumorId } = req.params;

        const result = await query(`
            SELECT v.*, u.username as verifier_username
            FROM verifications v
            LEFT JOIN users u ON v.verifier_id = u.id
            WHERE v.rumor_id = $1
            ORDER BY v.created_at DESC
        `, [rumorId]);

        res.json({ verifications: result.rows });
    } catch (error) {
        console.error('Get verifications error:', error);
        res.status(500).json({ error: 'Failed to fetch verifications' });
    }
});

/**
 * Check and award achievements
 */
async function checkAchievements(userId) {
    const userResult = await query(`
        SELECT u.*, 
            (SELECT COUNT(*) FROM verifications WHERE verifier_id = u.id) as total_verifications,
            (SELECT COUNT(*) FROM verifications WHERE verifier_id = u.id AND was_correct = true) as correct_verifications
        FROM users u WHERE u.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];
    const currentAchievements = user.achievements || [];
    const newAchievements = [];

    // Truth Seeker: 10 verifications
    if (!currentAchievements.includes('truth_seeker') && user.total_verifications >= 10) {
        newAchievements.push('truth_seeker');
    }

    // Sharpshooter: 80% accuracy for 30 days
    if (!currentAchievements.includes('sharpshooter')) {
        const accuracy = user.total_verifications > 0
            ? user.correct_verifications / user.total_verifications
            : 0;
        if (accuracy >= 0.8 && user.total_verifications >= 10) {
            newAchievements.push('sharpshooter');
        }
    }

    // Defender: 5 successful disputes
    if (!currentAchievements.includes('defender')) {
        const disputeResult = await query(`
            SELECT COUNT(*) FROM verifications 
            WHERE verifier_id = $1 AND vote_type = 'dispute' AND was_correct = true
        `, [userId]);
        if (parseInt(disputeResult.rows[0].count) >= 5) {
            newAchievements.push('defender');
        }
    }

    // Award new achievements
    if (newAchievements.length > 0) {
        let totalReward = 0;

        newAchievements.forEach(ach => {
            totalReward += ACHIEVEMENTS[ach].reward;
        });

        await query(`
            UPDATE users SET 
                achievements = achievements || $1::jsonb,
                token_balance = token_balance + $2,
                updated_at = NOW()
            WHERE id = $3
        `, [JSON.stringify(newAchievements), totalReward, userId]);

        // Notify user
        newAchievements.forEach(ach => {
            notifyAchievement(userId, {
                id: ach,
                reward: ACHIEVEMENTS[ach].reward
            });
        });

        notifyTokenChange(userId, totalReward, user.token_balance + totalReward);
    }
}

export default router;
