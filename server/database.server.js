/**
 * CampusVerify - Production Server with SQLite Database
 * Real database that works across ALL users when deployed
 * No external services needed - just run and deploy!
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Configuration
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'campusverify.db');

// ============================================
// SQLite Database Setup
// ============================================

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS rumors (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'other',
        stake_amount INTEGER DEFAULT 10,
        submitter_id TEXT DEFAULT 'anonymous',
        created_at INTEGER NOT NULL,
        support_count INTEGER DEFAULT 0,
        dispute_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        veracity_score REAL DEFAULT 0.5,
        confidence_score REAL DEFAULT 0.1,
        temporal_relevance REAL DEFAULT 1.0,
        source_reliability REAL DEFAULT 0.5,
        network_consensus REAL DEFAULT 0,
        final_trust_score INTEGER DEFAULT 50,
        evidence_type TEXT DEFAULT 'testimony',
        evidence_description TEXT,
        evidence_files TEXT
    );

    CREATE TABLE IF NOT EXISTS verifications (
        id TEXT PRIMARY KEY,
        rumor_id TEXT NOT NULL,
        verifier_id TEXT DEFAULT 'anonymous',
        vote_type TEXT NOT NULL,
        evidence TEXT,
        stake_amount INTEGER DEFAULT 5,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (rumor_id) REFERENCES rumors(id)
    );

    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        token_balance INTEGER DEFAULT 100,
        reputation_score REAL DEFAULT 50,
        total_submissions INTEGER DEFAULT 0,
        verified_accurate INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rumors_created ON rumors(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rumors_status ON rumors(status);
    CREATE INDEX IF NOT EXISTS idx_verifications_rumor ON verifications(rumor_id);
`);

console.log('📦 SQLite database initialized at:', DB_PATH);

// ============================================
// WebSocket for Real-time Updates
// ============================================

const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('📡 Client connected. Total:', clients.size);

    // Send current rumors on connect
    const rumors = getRumors();
    ws.send(JSON.stringify({ type: 'init', data: rumors }));

    ws.on('close', () => {
        clients.delete(ws);
        console.log('📡 Client disconnected. Total:', clients.size);
    });
});

function broadcast(type, data) {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
    console.log(`📤 Broadcast: ${type} to ${clients.size} clients`);
}

// ============================================
// Database Functions
// ============================================

function getRumors(limit = 50, offset = 0) {
    const stmt = db.prepare(`
        SELECT * FROM rumors 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset).map(formatRumor);
}

function getRumorById(id) {
    const stmt = db.prepare('SELECT * FROM rumors WHERE id = ?');
    const rumor = stmt.get(id);
    return rumor ? formatRumor(rumor) : null;
}

function createRumor(content, category, stakeAmount, submitterId, evidenceType = 'testimony', evidenceDescription = '', evidenceFiles = []) {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const filesJson = JSON.stringify(evidenceFiles);

    const stmt = db.prepare(`
        INSERT INTO rumors (id, content, category, stake_amount, submitter_id, created_at, evidence_type, evidence_description, evidence_files)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, content, category, stakeAmount, submitterId, createdAt, evidenceType, evidenceDescription, filesJson);

    return getRumorById(id);
}

function updateRumor(id, updates) {
    const rumor = getRumorById(id);
    if (!rumor) return null;

    const setClauses = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setClauses.push(`${dbKey} = ?`);
        values.push(value);
    }
    values.push(id);

    const stmt = db.prepare(`UPDATE rumors SET ${setClauses.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return getRumorById(id);
}

function createVerification(rumorId, verifierId, voteType, evidence, stakeAmount) {
    const id = crypto.randomUUID();
    const createdAt = Date.now();

    const stmt = db.prepare(`
        INSERT INTO verifications (id, rumor_id, verifier_id, vote_type, evidence, stake_amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, rumorId, verifierId, voteType, evidence, stakeAmount, createdAt);

    return { id, rumorId, verifierId, voteType, evidence, stakeAmount, createdAt };
}

function getVerificationsForRumor(rumorId) {
    const stmt = db.prepare('SELECT * FROM verifications WHERE rumor_id = ? ORDER BY created_at DESC');
    return stmt.all(rumorId);
}

function formatRumor(row) {
    let evidenceFiles = [];
    try {
        evidenceFiles = row.evidence_files ? JSON.parse(row.evidence_files) : [];
    } catch (e) {
        evidenceFiles = [];
    }

    return {
        id: row.id,
        content: row.content,
        category: row.category,
        stakeAmount: row.stake_amount,
        submitterId: row.submitter_id,
        createdAt: row.created_at,
        supportCount: row.support_count,
        disputeCount: row.dispute_count,
        status: row.status,
        veracityScore: row.veracity_score,
        confidenceScore: row.confidence_score,
        temporalRelevance: row.temporal_relevance,
        sourceReliability: row.source_reliability,
        networkConsensus: row.network_consensus,
        finalTrustScore: row.final_trust_score,
        evidenceType: row.evidence_type || 'testimony',
        evidenceDescription: row.evidence_description || '',
        evidenceFiles: evidenceFiles
    };
}

// ============================================
// Middleware
// ============================================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================
// API Routes (MUST be before static files!)
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        clients: clients.size,
        database: 'sqlite',
        dbPath: DB_PATH
    });
});

// Get all rumors (without large file data for performance)
app.get('/api/rumors', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const rumors = getRumors(limit, offset);

    // Strip large base64 file data from list response for performance
    // Keep only file metadata (name, type) and a flag indicating files exist
    const lightRumors = rumors.map(r => ({
        ...r,
        evidenceFiles: (r.evidenceFiles || []).map(f => ({
            name: f.name,
            type: f.type,
            hasData: !!f.data,
            // Include thumbnail for images, skip for videos
            data: f.type && f.type.startsWith('image/') ? f.data : undefined
        }))
    }));

    res.json(lightRumors);
});

// Get single rumor
app.get('/api/rumors/:id', (req, res) => {
    const rumor = getRumorById(req.params.id);
    if (!rumor) {
        return res.status(404).json({ error: 'Rumor not found' });
    }
    res.json(rumor);
});

// Create a new rumor
app.post('/api/rumors', (req, res) => {
    try {
        const { content, category, stakeAmount, userId, evidenceType, evidenceDescription, evidenceFiles } = req.body;

        console.log('📥 Received rumor submission:', {
            contentLength: content?.length,
            category,
            evidenceType,
            filesCount: evidenceFiles?.length || 0
        });

        if (!content || content.trim().length < 10) {
            return res.status(400).json({ error: 'Content must be at least 10 characters' });
        }

        const rumor = createRumor(
            content.trim(),
            category || 'other',
            stakeAmount || 10,
            userId || 'anonymous',
            evidenceType || 'testimony',
            evidenceDescription || '',
            evidenceFiles || []
        );

        // Create a light version without large video data for response/broadcast
        const lightRumor = {
            ...rumor,
            evidenceFiles: (rumor.evidenceFiles || []).map(f => ({
                name: f.name,
                type: f.type,
                hasData: !!f.data,
                // Keep image data for thumbnails, strip video data
                data: f.type && f.type.startsWith('image/') ? f.data : undefined
            }))
        };

        // Broadcast light version to all connected clients
        broadcast('rumor:added', lightRumor);
        console.log('📝 New rumor created:', rumor.id, 'with evidence:', evidenceType);

        res.status(201).json(lightRumor);
    } catch (error) {
        console.error('❌ Error creating rumor:', error);
        res.status(500).json({ error: 'Failed to create rumor: ' + error.message });
    }
});

// Delete a rumor (only owner can delete)
app.delete('/api/rumors/:id', (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    const rumor = getRumorById(id);
    if (!rumor) {
        return res.status(404).json({ error: 'Rumor not found' });
    }

    // Check if user is the owner
    if (rumor.submitterId !== userId && userId !== 'anonymous') {
        return res.status(403).json({ error: 'You can only delete your own rumors' });
    }

    // Delete from database
    const stmt = db.prepare('DELETE FROM rumors WHERE id = ?');
    stmt.run(id);

    // Also delete related verifications
    const deleteVerifications = db.prepare('DELETE FROM verifications WHERE rumor_id = ?');
    deleteVerifications.run(id);

    // Broadcast deletion to all clients
    broadcast('rumor:deleted', { id });
    console.log('🗑️ Rumor deleted:', id);

    res.json({ success: true, id });
});

// Verify/Dispute a rumor
app.post('/api/rumors/:id/verify', (req, res) => {
    const { id } = req.params;
    const { voteType, userId, evidence, stakeAmount } = req.body;

    const rumor = getRumorById(id);
    if (!rumor) {
        return res.status(404).json({ error: 'Rumor not found' });
    }

    // Record verification
    const verification = createVerification(
        id,
        userId || 'anonymous',
        voteType,
        evidence || '',
        stakeAmount || 5
    );

    // Update rumor counts
    const updates = {};
    if (voteType === 'support') {
        updates.support_count = rumor.supportCount + 1;
    } else {
        updates.dispute_count = rumor.disputeCount + 1;
    }

    // Recalculate trust score
    const newSupport = updates.support_count ?? rumor.supportCount;
    const newDispute = updates.dispute_count ?? rumor.disputeCount;
    const total = newSupport + newDispute;

    if (total > 0) {
        updates.network_consensus = newSupport / total;
        updates.confidence_score = Math.min(1, total / 10);
        updates.final_trust_score = Math.round(
            (rumor.veracityScore * 0.3 +
                (updates.network_consensus) * 0.4 +
                rumor.sourceReliability * 0.2 +
                rumor.temporalRelevance * 0.1) * 100
        );

        // Update status
        if (updates.final_trust_score >= 70 && newSupport > newDispute) {
            updates.status = 'verified';
        } else if (newDispute > newSupport) {
            updates.status = 'disputed';
        }
    }

    // Apply updates
    const stmt = db.prepare(`
        UPDATE rumors SET 
            support_count = ?, dispute_count = ?,
            network_consensus = ?, confidence_score = ?,
            final_trust_score = ?, status = ?
        WHERE id = ?
    `);
    stmt.run(
        newSupport, newDispute,
        updates.network_consensus ?? rumor.networkConsensus,
        updates.confidence_score ?? rumor.confidenceScore,
        updates.final_trust_score ?? rumor.finalTrustScore,
        updates.status ?? rumor.status,
        id
    );

    const updatedRumor = getRumorById(id);

    // Broadcast update
    broadcast('rumor:updated', updatedRumor);
    console.log('✅ Rumor verified:', id, voteType);

    res.json({ rumor: updatedRumor, verification });
});

// Get verifications for a rumor
app.get('/api/rumors/:id/verifications', (req, res) => {
    const verifications = getVerificationsForRumor(req.params.id);
    res.json(verifications);
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
    const totalRumors = db.prepare('SELECT COUNT(*) as count FROM rumors').get().count;
    const totalVerifications = db.prepare('SELECT COUNT(*) as count FROM verifications').get().count;
    const verifiedCount = db.prepare("SELECT COUNT(*) as count FROM rumors WHERE status = 'verified'").get().count;
    const disputedCount = db.prepare("SELECT COUNT(*) as count FROM rumors WHERE status = 'disputed'").get().count;

    res.json({
        totalRumors,
        totalVerifications,
        verifiedCount,
        disputedCount,
        activeConnections: clients.size
    });
});

// Leaderboard endpoint - returns real users ranked by activity
app.get('/api/leaderboard', (req, res) => {
    try {
        // Get all users who have submitted or verified
        const users = db.prepare(`
            SELECT 
                u.id,
                u.username,
                u.token_balance,
                u.reputation_score,
                u.total_submissions,
                u.verified_accurate,
                (SELECT COUNT(*) FROM verifications WHERE verifier_id = u.id) as total_verifications,
                (SELECT COUNT(*) FROM rumors WHERE submitter_id = u.id) as rumors_submitted
            FROM users u
            ORDER BY u.token_balance DESC
            LIMIT 20
        `).all();

        // Also count unique verifiers who aren't in users table
        const activeVerifiers = db.prepare(`
            SELECT 
                verifier_id as id,
                verifier_id as username,
                COUNT(*) as total_verifications,
                SUM(CASE WHEN vote_type = 'support' THEN 1 ELSE 0 END) as support_count,
                SUM(CASE WHEN vote_type = 'dispute' THEN 1 ELSE 0 END) as dispute_count
            FROM verifications
            WHERE verifier_id NOT IN (SELECT id FROM users)
            GROUP BY verifier_id
            ORDER BY total_verifications DESC
            LIMIT 20
        `).all();

        const leaderboard = [
            ...users.map(u => ({
                username: u.username || u.id.substring(0, 12),
                accuracy: u.total_verifications > 0
                    ? Math.round((u.verified_accurate / Math.max(1, u.total_verifications)) * 100)
                    : 0,
                verifications: u.total_verifications || 0,
                tokensEarned: (u.token_balance || 100) - 100
            })),
            ...activeVerifiers.map(v => ({
                username: v.username.substring(0, 16),
                accuracy: 0,
                verifications: v.total_verifications,
                tokensEarned: 0
            }))
        ];

        // Sort by verifications descending
        leaderboard.sort((a, b) => b.verifications - a.verifications);

        res.json(leaderboard.slice(0, 20));
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.json([]);
    }
});

// User sync endpoint - saves user data to shared database
app.post('/api/users/sync', (req, res) => {
    try {
        const { id, username, tokenBalance, reputationScore, totalSubmissions, verifiedAccurate, verifiedFalse, stakedTokens } = req.body;

        if (!id || !username) {
            return res.status(400).json({ error: 'id and username required' });
        }

        const totalVerifications = (verifiedAccurate || 0) + (verifiedFalse || 0);
        const tokensEarned = (tokenBalance || 100) - 100 + (stakedTokens || 0);

        // Upsert user data
        db.prepare(`
            INSERT INTO users (id, username, token_balance, reputation_score, total_submissions, verified_accurate, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                username = excluded.username,
                token_balance = excluded.token_balance,
                reputation_score = excluded.reputation_score,
                total_submissions = excluded.total_submissions,
                verified_accurate = excluded.verified_accurate
        `).run(
            id,
            username,
            tokenBalance || 100,
            reputationScore || 0.5,
            totalSubmissions || 0,
            verifiedAccurate || 0,
            Date.now()
        );

        // Broadcast leaderboard update to all connected clients
        broadcast({
            type: 'leaderboard_update',
            data: { id, username, tokenBalance, totalVerifications, tokensEarned }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('User sync error:', error);
        res.status(500).json({ error: 'Failed to sync user' });
    }
});

// ============================================
// Static File Serving (AFTER API routes!)
// ============================================

app.use(express.static(path.join(__dirname, '..')));

// ============================================
// Start Server
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║         🔍 CampusVerify Production Server Running            ║
╠══════════════════════════════════════════════════════════════╣
║  🌐 HTTP:      http://localhost:${PORT}                          ║
║  📡 WebSocket: ws://localhost:${PORT}                            ║
║  💾 Database:  SQLite (${DB_PATH.split('/').pop()})                      ║
╠══════════════════════════════════════════════════════════════╣
║  ✅ Ready for deployment! All users will share the same DB   ║
║  ✅ WebSocket broadcasts updates to ALL connected clients    ║
║  ✅ No PostgreSQL/Redis needed - just deploy and run!        ║
╚══════════════════════════════════════════════════════════════╝

🚀 To deploy on a server:
   1. Copy project to your server
   2. Run: npm install
   3. Run: npm run db
   4. Access via: http://your-server-ip:${PORT}
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down...');
    wss.close();
    db.close();
    server.close();
});
