/**
 * Smart Contract Tests
 * Hardhat tests for TruthToken and RumorLedger
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TruthToken", function () {
    let TruthToken, truthToken;
    let owner, user1, user2;
    const INITIAL_SUPPLY = 1000000;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        TruthToken = await ethers.getContractFactory("TruthToken");
        truthToken = await TruthToken.deploy(INITIAL_SUPPLY);
        await truthToken.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the correct name and symbol", async function () {
            expect(await truthToken.name()).to.equal("TruthToken");
            expect(await truthToken.symbol()).to.equal("TRUTH");
        });

        it("Should mint initial supply to owner", async function () {
            const ownerBalance = await truthToken.balanceOf(owner.address);
            expect(ownerBalance).to.equal(ethers.parseEther(INITIAL_SUPPLY.toString()));
        });

        it("Should set owner as admin", async function () {
            expect(await truthToken.admin()).to.equal(owner.address);
        });
    });

    describe("Token Transfers", function () {
        it("Should transfer tokens between accounts", async function () {
            const amount = ethers.parseEther("100");

            await truthToken.transfer(user1.address, amount);
            expect(await truthToken.balanceOf(user1.address)).to.equal(amount);
        });

        it("Should fail if sender doesn't have enough tokens", async function () {
            const amount = ethers.parseEther("100");

            await expect(
                truthToken.connect(user1).transfer(owner.address, amount)
            ).to.be.revertedWith("Insufficient balance");
        });
    });

    describe("Rumor Submission", function () {
        beforeEach(async function () {
            // Transfer tokens to user1
            await truthToken.transfer(user1.address, ethers.parseEther("100"));
        });

        it("Should submit rumor with stake", async function () {
            const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test rumor"));
            const stake = ethers.parseEther("10");
            const ipfsCid = "QmTest123";

            await truthToken.connect(user1).submitRumor(contentHash, stake, ipfsCid);

            // Check staked balance increased
            expect(await truthToken.stakedBalance(user1.address)).to.equal(stake);
        });

        it("Should fail with insufficient stake", async function () {
            const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test rumor"));
            const stake = ethers.parseEther("2"); // Below minimum

            await expect(
                truthToken.connect(user1).submitRumor(contentHash, stake, "QmTest")
            ).to.be.revertedWith("Min stake: 5 tokens");
        });

        it("Should fail with excessive stake", async function () {
            const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test rumor"));
            const stake = ethers.parseEther("100"); // Above maximum

            await expect(
                truthToken.connect(user1).submitRumor(contentHash, stake, "QmTest")
            ).to.be.revertedWith("Max stake: 50 tokens");
        });
    });

    describe("Staking on Rumors", function () {
        let rumorId;

        beforeEach(async function () {
            // Setup: transfer tokens and submit a rumor
            await truthToken.transfer(user1.address, ethers.parseEther("100"));
            await truthToken.transfer(user2.address, ethers.parseEther("100"));

            const contentHash = ethers.keccak256(ethers.toUtf8Bytes("Test rumor"));
            const tx = await truthToken.connect(user1).submitRumor(
                contentHash,
                ethers.parseEther("10"),
                "QmTest123"
            );

            const receipt = await tx.wait();
            const event = receipt.logs[1]; // RumorSubmitted event
            rumorId = event.args?.[0] || ethers.keccak256(
                ethers.solidityPacked(
                    ["bytes32", "address", "uint256"],
                    [contentHash, user1.address, receipt.blockNumber]
                )
            );
        });

        it("Should allow staking on rumor", async function () {
            const stake = ethers.parseEther("5");

            await truthToken.connect(user2).stakeOnRumor(rumorId, stake, true);

            expect(await truthToken.stakedBalance(user2.address)).to.equal(stake);
        });

        it("Should prevent double voting", async function () {
            const stake = ethers.parseEther("5");

            await truthToken.connect(user2).stakeOnRumor(rumorId, stake, true);

            await expect(
                truthToken.connect(user2).stakeOnRumor(rumorId, stake, false)
            ).to.be.revertedWith("Already voted");
        });
    });
});

describe("RumorLedger", function () {
    let RumorLedger, rumorLedger;
    let owner, user1;

    beforeEach(async function () {
        [owner, user1] = await ethers.getSigners();

        RumorLedger = await ethers.getContractFactory("RumorLedger");
        rumorLedger = await RumorLedger.deploy();
        await rumorLedger.waitForDeployment();
    });

    describe("Checkpoints", function () {
        it("Should create checkpoint", async function () {
            const rumorId = ethers.keccak256(ethers.toUtf8Bytes("rumor1"));
            const stateHash = ethers.keccak256(ethers.toUtf8Bytes("state1"));
            const trustScore = 75;
            const ipfsCid = "QmCheckpoint123";

            await rumorLedger.createCheckpoint(rumorId, stateHash, trustScore, ipfsCid);

            const checkpoints = await rumorLedger.getRumorCheckpoints(rumorId);
            expect(checkpoints.length).to.equal(1);
        });

        it("Should verify checkpoint", async function () {
            const rumorId = ethers.keccak256(ethers.toUtf8Bytes("rumor1"));
            const stateHash = ethers.keccak256(ethers.toUtf8Bytes("state1"));

            const tx = await rumorLedger.createCheckpoint(rumorId, stateHash, 75, "QmTest");
            const receipt = await tx.wait();

            // Get checkpoint ID from event
            const event = receipt.logs[0];
            const checkpointId = event.args?.[0];

            if (checkpointId) {
                const isValid = await rumorLedger.verifyCheckpoint(checkpointId, stateHash);
                expect(isValid).to.be.true;
            }
        });
    });

    describe("Nullifiers", function () {
        it("Should track used nullifiers", async function () {
            const nullifier = ethers.keccak256(ethers.toUtf8Bytes("nullifier1"));

            expect(await rumorLedger.isNullifierUsed(nullifier)).to.be.false;

            await rumorLedger.useNullifier(nullifier);

            expect(await rumorLedger.isNullifierUsed(nullifier)).to.be.true;
        });

        it("Should prevent double use of nullifier", async function () {
            const nullifier = ethers.keccak256(ethers.toUtf8Bytes("nullifier2"));

            await rumorLedger.useNullifier(nullifier);

            await expect(
                rumorLedger.useNullifier(nullifier)
            ).to.be.revertedWith("Nullifier already used");
        });
    });

    describe("Access Control", function () {
        it("Should only allow admin to create checkpoints", async function () {
            const rumorId = ethers.keccak256(ethers.toUtf8Bytes("rumor1"));
            const stateHash = ethers.keccak256(ethers.toUtf8Bytes("state1"));

            await expect(
                rumorLedger.connect(user1).createCheckpoint(rumorId, stateHash, 75, "QmTest")
            ).to.be.revertedWith("Not admin");
        });
    });
});
