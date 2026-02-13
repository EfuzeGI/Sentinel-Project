"use client";

import { useState } from "react";
import { useNear } from "@/contexts/NearContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Clock, User, Loader2, AlertCircle, Zap, Lock, Cloud } from "lucide-react";
import { uploadEncryptedData, isNovaConfigured } from "@/utils/nova";

// Interval presets in milliseconds
const INTERVAL_PRESETS = [
    { label: "1 hour", value: 60 * 60_000 },
    { label: "1 day", value: 24 * 60 * 60_000 },
    { label: "7 days", value: 7 * 24 * 60 * 60_000 },
    { label: "30 days", value: 30 * 24 * 60 * 60_000 },
];

const GRACE_PERIOD_PRESETS = [
    { label: "1 hour", value: 60 * 60_000 },
    { label: "12 hours", value: 12 * 60 * 60_000 },
    { label: "24 hours", value: 24 * 60 * 60_000 },
];

export function CreateVault() {
    const { setupVault, isTransactionPending, accountId } = useNear();

    const [beneficiary, setBeneficiary] = useState("");
    const [intervalMs, setIntervalMs] = useState(7 * 24 * 60 * 60_000); // Default 7 days
    const [gracePeriodMs, setGracePeriodMs] = useState(24 * 60 * 60_000); // Default 24 hours
    const [error, setError] = useState<string | null>(null);

    // Custom minute input states
    const [showCustomInterval, setShowCustomInterval] = useState(false);
    const [customIntervalMinutes, setCustomIntervalMinutes] = useState("");
    const [showCustomGrace, setShowCustomGrace] = useState(false);
    const [customGraceMinutes, setCustomGraceMinutes] = useState("");
    const [securePayload, setSecurePayload] = useState("");
    const [novaStatus, setNovaStatus] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!beneficiary.trim()) {
            setError("Beneficiary address is required");
            return;
        }

        if (!beneficiary.endsWith(".testnet") && !beneficiary.endsWith(".near")) {
            setError("Invalid NEAR address format (must end with .testnet or .near)");
            return;
        }

        if (beneficiary === accountId) {
            setError("Beneficiary cannot be the same as owner");
            return;
        }

        try {
            let payloadToStore = securePayload || undefined;

            // Upload to NOVA if secret exists and NOVA is configured
            if (payloadToStore && isNovaConfigured()) {
                setNovaStatus("Archiving to NOVA Decentralized Storage...");
                try {
                    payloadToStore = await uploadEncryptedData(payloadToStore);
                    if (payloadToStore.startsWith("NOVA:")) {
                        setNovaStatus("✅ Archived to NOVA (IPFS)");
                    } else {
                        setNovaStatus("⚠️ NOVA unavailable, storing directly");
                    }
                } catch {
                    setNovaStatus("⚠️ NOVA unavailable, storing directly");
                }
            }

            await setupVault(beneficiary, intervalMs, gracePeriodMs, payloadToStore);
            setNovaStatus(null);
        } catch (err) {
            console.error("Failed to create vault:", err);
            setError(err instanceof Error ? err.message : "Failed to create vault");
            setNovaStatus(null);
        }
    };

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
            <Card className="w-full max-w-lg bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
                <CardHeader className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl text-white">Create Your Vault</CardTitle>
                        <CardDescription className="text-slate-400 mt-2">
                            Set up a Dead Man&apos;s Switch to protect your assets
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Beneficiary Input */}
                        <div className="space-y-2">
                            <Label htmlFor="beneficiary" className="text-slate-300 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Beneficiary Address
                            </Label>
                            <Input
                                id="beneficiary"
                                type="text"
                                placeholder="friend.testnet"
                                value={beneficiary}
                                onChange={(e) => setBeneficiary(e.target.value)}
                                className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                                disabled={isTransactionPending}
                            />
                            <p className="text-xs text-slate-500">
                                This address will receive your funds if you stop sending heartbeats
                            </p>
                        </div>

                        {/* Heartbeat Interval */}
                        <div className="space-y-2">
                            <Label className="text-slate-300 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Heartbeat Interval
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                {INTERVAL_PRESETS.map((preset) => (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onClick={() => {
                                            setIntervalMs(preset.value);
                                            setShowCustomInterval(false);
                                            setCustomIntervalMinutes("");
                                        }}
                                        className={`p-2 text-sm rounded-lg border transition-all ${intervalMs === preset.value && !showCustomInterval
                                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                                            : "bg-slate-800/50 border-slate-600 text-slate-400 hover:border-slate-500"
                                            }`}
                                        disabled={isTransactionPending}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setShowCustomInterval(!showCustomInterval)}
                                    className={`p-2 text-sm rounded-lg border transition-all ${showCustomInterval
                                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                                        : "bg-slate-800/50 border-slate-600 text-slate-400 hover:border-slate-500"
                                        }`}
                                    disabled={isTransactionPending}
                                >
                                    Custom ⚙️
                                </button>
                            </div>
                            {showCustomInterval && (
                                <div className="flex gap-2 items-center mt-2">
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="Minutes"
                                        value={customIntervalMinutes}
                                        onChange={(e) => {
                                            setCustomIntervalMinutes(e.target.value);
                                            const minutes = parseInt(e.target.value);
                                            if (minutes > 0) {
                                                setIntervalMs(minutes * 60_000);
                                            }
                                        }}
                                        className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                                        disabled={isTransactionPending}
                                    />
                                    <span className="text-slate-400 text-sm whitespace-nowrap">minutes</span>
                                </div>
                            )}
                            <p className="text-xs text-slate-500">
                                How often you need to send a heartbeat to keep your vault safe
                            </p>
                        </div>

                        {/* Grace Period */}
                        <div className="space-y-2">
                            <Label className="text-slate-300 flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                Warning Grace Period
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                {GRACE_PERIOD_PRESETS.map((preset) => (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onClick={() => {
                                            setGracePeriodMs(preset.value);
                                            setShowCustomGrace(false);
                                            setCustomGraceMinutes("");
                                        }}
                                        className={`p-2 text-sm rounded-lg border transition-all ${gracePeriodMs === preset.value && !showCustomGrace
                                            ? "bg-amber-500/20 border-amber-500 text-amber-400"
                                            : "bg-slate-800/50 border-slate-600 text-slate-400 hover:border-slate-500"
                                            }`}
                                        disabled={isTransactionPending}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setShowCustomGrace(!showCustomGrace)}
                                    className={`p-2 text-sm rounded-lg border transition-all ${showCustomGrace
                                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                                        : "bg-slate-800/50 border-slate-600 text-slate-400 hover:border-slate-500"
                                        }`}
                                    disabled={isTransactionPending}
                                >
                                    Custom ⚙️
                                </button>
                            </div>
                            {showCustomGrace && (
                                <div className="flex gap-2 items-center mt-2">
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="Minutes"
                                        value={customGraceMinutes}
                                        onChange={(e) => {
                                            setCustomGraceMinutes(e.target.value);
                                            const minutes = parseInt(e.target.value);
                                            if (minutes > 0) {
                                                setGracePeriodMs(minutes * 60_000);
                                            }
                                        }}
                                        className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                                        disabled={isTransactionPending}
                                    />
                                    <span className="text-slate-400 text-sm whitespace-nowrap">minutes</span>
                                </div>
                            )}
                            <p className="text-xs text-slate-500">
                                Time you have to respond after warning is triggered
                            </p>
                        </div>

                        {/* Secure Payload (NOVA) */}
                        <div className="space-y-2">
                            <Label htmlFor="securePayload" className="text-slate-300 flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                Secret Message (Optional)
                            </Label>
                            <textarea
                                id="securePayload"
                                placeholder="Enter seed phrase, private key, or any secret to pass on..."
                                value={securePayload}
                                onChange={(e) => setSecurePayload(e.target.value)}
                                className="w-full min-h-[80px] px-3 py-2 rounded-md bg-slate-800/50 border border-slate-600 text-white placeholder:text-slate-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                                disabled={isTransactionPending}
                            />
                            <p className="text-xs text-slate-500">
                                🔐 This secret will only be revealed to your beneficiary after the vault triggers (Dead Man&apos;s Switch)
                            </p>
                            {isNovaConfigured() && securePayload && (
                                <p className="text-xs text-purple-400 flex items-center gap-1">
                                    <Cloud className="w-3 h-3" />
                                    Will be archived to NOVA decentralized storage (IPFS)
                                </p>
                            )}
                        </div>

                        {/* NOVA Upload Status */}
                        {novaStatus && (
                            <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-300 text-sm">
                                {novaStatus.startsWith("✅") ? null : <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                                {novaStatus}
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            disabled={isTransactionPending || !beneficiary}
                            className="w-full h-12 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold"
                        >
                            {isTransactionPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating Vault...
                                </>
                            ) : (
                                <>
                                    <Shield className="w-4 h-4 mr-2" />
                                    Initialize Vault
                                </>
                            )}
                        </Button>

                        {/* Info Box */}
                        <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
                            <h4 className="text-sm font-medium text-slate-300 mb-2">How it works:</h4>
                            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                                <li>Create your vault and deposit NEAR tokens</li>
                                <li>Send periodic heartbeats to prove you&apos;re active</li>
                                <li>If you miss a heartbeat, a warning is triggered</li>
                                <li>After the grace period, funds transfer to beneficiary</li>
                            </ol>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
