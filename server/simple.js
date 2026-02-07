/**
 * CampusVerify - Simple Server (No Database Required!)
 * Uses JSON file storage - perfect for demos and hackathons
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Configuration
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// ============================================
// JSON File Storage
// ============================================

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('Creating new data file...');
    }
    return {
        rumors: [],
        verifications: [],
        users: {}
    };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();

// ============================================
// WebSocket for Real-time Updates
// ============================================

const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('📡 Client connected. Total:', clients.size);

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
}

// ============================================
// Middleware
// ============================================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..'))); // Serve frontend

// ============================================
// API Routes
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', clients: clients.size });
});

// Get all rumors
app.get('/api/rumors', (req, res) => {
    res.json(db.rumors);
});

// Create a new rumor
app.post('/api/rumors', (req, res) => {
    const { content, category, stakeAmount, userId } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    const rumor = {
        id: crypto.randomUUID(),
        content,
        category: category || 'other',
        stakeAmount: stakeAmount || 10,
        submitterId: userId || 'anonymous',
        createdAt: Date.now(),
        supportCount: 0,
        disputeCount: 0,
        status: 'active',
        veracityScore: 0.5,
        confidenceScore: 0.1,
        temporalRelevance: 1.0,
        sourceReliability: 0.5,
        networkConsensus: 0,
        finalTrustScore: 50
    };

    db.rumors.unshift(rumor);
    saveData(db);

    // Broadcast to all connected clients
    broadcast('rumor:added', rumor);
    console.log('📝 New rumor created:', rumor.id);

    res.status(201).json(rumor);
});

// Verify/Dispute a rumor
app.post('/api/rumors/:id/verify', (req, res) => {
    const { id } = req.params;
    const { voteType, userId, evidence, stakeAmount } = req.body;

    const rumor = db.rumors.find(r => r.id === id);
    if (!rumor) {
        return res.status(404).json({ error: 'Rumor not found' });
    }

    // Record verification
    const verification = {
        id: crypto.randomUUID(),
        rumorId: id,
        verifierId: userId || 'anonymous',
        voteType,
        evidence: evidence || '',
        stakeAmount: stakeAmount || 5,
        createdAt: Date.now()
    };
    db.verifications.push(verification);

    // Update rumor counts
    if (voteType === 'support') {
        rumor.supportCount++;
    } else {
        rumor.disputeCount++;
    }

    // Recalculate trust score
    const total = rumor.supportCount + rumor.disputeCount;
    if (total > 0) {
        rumor.networkConsensus = rumor.supportCount / total;
        rumor.confidenceScore = Math.min(1, total / 10);
        rumor.finalTrustScore = Math.round(
            (rumor.veracityScore * 0.3 +
                rumor.networkConsensus * 0.4 +
                rumor.sourceReliability * 0.2 +
                rumor.temporalRelevance * 0.1) * 100
        );

        // Update status
        if (rumor.finalTrustScore >= 70 && rumor.supportCount > rumor.disputeCount) {
            rumor.status = 'verified';
        } else if (rumor.disputeCount > rumor.supportCount) {
            rumor.status = 'disputed';
        }
    }

    saveData(db);

    // Broadcast update
    broadcast('rumor:updated', rumor);
    console.log('✅ Rumor verified:', id, voteType);

    res.json({ rumor, verification });
});

// Get verifications for a rumor
app.get('/api/rumors/:id/verifications', (req, res) => {
    const verifications = db.verifications.filter(v => v.rumorId === req.params.id);
    res.json(verifications);
});

// ============================================
// Start Server
// ============================================

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║      🔍 CampusVerify Simple Server Running       ║
╠══════════════════════════════════════════════════╣
║  HTTP:  http://localhost:${PORT}                     ║
║  WS:    ws://localhost:${PORT}                       ║
║  Mode:  JSON File Storage (No DB Required!)      ║
╚══════════════════════════════════════════════════╝

📁 Data stored in: ${DATA_FILE}
🌐 Open http://localhost:${PORT} in your browser!
    `);
});
