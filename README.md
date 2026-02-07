# 🔍 CampusVerify

**Anonymous Campus Rumor Verification System — NUST AI Hackathon 2026**

A real-time platform where students can anonymously submit, verify, and dispute campus rumors using game-theoretic incentives, AI-powered bot detection, and a multi-component trust scoring engine.

🌐 **Live Demo:** [https://nust.retrax.co](https://nust.retrax.co)

---

## 🏆 Hackathon

Built for the **NUST AI Hackathon 2026** — solving the problem of misinformation on university campuses with a decentralized, gamified approach to truth verification.

---

## ✨ Key Features

### 🎯 Trust Score Engine
5-component weighted scoring system:
- **Veracity** — ratio of support vs dispute votes
- **Confidence** — total participation level
- **Temporal Relevance** — freshness of the rumor
- **Source Reliability** — submitter's historical accuracy
- **Network Consensus** — agreement strength among verifiers

### 💰 Token Economy
- Every user starts with **100 tokens**
- Submit a rumor → stake tokens based on confidence level
- Verify/dispute → stake tokens on your vote
- Accurate verifications earn rewards; inaccurate ones lose stake
- Creates real skin-in-the-game incentive for honest participation

### 🤖 AI Bot Detection
Multi-layered anomaly detection system:
- **Temporal clustering** — catches rapid-fire bot voting
- **Velocity spike detection** — flags unnatural activity bursts
- **One-sided voting analysis** — detects coordinated manipulation
- **Behavioral fingerprinting** — tracks action diversity and timing regularity
- Severity levels: Monitor → Warn → Reduce Vote Weight → Block

### 📊 Live Leaderboard
- Real-time user rankings synced across all connected clients
- Shows token balances, verification accuracy, and engagement
- Server-side SQLite database for shared state

### 🔐 Privacy & Security
- Anonymous user identities (no login required)
- Proof-of-Work challenge on app load to prevent scripted access
- Evidence file support (photos, videos, documents)
- Zero-Knowledge Proof circuits for anonymous voting (Circom)

### ⛓️ Smart Contracts
- `TruthToken.sol` — ERC-20 token with staking mechanics
- `RumorLedger.sol` — On-chain rumor checkpoints and nullifiers

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Run Locally

```bash
git clone https://github.com/mehraniqbalgp/Nust_AI-Hackathon.git
cd Nust_AI-Hackathon
npm install
node server/database.server.js
```

The app will be running at **http://localhost:3000**

### Deploy with Cloudflare Tunnel

```bash
# Install cloudflared
# See deployment_guide.md for full setup

cloudflared tunnel run nust-campusverify
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│   │  Feed   │ │ Submit  │ │Dashboard│ │   Leaderboard   │   │
│   └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘   │
│        └───────────┴───────────┴───────────────┘            │
│             Store (LocalStorage + Server Sync)               │
└──────────────────────────┼──────────────────────────────────┘
                           │ REST API + WebSocket
┌──────────────────────────┼──────────────────────────────────┐
│                    Express Backend                            │
│   ┌─────────────────┬──────────────┬──────────────────────┐   │
│   │  Rumors API     │  Users API   │  Leaderboard API     │   │
│   └────────┬────────┴──────┬───────┴──────────┬───────────┘   │
│            └───────────────┴──────────────────┘              │
│                     SQLite Database                           │
│              (rumors, verifications, users)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
├── index.html               # Main SPA entry point
├── index.css                # Full styling (dark/light themes, glassmorphism)
├── js/
│   ├── app.js               # App controller & navigation
│   ├── store.js             # State management (localStorage + server sync)
│   ├── models.js            # Data models (User, Rumor, Evidence, etc.)
│   ├── trustEngine.js       # 5-component trust score algorithm
│   ├── tokenEconomy.js      # Token staking & reward system
│   ├── anomalyDetector.js   # Bot detection & behavioral analysis
│   ├── api.js               # API client
│   └── components/
│       ├── Feed.js           # Rumor feed with filtering
│       ├── SubmitRumor.js    # Multi-step rumor submission
│       ├── VerifyRumor.js    # Verification modal with bot checks
│       ├── RumorCard.js      # Individual rumor display
│       ├── Dashboard.js      # User stats & achievements
│       └── Leaderboard.js    # Live rankings
├── server/
│   ├── database.server.js   # Express + SQLite + WebSocket server
│   ├── middleware/           # Auth, rate limiting, bot detection
│   ├── routes/               # API route handlers
│   └── services/             # Business logic services
├── contracts/
│   ├── TruthToken.sol        # ERC-20 token contract
│   └── RumorLedger.sol       # Rumor checkpoint contract
├── circuits/
│   └── anonymous_vote.circom # ZK circuit for anonymous voting
└── test/                     # API, contract, and E2E tests
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, CSS (Glassmorphism), Single Page App |
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3) |
| Real-time | WebSocket (ws) |
| Deployment | Cloudflare Tunnel |
| Smart Contracts | Solidity, Hardhat |
| ZK Proofs | Circom, snarkjs |

---

## 👥 Team

Built by **Mehran Iqbal** and team at the NUST AI Hackathon 2026.
