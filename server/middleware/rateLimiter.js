/**
 * Rate Limiter Middleware
 * Uses Redis for distributed rate limiting
 */

import { checkRateLimit } from '../services/redis.js';

/**
 * Rate limiter configuration by route type
 */
const limits = {
    default: { limit: 100, window: 60 },       // 100 req/min
    auth: { limit: 10, window: 60 },           // 10 req/min for auth
    submit: { limit: 5, window: 60 },          // 5 submissions/min
    verify: { limit: 20, window: 60 },         // 20 verifications/min
    upload: { limit: 10, window: 60 }          // 10 uploads/min
};

/**
 * Get rate limit config based on route
 */
function getLimitConfig(path, method) {
    if (path.includes('/auth/')) {
        return limits.auth;
    }
    if (path.includes('/rumors') && method === 'POST') {
        return limits.submit;
    }
    if (path.includes('/verifications') && method === 'POST') {
        return limits.verify;
    }
    if (path.includes('/upload')) {
        return limits.upload;
    }
    return limits.default;
}

/**
 * Rate limiter middleware
 */
export async function rateLimiter(req, res, next) {
    try {
        // Get client identifier (IP or user ID if authenticated)
        const identifier = req.user?.userId ||
            req.headers['x-forwarded-for']?.split(',')[0] ||
            req.connection.remoteAddress ||
            'unknown';

        const config = getLimitConfig(req.path, req.method);
        const key = `${identifier}:${req.path}`;

        const result = await checkRateLimit(key, config.limit, config.window);

        // Set rate limit headers
        res.set({
            'X-RateLimit-Limit': config.limit,
            'X-RateLimit-Remaining': result.remaining,
            'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000)
        });

        if (!result.allowed) {
            return res.status(429).json({
                error: 'Too many requests',
                retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000)
            });
        }

        next();
    } catch (error) {
        // If rate limiting fails, allow request
        console.error('Rate limiter error:', error);
        next();
    }
}
