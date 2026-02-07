/**
 * Rumors Routes
 * CRUD operations for rumors with trust scoring
 */

import { Router } from 'express';
import { query, transaction } from '../services/database.js';
import { cache, deleteCache, deleteCachePattern } from '../services/redis.js';
import { uploadToIPFS, createCheckpoint } from '../services/ipfs.js';
import { notifyNewRumor, notifyTrustScoreUpdate } from '../services/websocket.js';
import { authenticate } from '../middleware/authenticate.js';
import crypto from 'crypto';

const router = Router();

// Evidence type weights
const EVIDENCE_WEIGHTS = {
    documentary: 0.6,
    photo: 0.5,
    video: 0.5,
    statistical: 0.4,
    testimony: 0.3
};

/**
 * Get all rumors with filtering
 */
router.get('/', async (req, res) => {
    try {
        const { filter = 'trending', limit = 20, offset = 0 } = req.query;

        // Try cache first
        const cacheKey = `rumors:${filter}:${limit}:${offset}`;
        const cached = await cache(cacheKey, 30, async () => {
            let orderBy;
            let where = '';

            switch (filter) {
                case 'recent':
                    orderBy = 'created_at DESC';
                    break;
                case 'verified':
                    orderBy = 'final_trust_score DESC';
                    where = "AND (status = 'verified' OR final_trust_score >= 70)";
                    break;
                case 'disputed':
                    orderBy = 'dispute_count DESC';
                    where = "AND (status = 'disputed' OR dispute_count > support_count)";
                    break;
                case 'trending':
                default:
                    orderBy = `
                        (final_trust_score * 0.4 + 
                         (support_count + dispute_count) * 2 + 
                         EXTRACT(EPOCH FROM NOW() - created_at) / -3600 * 5) DESC
                    `;
            }

            const result = await query(`
                SELECT r.*, u.username as submitter_username
                FROM rumors r
                LEFT JOIN users u ON r.submitter_id = u.id
                WHERE r.status != 'deleted' ${where}
                ORDER BY ${orderBy}
                LIMIT $1 OFFSET $2
            `, [parseInt(limit), parseInt(offset)]);

            return result.rows;
        });

        res.json({ rumors: cached });
    } catch (error) {
        console.error('Get rumors error:', error);
        res.status(500).json({ error: 'Failed to fetch rumors' });
    }
});

/**
 * Get single rumor with evidence
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const rumorResult = await query(`
            SELECT r.*, u.username as submitter_username
            FROM rumors r
            LEFT JOIN users u ON r.submitter_id = u.id
            WHERE r.id = $1
        `, [id]);

        if (rumorResult.rows.length === 0) {
            return res.status(404).json({ error: 'Rumor not found' });
        }

        const rumor = rumorResult.rows[0];

        // Get evidence
        const evidenceResult = await query(`
            SELECT e.*, u.username as submitter_username
            FROM evidence e
            LEFT JOIN users u ON e.submitter_id = u.id
            WHERE e.rumor_id = $1
            ORDER BY e.created_at DESC
        `, [id]);

        // Get verification counts by type
        const voteResult = await query(`
            SELECT vote_type, COUNT(*) as count, SUM(stake_amount) as total_stake
            FROM verifications
            WHERE rumor_id = $1
            GROUP BY vote_type
        `, [id]);

        res.json({
            rumor,
            evidence: evidenceResult.rows,
            votes: voteResult.rows.reduce((acc, row) => {
                acc[row.vote_type] = {
                    count: parseInt(row.count),
                    totalStake: parseInt(row.total_stake)
                };
                return acc;
            }, {})
        });
    } catch (error) {
        console.error('Get rumor error:', error);
        res.status(500).json({ error: 'Failed to fetch rumor' });
    }
});

/**
 * Submit new rumor
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { content, category, stakeAmount, evidenceType, evidenceDescription } = req.body;
        const userId = req.user.userId;

        // Validate
        if (!content || content.length < 10) {
            return res.status(400).json({ error: 'Content must be at least 10 characters' });
        }

        if (!category) {
            return res.status(400).json({ error: 'Category is required' });
        }

        const stake = parseInt(stakeAmount) || 10;
        if (stake < 5 || stake > 50) {
            return res.status(400).json({ error: 'Stake must be between 5 and 50 tokens' });
        }

        // Check user balance
        const userResult = await query(
            'SELECT token_balance FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0 || userResult.rows[0].token_balance < stake) {
            return res.status(400).json({ error: 'Insufficient token balance' });
        }

        // Create content hash
        const contentHash = crypto.createHash('sha256').update(content).digest('hex');

        // Upload to IPFS
        const ipfsResult = await uploadToIPFS({ content, category, timestamp: Date.now() });

        // Transaction: create rumor and deduct tokens
        const result = await transaction(async (client) => {
            // Deduct tokens
            await client.query(
                `UPDATE users SET 
                    token_balance = token_balance - $1,
                    staked_tokens = staked_tokens + $1,
                    total_submissions = total_submissions + 1,
                    updated_at = NOW()
                 WHERE id = $2`,
                [stake, userId]
            );

            // Create rumor
            const rumorResult = await client.query(`
                INSERT INTO rumors (
                    submitter_id, content, category, stake_amount,
                    content_hash, ipfs_cid
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `, [userId, content, category, stake, contentHash, ipfsResult.cid]);

            const rumor = rumorResult.rows[0];

            // Add evidence if provided
            if (evidenceDescription) {
                const weight = EVIDENCE_WEIGHTS[evidenceType] || 0.3;
                await client.query(`
                    INSERT INTO evidence (rumor_id, submitter_id, type, description, weight)
                    VALUES ($1, $2, $3, $4, $5)
                `, [rumor.id, userId, evidenceType || 'testimony', evidenceDescription, weight]);
            }

            // Log activity
            await client.query(`
                INSERT INTO activities (user_id, type, details, token_change)
                VALUES ($1, 'submitted', $2, $3)
            `, [userId, `Submitted: "${content.substring(0, 50)}..."`, -stake]);

            return rumor;
        });

        // Clear cache
        await deleteCachePattern('rumors:*');

        // Notify via WebSocket
        notifyNewRumor(result);

        res.status(201).json({ rumor: result });
    } catch (error) {
        console.error('Submit rumor error:', error);
        res.status(500).json({ error: 'Failed to submit rumor' });
    }
});

/**
 * Recalculate trust score for a rumor
 */
async function recalculateTrustScore(rumorId) {
    const rumorResult = await query('SELECT * FROM rumors WHERE id = $1', [rumorId]);
    if (rumorResult.rows.length === 0) return null;

    const rumor = rumorResult.rows[0];

    // Get evidence
    const evidenceResult = await query(
        'SELECT * FROM evidence WHERE rumor_id = $1',
        [rumorId]
    );
    const evidence = evidenceResult.rows;

    // Get verifications
    const verifyResult = await query(
        'SELECT * FROM verifications WHERE rumor_id = $1',
        [rumorId]
    );
    const verifications = verifyResult.rows;

    // Calculate Veracity (V)
    let veracity = 0.5;
    if (evidence.length > 0) {
        let evidenceScore = 0;
        evidence.forEach((e, i) => {
            const dimFactor = 1 / (1 + i * 0.2);
            evidenceScore += e.weight * e.quality_score * dimFactor;
        });
        veracity = Math.min(evidenceScore / 2, 1.0);
    } else if (verifications.length > 0) {
        const supports = verifications.filter(v => v.vote_type === 'support').length;
        veracity = supports / verifications.length;
    }

    // Calculate Confidence (C)
    let confidence = 0.3;
    if (evidence.length > 0) {
        const hasDoc = evidence.some(e => e.type === 'documentary');
        const hasMedia = evidence.some(e => ['photo', 'video'].includes(e.type));
        confidence = hasDoc ? 0.9 : hasMedia ? 0.7 : 0.5;
    }
    const n = verifications.length;
    const sampleFactor = 1 - Math.exp(-n / 10);
    confidence *= sampleFactor;

    // Calculate Temporal Relevance (T)
    const hoursSince = (Date.now() - new Date(rumor.created_at).getTime()) / (1000 * 60 * 60);
    let temporal;
    if (['events', 'food'].includes(rumor.category)) {
        temporal = Math.exp(-0.5 * hoursSince);
    } else if (['academic', 'facilities'].includes(rumor.category)) {
        temporal = 1 / (1 + 0.01 * hoursSince);
    } else {
        temporal = 0.5 + 0.5 * Math.exp(-0.1 * hoursSince);
    }

    // Calculate Source Reliability (S)
    const submitterResult = await query(
        'SELECT total_submissions, verified_accurate, verified_false FROM users WHERE id = $1',
        [rumor.submitter_id]
    );
    let source = 0.5;
    if (submitterResult.rows.length > 0) {
        const s = submitterResult.rows[0];
        if (s.total_submissions > 0) {
            const rawScore = (s.verified_accurate - 2 * s.verified_false) / s.total_submissions;
            source = Math.max(0, Math.min(1, (rawScore + 1) / 2));
        }
    }

    // Calculate Network Consensus (N)
    let consensus = 0.5;
    if (verifications.length > 0) {
        const supportWeight = verifications
            .filter(v => v.vote_type === 'support')
            .reduce((sum, v) => sum + parseFloat(v.vote_weight), 0);
        const totalWeight = verifications.reduce((sum, v) => sum + parseFloat(v.vote_weight), 0);
        consensus = supportWeight / totalWeight;
    }

    // Weighted sum
    const finalScore = Math.round(
        (0.35 * veracity + 0.25 * confidence + 0.20 * temporal + 0.10 * source + 0.10 * consensus) * 100
    );

    // Determine status
    let status = rumor.status;
    if (finalScore >= 70) status = 'verified';
    else if (finalScore <= 30) status = 'disputed';

    // Update rumor
    await query(`
        UPDATE rumors SET
            veracity_score = $1,
            confidence_score = $2,
            temporal_relevance = $3,
            source_reliability = $4,
            network_consensus = $5,
            final_trust_score = $6,
            status = $7,
            support_count = $8,
            dispute_count = $9,
            updated_at = NOW()
        WHERE id = $10
    `, [
        veracity, confidence, temporal, source, consensus,
        finalScore, status,
        verifications.filter(v => v.vote_type === 'support').length,
        verifications.filter(v => v.vote_type === 'dispute').length,
        rumorId
    ]);

    // Notify WebSocket clients
    notifyTrustScoreUpdate(rumorId, finalScore);

    // Create checkpoint if significant change
    if (Math.abs(finalScore - rumor.final_trust_score) >= 10) {
        await createCheckpoint(rumorId, finalScore, verifications.length);
    }

    return finalScore;
}

export { recalculateTrustScore };
export default router;
