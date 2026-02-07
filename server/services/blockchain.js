/**
 * Blockchain Service
 * Ethereum/Polygon integration for on-chain operations
 */

import { ethers } from 'ethers';

let provider = null;
let wallet = null;
let truthTokenContract = null;
let rumorLedgerContract = null;

// Contract ABIs (simplified)
const TRUTH_TOKEN_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address, uint256) returns (bool)",
    "function submitRumor(bytes32, uint256, string) returns (bytes32)",
    "function stakeOnRumor(bytes32, uint256, bool) returns (bytes32)",
    "function resolveRumor(bytes32, bool)",
    "event RumorSubmitted(bytes32 indexed, address indexed, uint256)",
    "event Staked(address indexed, bytes32 indexed, uint256, bool)",
    "event RumorResolved(bytes32 indexed, uint8)"
];

const RUMOR_LEDGER_ABI = [
    "function createCheckpoint(bytes32, bytes32, uint256, string) returns (bytes32)",
    "function verifyCheckpoint(bytes32, bytes32) view returns (bool)",
    "function getLatestCheckpoint(bytes32) view returns (tuple(bytes32, bytes32, uint256, uint256, uint256, string))",
    "function useNullifier(bytes32)",
    "function isNullifierUsed(bytes32) view returns (bool)",
    "event CheckpointCreated(bytes32 indexed, bytes32 indexed, uint256, string)",
    "event NullifierUsed(bytes32 indexed)"
];

/**
 * Initialize blockchain connection
 */
export async function initBlockchain() {
    if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
        console.log('⚠️ Blockchain not configured - running in simulation mode');
        return null;
    }

    try {
        provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        console.log(`✅ Blockchain connected: ${await wallet.getAddress()}`);

        // Initialize contracts if addresses are set
        if (process.env.TRUTH_TOKEN_ADDRESS) {
            truthTokenContract = new ethers.Contract(
                process.env.TRUTH_TOKEN_ADDRESS,
                TRUTH_TOKEN_ABI,
                wallet
            );
        }

        if (process.env.RUMOR_LEDGER_ADDRESS) {
            rumorLedgerContract = new ethers.Contract(
                process.env.RUMOR_LEDGER_ADDRESS,
                RUMOR_LEDGER_ABI,
                wallet
            );
        }

        return { provider, wallet };
    } catch (error) {
        console.error('Blockchain init error:', error);
        return null;
    }
}

/**
 * Submit rumor to blockchain
 */
export async function submitRumorOnChain(contentHash, stakeAmount, ipfsCid) {
    if (!truthTokenContract) {
        return { simulated: true, txHash: `sim_${Date.now()}` };
    }

    try {
        const tx = await truthTokenContract.submitRumor(
            contentHash,
            ethers.parseEther(stakeAmount.toString()),
            ipfsCid
        );
        const receipt = await tx.wait();

        return {
            simulated: false,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            rumorId: receipt.logs[0]?.args?.[0]
        };
    } catch (error) {
        console.error('Submit rumor on-chain error:', error);
        throw error;
    }
}

/**
 * Stake on rumor (verify/dispute)
 */
export async function stakeOnRumorOnChain(rumorId, amount, isSupport) {
    if (!truthTokenContract) {
        return { simulated: true, txHash: `sim_${Date.now()}` };
    }

    try {
        const tx = await truthTokenContract.stakeOnRumor(
            rumorId,
            ethers.parseEther(amount.toString()),
            isSupport
        );
        const receipt = await tx.wait();

        return {
            simulated: false,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber
        };
    } catch (error) {
        console.error('Stake on-chain error:', error);
        throw error;
    }
}

/**
 * Create immutable checkpoint
 */
export async function createCheckpointOnChain(rumorId, stateHash, trustScore, ipfsCid) {
    if (!rumorLedgerContract) {
        return { simulated: true, checkpointId: `sim_cp_${Date.now()}` };
    }

    try {
        const tx = await rumorLedgerContract.createCheckpoint(
            rumorId,
            stateHash,
            trustScore,
            ipfsCid
        );
        const receipt = await tx.wait();

        return {
            simulated: false,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            checkpointId: receipt.logs[0]?.args?.[0]
        };
    } catch (error) {
        console.error('Checkpoint on-chain error:', error);
        throw error;
    }
}

/**
 * Use nullifier (for ZK voting)
 */
export async function useNullifierOnChain(nullifier) {
    if (!rumorLedgerContract) {
        return { simulated: true };
    }

    try {
        // Check if already used
        const isUsed = await rumorLedgerContract.isNullifierUsed(nullifier);
        if (isUsed) {
            throw new Error('Nullifier already used');
        }

        const tx = await rumorLedgerContract.useNullifier(nullifier);
        await tx.wait();

        return { simulated: false, used: true };
    } catch (error) {
        console.error('Use nullifier error:', error);
        throw error;
    }
}

/**
 * Verify checkpoint
 */
export async function verifyCheckpointOnChain(checkpointId, expectedStateHash) {
    if (!rumorLedgerContract) {
        return { simulated: true, valid: true };
    }

    try {
        const valid = await rumorLedgerContract.verifyCheckpoint(checkpointId, expectedStateHash);
        return { simulated: false, valid };
    } catch (error) {
        console.error('Verify checkpoint error:', error);
        throw error;
    }
}

/**
 * Get token balance
 */
export async function getTokenBalance(address) {
    if (!truthTokenContract) {
        return { simulated: true, balance: '100' };
    }

    try {
        const balance = await truthTokenContract.balanceOf(address);
        return {
            simulated: false,
            balance: ethers.formatEther(balance)
        };
    } catch (error) {
        console.error('Get balance error:', error);
        throw error;
    }
}

/**
 * Compute content hash
 */
export function computeContentHash(content) {
    return ethers.keccak256(ethers.toUtf8Bytes(content));
}

/**
 * Compute state hash
 */
export function computeStateHash(data) {
    return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(data)));
}
