"use client";

import { ExternalLink, Github, Send, BookOpen, Globe } from "lucide-react";

export function AboutPage() {
    return (
        <div className="max-w-[640px] mx-auto px-6 py-14">
            <div className="mb-10 animate-reveal">
                <p className="text-[11px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-2">
                    About
                </p>
                <h1 className="text-[28px] font-bold text-[var(--text)]">KeepAlive Protocol</h1>
            </div>

            <div className="space-y-4 text-[14px] text-[var(--text-muted)] leading-relaxed animate-reveal delay-1">
                <p>
                    <strong className="text-[var(--text)]">KeepAlive</strong> is an automated inheritance protocol.
                    It ensures your crypto assets are securely transferred to a designated beneficiary
                    if you ever become inactive — no intermediaries, no custodians, no trust required.
                </p>
                <p>
                    You deposit funds into a personal smart contract vault and periodically confirm
                    you&apos;re still active. If the countdown expires, the protocol autonomously
                    transfers your entire balance to your heir. Optionally, attach encrypted messages
                    via <strong className="text-[var(--text)]">NOVA</strong> — decrypted only after the transfer triggers.
                </p>
            </div>

            {/* Links */}
            <div className="mt-10 border-t border-[var(--border)] pt-8 animate-reveal delay-2">
                <p className="text-[10px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-5">Links</p>
                <div className="space-y-1">
                    {[
                        { icon: Github, label: "GitHub Repository", url: "https://github.com/EfuzeGI/Sentinel-Project" },
                        { icon: Globe, label: "Smart Contract on NearBlocks", url: "https://nearblocks.io/address/keepalive.near" },
                        { icon: BookOpen, label: "NOVA SDK Documentation", url: "https://nova-sdk.com" },
                        { icon: Send, label: "Telegram Bot (@keepalive_near_bot)", url: "https://t.me/keepalive_near_bot" },
                    ].map((link, i) => (
                        <a
                            key={i}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-3 py-2.5 text-[14px] text-[var(--text)] hover:bg-[var(--surface)] transition-colors group rounded-sm"
                        >
                            <link.icon className="w-4 h-4 text-[var(--text-dim)] group-hover:text-[var(--text-muted)]" />
                            {link.label}
                            <ExternalLink className="w-3 h-3 text-[var(--text-dim)] group-hover:text-[var(--text-muted)] ml-auto" />
                        </a>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-10 border-t border-[var(--border)] pt-6 animate-reveal delay-3">
                <p className="text-[11px] text-[var(--text-dim)]">
                    KeepAlive Protocol — Trustless Digital Inheritance
                </p>
            </div>
        </div>
    );
}
