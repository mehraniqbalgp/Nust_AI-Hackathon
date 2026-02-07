-- Migration: 002_seed_data
-- Description: Seed data for development/testing
-- Created: 2024

-- ============================================
-- Demo Users
-- ============================================
INSERT INTO users (id, username, credential_hash, token_balance, reputation_score, total_submissions, verified_accurate)
VALUES
    ('a1111111-1111-1111-1111-111111111111', 'TruthSeeker42', 'demo_hash_1', 150, 0.75, 10, 8),
    ('a2222222-2222-2222-2222-222222222222', 'CampusReporter', 'demo_hash_2', 200, 0.82, 15, 12),
    ('a3333333-3333-3333-3333-333333333333', 'FactChecker99', 'demo_hash_3', 175, 0.68, 8, 5),
    ('a4444444-4444-4444-4444-444444444444', 'NewsHunter', 'demo_hash_4', 120, 0.55, 5, 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Demo Rumors
-- ============================================
INSERT INTO rumors (id, submitter_id, content, category, stake_amount, final_trust_score, support_count, dispute_count, status)
VALUES
    (
        'b1111111-1111-1111-1111-111111111111',
        'a1111111-1111-1111-1111-111111111111',
        'Library will extend hours to 24/7 during finals week starting next Monday!',
        'academic',
        15,
        78,
        12,
        2,
        'verified'
    ),
    (
        'b2222222-2222-2222-2222-222222222222',
        'a2222222-2222-2222-2222-222222222222',
        'The main cafeteria is getting a complete renovation with new food vendors including a sushi bar.',
        'food',
        10,
        65,
        8,
        4,
        'pending'
    ),
    (
        'b3333333-3333-3333-3333-333333333333',
        'a3333333-3333-3333-3333-333333333333',
        'Free concert on the main lawn this Friday featuring a surprise famous artist!',
        'events',
        20,
        42,
        5,
        7,
        'disputed'
    ),
    (
        'b4444444-4444-4444-4444-444444444444',
        'a4444444-4444-4444-4444-444444444444',
        'WiFi upgrade across all dorms - speeds will triple by end of month.',
        'facilities',
        12,
        55,
        6,
        5,
        'pending'
    )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Demo Evidence
-- ============================================
INSERT INTO evidence (rumor_id, submitter_id, type, description, weight, quality_score)
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'documentary', 'Official email from library administration', 0.8, 0.9),
    ('b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'photo', 'Photo of announcement poster in library', 0.6, 0.7),
    ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'testimony', 'Overheard staff discussing renovations', 0.3, 0.5),
    ('b3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 'testimony', 'Friend works in events office', 0.3, 0.4)
ON CONFLICT DO NOTHING;

-- ============================================
-- Demo Verifications
-- ============================================
INSERT INTO verifications (rumor_id, verifier_id, vote_type, stake_amount, vote_weight, was_correct)
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'support', 5, 1.2, true),
    ('b1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', 'support', 8, 0.9, true),
    ('b1111111-1111-1111-1111-111111111111', 'a4444444-4444-4444-4444-444444444444', 'support', 5, 0.8, true),
    ('b2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'support', 6, 1.1, null),
    ('b2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'dispute', 5, 0.9, null),
    ('b3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 'dispute', 10, 1.1, null),
    ('b3333333-3333-3333-3333-333333333333', 'a4444444-4444-4444-4444-444444444444', 'support', 5, 0.8, null)
ON CONFLICT DO NOTHING;

-- ============================================
-- Demo Activities
-- ============================================
INSERT INTO activities (user_id, type, details, token_change, rumor_id)
VALUES
    ('a1111111-1111-1111-1111-111111111111', 'submitted', 'Submitted rumor about library hours', -15, 'b1111111-1111-1111-1111-111111111111'),
    ('a1111111-1111-1111-1111-111111111111', 'reward', 'Rumor verified - earned reward', 22, 'b1111111-1111-1111-1111-111111111111'),
    ('a2222222-2222-2222-2222-222222222222', 'verified', 'Verified library rumor', -5, 'b1111111-1111-1111-1111-111111111111'),
    ('a2222222-2222-2222-2222-222222222222', 'reward', 'Correct verification - earned reward', 8, 'b1111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ============================================
-- Seed Complete
-- ============================================
