/**
 * Error Handler Middleware
 * Centralized error handling
 */

/**
 * Handle all errors
 */
export function errorHandler(err, req, res, next) {
    console.error('Error:', err);

    // Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB' });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files. Maximum is 5' });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Unexpected field name in file upload' });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.details
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
    }

    // Database errors
    if (err.code === '23505') { // Unique violation
        return res.status(409).json({ error: 'Resource already exists' });
    }

    if (err.code === '23503') { // Foreign key violation
        return res.status(400).json({ error: 'Related resource not found' });
    }

    // Default error
    const status = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    res.status(status).json({ error: message });
}
