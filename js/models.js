/**
 * CampusVerify - Data Models
 * Type definitions and data structures for the rumor verification system
 */

// Evidence type weights (from design doc)
const EVIDENCE_WEIGHTS = {
    documentary: 0.6,
    photo: 0.5,
    video: 0.5,
    statistical: 0.4,
    testimony: 0.3
};

// Category icons and labels
const CATEGORIES = {
    facilities: { icon: '📚', label: 'Facilities' },
    events: { icon: '🎉', label: 'Events' },
    academic: { icon: '📝', label: 'Academic' },
    tech: { icon: '💻', label: 'Tech' },
    food: { icon: '🍕', label: 'Food' },
    other: { icon: '📌', label: 'Other' }
};

// Achievement definitions
const ACHIEVEMENTS = {
    truth_seeker: {
        id: 'truth_seeker',
        icon: '🔍',
        name: 'Truth Seeker',
        description: 'Verify 10 rumors correctly',
        requirement: { type: 'verifications', count: 10 },
        reward: 50
    },
    sharpshooter: {
        id: 'sharpshooter',
        icon: '🎯',
        name: 'Sharpshooter',
        description: '80% accuracy for 30 days',
        requirement: { type: 'accuracy', value: 0.8, days: 30 },
        reward: 100
    },
    early_bird: {
        id: 'early_bird',
        icon: '⚡',
        name: 'Early Bird',
        description: 'Verify within first hour 20 times',
        requirement: { type: 'early_verifications', count: 20 },
        reward: 75
    },
    defender: {
        id: 'defender',
        icon: '🛡️',
        name: 'Defender',
        description: 'Dispute 5 false rumors',
        requirement: { type: 'successful_disputes', count: 5 },
        reward: 150
    },
    fact_master: {
        id: 'fact_master',
        icon: '🏆',
        name: 'Fact Master',
        description: 'First to verify 5 major rumors',
        requirement: { type: 'first_verifications', count: 5 },
        reward: 200
    }
};

/**
 * Generate unique ID
 */
function generateId() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate anonymous username
 */
function generateUsername() {
    const adjectives = ['Anonymous', 'Hidden', 'Secret', 'Unknown', 'Mystery'];
    const nouns = ['Eagle', 'Hawk', 'Falcon', 'Phoenix', 'Raven', 'Owl', 'Wolf', 'Bear'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}_${nouns[Math.floor(Math.random() * nouns.length)]}`;
}

/**
 * Create new User
 */
function createUser(overrides = {}) {
    return {
        id: generateId(),
        username: generateUsername(),
        credentialHash: generateId(), // Simulated zk credential
        createdAt: Date.now(),
        lastActive: Date.now(),

        // Token economy
        tokenBalance: 100,
        stakedTokens: 0,

        // Reputation tracking
        totalSubmissions: 0,
        verifiedAccurate: 0,
        verifiedFalse: 0,
        disputeCount: 0,
        reputationScore: 0.5,

        // Behavioral fingerprinting (for bot detection)
        actionTimestamps: [],
        voteHistory: [],
        botScore: 0,

        // Status
        status: 'active', // active, flagged, suspended

        // Achievements
        unlockedAchievements: [],

        ...overrides
    };
}

/**
 * Create new Evidence
 */
function createEvidence(rumorId, submitterId, type, description, overrides = {}) {
    const weight = EVIDENCE_WEIGHTS[type] || 0.3;

    return {
        id: generateId(),
        rumorId,
        submitterId,
        type, // photo, video, documentary, testimony
        description,

        // Quality metrics
        weight,
        qualityScore: 0.8, // Default, can be adjusted

        // Immutability simulation
        contentHash: generateId(),
        ipfsCid: null, // Would be IPFS hash in real system

        createdAt: Date.now(),

        ...overrides
    };
}

/**
 * Create new Rumor
 */
function createRumor(submitterId, content, category, stakeAmount, overrides = {}) {
    return {
        id: generateId(),
        submitterId,
        content,
        category,

        // Trust score components
        veracityScore: 0.5,
        confidenceScore: 0.3,
        temporalRelevance: 1.0,
        sourceReliability: 0.5,
        networkConsensus: 0.5,
        finalTrustScore: 50,

        // Verification counts
        supportCount: 0,
        disputeCount: 0,

        // Evidence
        evidenceIds: [],

        // Token staking
        stakeAmount,

        // Metadata
        createdAt: Date.now(),
        eventTime: null,
        expiresAt: null,

        // Status
        status: 'active', // active, verified, refuted, disputed, deprecated

        // Immutability
        contentHash: generateId(),

        ...overrides
    };
}

/**
 * Create new Verification (vote)
 */
function createVerification(rumorId, verifierId, voteType, stakeAmount, evidenceId = null, overrides = {}) {
    return {
        id: generateId(),
        rumorId,
        verifierId,

        voteType, // support, dispute
        stakeAmount,
        evidenceId,

        // Vote weight (reputation-adjusted)
        voteWeight: 1.0,

        // Nullifier (prevents double voting)
        nullifierHash: generateId(),

        createdAt: Date.now(),

        // Outcome tracking
        wasCorrect: null, // Set when rumor is resolved

        ...overrides
    };
}

/**
 * Create Activity Log Entry
 */
function createActivityEntry(userId, type, details, tokenChange = 0) {
    return {
        id: generateId(),
        userId,
        type, // submitted, verified, disputed, earned, lost, achievement
        details,
        tokenChange,
        timestamp: Date.now()
    };
}
