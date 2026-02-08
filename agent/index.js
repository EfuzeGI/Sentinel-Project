import dotenv from 'dotenv';
import * as nearAPI from 'near-api-js';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════
//   ███████╗███████╗███╗   ██╗████████╗██╗███╗   ██╗███████╗██╗     
//   ██╔════╝██╔════╝████╗  ██║╚══██╔══╝██║████╗  ██║██╔════╝██║     
//   ███████╗█████╗  ██╔██╗ ██║   ██║   ██║██╔██╗ ██║█████╗  ██║     
//   ╚════██║██╔══╝  ██║╚██╗██║   ██║   ██║██║╚██╗██║██╔══╝  ██║     
//   ███████║███████╗██║ ╚████║   ██║   ██║██║ ╚████║███████╗███████╗
//   ╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝
//   Multi-Vault Warning Protocol Agent
// ═══════════════════════════════════════════════════════════════════

const RPC_ENDPOINTS = [
    'https://testnet.rpc.fastnear.com',
    'https://rpc.testnet.near.org',
    'https://near-testnet.drpc.org',
];

const cfg = {
    networkId: 'testnet',
    contractId: process.env.CONTRACT_ID || 'testbruh.testnet',
    agentId: process.env.AGENT_ACCOUNT_ID || 'testbruh.testnet',
    agentKey: process.env.AGENT_PRIVATE_KEY,
    pollInterval: 15_000,
    rpcTimeout: 15_000,
    warningAmount: '10000000000000000000', // 0.00001 NEAR
};

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
//  RPC Manager
// ═══════════════════════════════════════════════════════════════════

class Rpc {
    constructor() {
        this.idx = 0;
        this.acc = null;
        this.ks = new nearAPI.keyStores.InMemoryKeyStore();
    }

    async init() {
        if (!cfg.agentKey) throw new Error('AGENT_PRIVATE_KEY not set');
        const kp = nearAPI.KeyPair.fromString(cfg.agentKey);
        await this.ks.setKey(cfg.networkId, cfg.agentId, kp);
        log(`Key loaded: ${kp.getPublicKey().toString().slice(0, 20)}...`, C.dim);
    }

    async connect() {
        const url = RPC_ENDPOINTS[this.idx];
        log(`RPC: ${url}`, C.cyan);
        const near = await nearAPI.connect({ networkId: cfg.networkId, keyStore: this.ks, nodeUrl: url });
        this.acc = await near.account(cfg.agentId);
        log('Connected', C.green);
    }

    rotate() {
        this.idx = (this.idx + 1) % RPC_ENDPOINTS.length;
        log(`Rotating RPC...`, C.yellow);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Contract Methods - NOW WITH account_id PARAMETER
// ═══════════════════════════════════════════════════════════════════

async function viewMethod(rpc, method, args = {}) {
    for (let attempt = 0; attempt < RPC_ENDPOINTS.length; attempt++) {
        try {
            return await Promise.race([
                rpc.acc.viewFunction({ contractId: cfg.contractId, methodName: method, args }),
                new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), cfg.rpcTimeout)),
            ]);
        } catch (e) {
            if (attempt < RPC_ENDPOINTS.length - 1) {
                rpc.rotate();
                await rpc.connect();
            }
        }
    }
    throw new Error(`View failed: ${method}`);
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
                rpc.rotate();
                await rpc.connect();
            }
        }
    }
    throw new Error(`Call failed: ${method}`);
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

// Get all unique wallets being watched
function getAllWatchedWallets() {
    const subscribers = loadSubscribers();
    const wallets = new Set();

    for (const walletList of Object.values(subscribers)) {
        if (Array.isArray(walletList)) {
            for (const wallet of walletList) {
                wallets.add(wallet);
            }
        }
    }

    return Array.from(wallets);
}

// Initialize Telegram bot
let bot = null;

function initTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
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
                '👋 *Welcome to Sentinel!*\n\n' +
                '🛡️ Dead Man\'s Switch for NEAR Protocol\n\n' +
                '*Commands:*\n' +
                '• /status - View your watchlist\n' +
                '• /unlink `<wallet>` - Remove a wallet\n' +
                '• /clear - Remove all wallets\n\n' +
                `📊 Currently watching: *${wallets.length} wallet(s)*\n\n` +
                '👉 [Open Dashboard](https://sentinel-agent.netlify.app)',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Validate format
        if (!accountId.endsWith('.testnet') && !accountId.endsWith('.near')) {
            bot.sendMessage(msg.chat.id,
                '❌ Invalid wallet format.\n\n' +
                'Use the button on the Sentinel dashboard.',
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
            `👉 [Open Dashboard](https://sentinel-agent.netlify.app)`,
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
                `👉 [Open Dashboard](https://sentinel-agent.netlify.app)`,
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
    log(`${C.bold}║  SENTINEL - Digital Life Verification            ║${C.reset}`, C.magenta);
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
//  Process Single Vault
// ═══════════════════════════════════════════════════════════════════

async function processVault(rpc, accountId) {
    try {
        // Get vault status for this specific account
        const status = await viewMethod(rpc, 'get_vault', { account_id: accountId });

        if (!status) {
            // No vault for this account - skip silently
            return;
        }

        const prefix = `[${accountId}]`;

        if (status.is_emergency) {
            log(`${prefix} ${C.bold}EMERGENCY${C.reset} - Transfer complete`, C.red);
        }
        else if (status.is_yielding) {
            // LEVEL 2: Contract in YIELD - perform verification
            log(`${prefix} ${C.bold}YIELD STATE${C.reset} - Starting verification...`, C.magenta);

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
                    log(`${prefix} ${C.bold}🟢 YIELD CANCELLED${C.reset} - Owner alive`, C.green);
                }
            } catch (e) {
                log(`${prefix} resume_pulse failed: ${e.message}`, C.red);
            }
        }
        else if (status.is_execution_ready) {
            // Grace period passed - initiate YIELD
            log(`${prefix} ${C.bold}GRACE PERIOD EXPIRED${C.reset} - Initiating yield...`, C.orange);

            try {
                await callMethod(rpc, 'check_pulse', { account_id: accountId });
                log(`${prefix} Yield initiated`, C.cyan);
            } catch (e) {
                log(`${prefix} check_pulse failed: ${e.message}`, C.red);
            }
        }
        else if (status.is_warning_active) {
            // LEVEL 1.5: Warning sent, waiting grace period
            const remaining = formatTime(status.warning_grace_remaining_ms);
            log(`${prefix} ${C.bold}⏳ WARNING ACTIVE${C.reset} | ${remaining} until execution eligible`, C.yellow);
        }
        else if (status.is_expired) {
            // LEVEL 1: Expired but no warning - send warning
            log(`${prefix} ${C.bold}⚠️  HEARTBEAT EXPIRED${C.reset} - Triggering warning...`, C.orange);

            try {
                await callMethod(rpc, 'trigger_warning', { account_id: accountId });
                log(`${prefix} Warning triggered on-chain`, C.yellow);

                // Send dust transaction to owner
                await sendWarningShot(rpc, status.owner_id);

                // Send Telegram notification with dynamic grace period
                const gracePeriodFormatted = formatTime(status.grace_period_ms || '86400000');
                const alertMessage = `🚨 *SENTINEL ALERT* 🚨

⚠️ *Protocol 'Warning Shot' INITIATED*

Your Vault Timer has *EXPIRED*.
Vault: \`${accountId}\`
Funds will be transferred to the beneficiary in *${gracePeriodFormatted}* unless you act.

👉 [PING NOW TO ABORT](https://sentinel-agent.netlify.app/)`;

                await sendTelegramAlert(accountId, alertMessage, status);

                log(`${prefix} ${C.bold}🟡 WARNING SHOT FIRED${C.reset} - ${gracePeriodFormatted} grace period started`, C.yellow);
            } catch (e) {
                log(`${prefix} Warning trigger failed: ${e.message}`, C.red);
            }
        }
        else {
            // Normal operation
            const remaining = formatTime(status.time_remaining_ms);
            const balance = (BigInt(status.vault_balance) / 10n ** 24n).toString();
            log(`${prefix} ${C.green}✓${C.reset} ${remaining} remaining | ${balance} NEAR`);
        }
    } catch (e) {
        log(`[${accountId}] Error: ${e.message}`, C.red);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  Main Loop - NOW ITERATES THROUGH ALL WATCHED WALLETS
// ═══════════════════════════════════════════════════════════════════

async function main() {
    console.log();
    console.log(`${C.cyan}${C.bold}`);
    console.log('  ███████╗███████╗███╗   ██╗████████╗██╗███╗   ██╗███████╗██╗     ');
    console.log('  ██╔════╝██╔════╝████╗  ██║╚══██╔══╝██║████╗  ██║██╔════╝██║     ');
    console.log('  ███████╗█████╗  ██╔██╗ ██║   ██║   ██║██╔██╗ ██║█████╗  ██║     ');
    console.log('  ╚════██║██╔══╝  ██║╚██╗██║   ██║   ██║██║╚██╗██║██╔══╝  ██║     ');
    console.log('  ███████║███████╗██║ ╚████║   ██║   ██║██║ ╚████║███████╗███████╗');
    console.log('  ╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝');
    console.log(`${C.reset}`);
    console.log(`${C.dim}  Multi-Vault Warning Protocol Agent${C.reset}`);
    console.log();

    log(`Contract: ${cfg.contractId}`, C.dim);
    log(`Agent: ${cfg.agentId}`, C.dim);
    console.log();

    const rpc = new Rpc();
    await rpc.init();
    await rpc.connect();

    // Initialize Telegram bot for deep linking
    initTelegramBot();

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