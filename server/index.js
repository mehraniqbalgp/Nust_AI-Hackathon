/**
 * CampusVerify - Main Server Entry Point
 * Express server with PostgreSQL, Redis, WebSocket, and IPFS integration
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

// Routes
import authRoutes from './routes/auth.js';
import rumorRoutes from './routes/rumors.js';
import verificationRoutes from './routes/verifications.js';
import userRoutes from './routes/users.js';
import uploadRoutes from './routes/upload.js';

// Services
import { initDatabase } from './services/database.js';
import { initRedis } from './services/redis.js';
import { initWebSocket } from './services/websocket.js';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'file://'],
    credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api', rateLimiter);

// Static files (serve frontend)
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rumors', rumorRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handler
app.use(errorHandler);

// Initialize WebSocket
const wss = new WebSocketServer({ server });
initWebSocket(wss);

// Start server
async function startServer() {
    try {
        // Initialize database
        await initDatabase();
        console.log('✅ PostgreSQL connected');

        // Initialize Redis
        await initRedis();
        console.log('✅ Redis connected');

        // Start HTTP server
        server.listen(PORT, HOST, () => {
            console.log(`
╔══════════════════════════════════════════════════╗
║        🔍 CampusVerify Server Running            ║
╠══════════════════════════════════════════════════╣
║  HTTP:  http://${HOST}:${PORT}                     ║
║  WS:    ws://${HOST}:${PORT}                       ║
║  Mode:  ${process.env.NODE_ENV || 'development'}                          ║
╚══════════════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

export { app, server, wss };
