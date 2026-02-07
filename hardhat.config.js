require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.19",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },

    networks: {
        // Local development
        hardhat: {
            chainId: 31337
        },

        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 31337
        },

        // Polygon Mumbai Testnet
        mumbai: {
            url: process.env.RPC_URL || "https://rpc-mumbai.maticvigil.com",
            chainId: 80001,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            gasPrice: 35000000000 // 35 gwei
        },

        // Polygon Mainnet
        polygon: {
            url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
            chainId: 137,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            gasPrice: 50000000000 // 50 gwei
        },

        // Sepolia Testnet
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
            chainId: 11155111,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
        }
    },

    etherscan: {
        apiKey: {
            polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
            polygon: process.env.POLYGONSCAN_API_KEY || "",
            sepolia: process.env.ETHERSCAN_API_KEY || ""
        }
    },

    paths: {
        sources: "./contracts",
        tests: "./test/contracts",
        cache: "./cache",
        artifacts: "./artifacts"
    },

    gasReporter: {
        enabled: process.env.REPORT_GAS === "true",
        currency: "USD",
        coinmarketcap: process.env.COINMARKETCAP_API_KEY
    }
};
