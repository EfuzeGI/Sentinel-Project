"use client";

import { useState, useEffect } from "react";
import { useNear } from "@/contexts/NearContext";
import { Activity, ChevronRight, Copy, Eye, Clock, Shield, Users, Loader2, RotateCcw, RefreshCw, Trash2, ExternalLink } from "lucide-react";

export function Dashboard() {
    const {
        accountId,
        vaultStatus,
        ping,
        deposit,
        withdraw,
        revealPayload,
        resetVault,
        isTransactionPending,
        refreshStatus,
    } = useNear();

    const [hours, setHours] = useState("00");
    const [minutes, setMinutes] = useState("00");
    const [seconds, setSeconds] = useState("00");
    const [progress, setProgress] = useState(100);
    const [depositAmount, setDepositAmount] = useState("");
    const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [secretLoading, setSecretLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Timer countdown
    useEffect(() => {
        if (!vaultStatus) return;

        const startTime = Date.now();

        // Determine which time source to use
        const useGracePeriod = vaultStatus.is_warning_active;
        const initialRemaining = useGracePeriod
            ? Number(vaultStatus.warning_grace_remaining_ms)
            : Number(vaultStatus.time_remaining_ms);

        const total = useGracePeriod
            ? Number(vaultStatus.grace_period_ms)
            : Number(vaultStatus.heartbeat_interval_ms);

        const tick = () => {
            const elapsed = Date.now() - startTime;
            const ms = Math.max(0, initialRemaining - elapsed);

            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);

            setHours(String(h).padStart(2, "0"));
            setMinutes(String(m).padStart(2, "0"));
            setSeconds(String(s).padStart(2, "0"));
            setProgress(total > 0 ? Math.min(100, ((total - ms) / total) * 100) : 0);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [vaultStatus]);

    const formatNear = (yocto: string) => {
        const n = Number(BigInt(yocto || "0")) / 1e24;
        return n.toFixed(n < 0.01 ? 4 : 2);
    };

    const formatDuration = (ms: string) => {
        const val = Number(ms);
        if (val >= 86400000) return `${Math.round(val / 86400000)}d`;
        if (val >= 3600000) return `${Math.round(val / 3600000)}h`;
        return `${Math.round(val / 60000)}m`;
    };

    const [revealError, setRevealError] = useState<string | null>(null);

    const handleReveal = async () => {
        setSecretLoading(true);
        setRevealError(null);
        try {
            // Race against a timeout to prevent infinite loading
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Wallet interaction timed out")), 60000)
            );

            const payload = await Promise.race([
                revealPayload(),
                timeoutPromise
            ]) as string | null;

            if (payload) {
                setRevealedSecret(payload);
                setShowSecret(true);
            } else {
                // If null is returned without error (e.g. redirect wallet), we might not reach here due to reload
                // But if we do, it means no payload was found or unauthorized
                throw new Error("Unable to decrypt payload. You may not be authorized.");
            }
        } catch (err) {
            console.error("Reveal failed:", err);
            setRevealError(err instanceof Error ? err.message : "Failed to reveal payload");
        } finally {
            setSecretLoading(false);
        }
    };

    const handleCopy = () => {
        if (revealedSecret) {
            navigator.clipboard.writeText(revealedSecret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDeposit = async () => {
        if (!depositAmount) return;
        await deposit(depositAmount);
        setDepositAmount("");
    };

    if (!vaultStatus) return null;

    const switchStatus = vaultStatus.is_completed
        ? "COMPLETED"
        : vaultStatus.is_emergency
            ? "EMERGENCY"
            : vaultStatus.is_yielding
                ? "YIELDING"
                : vaultStatus.is_warning_active
                    ? "WARNING"
                    : vaultStatus.is_expired
                        ? "EXPIRED"
                        : "ACTIVE";

    const statusColor = switchStatus === "ACTIVE" ? "var(--accent)" : switchStatus === "WARNING" ? "var(--warn)" : "var(--danger)";

    return (
        <div className="max-w-[1200px] mx-auto px-8 py-8">
            {/* Status Bar */}
            <div className="flex items-center justify-between mb-6 animate-reveal">
                <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ backgroundColor: statusColor }} />
                    <span className="text-[13px] font-mono text-[var(--text-muted)] tracking-widest uppercase">
                        Switch Status: <span style={{ color: statusColor }}>{switchStatus}</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refreshStatus()}
                        disabled={isTransactionPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-30"
                        title="Refresh vault state"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                    </button>
                    <button
                        onClick={() => resetVault()}
                        disabled={isTransactionPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-red-400/60 hover:text-red-400 border border-red-900/30 hover:border-red-800/50 transition-colors disabled:opacity-30"
                        title="Delete vault and return funds"
                    >
                        <Trash2 className="w-3 h-3" />
                        Reset Vault
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1fr_380px] gap-5">
                {/* Left: Timer Block */}
                <div className="border border-[var(--border)] bg-[var(--surface)] p-10 animate-reveal delay-1">
                    {/* Countdown */}
                    <div className="flex items-baseline justify-center gap-2 mb-8">
                        <div className="text-center">
                            <span className="text-[80px] font-bold tracking-tight leading-none font-mono text-[var(--text)] animate-ticker">{hours}</span>
                            <p className="text-[11px] font-mono text-[var(--text-dim)] mt-2 tracking-widest uppercase">Hours</p>
                        </div>
                        <span className="text-[48px] font-light text-[var(--text-dim)] mx-2">:</span>
                        <div className="text-center">
                            <span className="text-[80px] font-bold tracking-tight leading-none font-mono text-[var(--text)]">{minutes}</span>
                            <p className="text-[11px] font-mono text-[var(--text-dim)] mt-2 tracking-widest uppercase">Minutes</p>
                        </div>
                        <span className="text-[48px] font-light text-[var(--text-dim)] mx-2">:</span>
                        <div className="text-center">
                            <span className="text-[80px] font-bold tracking-tight leading-none font-mono text-[var(--text)]">{seconds}</span>
                            <p className="text-[11px] font-mono text-[var(--text-dim)] mt-2 tracking-widest uppercase">Seconds</p>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="relative h-[3px] bg-[var(--border)] rounded-full mb-2">
                        <div
                            className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000"
                            style={{ width: `${progress}%`, backgroundColor: statusColor }}
                        />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-[var(--text-dim)]">
                        <span>TRIGGER</span>
                        <span>RESET</span>
                    </div>

                    {/* Heartbeat Action */}
                    <button
                        onClick={ping}
                        disabled={isTransactionPending}
                        className="mt-10 w-full flex items-center justify-between px-6 py-5 border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all group bg-[var(--bg)]"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 border border-[var(--border)] group-hover:border-[var(--accent)]/30 flex items-center justify-center transition-colors">
                                <Activity className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                            </div>
                            <div className="text-left">
                                <p className="text-[15px] font-semibold text-[var(--text)]">Ping</p>
                                <p className="text-[13px] text-[var(--text-dim)]">Send a heartbeat to reset your countdown timer.</p>
                            </div>
                        </div>
                        {isTransactionPending ? (
                            <Loader2 className="w-4 h-4 text-[var(--text-dim)] animate-spin" />
                        ) : (
                            <ChevronRight className="w-4 h-4 text-[var(--text-dim)] group-hover:text-[var(--text)] transition-colors" />
                        )}
                    </button>
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-5">
                    {/* Vault Balance */}
                    <div className="border border-[var(--border)] bg-[var(--surface)] p-6 animate-reveal delay-2">
                        <p className="text-[11px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-3">Vault Balance</p>
                        <p className="text-[36px] font-bold text-[var(--text)] tracking-tight">
                            {formatNear(vaultStatus.vault_balance)}
                            <span className="text-[16px] font-normal text-[var(--text-muted)] ml-2">NEAR</span>
                        </p>
                        <div className="flex gap-2 mt-5">
                            <input
                                type="text"
                                value={depositAmount}
                                onChange={e => setDepositAmount(e.target.value)}
                                placeholder="0.0"
                                className="flex-1 bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-hover)] min-w-0"
                            />
                            <button
                                onClick={handleDeposit}
                                disabled={isTransactionPending || !depositAmount}
                                className="px-5 py-2.5 bg-[var(--text)] text-black text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-30"
                            >
                                Deposit
                            </button>
                        </div>
                        <button
                            onClick={() => withdraw()}
                            disabled={isTransactionPending}
                            className="w-full mt-3 px-4 py-2.5 border border-[var(--border)] text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-30"
                        >
                            Withdraw All
                        </button>
                    </div>

                    {/* Details */}
                    <div className="border border-[var(--border)] bg-[var(--surface)] animate-reveal delay-3">
                        {[
                            { icon: Clock, label: "Interval", value: formatDuration(vaultStatus.heartbeat_interval_ms), color: "var(--text)" },
                            { icon: Shield, label: "Grace Period", value: formatDuration(vaultStatus.grace_period_ms), color: "var(--amber)" },
                            { icon: Users, label: "Beneficiary", value: vaultStatus.beneficiary_id, color: "var(--text)" },
                        ].map((item, i) => (
                            <div key={i} className={`flex items-center justify-between px-6 py-4 ${i > 0 ? "border-t border-[var(--border)]" : ""}`}>
                                <div className="flex items-center gap-3">
                                    <item.icon className="w-4 h-4 text-[var(--text-dim)]" />
                                    <span className="text-[14px] text-[var(--text-muted)]">{item.label}</span>
                                </div>
                                <span className="text-[14px] font-mono font-medium" style={{ color: item.color }}>{item.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Secret Payload */}
                    <div className="border border-[var(--border)] bg-[var(--surface)] p-6 animate-reveal delay-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[14px] font-semibold text-[var(--text)]">Secret Payload</p>
                            {showSecret && revealedSecret && (
                                <button onClick={handleCopy} className="flex items-center gap-1 text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">
                                    <Copy className="w-3 h-3" />
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            )}
                        </div>
                        {showSecret && revealedSecret ? (
                            <div className="bg-[var(--bg)] border border-[var(--border)] p-4 text-[12px] font-mono text-[var(--text-muted)] break-all leading-relaxed">
                                {revealedSecret}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <button
                                    onClick={handleReveal}
                                    disabled={secretLoading}
                                    className="w-full flex items-center justify-center gap-2 py-3 border border-[var(--border)] text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-50"
                                >
                                    {secretLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <>
                                            <Eye className="w-3.5 h-3.5" />
                                            Reveal
                                        </>
                                    )}
                                </button>
                                {revealError && (
                                    <p className="text-[11px] text-red-400 text-center animate-in fade-in slide-in-from-top-1">
                                        {revealError}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Telegram */}
                    <a
                        href={`https://t.me/keepalive_near_bot?start=${accountId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-[var(--border)] bg-[var(--surface)] p-5 flex items-center justify-between group hover:border-[var(--border-hover)] transition-colors animate-reveal delay-5"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-[16px]">📱</span>
                            <div>
                                <p className="text-[13px] font-medium text-[var(--text)]">Telegram Alerts</p>
                                <p className="text-[11px] text-[var(--text-dim)]">
                                    {vaultStatus?.telegram_chat_id ? "Connected — receiving alerts" : "Get notified when your timer runs low"}
                                </p>
                            </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--text-dim)] group-hover:text-[var(--text-muted)] transition-colors" />
                    </a>
                </div>
            </div>
        </div>
    );
}
