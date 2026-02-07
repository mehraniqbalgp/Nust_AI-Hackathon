# 🔍 CampusVerify

**Anonymous Campus Rumor Verification System with Blockchain & Zero-Knowledge Proofs**

A decentralized platform for verifying campus rumors using game-theoretic incentives, token staking, and privacy-preserving credentials.

---

## ✨ Features

- **🎯 Trust Score Algorithm** - 5-component weighted scoring (Veracity, Confidence, Temporal, Source, Consensus)
- **💰 Token Economy** - Stake tokens on submissions and verifications, earn rewards for accuracy
- **🔐 Zero-Knowledge Proofs** - Anonymous voting without revealing identity
- **⛓️ Blockchain Anchoring** - Immutable checkpoints on Polygon
- **📁 IPFS Storage** - Decentralized evidence storage
- **🤖 Sybil Resistance** - Proof-of-Work challenge + behavioral analysis
- **🌙 Dark/Light Theme** - Clean glassmorphism UI

---

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repo>
cd campus-verify
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Database (Docker)

```bash
npm run docker:up        # Start PostgreSQL + Redis
npm run db:migrate       # Run migrations
```

### 4. Run Development Server

```bash
npm run dev              # Backend on :3000
npm run dev:frontend     # Frontend on :8080 (optional)
```

---

## 📦 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start backend with hot reload |
| `npm run dev:frontend` | Serve frontend on port 8080 |
| `npm run docker:up` | Start PostgreSQL + Redis containers |
| `npm run db:migrate` | Run database migrations |
| `npm run db:reset` | Reset and re-run all migrations |
| `npm run contracts:compile` | Compile Solidity contracts |
| `npm run contracts:test` | Run contract unit tests |
| `npm run contracts:deploy:mumbai` | Deploy to Polygon Mumbai |
| `npm run zk:compile` | Compile ZK circuits |
| `npm run test` | Run API integration tests |
| `npm run test:e2e` | Run Playwright browser tests |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│   │  Feed   │ │ Submit  │ │Dashboard│ │   Leaderboard   │   │
│   └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘   │
│        └───────────┴───────────┴───────────────┘            │
│                          │ API Client                        │
└──────────────────────────┼──────────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────┼──────────────────────────────────┐
│                       Backend                                │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│   │  Auth   │ │ Rumors  │ │ Verify  │ │     Upload      │   │
│   └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘   │
│        └───────────┴───────────┴───────────────┘            │
│                          │                                   │
│   ┌──────────────────────┴──────────────────────────────┐   │
│   │ PostgreSQL │    Redis    │   IPFS   │  Blockchain   │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Testing

```bash
# API Integration Tests
npm run test

# Smart Contract Tests
npm run test:contracts

# E2E Browser Tests
npm run test:e2e

# Run All Tests
npm run test:all
```

---

## 🔗 Smart Contracts

| Contract | Description | Network |
|----------|-------------|---------|
| `TruthToken` | ERC-20 with staking/rewards | Polygon Mumbai |
| `RumorLedger` | Checkpoints + nullifiers | Polygon Mumbai |

### Deploy Contracts

```bash
# Start local node
npm run contracts:node

# Deploy locally
npm run contracts:deploy:local

# Deploy to Mumbai testnet
npm run contracts:deploy:mumbai
```

---

## 🔐 Zero-Knowledge Proofs

The `anonymous_vote.circom` circuit enables:
- Merkle tree membership proof
- Nullifier-based double-vote prevention
- Identity never revealed on-chain

### Compile Circuits

```bash
npm run zk:compile
```

Requires: `circom` and `snarkjs` installed globally.

---

## 🐳 Docker

```bash
# Start dependencies only
docker compose up -d postgres redis

# Start everything (including app)
docker compose --profile full up -d

# View logs
docker compose logs -f

# Stop all
docker compose down
```

---

## 📁 Project Structure

```
├── contracts/           # Solidity smart contracts
├── circuits/            # Circom ZK circuits
├── server/              # Express backend
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── middleware/      # Express middleware
│   └── migrations/      # SQL migrations
├── js/                  # Frontend JavaScript
│   └── components/      # UI components
├── test/                # Tests
│   ├── api.test.js      # API integration tests
│   ├── contracts/       # Contract unit tests
│   └── e2e/             # Browser E2E tests
├── scripts/             # Deployment scripts
├── index.html           # Frontend entry
└── index.css            # Styles
```

---

## 📄 License

MIT

---

## 🤝 Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request
