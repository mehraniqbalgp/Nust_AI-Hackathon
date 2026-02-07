/**
 * IPFS Service
 * Decentralized storage using Pinata
 */

import { create } from 'ipfs-http-client';
import crypto from 'crypto';

let ipfsClient = null;

/**
 * Initialize IPFS client (Pinata)
 */
export function initIPFS() {
    if (process.env.IPFS_API_KEY && process.env.IPFS_API_SECRET) {
        const auth = 'Basic ' + Buffer.from(
            process.env.IPFS_API_KEY + ':' + process.env.IPFS_API_SECRET
        ).toString('base64');

        ipfsClient = create({
            host: 'api.pinata.cloud',
            port: 443,
            protocol: 'https',
            headers: {
                authorization: auth
            }
        });
    }
    return ipfsClient;
}

/**
 * Upload content to IPFS
 */
export async function uploadToIPFS(content, options = {}) {
    if (!ipfsClient) {
        // Fallback: return hash without actual upload
        const hash = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
        return {
            cid: `Qm${hash.substring(0, 44)}`, // Simulated CID
            simulated: true
        };
    }

    try {
        const data = typeof content === 'string' ? content : JSON.stringify(content);
        const result = await ipfsClient.add(data, {
            pin: true,
            ...options
        });

        return {
            cid: result.path,
            size: result.size,
            simulated: false
        };
    } catch (error) {
        console.error('IPFS upload error:', error);
        throw error;
    }
}

/**
 * Upload file buffer to IPFS
 */
export async function uploadFileToIPFS(buffer, filename) {
    if (!ipfsClient) {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        return {
            cid: `Qm${hash.substring(0, 44)}`,
            simulated: true
        };
    }

    try {
        const result = await ipfsClient.add({
            path: filename,
            content: buffer
        }, {
            pin: true
        });

        return {
            cid: result.path,
            size: result.size,
            simulated: false
        };
    } catch (error) {
        console.error('IPFS file upload error:', error);
        throw error;
    }
}

/**
 * Get content from IPFS
 */
export async function getFromIPFS(cid) {
    if (!ipfsClient) {
        return null; // Cannot fetch without client
    }

    try {
        const chunks = [];
        for await (const chunk of ipfsClient.cat(cid)) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    } catch (error) {
        console.error('IPFS fetch error:', error);
        throw error;
    }
}

/**
 * Get IPFS gateway URL
 */
export function getIPFSUrl(cid) {
    const gateway = process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
    return `${gateway}${cid}`;
}

/**
 * Pin content for permanence
 */
export async function pinContent(cid) {
    if (!ipfsClient) return { simulated: true };

    try {
        await ipfsClient.pin.add(cid);
        return { pinned: true, cid };
    } catch (error) {
        console.error('IPFS pin error:', error);
        throw error;
    }
}

/**
 * Create immutable checkpoint
 */
export async function createCheckpoint(rumorId, trustScore, votes) {
    const checkpoint = {
        rumorId,
        trustScore,
        votes,
        timestamp: Date.now(),
        version: '1.0'
    };

    // Hash for verification
    const contentHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(checkpoint))
        .digest('hex');

    checkpoint.hash = contentHash;

    // Upload to IPFS
    const result = await uploadToIPFS(checkpoint);

    return {
        ...result,
        checkpoint,
        contentHash
    };
}
