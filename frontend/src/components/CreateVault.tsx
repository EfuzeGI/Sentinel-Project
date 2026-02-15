"use client";

import { useState } from "react";
import { useNear } from "@/contexts/NearContext";
import {
    Clock,
    Lock,
    Loader2,
    ExternalLink,
    Check,
    CheckCircle2,
    Shield,
    Key,
    Users,
    AlertTriangle,
    Info,
    Brain,
    Wallet,
} from "lucide-react";
import { encryptSecret, packE2EPayload } from "@/utils/encryption";
import { uploadEncryptedData } from "@/utils/nova";

const PRESETS = {
    interval: [
        { label: "2m", ms: 120000 },
        { label: "5m", ms: 300000 },
        { label: "1h", ms: 3600000 },
        { label: "24h", ms: 86400000 },
        { label: "7d", ms: 604800000 },
        { label: "30d", ms: 2592000000 },
    ],
    grace: [
        { label: "1m", ms: 60000 },
        { label: "5m", ms: 300000 },
        { label: "1h", ms: 3600000 },
        { label: "12h", ms: 43200000 },
        { label: "24h", ms: 86400000 },
        { label: "48h", ms: 172800000 },
    ],
};

function msToLabel(ms: number): string {
    if (ms >= 86400000) return `${(ms / 86400000).toFixed(ms % 86400000 === 0 ? 0 : 1)}d`;
    if (ms >= 3600000) return `${(ms / 3600000).toFixed(ms % 3600000 === 0 ? 0 : 1)}h`;
    return `${Math.round(ms / 60000)}m`;
}

// Slider converts 0-100 → ms range with logarithmic scale (1min → 30d)
const MIN_MS = 60000;       // 1 minute
const MAX_MS = 2592000000;  // 30 days
function sliderToMs(val: number): number {
    const log = Math.log(MIN_MS) + (val / 100) * (Math.log(MAX_MS) - Math.log(MIN_MS));
    return Math.round(Math.exp(log));
}
function msToSlider(ms: number): number {
    return ((Math.log(ms) - Math.log(MIN_MS)) / (Math.log(MAX_MS) - Math.log(MIN_MS))) * 100;
}

export function CreateVault() {
    const { setupVault, isTransactionPending, accountId, vaultStatus } = useNear();
    const [beneficiary, setBeneficiary] = useState("");
    const [intervalMs, setIntervalMs] = useState(86400000); // 24h default
    const [graceMs, setGraceMs] = useState(86400000);       // 24h default
    const [secretPayload, setSecretPayload] = useState("");
    const [useCustomInterval, setUseCustomInterval] = useState(false);
    const [useCustomGrace, setUseCustomGrace] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const telegramConnected = vaultStatus?.telegram_chat_id && vaultStatus.telegram_chat_id !== "";

    const encryptAndSubmit = async () => {
        if (!beneficiary.trim()) {
            setError("Beneficiary address is required");
            return;
        }
        if (!secretPayload.trim()) {
            setError("Secret payload is required");
            return;
        }

        setError(null);
        setIsSubmitting(true);

        try {
            let encryptedPayload: string | undefined;

            if (secretPayload.trim()) {
                // 1. Encrypt locally
                const { ciphertext, key, iv } = await encryptSecret(secretPayload);

                // 2. Upload to NOVA (IPFS)
                const novaString = await uploadEncryptedData(ciphertext);
                const cid = novaString.replace("NOVA:", "");

                // 3. Pack metadata
                encryptedPayload = packE2EPayload(cid, key, iv);
            }

            // 4. Submit to NEAR
            await setupVault(
                beneficiary.trim(),
                intervalMs,
                graceMs,
                encryptedPayload
            );

            // 5. Auto-register with Monitoring Agent
            try {
                // Use a relative path or the production URL for the agent if known
                // Since this is a browser app, it should talk to the API
                await fetch(`/api/agent/register-vault`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ wallet_id: accountId }),
                });
            } catch (e) {
                console.warn("⚠️ Agent registration failed:", e);
            }
        } catch (err) {
            console.error("Vault setup failed:", err);
            setError(err instanceof Error ? err.message : "Failed to initialize vault");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isReady = beneficiary.trim() && secretPayload.trim();
    const hasVault = vaultStatus !== null && vaultStatus.is_initialized;

    if (hasVault && !isSubmitting) {
        return (
            <div className="max-w-[680px] mx-auto px-6 py-20 text-center animate-reveal">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/20 mb-6">
                    <CheckCircle2 className="w-8 h-8 text-[var(--accent)]" />
                </div>
                <h1 className="text-[28px] font-bold text-[var(--text)] mb-3">Vault Active</h1>
                <p className="text-[15px] text-[var(--text-muted)] mb-10 max-w-[400px] mx-auto">
                    You already have an active KeepAlive vault. Manage your heartbeat and funds in the dashboard.
                </p>
                <button
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent("sentinel:navigate", { detail: "dashboard" }));
                    }}
                    className="px-8 py-3.5 bg-[var(--text)] text-black font-semibold hover:opacity-90 transition-opacity"
                >
                    Go to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-[680px] mx-auto px-6 py-14">
            <div className="text-center mb-10 animate-reveal">
                <h1 className="text-[28px] font-bold text-[var(--text)] mb-2">Configure KeepAlive</h1>
                <p className="text-[15px] text-[var(--text-muted)]">Set the parameters for your automated inheritance vault.</p>
            </div>

            <div className="border border-[var(--border)] bg-[var(--surface)] animate-reveal delay-1">
                {/* Beneficiary */}
                <div className="p-7 border-b border-[var(--border)]">
                    <label className="text-[11px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-3 flex items-center gap-1">
                        <span className="text-[var(--accent)]">*</span> Beneficiary Address
                    </label>
                    <input
                        type="text"
                        value={beneficiary}
                        onChange={e => { setBeneficiary(e.target.value); setError(null); }}
                        placeholder="receiver.near"
                        className="w-full bg-[var(--bg)] border border-[var(--border)] px-4 py-3.5 text-[14px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-hover)]"
                    />
                </div>

                {/* Heartbeat Interval */}
                <div className="p-7 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[11px] font-mono text-[var(--text-dim)] tracking-widest uppercase flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Heartbeat Interval
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-[14px] font-mono font-semibold text-[var(--text)]">{msToLabel(intervalMs)}</span>
                            <button
                                onClick={() => setUseCustomInterval(!useCustomInterval)}
                                className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${useCustomInterval
                                    ? "border-[var(--accent)]/30 text-[var(--accent)]"
                                    : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                                    }`}
                            >
                                {useCustomInterval ? "PRESETS" : "CUSTOM"}
                            </button>
                        </div>
                    </div>

                    {useCustomInterval ? (
                        <div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={0.5}
                                value={msToSlider(intervalMs)}
                                onChange={e => setIntervalMs(sliderToMs(Number(e.target.value)))}
                                className="w-full h-1 appearance-none cursor-pointer bg-[var(--border)] accent-[var(--accent)]"
                                style={{
                                    background: `linear-gradient(to right, var(--accent) ${msToSlider(intervalMs)}%, var(--border) ${msToSlider(intervalMs)}%)`
                                }}
                            />
                            <div className="flex justify-between text-[9px] font-mono text-[var(--text-dim)] mt-1.5">
                                <span>1 min</span>
                                <span>30 days</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex border border-[var(--border)]">
                            {PRESETS.interval.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => setIntervalMs(item.ms)}
                                    className={`flex-1 py-2.5 text-[13px] font-mono transition-colors ${intervalMs === item.ms
                                        ? "bg-[var(--text)] text-black font-semibold"
                                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                                        } ${i > 0 ? "border-l border-[var(--border)]" : ""}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Grace Period */}
                <div className="p-7 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[11px] font-mono text-[var(--text-dim)] tracking-widest uppercase flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" /> Grace Period
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-[14px] font-mono font-semibold text-[var(--amber)]">{msToLabel(graceMs)}</span>
                            <button
                                onClick={() => setUseCustomGrace(!useCustomGrace)}
                                className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${useCustomGrace
                                    ? "border-[var(--amber)]/30 text-[var(--amber)]"
                                    : "border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text-muted)]"
                                    }`}
                            >
                                {useCustomGrace ? "PRESETS" : "CUSTOM"}
                            </button>
                        </div>
                    </div>

                    {useCustomGrace ? (
                        <div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={0.5}
                                value={msToSlider(graceMs)}
                                onChange={e => setGraceMs(sliderToMs(Number(e.target.value)))}
                                className="w-full h-1 appearance-none cursor-pointer bg-[var(--border)]"
                                style={{
                                    background: `linear-gradient(to right, var(--amber) ${msToSlider(graceMs)}%, var(--border) ${msToSlider(graceMs)}%)`
                                }}
                            />
                            <div className="flex justify-between text-[9px] font-mono text-[var(--text-dim)] mt-1.5">
                                <span>1 min</span>
                                <span>30 days</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex border border-[var(--border)]">
                            {PRESETS.grace.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => setGraceMs(item.ms)}
                                    className={`flex-1 py-2.5 text-[13px] font-mono transition-colors ${graceMs === item.ms
                                        ? "bg-[var(--amber)] text-white font-semibold"
                                        : "text-[var(--text-muted)] hover:text-[var(--text)]"
                                        } ${i > 0 ? "border-l border(--border)]" : ""}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Encrypted Payload */}
                <div className="p-7 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[11px] font-mono text-[var(--text-dim)] tracking-widest uppercase flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" /> Encrypted Payload
                        </label>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 border border-[var(--accent)]/20 text-[var(--accent)]">
                            AES-256-GCM
                        </span>
                    </div>
                    <textarea
                        value={secretPayload}
                        onChange={e => { setSecretPayload(e.target.value); setError(null); }}
                        rows={3}
                        placeholder="Enter seed phrases, private notes, or coordinates here. Encrypted locally before it ever leaves your browser."
                        className="w-full bg-[var(--bg)] border border-[var(--border)] px-4 py-3.5 text-[13px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-hover)] resize-none"
                    />
                </div>

                {/* Telegram Connect */}
                <div className="p-7 border-b border-[var(--border)]">
                    <label className="text-[11px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-3 block">
                        Telegram Notifications (optional)
                    </label>
                    {telegramConnected ? (
                        <div className="flex items-center justify-between p-4 border border-[var(--accent)]/20 bg-[var(--accent-dim)]">
                            <div className="flex items-center gap-2.5">
                                <Check className="w-4 h-4 text-[var(--accent)]" />
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--text)]">Telegram Connected</p>
                                    <p className="text-[11px] text-[var(--text-dim)]">You&#39;ll receive alerts when your timer expires.</p>
                                </div>
                            </div>
                            <a
                                href={`https://t.me/keepalive_near_bot?start=${accountId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] transition-colors flex items-center gap-1"
                            >
                                Open Bot <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    ) : (
                        <a
                            href={`https://t.me/keepalive_near_bot?start=${accountId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors group"
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="text-[16px]">📱</span>
                                <div>
                                    <p className="text-[13px] font-medium text-[var(--text)]">Connect Telegram Bot</p>
                                    <p className="text-[11px] text-[var(--text-dim)]">Receive instant alerts when your vault timer is running low.</p>
                                </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-[var(--text-dim)] group-hover:text-[var(--text-muted)] transition-colors" />
                        </a>
                    )}
                </div>

                {/* Submit */}
                <div className="p-7">
                    <button
                        onClick={encryptAndSubmit}
                        disabled={!isReady || isTransactionPending || isSubmitting}
                        className={`w-full py-4 text-[15px] font-semibold transition-all flex items-center justify-center gap-2 ${isReady && !isTransactionPending && !isSubmitting
                            ? "bg-[var(--text)] text-black hover:opacity-90 grayscale-0"
                            : "bg-[var(--border)] text-[var(--text-dim)] cursor-not-allowed grayscale"
                            }`}
                    >
                        {isTransactionPending || isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {isSubmitting ? "Encrypting..." : "Signing..."}
                            </>
                        ) : (
                            <>Initialize Vault</>
                        )}
                    </button>
                    {error && (
                        <p className="mt-3 text-[11px] font-mono text-red-500 text-center animate-shake">
                            {error}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
