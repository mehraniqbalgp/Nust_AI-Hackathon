/**
 * File Upload Routes
 * Handle image/video evidence uploads with IPFS
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query } from '../services/database.js';
import { uploadFileToIPFS, getIPFSUrl } from '../services/ipfs.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'application/pdf'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed: jpg, png, gif, webp, mp4, webm, pdf'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 5 // Max 5 files
    }
});

/**
 * Upload evidence files
 */
router.post('/evidence', authenticate, upload.array('files', 5), async (req, res) => {
    try {
        const { rumorId } = req.body;
        const userId = req.user.userId;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Check rumor exists
        if (rumorId) {
            const rumorResult = await query('SELECT id FROM rumors WHERE id = $1', [rumorId]);
            if (rumorResult.rows.length === 0) {
                return res.status(404).json({ error: 'Rumor not found' });
            }
        }

        const uploadedFiles = [];

        for (const file of req.files) {
            // Generate content hash
            const contentHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

            // Upload to IPFS
            const ipfsResult = await uploadFileToIPFS(file.buffer, file.originalname);

            // Determine evidence type
            let evidenceType = 'documentary';
            if (file.mimetype.startsWith('image/')) {
                evidenceType = 'photo';
            } else if (file.mimetype.startsWith('video/')) {
                evidenceType = 'video';
            }

            // Get evidence weight
            const weights = {
                photo: 0.5,
                video: 0.5,
                documentary: 0.6
            };

            // Save to database if linked to a rumor
            let evidenceId = null;
            if (rumorId) {
                const result = await query(`
                    INSERT INTO evidence (
                        rumor_id, submitter_id, type, description,
                        file_path, file_type, file_size, ipfs_cid, content_hash, weight
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id
                `, [
                    rumorId,
                    userId,
                    evidenceType,
                    file.originalname,
                    getIPFSUrl(ipfsResult.cid),
                    file.mimetype,
                    file.size,
                    ipfsResult.cid,
                    contentHash,
                    weights[evidenceType]
                ]);
                evidenceId = result.rows[0].id;
            }

            uploadedFiles.push({
                evidenceId,
                filename: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                type: evidenceType,
                ipfsCid: ipfsResult.cid,
                url: getIPFSUrl(ipfsResult.cid),
                contentHash
            });
        }

        res.status(201).json({
            files: uploadedFiles,
            message: `${uploadedFiles.length} file(s) uploaded successfully`
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

/**
 * Get IPFS URL for a CID
 */
router.get('/ipfs/:cid', (req, res) => {
    const { cid } = req.params;
    res.json({ url: getIPFSUrl(cid) });
});

export default router;
