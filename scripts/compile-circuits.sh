#!/bin/bash

# ============================================
# ZK Circuit Compilation Script
# Compiles Circom circuits and generates proving keys
# ============================================

set -e

CIRCUIT_NAME="anonymous_vote"
CIRCUITS_DIR="./circuits"
BUILD_DIR="./circuits/build"
POWERS_OF_TAU="powersOfTau28_hez_final_14.ptau"

echo "═══════════════════════════════════════════════"
echo "  ZK Circuit Compilation"
echo "═══════════════════════════════════════════════"
echo ""

# Check dependencies
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed"
        echo "   Install with: $2"
        exit 1
    else
        echo "✅ $1 found"
    fi
}

echo "📋 Checking dependencies..."
check_command "circom" "npm install -g circom"
check_command "snarkjs" "npm install -g snarkjs"
echo ""

# Create build directory
mkdir -p $BUILD_DIR
cd $CIRCUITS_DIR

# Download powers of tau if not exists
if [ ! -f "$POWERS_OF_TAU" ]; then
    echo "📥 Downloading Powers of Tau..."
    curl -L -o $POWERS_OF_TAU \
        "https://hermez.s3-eu-west-1.amazonaws.com/$POWERS_OF_TAU"
    echo ""
fi

# Compile circuit
echo "🔧 Compiling circuit..."
circom ${CIRCUIT_NAME}.circom \
    --r1cs \
    --wasm \
    --sym \
    -o build

echo "✅ Circuit compiled"
echo "   Constraints: $(snarkjs r1cs info build/${CIRCUIT_NAME}.r1cs | grep 'Constraints' | awk '{print $2}')"
echo ""

# Generate proving key (Phase 2)
echo "🔑 Generating proving key..."

# Setup ceremony
snarkjs groth16 setup \
    build/${CIRCUIT_NAME}.r1cs \
    $POWERS_OF_TAU \
    build/${CIRCUIT_NAME}_0000.zkey

# Contribute to ceremony (in production, multiple parties should contribute)
echo "random_entropy_$(date +%s)" | snarkjs zkey contribute \
    build/${CIRCUIT_NAME}_0000.zkey \
    build/${CIRCUIT_NAME}_final.zkey \
    --name="CampusVerify Contribution" \
    -v

# Export verification key
snarkjs zkey export verificationkey \
    build/${CIRCUIT_NAME}_final.zkey \
    build/verification_key.json

echo "✅ Proving key generated"
echo ""

# Generate Solidity verifier (optional)
echo "📄 Generating Solidity verifier..."
snarkjs zkey export solidityverifier \
    build/${CIRCUIT_NAME}_final.zkey \
    build/Verifier.sol

echo "✅ Solidity verifier generated"
echo ""

# Copy files to expected locations
cp build/${CIRCUIT_NAME}_final.zkey ../${CIRCUIT_NAME}.zkey
cp build/verification_key.json ../verification_key.json
cp build/Verifier.sol ../contracts/ZKVerifier.sol 2>/dev/null || true

# Summary
echo "═══════════════════════════════════════════════"
echo "  Compilation Complete!"
echo "═══════════════════════════════════════════════"
echo ""
echo "Generated files:"
echo "  - circuits/build/${CIRCUIT_NAME}_js/   (WASM)"
echo "  - circuits/${CIRCUIT_NAME}.zkey        (Proving key)"
echo "  - circuits/verification_key.json       (Verification key)"
echo "  - contracts/ZKVerifier.sol             (Solidity verifier)"
echo ""
echo "To generate a proof:"
echo "  cd circuits/build/${CIRCUIT_NAME}_js"
echo "  node generate_witness.js ${CIRCUIT_NAME}.wasm input.json witness.wtns"
echo "  snarkjs groth16 prove ../${CIRCUIT_NAME}_final.zkey witness.wtns proof.json public.json"
echo ""
