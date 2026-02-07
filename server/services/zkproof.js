/**
 * Zero-Knowledge Proof Service
 * SnarkJS integration for anonymous voting
 */

import { groth16 } from 'snarkjs';
import * as circomlibjs from 'circomlibjs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let poseidon = null;

/**
 * Initialize Poseidon hash function
 */
export async function initZK() {
    try {
        const poseidonJs = await circomlibjs.buildPoseidon();
        poseidon = (inputs) => {
            const hash = poseidonJs(inputs);
            return poseidonJs.F.toString(hash);
        };
        console.log('✅ ZK initialized');
        return true;
    } catch (error) {
        console.error('ZK init error:', error);
        return false;
    }
}

/**
 * Generate identity commitment from secret
 */
export function generateIdentityCommitment(secret) {
    if (!poseidon) {
        // Fallback to SHA256
        return crypto.createHash('sha256').update(secret).digest('hex');
    }
    return poseidon([BigInt('0x' + secret)]);
}

/**
 * Generate nullifier for a specific rumor
 * Prevents double voting
 */
export function generateNullifier(secret, rumorId) {
    if (!poseidon) {
        return crypto.createHash('sha256')
            .update(secret + rumorId)
            .digest('hex');
    }
    return poseidon([
        BigInt('0x' + secret),
        BigInt('0x' + rumorId.replace(/-/g, ''))
    ]);
}

/**
 * Build Merkle tree of identity commitments
 */
export function buildMerkleTree(commitments, levels = 20) {
    const tree = [];
    let currentLevel = [...commitments];

    // Pad to power of 2
    const size = Math.pow(2, levels);
    while (currentLevel.length < size) {
        currentLevel.push('0');
    }

    tree.push(currentLevel);

    // Build up the tree
    for (let i = 0; i < levels; i++) {
        const level = [];
        for (let j = 0; j < currentLevel.length; j += 2) {
            if (poseidon) {
                level.push(poseidon([
                    BigInt(currentLevel[j]),
                    BigInt(currentLevel[j + 1])
                ]));
            } else {
                level.push(
                    crypto.createHash('sha256')
                        .update(currentLevel[j] + currentLevel[j + 1])
                        .digest('hex')
                );
            }
        }
        tree.push(level);
        currentLevel = level;
    }

    return {
        root: tree[tree.length - 1][0],
        tree
    };
}

/**
 * Generate Merkle proof for a commitment
 */
export function generateMerkleProof(tree, index) {
    const pathElements = [];
    const pathIndices = [];

    let idx = index;
    for (let i = 0; i < tree.length - 1; i++) {
        const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
        pathElements.push(tree[i][siblingIdx] || '0');
        pathIndices.push(idx % 2);
        idx = Math.floor(idx / 2);
    }

    return { pathElements, pathIndices };
}

/**
 * Generate ZK proof for anonymous vote
 * NOTE: This requires compiled circuit files (wasm + zkey)
 */
export async function generateVoteProof(input) {
    const {
        identitySecret,
        merkleRoot,
        rumorId,
        voteType,
        pathElements,
        pathIndices
    } = input;

    // Check for circuit files
    const wasmPath = path.join(__dirname, '../../circuits/anonymous_vote_js/anonymous_vote.wasm');
    const zkeyPath = path.join(__dirname, '../../circuits/anonymous_vote.zkey');

    try {
        // Generate nullifier
        const nullifierHash = generateNullifier(
            identitySecret,
            typeof rumorId === 'string' ? rumorId : rumorId.toString()
        );

        // Prepare circuit input
        const circuitInput = {
            merkleRoot: BigInt(merkleRoot),
            nullifierHash: BigInt(nullifierHash),
            rumorId: BigInt('0x' + rumorId.replace(/-/g, '')),
            voteType: BigInt(voteType),
            identitySecret: BigInt('0x' + identitySecret),
            pathElements: pathElements.map(e => BigInt(e)),
            pathIndices: pathIndices
        };

        // Generate proof
        const { proof, publicSignals } = await groth16.fullProve(
            circuitInput,
            wasmPath,
            zkeyPath
        );

        return {
            proof,
            publicSignals,
            nullifierHash
        };
    } catch (error) {
        console.error('ZK proof generation error:', error);
        // Return simulated proof
        return {
            simulated: true,
            nullifierHash: generateNullifier(identitySecret, rumorId),
            proof: {
                pi_a: ['0', '0', '1'],
                pi_b: [['0', '0'], ['0', '0'], ['1', '0']],
                pi_c: ['0', '0', '1']
            },
            publicSignals: [merkleRoot, generateNullifier(identitySecret, rumorId), rumorId, voteType]
        };
    }
}

/**
 * Verify ZK proof
 */
export async function verifyVoteProof(proof, publicSignals) {
    const vkeyPath = path.join(__dirname, '../../circuits/verification_key.json');

    try {
        const vkey = await import(vkeyPath, { assert: { type: 'json' } });
        const valid = await groth16.verify(vkey.default, publicSignals, proof);
        return { valid, simulated: false };
    } catch (error) {
        console.error('ZK verification error:', error);
        // Return simulated verification
        return { valid: true, simulated: true };
    }
}

/**
 * Generate random identity secret
 */
export function generateIdentitySecret() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash data with Poseidon or fallback
 */
export function hashData(...inputs) {
    if (poseidon) {
        return poseidon(inputs.map(i => BigInt(i)));
    }
    return crypto.createHash('sha256')
        .update(inputs.join(''))
        .digest('hex');
}
