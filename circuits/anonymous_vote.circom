/**
 * Anonymous Voting Circuit
 * Circom circuit for ZK proof of membership and voting
 * 
 * This implements a Semaphore-style anonymous voting system
 * where users can prove membership in a group without revealing
 * their identity, while preventing double voting via nullifiers.
 */

pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mux1.circom";

/**
 * MerkleTreeChecker verifies a Merkle proof
 */
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    
    signal output valid;
    
    component hashers[levels];
    component mux[levels];
    
    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;
    
    for (var i = 0; i < levels; i++) {
        hashers[i] = Poseidon(2);
        mux[i] = MultiMux1(2);
        
        mux[i].c[0][0] <== levelHashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== levelHashes[i];
        mux[i].s <== pathIndices[i];
        
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];
        
        levelHashes[i + 1] <== hashers[i].out;
    }
    
    component isEqual = IsEqual();
    isEqual.in[0] <== levelHashes[levels];
    isEqual.in[1] <== root;
    
    valid <== isEqual.out;
}

/**
 * AnonymousVote circuit
 * Proves:
 * 1. User is a member of the campus group (via Merkle tree)
 * 2. Vote is valid (support or dispute)
 * 3. Nullifier is correctly computed (prevents double voting)
 * 
 * Public inputs: merkleRoot, nullifierHash, rumorId, voteType
 * Private inputs: secret, pathElements, pathIndices
 */
template AnonymousVote(levels) {
    // Public inputs
    signal input merkleRoot;        // Root of member tree
    signal input nullifierHash;     // Prevents double voting
    signal input rumorId;           // Which rumor being voted on
    signal input voteType;          // 0 = dispute, 1 = support
    
    // Private inputs
    signal input identitySecret;    // User's secret key
    signal input pathElements[levels];
    signal input pathIndices[levels];
    
    // Outputs
    signal output validVote;
    
    // 1. Compute identity commitment: hash(secret)
    component identityHasher = Poseidon(1);
    identityHasher.inputs[0] <== identitySecret;
    signal identityCommitment;
    identityCommitment <== identityHasher.out;
    
    // 2. Verify Merkle membership
    component merkleChecker = MerkleTreeChecker(levels);
    merkleChecker.leaf <== identityCommitment;
    merkleChecker.root <== merkleRoot;
    for (var i = 0; i < levels; i++) {
        merkleChecker.pathElements[i] <== pathElements[i];
        merkleChecker.pathIndices[i] <== pathIndices[i];
    }
    
    // 3. Compute nullifier: hash(secret, rumorId)
    // This is unique per user per rumor, preventing double voting
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== identitySecret;
    nullifierHasher.inputs[1] <== rumorId;
    
    // 4. Verify nullifier matches claimed nullifier
    component nullifierCheck = IsEqual();
    nullifierCheck.in[0] <== nullifierHasher.out;
    nullifierCheck.in[1] <== nullifierHash;
    
    // 5. Verify vote type is valid (0 or 1)
    component voteValid = LessEqThan(1);
    voteValid.in[0] <== voteType;
    voteValid.in[1] <== 1;
    
    // All conditions must be true
    validVote <== merkleChecker.valid * nullifierCheck.out * voteValid.out;
}

/**
 * ReputationProof circuit
 * Proves user has sufficient reputation without revealing exact amount
 */
template ReputationProof() {
    // Public inputs
    signal input minReputation;     // Minimum required reputation
    signal input commitmentHash;    // Hash of reputation data
    
    // Private inputs
    signal input reputation;        // Actual reputation score
    signal input salt;              // Random value to create commitment
    
    // Output
    signal output valid;
    
    // 1. Verify commitment
    component commitHasher = Poseidon(2);
    commitHasher.inputs[0] <== reputation;
    commitHasher.inputs[1] <== salt;
    
    component commitCheck = IsEqual();
    commitCheck.in[0] <== commitHasher.out;
    commitCheck.in[1] <== commitmentHash;
    
    // 2. Verify reputation >= minReputation
    component repCheck = GreaterEqThan(32);
    repCheck.in[0] <== reputation;
    repCheck.in[1] <== minReputation;
    
    valid <== commitCheck.out * repCheck.out;
}

// Main component: 20 levels allows for ~1 million members
component main {public [merkleRoot, nullifierHash, rumorId, voteType]} = AnonymousVote(20);
