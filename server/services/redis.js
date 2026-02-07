/**
 * Redis Cache Service
 * Caching layer for performance optimization
 */

import { createClient } from 'redis';

let client = null;

/**
 * Initialize Redis connection
 */
export async function initRedis() {
    client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', (err) => {
        console.error('Redis error:', err);
    });

    client.on('reconnecting', () => {
        console.log('Redis reconnecting...');
    });

    await client.connect();
    return client;
}

/**
 * Get Redis client
 */
export function getRedis() {
    if (!client) {
        throw new Error('Redis not initialized');
    }
    return client;
}

/**
 * Cache helper - get or set
 */
export async function cache(key, ttl, fetchFn) {
    try {
        const cached = await client.get(key);
        if (cached) {
            return JSON.parse(cached);
        }

        const fresh = await fetchFn();
        await client.setEx(key, ttl, JSON.stringify(fresh));
        return fresh;
    } catch (error) {
        console.error('Cache error:', error);
        return fetchFn();
    }
}

/**
 * Set cache
 */
export async function setCache(key, value, ttl = 300) {
    await client.setEx(key, ttl, JSON.stringify(value));
}

/**
 * Get cache
 */
export async function getCache(key) {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
}

/**
 * Delete cache
 */
export async function deleteCache(key) {
    await client.del(key);
}

/**
 * Delete cache by pattern
 */
export async function deleteCachePattern(pattern) {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
        await client.del(keys);
    }
}

/**
 * Increment counter (for rate limiting)
 */
export async function incrementCounter(key, ttl = 60) {
    const value = await client.incr(key);
    if (value === 1) {
        await client.expire(key, ttl);
    }
    return value;
}

/**
 * Rate limit check
 */
export async function checkRateLimit(key, limit, windowSeconds) {
    const count = await incrementCounter(`ratelimit:${key}`, windowSeconds);
    return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetAt: Date.now() + (windowSeconds * 1000)
    };
}

/**
 * Store session
 */
export async function storeSession(sessionId, userId, ttl = 86400) {
    await client.setEx(`session:${sessionId}`, ttl, userId);
}

/**
 * Get session
 */
export async function getSession(sessionId) {
    return client.get(`session:${sessionId}`);
}

/**
 * Publish event (for WebSocket broadcasting)
 */
export async function publishEvent(channel, event) {
    await client.publish(channel, JSON.stringify(event));
}

/**
 * Subscribe to events
 */
export async function subscribeToEvents(channel, callback) {
    const subscriber = client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(channel, (message) => {
        callback(JSON.parse(message));
    });
    return subscriber;
}
