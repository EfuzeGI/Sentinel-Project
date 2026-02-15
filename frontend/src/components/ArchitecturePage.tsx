"use client";

import { useState, useEffect } from "react";

type Section = "transfer" | "encryption" | "pulse" | "methods";

const SECTIONS: { id: Section; label: string }[] = [
    { id: "transfer", label: "Fund Transfer" },
    { id: "encryption", label: "E2E Encryption" },
    { id: "pulse", label: "Pulse States" },
    { id: "methods", label: "Contract API" },
];

export function ArchitecturePage() {
    const [active, setActive] = useState<Section>("transfer");

    return (
        <div className="max-w-[960px] mx-auto px-6 py-14">
            <div className="mb-10 animate-reveal">
                <p className="text-[11px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-2">
                    Protocol Architecture
                </p>
                <h1 className="text-[28px] font-bold text-[var(--text)]">How KeepAlive Works</h1>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-[var(--border)] mb-10 animate-reveal delay-1">
                {SECTIONS.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setActive(s.id)}
                        className={`px-4 py-2.5 text-[12px] font-mono transition-colors border-b-2 -mb-px ${active === s.id
                            ? "border-[var(--text)] text-[var(--text)]"
                            : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                            }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="animate-fade">
                {active === "transfer" && <TransferFlow />}
                {active === "encryption" && <EncryptionPipeline />}
                {active === "pulse" && <PulseStates />}
                {active === "methods" && <ContractMethods />}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   FUND TRANSFER FLOW — Visual Pipeline
   ═══════════════════════════════════════════════════════════════════ */

function useTextScramble(original: string, speed = 40) {
    const [display, setDisplay] = useState(original);
    const chars = "0123456789abcdef@#$%&*!?><{}[]";

    useEffect(() => {
        let frame = 0;
        const totalFrames = original.length * 2;
        const interval = setInterval(() => {
            frame++;
            const progress = Math.min(frame / totalFrames, 1);
            const revealed = Math.floor(progress * original.length);
            let result = "";
            for (let i = 0; i < original.length; i++) {
                if (i < revealed) {
                    result += original[i];
                } else {
                    result += chars[Math.floor(Math.random() * chars.length)];
                }
            }
            setDisplay(result);
            if (frame >= totalFrames) {
                clearInterval(interval);
                setDisplay(original);
            }
        }, speed);
        return () => clearInterval(interval);
    }, [original]);

    return display;
}

function CipherBlock() {
    const [cipher, setCipher] = useState("7x#9fB@!kL$2mN&p");
    const chars = "0123456789abcdef#@$%!?&*<>{}";

    useEffect(() => {
        const interval = setInterval(() => {
            let s = "";
            for (let i = 0; i < 17; i++) s += chars[Math.floor(Math.random() * chars.length)];
            setCipher(s);
        }, 80);
        return () => clearInterval(interval);
    }, []);

    return (
        <span className="font-mono text-white/40">
            {cipher}
        </span>
    );
}

function TransferFlow() {
    const scrambled = useTextScramble("aes256:7f3a9b2c...e8d1", 60);
    const [openIndex, setOpenIndex] = useState(0);

    const stages = [
        {
            step: "01",
            title: "Client-Side Secret",
            subtitle: "Your browser only",
            color: "#888",
            content: (
                <div className="bg-black/80 border border-[var(--border)] p-4 font-mono text-[13px]">
                    <span className="text-[9px] text-[var(--text-dim)] tracking-widest uppercase">payload input</span>
                    <div className="text-[var(--text)] mt-2">
                        <span className="text-[var(--text-dim)]">&gt; </span>
                        my_secret_seed_phrase_2024
                        <span className="inline-block w-[2px] h-[14px] bg-[var(--text-muted)] ml-0.5 align-middle" style={{ animation: "blink-cursor 1s step-end infinite" }} />
                    </div>
                </div>
            ),
        },
        {
            step: "02",
            title: "E2E Encryption",
            subtitle: "AES-256-GCM · Web Crypto API",
            color: "#888",
            content: (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-black/50 border border-white/6 p-3">
                            <p className="text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-widest mb-1">Plaintext</p>
                            <p className="font-mono text-[13px] text-[var(--text)]">my_secret_seed...</p>
                        </div>
                        <div className="text-[var(--text-muted)] text-[18px]">→</div>
                        <div className="flex-1 bg-black/70 border border-white/6 p-3">
                            <p className="text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-widest mb-1">Ciphertext</p>
                            <p className="font-mono text-[13px]"><CipherBlock /></p>
                        </div>
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.08] p-3 text-center">
                        <p className="text-[12px] font-mono font-bold text-white/50 tracking-wider">SERVER SEES ONLY GIBBERISH</p>
                    </div>
                </div>
            ),
        },
        {
            step: "03",
            title: "Decentralized Storage",
            subtitle: "NOVA IPFS Network",
            color: "#888",
            content: (
                <div className="relative bg-black/40 border border-white/6 p-5 overflow-hidden">
                    {/* Constellation dots */}
                    <div className="absolute inset-0 overflow-hidden">
                        {Array.from({ length: 16 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute rounded-full bg-white/40"
                                style={{
                                    width: i % 3 === 0 ? 5 : 3,
                                    height: i % 3 === 0 ? 5 : 3,
                                    left: `${8 + (i * 5.5) % 84}%`,
                                    top: `${12 + ((i * 19) % 76)}%`,
                                    animation: `pulse-dot ${2 + (i % 3)}s ease-in-out infinite`,
                                    animationDelay: `${i * 0.15}s`,
                                }}
                            />
                        ))}
                    </div>
                    <div className="relative text-center py-2">
                        <p className="text-[20px] font-bold font-mono text-white mb-1" style={{ textShadow: '0 0 20px rgba(255,255,255,0.15)' }}>NOVA</p>
                        <p className="text-[11px] text-[var(--text-muted)]">Encrypted shards distributed across IPFS peers</p>
                        <div className="flex items-center justify-center gap-4 mt-3">
                            {["shard_0x7f", "shard_0xa3", "shard_0x1b"].map((shard, i) => (
                                <span key={i} className="text-[9px] font-mono px-2 py-0.5 border border-white/10 text-[var(--text-muted)]">
                                    {shard}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            step: "04",
            title: "Smart Contract Lock",
            subtitle: "NEAR Protocol · On-chain",
            color: "#888",
            content: (
                <div className="relative bg-black/40 border border-white/6 p-5">
                    <div className="flex items-center gap-6">
                        {/* Lock visual */}
                        <div className="relative flex-shrink-0">
                            <div className="w-20 h-20 border border-white/10 rounded-xl flex items-center justify-center" style={{ boxShadow: '0 0 20px rgba(255,255,255,0.04)' }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </div>
                            <div className="absolute inset-0 border border-white/[0.06] rounded-xl" style={{ animation: "pulse-ring 2.5s ease-out infinite" }} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse-dot" />
                                        <span className="text-[10px] font-mono text-[var(--text-muted)]">HEARTBEAT ACTIVE</span>
                                    </div>
                                    <LiveTimer />
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-widest">Locked Value</p>
                                    <p className="text-[28px] font-bold font-mono text-white leading-none" style={{ textShadow: '0 0 16px rgba(255,255,255,0.1)' }}>1,500 <span className="text-[16px] text-[var(--text-muted)]">NEAR</span></p>
                                </div>
                            </div>
                            <p className="text-[11px] text-[var(--text-dim)]">Timer guards the vault. Miss a heartbeat → funds auto-transfer to beneficiary.</p>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            step: "05",
            title: "Inheritance Delivered",
            subtitle: "Trustless · Automatic · Irreversible",
            color: "#34d399",
            content: (
                <div className="space-y-3">
                    {/* THE MONEY — hero element */}
                    <div className="bg-black/60 border border-[var(--accent)]/20 p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[9px] font-mono text-[var(--accent)] uppercase tracking-widest">Assets Transferred</p>
                            <span className="text-[9px] font-mono text-[var(--text-dim)]">TX: 8f3a...d1b2</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <p className="text-[36px] font-bold font-mono text-[var(--accent)] leading-none">+1,500</p>
                            <div>
                                <p className="text-[16px] font-semibold text-[var(--text)]">NEAR</p>
                                <p className="text-[12px] font-mono text-[var(--text-muted)]">→ alice.near</p>
                            </div>
                        </div>
                    </div>

                    {/* THE SECRETS — secondary */}
                    <div className="bg-black/40 border border-[var(--border)] p-4">
                        <p className="text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-widest mb-2">Attached Secrets Revealed</p>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <p className="font-mono text-[11px] text-[var(--text-dim)] line-through">{scrambled}</p>
                            </div>
                            <span className="text-[var(--text-dim)]">→</span>
                            <div className="flex-1">
                                <p className="font-mono text-[11px] text-[var(--accent)]">my_secret_seed_phrase</p>
                            </div>
                        </div>
                        <p className="text-[10px] text-[var(--text-dim)] mt-2">Private keys, instructions, or farewell messages — decrypted client-side via NOVA.</p>
                    </div>
                </div>
            ),
        },
    ];

    return (
        <div>
            <p className="text-[14px] text-[var(--text-muted)] mb-10 max-w-[600px]">
                Watch your data travel through the KeepAlive pipeline — from secret input to trustless inheritance.
            </p>

            {/* Accordion Pipeline */}
            <div className="border-t border-white/[0.06]">
                {stages.map((stage, i) => {
                    const isOpen = openIndex === i;
                    const isLast = i === stages.length - 1;

                    return (
                        <div key={i} className={`animate-reveal delay-${i + 1} border-b border-white/[0.06]`}>
                            {/* Clickable Header Row */}
                            <button
                                onClick={() => setOpenIndex(isOpen ? -1 : i)}
                                className="w-full flex items-center gap-5 py-5 px-2 text-left cursor-pointer group transition-colors duration-300 hover:bg-white/[0.02]"
                            >
                                <span
                                    className={`text-[15px] font-mono font-bold transition-colors duration-300 ${isOpen ? 'text-white' : 'text-gray-600'}`}
                                >
                                    {stage.step}
                                </span>

                                <div className="flex-1 min-w-0">
                                    <h3 className={`text-[17px] font-semibold transition-colors duration-300 ${isOpen ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                                        {stage.title}
                                    </h3>
                                    <p className={`text-[11px] font-mono transition-colors duration-300 ${isOpen ? 'text-gray-400' : 'text-[var(--text-dim)]'}`}>
                                        {stage.subtitle}
                                    </p>
                                </div>

                                {/* Open/Close indicator */}
                                <span className={`text-[20px] font-light text-gray-500 transition-transform duration-300 select-none ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
                                    +
                                </span>
                            </button>

                            {/* Expandable Content */}
                            <div
                                className="grid transition-all duration-500 ease-in-out"
                                style={{
                                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                                    opacity: isOpen ? 1 : 0,
                                }}
                            >
                                <div className="overflow-hidden">
                                    <div className={`px-2 pb-6 pt-1 ${isLast ? '' : ''}`}>
                                        {stage.content}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom summary */}
            <div className="grid md:grid-cols-2 gap-px bg-[var(--border)] mt-10">
                <div className="bg-[var(--bg)] p-6">
                    <p className="text-[10px] font-mono text-[var(--accent)] tracking-widest uppercase mb-2">Normal Operation</p>
                    <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                        Owner regularly calls <code className="text-[var(--text)] bg-[var(--surface)] px-1">ping()</code> to reset the countdown. This proves activity and keeps the vault alive.
                    </p>
                </div>
                <div className="bg-[var(--bg)] p-6">
                    <p className="text-[10px] font-mono text-red-400 tracking-widest uppercase mb-2">Triggered Transfer</p>
                    <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                        If the owner goes silent: Warning → Grace → Yield → Transfer. The contract autonomously sends funds + secrets to the beneficiary.
                    </p>
                </div>
            </div>
        </div>
    );
}

function LiveTimer() {
    const [time, setTime] = useState("23:59:47");

    useEffect(() => {
        let h = 23, m = 59, s = 47;
        const interval = setInterval(() => {
            s--;
            if (s < 0) { s = 59; m--; }
            if (m < 0) { m = 59; h--; }
            if (h < 0) { h = 23; m = 59; s = 59; }
            setTime(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <p className="text-[28px] font-bold font-mono text-white leading-none" style={{ textShadow: '0 0 16px rgba(255,255,255,0.1)' }}>{time}</p>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   ENCRYPTION PIPELINE
   ═══════════════════════════════════════════════════════════════════ */

function EncryptionPipeline() {
    const pipeline = [
        { stage: "1", label: "User Input", detail: "Plaintext secret entered in browser", side: "CLIENT" },
        { stage: "2", label: "Key Generation", detail: "AES-256-GCM key + random IV generated via Web Crypto API", side: "CLIENT" },
        { stage: "3", label: "Encrypt", detail: "crypto.subtle.encrypt() — plaintext → ciphertext", side: "CLIENT" },
        { stage: "4", label: "Package", detail: 'Format: E2E:LOCAL:<cipher>|KEY:<b64>|IV:<b64>', side: "CLIENT" },
        { stage: "5", label: "Store", detail: "Encrypted payload stored in smart contract secure_payload field", side: "ON-CHAIN" },
        { stage: "6", label: "Access Control", detail: "reveal_payload() — owner always, beneficiary only if is_completed=true", side: "ON-CHAIN" },
        { stage: "7", label: "Decrypt", detail: "Beneficiary retrieves payload → browser decrypts with key + IV", side: "CLIENT" },
    ];

    return (
        <div>
            <p className="text-[13px] text-[var(--text-muted)] mb-8 max-w-[600px]">
                End-to-end encryption pipeline. The server and smart contract <strong className="text-[var(--text)]">never see plaintext data</strong>.
                All cryptographic operations happen in the user&#39;s browser.
            </p>

            <div className="border border-[var(--border)]">
                {pipeline.map((step, i) => (
                    <div key={i} className={`flex animate-reveal delay-${i + 1} ${i > 0 ? "border-t border-[var(--border)]" : ""}`}>
                        {/* Stage number */}
                        <div className="w-16 flex items-center justify-center border-r border-[var(--border)] bg-[var(--surface)]">
                            <span className="text-[18px] font-bold text-[var(--text-dim)] font-mono">{step.stage}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 px-6 py-4">
                            <div className="flex items-center gap-3 mb-1">
                                <span className="text-[13px] font-semibold text-[var(--text)]">{step.label}</span>
                                <span className={`text-[8px] font-mono px-1.5 py-0.5 tracking-wider ${step.side === "CLIENT"
                                    ? "border border-[var(--accent)]/20 text-[var(--accent)]"
                                    : "border border-[var(--border)] text-[var(--text-dim)]"
                                    }`}>
                                    {step.side}
                                </span>
                            </div>
                            <p className="text-[12px] text-[var(--text-muted)]">{step.detail}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Key Insight */}
            <div className="mt-4 border border-[var(--border)] bg-[var(--surface)] p-6">
                <p className="text-[10px] font-mono text-[var(--accent)] tracking-widest uppercase mb-2">Zero-Knowledge Guarantee</p>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
                    At no point does the NEAR smart contract, NOVA IPFS, or any intermediary have access to plaintext data.
                    The encryption key is embedded in the payload string itself — readable only by someone with browser-level access
                    to that specific vault entry. This is a trustless, client-side encryption scheme.
                </p>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   PULSE STATES (State Machine)
   ═══════════════════════════════════════════════════════════════════ */

function PulseStates() {
    const states = [
        {
            name: "ALIVE",
            color: "var(--accent)",
            desc: "Owner is pinging regularly. Timer resets with each heartbeat. This is the normal operating state.",
            trigger: "ping() called before interval expires"
        },
        {
            name: "EXPIRED",
            color: "var(--warn)",
            desc: "Heartbeat interval exceeded. The owner has not pinged within the required timeframe. Warning phase begins.",
            trigger: "now > last_active + heartbeat_interval"
        },
        {
            name: "WARNING_TRIGGERED",
            color: "var(--warn)",
            desc: "A warning has been issued. The Telegram bot notifies the owner. Grace period countdown starts.",
            trigger: "trigger_warning() called by agent"
        },
        {
            name: "WARNING_GRACE_PERIOD",
            color: "#f59e0b",
            desc: "Owner has one last chance to respond with a ping. If they ping now, the vault returns to ALIVE and the warning is cleared.",
            trigger: "now < warning_triggered_at + grace_period"
        },
        {
            name: "YIELD_INITIATED",
            color: "var(--danger)",
            desc: "Grace period expired. The vault enters a yield state awaiting agent verification before executing the transfer.",
            trigger: "check_pulse() called after grace expires"
        },
        {
            name: "TRANSFER_COMPLETE",
            color: "#7f1d1d",
            desc: "Agent confirmed inactivity. Vault balance has been transferred to the beneficiary. Encrypted payload is now accessible by the beneficiary.",
            trigger: "resume_pulse(confirm_death=true)"
        },
    ];

    return (
        <div>
            <p className="text-[13px] text-[var(--text-muted)] mb-8 max-w-[600px]">
                The <code className="text-[var(--text)] bg-[var(--surface)] px-1">check_pulse()</code> contract method determines the vault&#39;s lifecycle state.
                Each state has specific rules about what actions are permitted.
            </p>

            <div className="space-y-1">
                {states.map((state, i) => (
                    <div key={i} className={`flex border border-[var(--border)] animate-reveal delay-${i + 1}`}>
                        {/* Status indicator */}
                        <div className="w-1 flex-shrink-0" style={{ backgroundColor: state.color }} />

                        <div className="flex-1 p-5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[14px] font-mono font-bold text-[var(--text)]">{state.name}</span>
                                <span className="text-[9px] font-mono text-[var(--text-dim)] max-w-[50%] text-right">{state.trigger}</span>
                            </div>
                            <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">{state.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Visual state machine */}
            <div className="mt-8 border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
                <p className="text-[10px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-4">State Transitions</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                    {["ALIVE", "→", "EXPIRED", "→", "WARNING", "→", "GRACE", "→", "YIELD", "→", "TRANSFER"].map((item, i) => (
                        item === "→" ? (
                            <span key={i} className="text-[var(--text-dim)] text-[12px]">→</span>
                        ) : (
                            <span key={i} className="px-2 py-1 border border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)]">
                                {item}
                            </span>
                        )
                    ))}
                </div>
                <p className="text-[10px] text-[var(--text-dim)] mt-3">
                    At any point before YIELD, the owner can call <code className="text-[var(--text)]">ping()</code> to return to ALIVE.
                </p>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   CONTRACT METHODS TABLE
   ═══════════════════════════════════════════════════════════════════ */

function ContractMethods() {
    const methods = [
        { name: "setup_vault", type: "call", params: "beneficiary, interval_ms?, grace_period_ms?, secure_payload?", desc: "Create a new vault" },
        { name: "ping", type: "call", params: "(none)", desc: "Reset heartbeat timer — prove you're alive" },
        { name: "deposit", type: "call (payable)", params: "attached NEAR", desc: "Add funds to vault balance" },
        { name: "withdraw", type: "call", params: "amount?", desc: "Withdraw NEAR from vault" },
        { name: "reveal_payload", type: "call", params: "account_id", desc: "Access encrypted payload (auth-gated)" },
        { name: "trigger_warning", type: "call", params: "account_id", desc: "Issue warning after interval expires" },
        { name: "check_pulse", type: "call", params: "account_id", desc: "Check if grace period has expired, initiate yield" },
        { name: "resume_pulse", type: "call", params: "account_id, confirm_death", desc: "Finalize transfer or cancel yield" },
        { name: "reset_vault", type: "call", params: "(none)", desc: "Delete vault and return funds to owner" },
        { name: "get_vault", type: "view", params: "account_id", desc: "Read vault status and all computed fields" },
        { name: "get_all_vaults", type: "view", params: "(none)", desc: "List all vault owner account IDs" },
    ];

    return (
        <div>
            <p className="text-[13px] text-[var(--text-muted)] mb-8 max-w-[600px]">
                Complete smart contract API reference. The contract is deployed on NEAR Protocol
                and all state transitions are trustless and verifiable.
            </p>

            <div className="border border-[var(--border)] overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[140px_80px_1fr_1fr] bg-[var(--surface)] border-b border-[var(--border)] px-4 py-2">
                    <span className="text-[9px] font-mono text-[var(--text-dim)] tracking-widest uppercase">Method</span>
                    <span className="text-[9px] font-mono text-[var(--text-dim)] tracking-widest uppercase">Type</span>
                    <span className="text-[9px] font-mono text-[var(--text-dim)] tracking-widest uppercase">Parameters</span>
                    <span className="text-[9px] font-mono text-[var(--text-dim)] tracking-widest uppercase">Description</span>
                </div>

                {/* Rows */}
                {methods.map((m, i) => (
                    <div key={i} className={`grid grid-cols-[140px_80px_1fr_1fr] px-4 py-3 animate-reveal delay-${Math.min(i + 1, 8)} ${i > 0 ? "border-t border-[var(--border)]" : ""}`}>
                        <span className="text-[11px] font-mono text-[var(--text)]">{m.name}</span>
                        <span className={`text-[10px] font-mono ${m.type === "view" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`}>{m.type}</span>
                        <span className="text-[10px] font-mono text-[var(--text-dim)]">{m.params}</span>
                        <span className="text-[11px] text-[var(--text-muted)]">{m.desc}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
