/**
 * Captcha Service
 * Puzzle-based captcha as alternative/addition to PoW
 */

import crypto from 'crypto';

// Captcha types
const CAPTCHA_TYPES = {
    MATH: 'math',           // Simple math problem
    SEQUENCE: 'sequence',   // Number sequence completion
    WORD: 'word',           // Word puzzle
    SLIDER: 'slider'        // Slider verification (for frontend)
};

// Challenge storage (in production, use Redis)
const challenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

class CaptchaService {

    /**
     * Generate a captcha challenge
     * @param {string} type - Captcha type
     * @returns {object} - { challengeId, question, type, expiresAt }
     */
    generateChallenge(type = CAPTCHA_TYPES.MATH) {
        const challengeId = crypto.randomUUID();
        const expiresAt = Date.now() + CHALLENGE_TTL_MS;

        let challenge;

        switch (type) {
            case CAPTCHA_TYPES.MATH:
                challenge = this.generateMathChallenge();
                break;
            case CAPTCHA_TYPES.SEQUENCE:
                challenge = this.generateSequenceChallenge();
                break;
            case CAPTCHA_TYPES.WORD:
                challenge = this.generateWordChallenge();
                break;
            case CAPTCHA_TYPES.SLIDER:
                challenge = this.generateSliderChallenge();
                break;
            default:
                challenge = this.generateMathChallenge();
        }

        // Store challenge (don't expose answer to client)
        challenges.set(challengeId, {
            answer: challenge.answer,
            type,
            expiresAt,
            attempts: 0
        });

        // Clean old challenges periodically
        this.cleanExpiredChallenges();

        return {
            challengeId,
            question: challenge.question,
            hint: challenge.hint,
            type,
            expiresAt
        };
    }

    /**
     * Verify a captcha answer
     * @param {string} challengeId 
     * @param {string|number} answer 
     * @returns {object} - { success: boolean, message: string }
     */
    verify(challengeId, answer) {
        const challenge = challenges.get(challengeId);

        if (!challenge) {
            return { success: false, message: 'Challenge not found or expired' };
        }

        if (Date.now() > challenge.expiresAt) {
            challenges.delete(challengeId);
            return { success: false, message: 'Challenge expired' };
        }

        challenge.attempts++;

        if (challenge.attempts > 3) {
            challenges.delete(challengeId);
            return { success: false, message: 'Too many attempts' };
        }

        // Normalize answer for comparison
        const normalizedAnswer = String(answer).toLowerCase().trim();
        const expectedAnswer = String(challenge.answer).toLowerCase().trim();

        if (normalizedAnswer === expectedAnswer) {
            challenges.delete(challengeId);
            return { success: true, message: 'Captcha verified' };
        }

        return {
            success: false,
            message: 'Incorrect answer',
            attemptsRemaining: 3 - challenge.attempts
        };
    }

    /**
     * Generate math problem captcha
     */
    generateMathChallenge() {
        const operations = [
            { op: '+', fn: (a, b) => a + b },
            { op: '-', fn: (a, b) => a - b },
            { op: '×', fn: (a, b) => a * b }
        ];

        const { op, fn } = operations[Math.floor(Math.random() * operations.length)];

        let a, b;
        if (op === '×') {
            a = Math.floor(Math.random() * 10) + 1;
            b = Math.floor(Math.random() * 10) + 1;
        } else if (op === '-') {
            a = Math.floor(Math.random() * 50) + 20;
            b = Math.floor(Math.random() * 20) + 1;
        } else {
            a = Math.floor(Math.random() * 50) + 10;
            b = Math.floor(Math.random() * 50) + 10;
        }

        return {
            question: `What is ${a} ${op} ${b}?`,
            hint: 'Solve the math problem',
            answer: fn(a, b)
        };
    }

    /**
     * Generate number sequence captcha
     */
    generateSequenceChallenge() {
        const sequences = [
            // Arithmetic sequences
            () => {
                const start = Math.floor(Math.random() * 10) + 1;
                const step = Math.floor(Math.random() * 5) + 2;
                const seq = [start, start + step, start + 2 * step, start + 3 * step];
                return {
                    question: `Complete the sequence: ${seq.join(', ')}, ?`,
                    answer: start + 4 * step,
                    hint: 'Find the pattern'
                };
            },
            // Double sequences
            () => {
                const start = Math.floor(Math.random() * 5) + 1;
                const seq = [start, start * 2, start * 4, start * 8];
                return {
                    question: `Complete the sequence: ${seq.join(', ')}, ?`,
                    answer: start * 16,
                    hint: 'Each number doubles'
                };
            },
            // Fibonacci-like
            () => {
                const a = Math.floor(Math.random() * 3) + 1;
                const b = Math.floor(Math.random() * 3) + 2;
                const seq = [a, b, a + b, b + (a + b)];
                return {
                    question: `Complete the sequence: ${seq.join(', ')}, ?`,
                    answer: (a + b) + (b + (a + b)),
                    hint: 'Add the previous two numbers'
                };
            }
        ];

        return sequences[Math.floor(Math.random() * sequences.length)]();
    }

    /**
     * Generate word puzzle captcha
     */
    generateWordChallenge() {
        const puzzles = [
            { question: 'Type the word "verify" backwards', answer: 'yfirev', hint: 'Reverse the letters' },
            { question: 'What is the fifth letter of "CAPTCHA"?', answer: 'h', hint: 'Count carefully' },
            { question: 'Type "campus" without vowels', answer: 'cmps', hint: 'Remove a, e, i, o, u' },
            { question: 'How many letters are in "verification"?', answer: '12', hint: 'Count all letters' },
            { question: 'What word comes after "rumor" in alphabetical order: verify, truth, rumor?', answer: 'truth', hint: 'r, t, v...' },
            { question: 'Type the first and last letter of "BLOCKCHAIN"', answer: 'bn', hint: 'B...N' }
        ];

        return puzzles[Math.floor(Math.random() * puzzles.length)];
    }

    /**
     * Generate slider challenge (frontend handles the actual slider)
     */
    generateSliderChallenge() {
        const targetPosition = Math.floor(Math.random() * 80) + 10; // 10-90%
        const tolerance = 5; // ±5%

        return {
            question: 'Slide to the target position',
            hint: `Position: ${targetPosition}%`,
            answer: targetPosition,
            tolerance
        };
    }

    /**
     * Clean expired challenges
     */
    cleanExpiredChallenges() {
        const now = Date.now();
        for (const [id, challenge] of challenges.entries()) {
            if (now > challenge.expiresAt) {
                challenges.delete(id);
            }
        }
    }

    /**
     * Get active challenge count (for monitoring)
     */
    getActiveCount() {
        this.cleanExpiredChallenges();
        return challenges.size;
    }
}

export default new CaptchaService();
export { CAPTCHA_TYPES };
