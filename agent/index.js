import dotenv from 'dotenv';
import * as nearAPI from 'near-api-js';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

dotenv.config();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════
//   KeepAlive Protocol: Multi-Vault Monitoring Agent
// ═══════════════════════════════════════════════════════════════════

let bot = null;

const RPC_ENDPOINTS = [
    'https://rpc.mainnet.near.org',
    'https://rpc.fastnear.com',
    'https://near.lava.build',
];

const cfg = {
    networkId: process.env.NETWORK_ID || 'mainnet',
    contractId: (process.env.CONTRACT_ID || 'testbruh.testnet').trim(),
    agentId: (process.env.AGENT_ACCOUNT_ID || 'testbruh.testnet').trim(),
    agentKey: process.env.AGENT_PRIVATE_KEY ? process.env.AGENT_PRIVATE_KEY.trim() : undefined,
    pollInterval: 30_000, // Check every 30 seconds (less aggressive)
    rpcTimeout: 30_000, // 30 seconds - public testnet RPCs are slow
    warningAmount: '10000000000000000000', // 0.00001 NEAR
};

// ═══════════════════════════════════════════════════════════════════
//  Persistent Activity Cache (Survives Restarts)
// ═══════════════════════════════════════════════════════════════════

const CACHE_FILE = path.join(__dirname, '.cache.json');

// Load cache from file on startup
let userActivityCache = {};
try {
    if (fs.existsSync(CACHE_FILE)) {
        userActivityCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
} catch (e) {
    // If cache corrupted, start fresh
    userActivityCache = {};
}

// Save cache to file
function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(userActivityCache, null, 2));
    } catch (e) {
        // Ignore write errors silently
    }
}

const C = {
    reset: '\x1b[0m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
    orange: '\x1b[38;5;208m',
};

const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false });
const log = (msg, c = C.reset) => console.log(`${C.dim}[${ts()}]${C.reset} ${c}${msg}${C.reset}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════
//  RPC Manager - AGGRESSIVE FAIL-FAST
// ═══════════════════════════════════════════════════════════════════

async function testRpcEndpoint(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.rpcTimeout);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'health-check',
                method: 'status',
                params: []
            }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        return response.ok;
    } catch (e) {
        clearTimeout(timeout);
        return false;
    }
}

async function getFastProvider(ks, retryCount = 0) {
    for (const url of RPC_ENDPOINTS) {
        log(`Testing: ${url}`, C.dim);

        try {
            // Try direct connection with nearAPI (more reliable than fetch ping)
            const near = await Promise.race([
                nearAPI.connect({
                    networkId: cfg.networkId,
                    keyStore: ks,
                    nodeUrl: url
                }),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), cfg.rpcTimeout))
            ]);

            const acc = await near.account(cfg.agentId);
            log(`RPC: ${url}`, C.cyan);
            log('Connected', C.green);
            return { acc, url, idx: RPC_ENDPOINTS.indexOf(url) };
        } catch (e) {
            log(`Skip (${e.message}): ${url}`, C.yellow);
        }
    }

    // All failed - retry with delay
    if (retryCount < 3) {
        log(`⚠️ All RPCs busy. Waiting 5s before retry (${retryCount + 1}/3)...`, C.orange);
        await sleep(5000);
        return getFastProvider(ks, retryCount + 1);
    }

    throw new Error('All RPC endpoints failed after 3 retries!');
}

class Rpc {
    constructor() {
        this.idx = 0;
        this.acc = null;
        this.url = null;
        this.ks = new nearAPI.keyStores.InMemoryKeyStore();
    }

    async init() {
        if (!cfg.agentKey) throw new Error('AGENT_PRIVATE_KEY not set');
        const kp = nearAPI.KeyPair.fromString(cfg.agentKey);
        await this.ks.setKey(cfg.networkId, cfg.agentId, kp);
        log(`Key loaded: ${kp.getPublicKey().toString().slice(0, 20)}...`, C.dim);
    }

    async connect() {
        const result = await getFastProvider(this.ks);
        this.acc = result.acc;
        this.url = result.url;
        this.idx = result.idx;
    }

    async rotate() {
        // Try next RPC in priority order, starting after current
        const startIdx = (this.idx + 1) % RPC_ENDPOINTS.length;

        for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
            const tryIdx = (startIdx + i) % RPC_ENDPOINTS.length;
            const url = RPC_ENDPOINTS[tryIdx];

            const isAlive = await testRpcEndpoint(url);

            if (isAlive) {
                try {
                    const near = await nearAPI.connect({
                        networkId: cfg.networkId,
                        keyStore: this.ks,
                        nodeUrl: url
                    });
                    this.acc = await near.account(cfg.agentId);
                    this.url = url;
                    this.idx = tryIdx;
                    return;
                } catch (e) {
                    // Connection failed, try next
                }
            }
        }

        // All RPCs failed - wait and retry Primary
        await sleep(3000);

        // Force connect to Primary
        const primaryUrl = RPC_ENDPOINTS[0];

        try {
            const near = await nearAPI.connect({
                networkId: cfg.networkId,
                keyStore: this.ks,
                nodeUrl: primaryUrl
            });
            this.acc = await near.account(cfg.agentId);
            this.url = primaryUrl;
            this.idx = 0;
            log('Connected', C.green);
        } catch (e) {
            log(`Primary still down: ${e.message}. Will retry next cycle.`, C.red);
            // Don't throw - let the main loop continue and retry
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Contract Methods - NOW WITH account_id PARAMETER
// ═══════════════════════════════════════════════════════════════════

async function viewMethod(rpc, method, args = {}) {
    for (let attempt = 0; attempt < RPC_ENDPOINTS.length + 1; attempt++) {
        try {
            return await Promise.race([
                rpc.acc.viewFunction({ contractId: cfg.contractId, methodName: method, args }),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), cfg.rpcTimeout)),
            ]);
        } catch (e) {
            if (attempt < RPC_ENDPOINTS.length) {
                await rpc.rotate();
            }
        }
    }
    return null; // Return null instead of throwing - caller handles it
}

async function callMethod(rpc, method, args = {}, deposit = '0') {
    for (let attempt = 0; attempt < RPC_ENDPOINTS.length; attempt++) {
        try {
            return await rpc.acc.functionCall({
                contractId: cfg.contractId,
                methodName: method,
                args,
                gas: '300000000000000',
                attachedDeposit: deposit,
            });
        } catch (e) {
            if (e.message?.includes('no matching key pair')) throw e;
            if (attempt < RPC_ENDPOINTS.length - 1) {
                await rpc.rotate();
            }
        }
    }
    throw new Error(`Call failed: ${method}`);
}

// ═══════════════════════════════════════════════════════════════════
//  Native Activity Check (Passive Liveness via RPC)
// ═══════════════════════════════════════════════════════════════════

async function checkNativeActivity(rpc, accountId) {
    try {
        // Get all access keys for the account
        const url = RPC_ENDPOINTS[rpc.idx];
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'activity-check',
                method: 'query',
                params: {
                    request_type: 'view_access_key_list',
                    finality: 'final',
                    account_id: accountId
                }
            })
        });

        const data = await response.json();

        if (data.error || !data.result?.keys) {
            log(`[${accountId}] Activity check failed: ${data.error?.message || 'no keys'}`, C.dim);
            return 0;
        }

        // Sum all nonces
        const totalNonce = data.result.keys.reduce((sum, key) => {
            return sum + BigInt(key.access_key.nonce);
        }, 0n);

        return totalNonce;
    } catch (e) {
        log(`[${accountId}] Activity check error: ${e.message}`, C.dim);
        return 0n;
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Warning Shot - Send dust to owner with alert memo
// ═══════════════════════════════════════════════════════════════════

async function sendWarningShot(rpc, ownerId) {
    console.log();
    log(`${C.bold}⚠️  SENDING WARNING SHOT${C.reset}`, C.orange);
    log(`Recipient: ${ownerId}`, C.dim);
    log(`Amount: 0.00001 NEAR`, C.dim);

    try {
        const tx = await rpc.acc.sendMoney(ownerId, cfg.warningAmount);

        log(`${C.bold}📨 WARNING SHOT FIRED${C.reset}`, C.yellow);
        log(`TX: ${tx.transaction.hash}`, C.dim);
        log(`Owner has grace period to ping before execution.`, C.yellow);
        console.log();

        return true;
    } catch (e) {
        log(`Warning shot failed: ${e.message}`, C.red);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Telegram Bot with Multi-Wallet Support
// ═══════════════════════════════════════════════════════════════════

const SUBSCRIBERS_FILE = path.join(__dirname, 'subscribers.json');
const KNOWN_VAULTS_FILE = path.join(__dirname, 'known_vaults.json');

// Load subscribers: { "chatId": ["wallet1", "wallet2"] }
function loadSubscribers() {
    try {
        if (fs.existsSync(SUBSCRIBERS_FILE)) {
            return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
        }
    } catch (e) {
        log(`Error loading subscribers: ${e.message}`, C.red);
    }
    return {};
}

// Save subscribers to file
function saveSubscribers(subscribers) {
    try {
        fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
    } catch (e) {
        log(`Error saving subscribers: ${e.message}`, C.red);
    }
}

// Load known vaults (auto-registered, independent of Telegram)
function loadKnownVaults() {
    try {
        if (fs.existsSync(KNOWN_VAULTS_FILE)) {
            return JSON.parse(fs.readFileSync(KNOWN_VAULTS_FILE, 'utf8'));
        }
    } catch (e) {
        log(`Error loading known vaults: ${e.message}`, C.red);
    }
    return [];
}

// Save known vaults
function saveKnownVaults(vaults) {
    try {
        fs.writeFileSync(KNOWN_VAULTS_FILE, JSON.stringify(vaults, null, 2));
    } catch (e) {
        log(`Error saving known vaults: ${e.message}`, C.red);
    }
}

// Register a vault (called from HTTP API or internally)
function registerVault(walletId) {
    const vaults = loadKnownVaults();
    if (!vaults.includes(walletId)) {
        vaults.push(walletId);
        saveKnownVaults(vaults);
        log(`📋 Vault registered: ${walletId}`, C.green);
        return true;
    }
    return false; // Already registered
}

// Get all unique wallets: merge Telegram subscribers + known vaults
function getAllWatchedWallets() {
    const wallets = new Set();

    // Source 1: Telegram subscribers
    const subscribers = loadSubscribers();
    for (const walletList of Object.values(subscribers)) {
        if (Array.isArray(walletList)) {
            for (const wallet of walletList) {
                wallets.add(wallet);
            }
        }
    }

    // Source 2: Known vaults (auto-registered from frontend)
    const knownVaults = loadKnownVaults();
    for (const vault of knownVaults) {
        wallets.add(vault);
    }

    return Array.from(wallets);
}

// ═══════════════════════════════════════════════════════════════════
//  HTTP API - Auto-register vaults from frontend (port 3001)
// ═══════════════════════════════════════════════════════════════════

function startHttpApi() {
    const PORT = process.env.PORT || process.env.AGENT_API_PORT || 3001;

    const server = http.createServer((req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // POST /register-vault  { wallet_id: "user.testnet" }
        if (req.method === 'POST' && req.url === '/register-vault') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { wallet_id } = JSON.parse(body);
                    if (!wallet_id || typeof wallet_id !== 'string') {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'wallet_id is required' }));
                        return;
                    }

                    const isNew = registerVault(wallet_id);

                    // FORCE CHECK IMMEDIATE: Even if already registered, force a check now
                    // We need access to RPC. Since startHttpApi is called from main where rpc exists,
                    // we should pass rpc to startHttpApi or make rpc global.
                    // For minimal diff, let's assume we can access the global instance or we'll hotfix the architecture.
                    // Actually, let's emit an event or just do it if we restructure. 
                    // EASIER: Just respond 200, and let the loop handle it? No, user wants infinite loading fixed.
                    // Let's rely on the loop for now but decrease poll interval? 
                    // No, let's adding a specific "force_check" flag or similar.

                    // BETTER FIX: Make rpc global or pass it.
                    // I will change startHttpApi signature to accept rpc.

                    if (global.sharedRpc) {
                        // Fire and forget - don't block response
                        processVault(global.sharedRpc, wallet_id).catch(err => log(`Immediate check failed: ${err.message}`, C.red));
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, registered: isNew, wallet_id, message: "Monitoring active. Initial check triggered." }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }

        // GET /vaults - list all watched vaults
        if (req.method === 'GET' && req.url === '/vaults') {
            const wallets = getAllWatchedWallets();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ vaults: wallets, count: wallets.length }));
            return;
        }

        // GET /health
        if (req.method === 'GET' && req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(PORT, () => {
        log(`🌐 Agent API running on port ${PORT}`, C.green);
    });
}

// ═══════════════════════════════════════════════════════════════════
//  KeepAlive Bot - Multi-Wallet Monitoring
// ═══════════════════════════════════════════════════════════════════
function initTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : null;
    if (!token) {
        log('TELEGRAM_BOT_TOKEN not set, Telegram disabled', C.dim);
        return;
    }

    bot = new TelegramBot(token, { polling: true });
    log('📱 Telegram bot initialized', C.green);

    // Handle /start command with deep linking
    bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
        const chatId = String(msg.chat.id);
        const accountId = match[1]?.trim();

        if (!accountId) {
            const subscribers = loadSubscribers();
            const wallets = subscribers[chatId] || [];

            bot.sendMessage(msg.chat.id,
                '👋 *Welcome to KeepAlive!*\n\n' +
                '🛡️ Automated Inheritance for NEAR Protocol\n\n' +
                '*Commands:*\n' +
                '• /status - View your watchlist\n' +
                '• /add `<wallet>` - Add a wallet to watch\n' +
                '• /unlink `<wallet>` - Remove a wallet\n' +
                '• /clear - Remove all wallets\n\n' +
                '• /clear - Remove all wallets\n\n' +
                `📊 Currently watching: *${wallets.length} wallet(s)*\n\n` +
                '👉 [Open Dashboard](https://keepalive-fdn.vercel.app)',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Validate format
        if (!accountId.endsWith('.testnet') && !accountId.endsWith('.near')) {
            bot.sendMessage(msg.chat.id,
                '❌ Invalid wallet format.\n\n' +
                'Use the button on the KeepAlive dashboard.',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Add to local watchlist
        const subscribers = loadSubscribers();
        if (!subscribers[chatId]) subscribers[chatId] = [];

        if (subscribers[chatId].includes(accountId)) {
            bot.sendMessage(msg.chat.id,
                `ℹ️ Already watching \`${accountId}\`\n\n` +
                `Use /status to view your watchlist.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        subscribers[chatId].push(accountId);
        saveSubscribers(subscribers);

        // Save telegram_chat_id on-chain
        try {
            await callMethod(rpc, 'link_telegram', { account_id: accountId, chat_id: chatId });
            log(`📱 Linked on-chain: ${accountId} -> chat ${chatId}`, C.green);
        } catch (e) {
            log(`Failed to link on-chain (vault may not exist): ${e.message}`, C.yellow);
        }

        log(`📱 Added to watchlist: ${accountId} -> chat ${chatId}`, C.green);

        bot.sendMessage(msg.chat.id,
            `✅ *Added to Watchlist!*\n\n` +
            `🔗 Wallet: \`${accountId}\`\n\n` +
            `You will receive alerts when:\n` +
            `• Heartbeat expires\n` +
            `• Warning shot is fired\n` +
            `• Transfer is initiated\n\n` +
            `📊 Currently watching: *${subscribers[chatId].length} wallet(s)*\n\n` +
            `👉 [Open Dashboard](https://keepalive-fdn.vercel.app)`,
            { parse_mode: 'Markdown' }
        );
    });

    // Handle /status command
    bot.onText(/\/status/, async (msg) => {
        const chatId = String(msg.chat.id);
        const subscribers = loadSubscribers();
        const wallets = subscribers[chatId] || [];

        if (wallets.length > 0) {
            const walletList = wallets.map((w, i) => `${i + 1}. \`${w}\``).join('\n');
            bot.sendMessage(msg.chat.id,
                `📊 *Your Watchlist*\n\n` +
                `${walletList}\n\n` +
                `_To remove:_ /unlink wallet.testnet\n\n` +
                `👉 [Open Dashboard](https://keepalive-fdn.vercel.app)`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(msg.chat.id,
                `📊 *Your Watchlist*\n\n` +
                `_No wallets linked yet._\n\n` +
                `Use the "Connect Telegram" button on the dashboard.`,
                { parse_mode: 'Markdown' }
            );
        }
    });

    // Handle /add <wallet> command
    bot.onText(/\/add(?:\s+(.+))?/, async (msg, match) => {
        const chatId = String(msg.chat.id);
        const accountId = match[1]?.trim();

        if (!accountId) {
            bot.sendMessage(msg.chat.id,
                `ℹ️ *Usage:* /add wallet.near\n\n` +
                `Adds a wallet to your watchlist.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Validate format
        if (!accountId.endsWith('.testnet') && !accountId.endsWith('.near')) {
            bot.sendMessage(msg.chat.id,
                '❌ Invalid wallet format.\n\n' +
                'Must end with .near or .testnet',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Add to local watchlist
        const subscribers = loadSubscribers();
        if (!subscribers[chatId]) subscribers[chatId] = [];

        if (subscribers[chatId].includes(accountId)) {
            bot.sendMessage(msg.chat.id,
                `ℹ️ Already watching \`${accountId}\`\n\n` +
                `Use /status to view your watchlist.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        subscribers[chatId].push(accountId);
        saveSubscribers(subscribers);

        // Save telegram_chat_id on-chain
        try {
            await callMethod(rpc, 'link_telegram', { account_id: accountId, chat_id: chatId });
            log(`📱 Linked on-chain: ${accountId} -> chat ${chatId}`, C.green);
        } catch (e) {
            log(`Failed to link on-chain (vault may not exist): ${e.message}`, C.yellow);
        }

        log(`📱 Added to watchlist: ${accountId} -> chat ${chatId}`, C.green);

        bot.sendMessage(msg.chat.id,
            `✅ *Added to Watchlist!*\n\n` +
            `🔗 Wallet: \`${accountId}\`\n\n` +
            `📊 Currently watching: *${subscribers[chatId].length} wallet(s)*`,
            { parse_mode: 'Markdown' }
        );
    });

    // Handle /unlink <wallet> command
    bot.onText(/\/unlink(?:\s+(.+))?/, async (msg, match) => {
        const chatId = String(msg.chat.id);
        const walletToRemove = match[1]?.trim();

        if (!walletToRemove) {
            bot.sendMessage(msg.chat.id,
                `ℹ️ *Usage:* /unlink wallet.testnet\n\n` +
                `Use /status to see your wallets.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        const subscribers = loadSubscribers();
        const wallets = subscribers[chatId] || [];
        const index = wallets.indexOf(walletToRemove);

        if (index === -1) {
            bot.sendMessage(msg.chat.id,
                `❌ Wallet \`${walletToRemove}\` not found.\n\n` +
                `Use /status to see your wallets.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        wallets.splice(index, 1);
        subscribers[chatId] = wallets;
        saveSubscribers(subscribers);

        log(`📱 Removed: ${walletToRemove} (chat ${chatId})`, C.yellow);

        bot.sendMessage(msg.chat.id,
            `✅ Removed \`${walletToRemove}\`\n\n` +
            `📊 Remaining: *${wallets.length} wallet(s)*`,
            { parse_mode: 'Markdown' }
        );
    });

    // Handle /clear command
    bot.onText(/\/clear/, async (msg) => {
        const chatId = String(msg.chat.id);
        const subscribers = loadSubscribers();
        const wallets = subscribers[chatId] || [];

        if (wallets.length === 0) {
            bot.sendMessage(msg.chat.id, `ℹ️ Your watchlist is already empty.`);
            return;
        }

        const count = wallets.length;
        delete subscribers[chatId];
        saveSubscribers(subscribers);

        log(`📱 Cleared watchlist: chat ${chatId} (${count} wallets)`, C.yellow);

        bot.sendMessage(msg.chat.id,
            `✅ Cleared *${count} wallet(s)* from your watchlist.`,
            { parse_mode: 'Markdown' }
        );
    });

    // Handle errors
    bot.on('polling_error', (error) => {
        log(`Telegram polling error: ${error.message}`, C.red);
    });
}

// Send alert to all subscribers watching this wallet
// First tries on-chain telegram_chat_id, then falls back to local subscribers
async function sendTelegramAlert(targetWalletId, message, vaultData = null) {
    if (!bot) {
        log('Telegram bot not initialized', C.dim);
        return false;
    }

    const sentChats = new Set(); // Avoid duplicate alerts
    let sentCount = 0;

    // Try on-chain telegram_chat_id first
    if (vaultData?.telegram_chat_id) {
        const chatId = vaultData.telegram_chat_id;
        try {
            await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            sentChats.add(chatId);
            sentCount++;
            log(`📱 Alert sent via on-chain link to chat ${chatId}`, C.green);
        } catch (e) {
            log(`Failed to alert on-chain chat ${chatId}: ${e.message}`, C.red);
        }
    }

    // Also check local subscribers (backup/additional)
    const subscribers = loadSubscribers();
    for (const [chatId, wallets] of Object.entries(subscribers)) {
        if (Array.isArray(wallets) && wallets.includes(targetWalletId) && !sentChats.has(chatId)) {
            try {
                await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                sentCount++;
            } catch (e) {
                log(`Failed to alert chat ${chatId}: ${e.message}`, C.red);
            }
        }
    }

    if (sentCount > 0) {
        log(`📱 Alert sent to ${sentCount} subscriber(s)`, C.green);
        return true;
    } else {
        log(`No subscribers for ${targetWalletId}`, C.dim);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Digital Verification (Level 2)
// ═══════════════════════════════════════════════════════════════════

async function performDigitalLifeCheck(ownerId) {
    console.log();
    log(`${C.bold}╔══════════════════════════════════════════════════╗${C.reset}`, C.magenta);
    log(`${C.bold}║  KEEPALIVE - Digital Life Verification           ║${C.reset}`, C.magenta);
    log(`${C.bold}╚══════════════════════════════════════════════════╝${C.reset}`, C.magenta);
    console.log();

    log(`Target: ${ownerId}`, C.cyan);
    console.log();

    const checks = [
        { name: 'Twitter/X Activity', icon: '🐦', delay: 800 },
        { name: 'GitHub Commits', icon: '💻', delay: 600 },
        { name: 'Discord Presence', icon: '💬', delay: 700 },
        { name: 'Telegram Status', icon: '📱', delay: 500 },
        { name: 'On-Chain Txs', icon: '⛓️', delay: 900 },
        { name: 'Email Ping', icon: '📧', delay: 400 },
    ];

    let score = 0;

    for (const check of checks) {
        process.stdout.write(`${C.dim}[${ts()}]${C.reset} ${check.icon}  Scanning ${check.name}... `);
        await sleep(check.delay);

        // TODO: Implement real API checks when social accounts are connected
        const hasActivity = false;

        if (hasActivity) {
            console.log(`${C.green}ACTIVITY DETECTED${C.reset}`);
            score++;
        } else {
            console.log(`${C.yellow}No activity${C.reset}`);
        }
    }

    console.log();
    log(`═══════════════════════════════════════════════`, C.dim);
    log(`Score: ${score}/${checks.length}`, C.cyan);

    const isAlive = score > 0;

    if (isAlive) {
        log(`${C.bold}RESULT: OWNER APPEARS ALIVE${C.reset}`, C.green);
    } else {
        log(`${C.bold}RESULT: NO SIGNS OF LIFE${C.reset}`, C.red);
    }

    log(`═══════════════════════════════════════════════`, C.dim);
    console.log();

    return !isAlive;
}

// ═══════════════════════════════════════════════════════════════════
//  Utility
// ═══════════════════════════════════════════════════════════════════

function formatTime(ms) {
    const v = BigInt(ms);
    const d = Number(v / 86400000n);
    const h = Number((v % 86400000n) / 3600000n);
    const m = Number((v % 3600000n) / 60000n);
    const s = Number((v % 60000n) / 1000n);

    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// ═══════════════════════════════════════════════════════════════════
//  Nonce Cache (Tracks outgoing tx activity per account)
// ═══════════════════════════════════════════════════════════════════

const userNonceCache = {};

// ═══════════════════════════════════════════════════════════════════
//  Process Single Vault — 75/25 Smart Monitoring
// ═══════════════════════════════════════════════════════════════════

async function processVault(rpc, accountId) {
    // Kill switch: set AGENT_ACTIVE=false in Railway to pause all vault processing
    if (process.env.AGENT_ACTIVE === 'false') {
        log(`⏸️ Agent is PAUSED via env var. Skipping: ${accountId}`, C.yellow);
        return;
    }

    try {
        // Get vault status for this specific account
        const status = await viewMethod(rpc, 'get_vault', { account_id: accountId });

        if (!status) {
            return; // No vault or RPC failure — silently skip
        }

        const prefix = `[${accountId}]`;

        // ─────────────────────────────────────────────
        //  PRIORITY 1: EMERGENCY (Transfer completed)
        // ─────────────────────────────────────────────
        if (status.is_emergency) {
            const emergencyKey = `emergency_${accountId}`;

            // First time detecting emergency
            if (!userActivityCache[emergencyKey]) {
                log(`${prefix} ${C.bold}🔴 EMERGENCY${C.reset} — Transfer complete`, C.red);

                userActivityCache[emergencyKey] = true;
                saveCache(); // Persist to file

                const emergencyMessage = `🚨 *SENTINEL EMERGENCY* 🚨

💀 *TRANSFER COMPLETED*

The grace period expired and funds have been transferred to the beneficiary.

Vault: \`${accountId}\`
Beneficiary: \`${status.beneficiary_id}\`

This vault is now in EMERGENCY state.`;

                await sendTelegramAlert(accountId, emergencyMessage, status);
                log(`${prefix} Emergency alert sent to Telegram`, C.red);
            }
            // Already alerted - silently skip
            return;
        }

        // ─────────────────────────────────────────────
        //  PRIORITY 2: YIELD STATE (Level 2 verification)
        // ─────────────────────────────────────────────
        if (status.is_yielding) {
            log(`${prefix} ${C.bold}⚡ YIELD STATE${C.reset} — Starting verification...`, C.magenta);

            const confirmDeath = await performDigitalLifeCheck(status.owner_id);
            log(`${prefix} Calling resume_pulse(${confirmDeath})...`, C.cyan);

            try {
                await callMethod(rpc, 'resume_pulse', {
                    account_id: accountId,
                    confirm_death: confirmDeath
                });

                if (confirmDeath) {
                    log(`${prefix} ${C.bold}🔴 TRANSFER EXECUTED${C.reset}`, C.red);
                    await sendTelegramAlert(accountId,
                        `🔴 *SENTINEL ALERT*\n\n` +
                        `💀 *TRANSFER EXECUTED*\n\n` +
                        `Vault: \`${accountId}\`\n` +
                        `Funds transferred to beneficiary.\n\n` +
                        `The owner did not respond to warnings.`,
                        status
                    );
                } else {
                    log(`${prefix} ${C.bold}🟢 YIELD CANCELLED${C.reset} — Owner alive`, C.green);
                }
            } catch (e) {
                log(`${prefix} resume_pulse failed: ${e.message}`, C.red);
            }
            return;
        }

        // ─────────────────────────────────────────────
        //  PRIORITY 3: EXECUTION READY (grace expired)
        // ─────────────────────────────────────────────
        if (status.is_execution_ready) {
            log(`${prefix} ${C.bold}⏰ GRACE PERIOD EXPIRED${C.reset} — Initiating yield...`, C.orange);

            try {
                await callMethod(rpc, 'check_pulse', { account_id: accountId });
                log(`${prefix} Yield initiated`, C.cyan);
            } catch (e) {
                log(`${prefix} check_pulse failed: ${e.message}`, C.red);
            }
            return;
        }

        // ─────────────────────────────────────────────
        //  PRIORITY 4: WARNING ACTIVE (waiting grace)
        // ─────────────────────────────────────────────
        if (status.is_warning_active) {
            const remaining = formatTime(status.warning_grace_remaining_ms);
            log(`${prefix} ${C.bold}⏳ WARNING ACTIVE${C.reset} | ${remaining} until execution eligible`, C.yellow);
            return;
        }

        // ─────────────────────────────────────────────
        //  75/25 SMART MONITORING (Normal + Expired)
        // ─────────────────────────────────────────────

        const intervalMs = BigInt(status.heartbeat_interval_ms);
        const timeRemainingMs = BigInt(status.time_remaining_ms);
        const dangerZone = intervalMs / 4n; // 25% of interval
        const balance = (BigInt(status.vault_balance) / 10n ** 24n).toString();

        // ── SAFE ZONE (>75% time remaining) ──
        if (timeRemainingMs > dangerZone && !status.is_expired) {
            const remaining = formatTime(status.time_remaining_ms);
            const pct = Number((timeRemainingMs * 100n) / intervalMs);

            // Pre-seed nonce in safe zone so it's ready for danger zone comparison
            if (userNonceCache[status.owner_id] === undefined) {
                const nonce = await checkNativeActivity(rpc, status.owner_id);
                userNonceCache[status.owner_id] = nonce;
                log(`${prefix} ${C.green}🟢 Safe Zone${C.reset} (${pct}%) | ${remaining} left | ${balance} NEAR — Nonce cached.`, C.dim);
            } else {
                log(`${prefix} ${C.green}🟢 Safe Zone${C.reset} (${pct}%) | ${remaining} left | ${balance} NEAR — Skipping.`, C.dim);
            }
            return; // No further action needed
        }

        // ── DANGER ZONE (≤25% time remaining OR expired) ──
        const remaining = formatTime(status.time_remaining_ms);

        if (status.is_expired) {
            log(`${prefix} ${C.bold}🔴 EXPIRED${C.reset} — Entering Danger Zone check...`, C.orange);
        } else {
            const pct = Number((timeRemainingMs * 100n) / intervalMs);
            log(`${prefix} ${C.bold}🟡 Danger Zone${C.reset} (${pct}%) | ${remaining} left — Checking activity...`, C.yellow);
        }

        // ── NONCE-BASED ACTIVITY CHECK ──
        const currentNonce = await checkNativeActivity(rpc, status.owner_id);
        const cachedNonce = userNonceCache[status.owner_id];

        // First run: seed the cache if somehow not seeded in safe zone
        if (cachedNonce === undefined) {
            userNonceCache[status.owner_id] = currentNonce;
            log(`${prefix} 📊 Nonce seeded: ${currentNonce}`, C.dim);
            // Don't return! Continue to check if expired below
        }

        // ── NONCE CHANGED → User is ALIVE (outgoing tx detected) ──
        if (cachedNonce !== undefined && currentNonce > cachedNonce) {
            log(`${prefix} ${C.bold}🔵 ACTIVITY DETECTED!${C.reset} Nonce: ${cachedNonce} → ${currentNonce}`, C.cyan);
            log(`${prefix} Auto-pinging on behalf of user...`, C.green);

            try {
                await callMethod(rpc, 'agent_ping', { account_id: accountId });
                log(`${prefix} ${C.bold}✅ AUTO-PING SUCCESSFUL${C.reset} — Timer reset`, C.green);

                // Positive Telegram notification
                await sendTelegramAlert(accountId,
                    `✅ *SENTINEL — Auto-Extend*\n\n` +
                    `🔵 Saw you active on-chain.\n` +
                    `Vault: \`${accountId}\`\n` +
                    `Timer has been automatically extended.\n\n` +
                    `Stay safe. 🛡️`,
                    status
                );
            } catch (e) {
                log(`${prefix} Auto-ping failed: ${e.message}`, C.red);
            }

            userNonceCache[status.owner_id] = currentNonce;
            return;
        }

        // ── NONCE UNCHANGED → User is SILENT ──
        userNonceCache[status.owner_id] = currentNonce;
        log(`${prefix} 🔇 No activity detected. Nonce unchanged: ${currentNonce}`, C.yellow);

        if (status.is_expired) {
            // Expired + no activity → trigger warning
            await triggerWarningShot(rpc, accountId, status, prefix);
        } else {
            // In danger zone but not expired yet — just alert
            const warningKey = `dangerzone_${accountId}`;
            if (!userActivityCache[warningKey]) {
                userActivityCache[warningKey] = true;

                await sendTelegramAlert(accountId,
                    `⚠️ *SENTINEL WARNING*\n\n` +
                    `No on-chain activity detected.\n` +
                    `Vault: \`${accountId}\`\n` +
                    `Time remaining: *${remaining}*\n\n` +
                    `👉 [PING NOW](https://keepalive-fdn.vercel.app/) to keep your vault alive!`,
                    status
                );
                log(`${prefix} ⚠️ Danger zone warning sent`, C.yellow);
            }
        }
    } catch (e) {
        log(`[${accountId}] Error: ${e.message}`, C.red);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Warning Shot — Trigger on-chain warning + dust tx + Telegram
// ═══════════════════════════════════════════════════════════════════

async function triggerWarningShot(rpc, accountId, status, prefix) {
    try {
        await callMethod(rpc, 'trigger_warning', { account_id: accountId });
        log(`${prefix} Warning triggered on-chain`, C.yellow);

        // Send dust transaction to owner
        await sendWarningShot(rpc, status.owner_id);

        // Send Telegram notification
        const gracePeriodFormatted = formatTime(status.grace_period_ms || '86400000');
        const alertMessage = `🚨 *SENTINEL ALERT* 🚨

⚠️ *Protocol 'Warning Shot' INITIATED*

Your Vault Timer has *EXPIRED*.
Vault: \`${accountId}\`
Funds will be transferred to the beneficiary in *${gracePeriodFormatted}* unless you act.

👉 [PING NOW TO ABORT](https://keepalive-fdn.vercel.app/)`;

        await sendTelegramAlert(accountId, alertMessage, status);

        log(`${prefix} ${C.bold}🟡 WARNING SHOT FIRED${C.reset} — ${gracePeriodFormatted} grace period started`, C.yellow);
    } catch (e) {
        log(`${prefix} Warning trigger failed: ${e.message}`, C.red);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Main Loop - NOW ITERATES THROUGH ALL WATCHED WALLETS
// ═══════════════════════════════════════════════════════════════════

async function main() {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(' Sentinel Protocol Agent: Active Duty');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log();

    log(`Contract: ${cfg.contractId}`, C.dim);
    log(`Agent: ${cfg.agentId}`, C.dim);
    console.log();

    const rpc = new Rpc();
    await rpc.init();
    await rpc.connect();

    // Expose RPC for HTTP API immediate triggers
    global.sharedRpc = rpc;

    // Initialize Telegram bot for deep linking
    initTelegramBot();

    // Start HTTP API for auto-registering vaults from frontend
    startHttpApi();

    log('Multi-vault monitoring started...', C.green);
    console.log();

    while (true) {
        try {
            // Get all watched wallets from subscribers
            const watchedWallets = getAllWatchedWallets();

            if (watchedWallets.length === 0) {
                log(`No wallets being watched. Waiting for subscribers...`, C.dim);
            } else {
                console.log();
                log(`═══════════════════════════════════════════════`, C.dim);
                log(`Checking ${watchedWallets.length} vault(s)...`, C.cyan);
                log(`═══════════════════════════════════════════════`, C.dim);

                // Process each watched wallet
                for (const walletId of watchedWallets) {
                    await processVault(rpc, walletId);
                    // Small delay between vaults to avoid rate limiting
                    await sleep(500);
                }
            }
        } catch (e) {
            log(`Error: ${e.message}`, C.red);
        }

        await sleep(cfg.pollInterval);
    }
}

main().catch(e => {
    console.error(`${C.red}Fatal: ${e.message}${C.reset}`);
    process.exit(1);
});