-- Migration: 001_initial_schema
-- Description: Initial database schema for Campus Rumor Verification System
-- Created: 2024

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    credential_hash VARCHAR(256) UNIQUE NOT NULL,
    token_balance INTEGER DEFAULT 100,
    staked_tokens INTEGER DEFAULT 0,
    reputation_score DECIMAL(5,4) DEFAULT 0.5000,
    total_submissions INTEGER DEFAULT 0,
    verified_accurate INTEGER DEFAULT 0,
    verified_false INTEGER DEFAULT 0,
    achievements JSONB DEFAULT '[]',
    action_timestamps JSONB DEFAULT '[]',
    bot_score DECIMAL(5,4) DEFAULT 0.0000,
    status VARCHAR(20) DEFAULT 'active',
    last_active TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_credential ON users(credential_hash);
CREATE INDEX idx_users_reputation ON users(reputation_score DESC);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- Rumors Table
-- ============================================
CREATE TABLE IF NOT EXISTS rumors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submitter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    stake_amount INTEGER NOT NULL,
    
    -- Trust Score Components
    veracity_score DECIMAL(5,4) DEFAULT 0.5000,
    confidence_score DECIMAL(5,4) DEFAULT 0.3000,
    temporal_relevance DECIMAL(5,4) DEFAULT 1.0000,
    source_reliability DECIMAL(5,4) DEFAULT 0.5000,
    network_consensus DECIMAL(5,4) DEFAULT 0.5000,
    final_trust_score INTEGER DEFAULT 50,
    
    -- Verification counts
    support_count INTEGER DEFAULT 0,
    dispute_count INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    resolved_at TIMESTAMP,
    
    -- Content hashes
    content_hash VARCHAR(64),
    ipfs_cid VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rumors_submitter ON rumors(submitter_id);
CREATE INDEX idx_rumors_category ON rumors(category);
CREATE INDEX idx_rumors_status ON rumors(status);
CREATE INDEX idx_rumors_trust ON rumors(final_trust_score DESC);
CREATE INDEX idx_rumors_created ON rumors(created_at DESC);

-- ============================================
-- Evidence Table
-- ============================================
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rumor_id UUID REFERENCES rumors(id) ON DELETE CASCADE,
    submitter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL,
    description TEXT,
    file_path TEXT,
    file_type VARCHAR(50),
    file_size INTEGER,
    ipfs_cid VARCHAR(100),
    content_hash VARCHAR(64),
    weight DECIMAL(3,2) DEFAULT 0.50,
    quality_score DECIMAL(3,2) DEFAULT 0.50,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_evidence_rumor ON evidence(rumor_id);
CREATE INDEX idx_evidence_type ON evidence(type);

-- ============================================
-- Verifications Table
-- ============================================
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rumor_id UUID REFERENCES rumors(id) ON DELETE CASCADE,
    verifier_id UUID REFERENCES users(id) ON DELETE SET NULL,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('support', 'dispute')),
    stake_amount INTEGER NOT NULL,
    evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL,
    vote_weight DECIMAL(5,4) DEFAULT 1.0000,
    was_correct BOOLEAN,
    reward_amount INTEGER DEFAULT 0,
    nullifier_hash VARCHAR(64) UNIQUE,
    zk_proof JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_verifications_rumor ON verifications(rumor_id);
CREATE INDEX idx_verifications_verifier ON verifications(verifier_id);
CREATE INDEX idx_verifications_vote ON verifications(vote_type);
CREATE UNIQUE INDEX idx_verifications_unique ON verifications(rumor_id, verifier_id);

-- ============================================
-- Checkpoints Table (Blockchain State)
-- ============================================
CREATE TABLE IF NOT EXISTS checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rumor_id UUID REFERENCES rumors(id) ON DELETE CASCADE,
    trust_score INTEGER NOT NULL,
    verification_count INTEGER NOT NULL,
    state_hash VARCHAR(64) NOT NULL,
    ipfs_cid VARCHAR(100),
    tx_hash VARCHAR(66),
    block_number BIGINT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_checkpoints_rumor ON checkpoints(rumor_id);
CREATE INDEX idx_checkpoints_created ON checkpoints(created_at DESC);

-- ============================================
-- Activities Table
-- ============================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    details TEXT,
    token_change INTEGER DEFAULT 0,
    rumor_id UUID REFERENCES rumors(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_created ON activities(created_at DESC);

-- ============================================
-- POW Challenges Table
-- ============================================
CREATE TABLE IF NOT EXISTS pow_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge VARCHAR(64) NOT NULL,
    difficulty INTEGER DEFAULT 4,
    solved BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pow_challenge ON pow_challenges(challenge);
CREATE INDEX idx_pow_expires ON pow_challenges(expires_at);

-- ============================================
-- Helper Functions
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_rumors_timestamp
    BEFORE UPDATE ON rumors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Migration Complete
-- ============================================
