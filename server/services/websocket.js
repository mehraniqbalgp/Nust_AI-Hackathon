/**
 * WebSocket Service
 * Real-time notifications and updates
 */

const clients = new Map();
const subscriptions = new Map();

/**
 * Initialize WebSocket server
 */
export function initWebSocket(wss) {
    wss.on('connection', (ws, req) => {
        const clientId = generateClientId();
        clients.set(clientId, {
            ws,
            userId: null,
            subscriptions: new Set()
        });

        console.log(`WebSocket client connected: ${clientId}`);

        ws.on('message', (data) => {
            handleMessage(clientId, data);
        });

        ws.on('close', () => {
            const client = clients.get(clientId);
            if (client) {
                // Remove from subscriptions
                client.subscriptions.forEach(channel => {
                    const subs = subscriptions.get(channel);
                    if (subs) {
                        subs.delete(clientId);
                    }
                });
            }
            clients.delete(clientId);
            console.log(`WebSocket client disconnected: ${clientId}`);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket error for ${clientId}:`, error);
        });

        // Send welcome message
        sendToClient(clientId, {
            type: 'connected',
            clientId,
            timestamp: Date.now()
        });
    });

    return wss;
}

/**
 * Generate unique client ID
 */
function generateClientId() {
    return 'ws_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Handle incoming message
 */
function handleMessage(clientId, data) {
    try {
        const message = JSON.parse(data.toString());
        const client = clients.get(clientId);

        if (!client) return;

        switch (message.type) {
            case 'authenticate':
                client.userId = message.userId;
                sendToClient(clientId, { type: 'authenticated', userId: message.userId });
                break;

            case 'subscribe':
                subscribeToChannel(clientId, message.channel);
                break;

            case 'unsubscribe':
                unsubscribeFromChannel(clientId, message.channel);
                break;

            case 'ping':
                sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
    }
}

/**
 * Subscribe client to channel
 */
function subscribeToChannel(clientId, channel) {
    const client = clients.get(clientId);
    if (!client) return;

    if (!subscriptions.has(channel)) {
        subscriptions.set(channel, new Set());
    }

    subscriptions.get(channel).add(clientId);
    client.subscriptions.add(channel);

    sendToClient(clientId, {
        type: 'subscribed',
        channel
    });
}

/**
 * Unsubscribe client from channel
 */
function unsubscribeFromChannel(clientId, channel) {
    const client = clients.get(clientId);
    if (!client) return;

    const subs = subscriptions.get(channel);
    if (subs) {
        subs.delete(clientId);
    }
    client.subscriptions.delete(channel);

    sendToClient(clientId, {
        type: 'unsubscribed',
        channel
    });
}

/**
 * Send message to specific client
 */
export function sendToClient(clientId, message) {
    const client = clients.get(clientId);
    if (client && client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.send(JSON.stringify(message));
    }
}

/**
 * Send message to specific user (all their connections)
 */
export function sendToUser(userId, message) {
    clients.forEach((client, clientId) => {
        if (client.userId === userId) {
            sendToClient(clientId, message);
        }
    });
}

/**
 * Broadcast to channel
 */
export function broadcastToChannel(channel, message) {
    const subs = subscriptions.get(channel);
    if (!subs) return;

    subs.forEach(clientId => {
        sendToClient(clientId, message);
    });
}

/**
 * Broadcast to all clients
 */
export function broadcastAll(message) {
    clients.forEach((client, clientId) => {
        sendToClient(clientId, message);
    });
}

// ============================================
// Notification Events
// ============================================

/**
 * Notify new rumor posted
 */
export function notifyNewRumor(rumor) {
    broadcastToChannel('rumors', {
        type: 'new_rumor',
        rumor,
        timestamp: Date.now()
    });
}

/**
 * Notify rumor verified
 */
export function notifyRumorVerified(rumorId, verification) {
    broadcastToChannel(`rumor:${rumorId}`, {
        type: 'rumor_verified',
        rumorId,
        verification,
        timestamp: Date.now()
    });
}

/**
 * Notify trust score update
 */
export function notifyTrustScoreUpdate(rumorId, newScore) {
    broadcastToChannel(`rumor:${rumorId}`, {
        type: 'trust_score_update',
        rumorId,
        newScore,
        timestamp: Date.now()
    });
}

/**
 * Notify achievement unlocked
 */
export function notifyAchievement(userId, achievement) {
    sendToUser(userId, {
        type: 'achievement_unlocked',
        achievement,
        timestamp: Date.now()
    });
}

/**
 * Notify token change
 */
export function notifyTokenChange(userId, change, newBalance) {
    sendToUser(userId, {
        type: 'token_change',
        change,
        newBalance,
        timestamp: Date.now()
    });
}
