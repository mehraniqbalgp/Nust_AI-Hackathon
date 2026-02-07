// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title RumorLedger
 * @dev Immutable ledger for rumor verification with state anchoring
 */
contract RumorLedger {
    // State hashes for verification
    mapping(bytes32 => StateCheckpoint) public checkpoints;
    mapping(bytes32 => bytes32[]) public rumorCheckpoints;
    
    // ZK Proof verifier
    address public zkVerifier;
    
    // Nullifiers to prevent double voting
    mapping(bytes32 => bool) public usedNullifiers;
    
    struct StateCheckpoint {
        bytes32 rumorId;
        bytes32 stateHash;
        uint256 trustScore;
        uint256 timestamp;
        uint256 blockNumber;
        string ipfsCid;
    }
    
    event CheckpointCreated(
        bytes32 indexed checkpointId,
        bytes32 indexed rumorId,
        uint256 trustScore,
        string ipfsCid
    );
    
    event NullifierUsed(bytes32 indexed nullifier);
    
    address public admin;
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    /**
     * @dev Create a state checkpoint for a rumor
     */
    function createCheckpoint(
        bytes32 rumorId,
        bytes32 stateHash,
        uint256 trustScore,
        string memory ipfsCid
    ) public onlyAdmin returns (bytes32) {
        bytes32 checkpointId = keccak256(abi.encodePacked(
            rumorId,
            stateHash,
            trustScore,
            block.timestamp,
            block.number
        ));
        
        checkpoints[checkpointId] = StateCheckpoint({
            rumorId: rumorId,
            stateHash: stateHash,
            trustScore: trustScore,
            timestamp: block.timestamp,
            blockNumber: block.number,
            ipfsCid: ipfsCid
        });
        
        rumorCheckpoints[rumorId].push(checkpointId);
        
        emit CheckpointCreated(checkpointId, rumorId, trustScore, ipfsCid);
        
        return checkpointId;
    }
    
    /**
     * @dev Verify a state hash matches a checkpoint
     */
    function verifyCheckpoint(
        bytes32 checkpointId,
        bytes32 expectedStateHash
    ) public view returns (bool) {
        StateCheckpoint memory cp = checkpoints[checkpointId];
        return cp.stateHash == expectedStateHash;
    }
    
    /**
     * @dev Get all checkpoints for a rumor
     */
    function getRumorCheckpoints(bytes32 rumorId) public view returns (bytes32[] memory) {
        return rumorCheckpoints[rumorId];
    }
    
    /**
     * @dev Get latest checkpoint for a rumor
     */
    function getLatestCheckpoint(bytes32 rumorId) public view returns (StateCheckpoint memory) {
        bytes32[] memory cps = rumorCheckpoints[rumorId];
        require(cps.length > 0, "No checkpoints");
        return checkpoints[cps[cps.length - 1]];
    }
    
    /**
     * @dev Use a nullifier (for ZK voting)
     * Prevents double voting without revealing identity
     */
    function useNullifier(bytes32 nullifier) public onlyAdmin {
        require(!usedNullifiers[nullifier], "Nullifier already used");
        usedNullifiers[nullifier] = true;
        emit NullifierUsed(nullifier);
    }
    
    /**
     * @dev Check if nullifier has been used
     */
    function isNullifierUsed(bytes32 nullifier) public view returns (bool) {
        return usedNullifiers[nullifier];
    }
    
    /**
     * @dev Verify ZK proof (placeholder - would call external verifier)
     */
    function verifyZKProof(
        bytes memory proof,
        bytes32[] memory publicInputs
    ) public view returns (bool) {
        if (zkVerifier == address(0)) {
            return true; // No verifier set, accept all
        }
        
        // Would call external verifier contract
        // return IZKVerifier(zkVerifier).verify(proof, publicInputs);
        return true;
    }
    
    /**
     * @dev Set ZK verifier contract
     */
    function setZKVerifier(address verifier) public onlyAdmin {
        zkVerifier = verifier;
    }
    
    /**
     * @dev Transfer admin
     */
    function setAdmin(address newAdmin) public onlyAdmin {
        admin = newAdmin;
    }
}
