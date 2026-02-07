/**
 * PostgreSQL Database Service
 * Connection pool and query helpers
 */

import pg from 'pg';
const { Pool } = pg;

let pool = null;

/**
 * Initialize database connection pool
 */
export async function initDatabase() {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL ||
            `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    // Run migrations
    await runMigrations();

    return pool;
}

/**
 * Run database migrations
 */
async function runMigrations() {
    const migrations = `
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(50) UNIQUE NOT NULL,
            credential_hash VARCHAR(256) UNIQUE NOT NULL,
            password_hash VARCHAR(256),
            
            -- Token economy
            token_balance INTEGER DEFAULT 100,
            staked_tokens INTEGER DEFAULT 0,
            
            -- Reputation
            total_submissions INTEGER DEFAULT 0,
            verified_accurate INTEGER DEFAULT 0,
            verified_false INTEGER DEFAULT 0,
            reputation_score DECIMAL(3,2) DEFAULT 0.50,
            
            -- Behavioral fingerprinting
            action_timestamps JSONB DEFAULT '[]',
            bot_score DECIMAL(3,2) DEFAULT 0.00,
            
            -- Status
            status VARCHAR(20) DEFAULT 'active',
            pow_completed BOOLEAN DEFAULT false,
            
            -- Achievements
            achievements JSONB DEFAULT '[]',
            
            -- Timestamps
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            last_active TIMESTAMP DEFAULT NOW()
        );

        -- Rumors table
        CREATE TABLE IF NOT EXISTS rumors (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            submitter_id UUID REFERENCES users(id),
            content TEXT NOT NULL,
            category VARCHAR(50) NOT NULL,
            
            -- Trust score components
            veracity_score DECIMAL(4,3) DEFAULT 0.500,
            confidence_score DECIMAL(4,3) DEFAULT 0.300,
            temporal_relevance DECIMAL(4,3) DEFAULT 1.000,
            source_reliability DECIMAL(4,3) DEFAULT 0.500,
            network_consensus DECIMAL(4,3) DEFAULT 0.500,
            final_trust_score INTEGER DEFAULT 50,
            
            -- Counts
            support_count INTEGER DEFAULT 0,
            dispute_count INTEGER DEFAULT 0,
            
            -- Staking
            stake_amount INTEGER NOT NULL,
            
            -- Status
            status VARCHAR(20) DEFAULT 'active',
            resolved BOOLEAN DEFAULT false,
            
            -- Immutability
            content_hash VARCHAR(256),
            ipfs_cid VARCHAR(100),
            blockchain_tx VARCHAR(100),
            
            -- Timestamps
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            event_time TIMESTAMP,
            expires_at TIMESTAMP
        );

        -- Evidence table
        CREATE TABLE IF NOT EXISTS evidence (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            rumor_id UUID REFERENCES rumors(id) ON DELETE CASCADE,
            submitter_id UUID REFERENCES users(id),
            
            type VARCHAR(50) NOT NULL,
            description TEXT,
            
            -- Quality
            weight DECIMAL(3,2) DEFAULT 0.30,
            quality_score DECIMAL(3,2) DEFAULT 0.80,
            
            -- File storage
            file_path VARCHAR(500),
            file_type VARCHAR(50),
            file_size INTEGER,
            ipfs_cid VARCHAR(100),
            
            -- Immutability
            content_hash VARCHAR(256),
            
            created_at TIMESTAMP DEFAULT NOW()
        );

        -- Verifications table
        CREATE TABLE IF NOT EXISTS verifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            rumor_id UUID REFERENCES rumors(id) ON DELETE CASCADE,
            verifier_id UUID REFERENCES users(id),
            
            vote_type VARCHAR(20) NOT NULL,
            stake_amount INTEGER NOT NULL,
            evidence_id UUID REFERENCES evidence(id),
            
            -- Weight
            vote_weight DECIMAL(4,2) DEFAULT 1.00,
            
            -- Nullifier (prevent double voting)
            nullifier_hash VARCHAR(256) UNIQUE,
            
            -- Outcome
            was_correct BOOLEAN,
            
            created_at TIMESTAMP DEFAULT NOW()
        );

        -- Activity log table
        CREATE TABLE IF NOT EXISTS activities (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            
            type VARCHAR(50) NOT NULL,
            details TEXT,
            token_change INTEGER DEFAULT 0,
            
            created_at TIMESTAMP DEFAULT NOW()
        );

        -- Blockchain checkpoints table
        CREATE TABLE IF NOT EXISTS checkpoints (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            
            rumor_id UUID REFERENCES rumors(id),
            checkpoint_type VARCHAR(50) NOT NULL,
            
            state_hash VARCHAR(256) NOT NULL,
            trust_score INTEGER,
            
            blockchain_tx VARCHAR(100),
            block_number BIGINT,
            
            created_at TIMESTAMP DEFAULT NOW()
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_rumors_status ON rumors(status);
        CREATE INDEX IF NOT EXISTS idx_rumors_created ON rumors(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_rumors_trust ON rumors(final_trust_score DESC);
        CREATE INDEX IF NOT EXISTS idx_verifications_rumor ON verifications(rumor_id);
        CREATE INDEX IF NOT EXISTS idx_evidence_rumor ON evidence(rumor_id);
        CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
    `;

    await pool.query(migrations);
}

/**
 * Get database pool
 */
export function getPool() {
    if (!pool) {
        throw new Error('Database not initialized');
    }
    return pool;
}

/**
 * Query helper
 */
export async function query(text, params) {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 100) {
        console.log(`Slow query (${duration}ms):`, text.substring(0, 100));
    }

    return result;
}

/**
 * Transaction helper
 */
export async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
