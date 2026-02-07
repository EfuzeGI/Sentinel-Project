/**
 * NEAR Contract Configuration
 * 
 * Configure these values in .env.local
 */

// Network configuration
export const NETWORK_ID = process.env.NEXT_PUBLIC_NETWORK_ID || "testnet";

// Contract ID - from env
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "sentinel-demo-2026.testnet";

// RPC URL - strictly from env with fallback
export const NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || "https://testnet.rpc.fastnear.com";

export const WALLET_URL = NETWORK_ID === "mainnet"
    ? "https://wallet.near.org"
    : "https://wallet.testnet.near.org";

export const HELPER_URL = NETWORK_ID === "mainnet"
    ? "https://helper.mainnet.near.org"
    : "https://helper.testnet.near.org";

export const EXPLORER_URL = NETWORK_ID === "mainnet"
    ? "https://explorer.near.org"
    : "https://explorer.testnet.near.org";

// Time constants (in milliseconds)
export const TIME_CONSTANTS = {
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000,
    MONTH: 30 * 24 * 60 * 60 * 1000,
};

// Default heartbeat interval (30 days)
export const DEFAULT_HEARTBEAT_INTERVAL = TIME_CONSTANTS.MONTH;

// NEAR denomination
export const YOCTO_NEAR = "1000000000000000000000000"; // 10^24

// Storage deposit for contracts
export const STORAGE_DEPOSIT = "0.1"; // NEAR

// Gas limits
export const GAS_LIMIT = {
    DEFAULT: "30000000000000", // 30 TGas
    HIGH: "100000000000000", // 100 TGas
};
