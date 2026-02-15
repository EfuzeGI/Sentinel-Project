"use client";

import { useState } from "react";
import { useNear } from "@/contexts/NearContext";
import { Loader2, Eye, Copy, Check } from "lucide-react";
import { decryptSecret, unpackE2ELocalPayload, unpackE2EPayload } from "@/utils/encryption";
import { retrieveEncryptedData } from "@/utils/nova";

export function BeneficiaryView() {
    const { revealPayload, isTransactionPending, accountId } = useNear();
    const [ownerInput, setOwnerInput] = useState("");
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleReveal = async () => {
        setError("");
        setResult(null);
        setLoading(true);
        try {
            const targetAccount = ownerInput.trim() || undefined;
            const payload = await revealPayload(targetAccount);
            if (payload) {
                // 1. Try Local Payload
                const localPack = unpackE2ELocalPayload(payload);
                if (localPack) {
                    try {
                        const decrypted = await decryptSecret(localPack.ciphertext, localPack.key, localPack.iv);
                        setResult(decrypted);
                    } catch (e) {
                        console.error("Local decryption failed:", e);
                        setResult(payload);
                        setError("Decryption failed. Showing raw payload.");
                    }
                }
                // 2. Try Nova Payload
                else {
                    const novaPack = unpackE2EPayload(payload);
                    if (novaPack) {
                        try {
                            const ciphertext = await retrieveEncryptedData(`NOVA:${novaPack.cid}`);
                            const decrypted = await decryptSecret(ciphertext, novaPack.key, novaPack.iv);
                            setResult(decrypted);
                        } catch (e) {
                            console.error("Nova retrieval/decryption failed:", e);
                            setResult(payload);
                            setError("Failed to retrieve from Nova/IPFS.");
                        }
                    } else {
                        // 3. Raw
                        setResult(payload);
                    }
                }
            } else {
                setError("No payload found for this vault, or the vault has not triggered yet.");
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to reveal payload.");
        }
        setLoading(false);
    };

    const handleCopy = () => {
        if (result) {
            navigator.clipboard.writeText(result);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="max-w-[500px] mx-auto px-6 py-14">
            <div className="mb-8 animate-reveal">
                <p className="text-[11px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-2">
                    Beneficiary Access
                </p>
                <h2 className="text-[22px] font-bold text-[var(--text)]">Retrieve Inherited Payload</h2>
                <p className="text-[13px] text-[var(--text-muted)] mt-2">
                    If a vault owner&#39;s switch has triggered, you can access the encrypted payload they left for you.
                </p>
            </div>

            <div className="border border-[var(--border)] bg-[var(--surface)] animate-reveal delay-1">
                <div className="p-6">
                    <label className="text-[10px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-2 block">
                        Vault Creator Account ID
                    </label>
                    <input
                        type="text"
                        value={ownerInput}
                        onChange={e => setOwnerInput(e.target.value)}
                        placeholder="e.g. vault-owner.near"
                        className="w-full bg-[var(--bg)] border border-[var(--border)] px-4 py-3 text-[13px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-hover)]"
                    />
                </div>

                <div className="p-6 border-t border-[var(--border)]">
                    <button
                        onClick={handleReveal}
                        disabled={loading || isTransactionPending}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--text)] text-black text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-30"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Eye className="w-3.5 h-3.5" />
                                Reveal Payload
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Result */}
            {result && (
                <div className="mt-4 border border-[var(--border)] bg-[var(--surface)] p-5 animate-reveal">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-[var(--accent)] tracking-widest uppercase">Decrypted Payload</span>
                        <button onClick={handleCopy} className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] transition-colors flex items-center gap-1">
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? "Copied" : "Copy"}
                        </button>
                    </div>
                    <div className="bg-[var(--bg)] border border-[var(--border)] p-4 text-[12px] font-mono text-[var(--text-muted)] break-all">
                        {result}
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mt-4 border border-red-900/40 bg-red-950/20 p-4 text-[12px] text-red-400/80 animate-reveal">
                    {error}
                </div>
            )}
        </div>
    );
}
