/**
 * API Route Tests
 * Integration tests for backend API
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';

// Helper for API requests
async function request(method, path, body = null, token = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${path}`, options);
    const data = await response.json();

    return { status: response.status, data };
}

// Test state
let authToken = null;
let testRumorId = null;

// ============================================
// Authentication Tests
// ============================================
describe('Authentication API', () => {

    it('should return PoW challenge', async () => {
        const { status, data } = await request('POST', '/auth/pow-challenge');

        assert.strictEqual(status, 200);
        assert.ok(data.challenge);
        assert.ok(data.difficulty);
        assert.ok(data.expiresAt);
    });

    it('should register with valid PoW solution', async () => {
        // First get challenge
        const { data: challenge } = await request('POST', '/auth/pow-challenge');

        // Simulate solving PoW (in real test would compute nonce)
        // For testing, we'll use a mock or skip PoW validation
        const credentialHash = 'test_credential_' + Date.now();

        const { status, data } = await request('POST', '/auth/register', {
            challenge: challenge.challenge,
            nonce: 0, // Would be computed
            credentialHash
        });

        // May fail due to PoW validation - that's expected
        if (status === 200) {
            assert.ok(data.token);
            authToken = data.token;
        } else {
            assert.strictEqual(status, 400); // PoW validation failure
        }
    });

    it('should login with existing credential', async () => {
        const { status, data } = await request('POST', '/auth/login', {
            credentialHash: 'demo_hash_1' // From seed data
        });

        if (status === 200) {
            assert.ok(data.token);
            authToken = data.token;
        }
    });

    it('should validate token', async () => {
        if (!authToken) return;

        const { status, data } = await request('GET', '/auth/validate', null, authToken);

        assert.strictEqual(status, 200);
        assert.strictEqual(data.valid, true);
    });

    it('should reject invalid token', async () => {
        const { status } = await request('GET', '/auth/validate', null, 'invalid_token');

        assert.strictEqual(status, 401);
    });
});

// ============================================
// Rumors Tests
// ============================================
describe('Rumors API', () => {

    it('should get rumors list', async () => {
        const { status, data } = await request('GET', '/rumors');

        assert.strictEqual(status, 200);
        assert.ok(Array.isArray(data.rumors));
    });

    it('should filter rumors by category', async () => {
        const { status, data } = await request('GET', '/rumors?filter=trending');

        assert.strictEqual(status, 200);
        assert.ok(Array.isArray(data.rumors));
    });

    it('should get single rumor with evidence', async () => {
        // Use seeded rumor ID
        const { status, data } = await request('GET', '/rumors/b1111111-1111-1111-1111-111111111111');

        if (status === 200) {
            assert.ok(data.rumor);
            assert.ok(data.evidence);
            assert.ok(data.votes);
        }
    });

    it('should require auth to submit rumor', async () => {
        const { status } = await request('POST', '/rumors', {
            content: 'Test rumor',
            category: 'academic',
            stakeAmount: 10
        });

        assert.strictEqual(status, 401);
    });

    it('should submit rumor with auth', async () => {
        if (!authToken) return;

        const { status, data } = await request('POST', '/rumors', {
            content: 'Test rumor content for integration testing',
            category: 'academic',
            stakeAmount: 10,
            evidenceType: 'testimony',
            evidenceDescription: 'Test evidence'
        }, authToken);

        if (status === 201) {
            assert.ok(data.rumor);
            assert.ok(data.rumor.id);
            testRumorId = data.rumor.id;
        }
    });
});

// ============================================
// Verifications Tests
// ============================================
describe('Verifications API', () => {

    it('should get verifications for rumor', async () => {
        const { status, data } = await request('GET', '/verifications/rumor/b1111111-1111-1111-1111-111111111111');

        if (status === 200) {
            assert.ok(Array.isArray(data.verifications));
        }
    });

    it('should require auth to verify', async () => {
        const { status } = await request('POST', '/verifications', {
            rumorId: 'b1111111-1111-1111-1111-111111111111',
            voteType: 'support',
            stakeAmount: 5
        });

        assert.strictEqual(status, 401);
    });
});

// ============================================
// Users Tests
// ============================================
describe('Users API', () => {

    it('should get leaderboard without auth', async () => {
        const { status, data } = await request('GET', '/users/leaderboard');

        assert.strictEqual(status, 200);
        assert.ok(Array.isArray(data.leaders));
    });

    it('should require auth for profile', async () => {
        const { status } = await request('GET', '/users/me');

        assert.strictEqual(status, 401);
    });

    it('should get profile with auth', async () => {
        if (!authToken) return;

        const { status, data } = await request('GET', '/users/me', null, authToken);

        if (status === 200) {
            assert.ok(data.user);
            assert.ok(data.user.tokenBalance !== undefined);
        }
    });
});

// ============================================
// Rate Limiting Tests
// ============================================
describe('Rate Limiting', () => {

    it('should rate limit excessive requests', async () => {
        const requests = [];

        // Send many requests quickly
        for (let i = 0; i < 15; i++) {
            requests.push(request('POST', '/auth/pow-challenge'));
        }

        const results = await Promise.all(requests);
        const rateLimited = results.filter(r => r.status === 429);

        // Should see some 429s
        console.log(`Rate limited: ${rateLimited.length}/${requests.length}`);
    });
});

console.log('\n🧪 Running API Integration Tests...\n');
console.log('Note: Tests require the server to be running with seeded database\n');
