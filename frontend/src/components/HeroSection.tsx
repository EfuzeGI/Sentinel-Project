"use client";

import { useNear } from "@/contexts/NearContext";
import { ArrowRight, Vault, Activity, Send } from "lucide-react";

export function HeroSection() {
    const { connect, isConnected } = useNear();

    return (
        <div className="flex flex-col">
            {/* ═══ HERO ═══ */}
            <div className="relative min-h-[100vh] flex items-center justify-center px-8 overflow-hidden pb-0 pt-24">

                {/* ── Background Glow ── */}
                <div
                    className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)", filter: "blur(80px)" }}
                />



                {/* ── Center Content ── */}
                <div className="max-w-[1000px] w-full text-center relative z-10 flex flex-col items-center">
                    <h1 className="animate-reveal text-[clamp(3.5rem,7vw,5.5rem)] font-extrabold leading-[1.0] tracking-tight mb-8">
                        <span
                            className="block"
                            style={{
                                background: "linear-gradient(180deg, #ffffff 0%, #71717a 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            Preserve your legacy.
                        </span>
                        <span
                            className="block"
                            style={{
                                background: "linear-gradient(180deg, #ffffff 20%, #71717a 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                            }}
                        >
                            Automate your inheritance.
                        </span>
                    </h1>

                    <p className="animate-reveal delay-1 text-[18px] text-gray-400 leading-relaxed max-w-[580px] mx-auto mb-12">
                        Ensure your digital assets are securely transferred to your beneficiaries if you ever go silent.
                        An automated inheritance protocol, built on NEAR.
                    </p>

                    <div className="animate-reveal delay-2 mb-16 flex items-center justify-center gap-4">
                        {isConnected ? (
                            <button
                                onClick={() => {
                                    const evt = new CustomEvent("sentinel:navigate", { detail: "dashboard" });
                                    window.dispatchEvent(evt);
                                }}
                                className="group inline-flex items-center gap-3 px-12 py-4 bg-white text-black text-[15px] font-bold tracking-wide transition-all hover:bg-gray-200"
                                style={{ boxShadow: "0 0 40px rgba(255,255,255,0.08)" }}
                            >
                                Open Dashboard
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </button>
                        ) : (
                            <button
                                onClick={connect}
                                className="group inline-flex items-center gap-3 px-12 py-4 bg-white text-black text-[15px] font-bold tracking-wide transition-all hover:bg-gray-200"
                                style={{ boxShadow: "0 0 40px rgba(255,255,255,0.08)" }}
                            >
                                Launch KeepAlive
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                const evt = new CustomEvent("sentinel:navigate", { detail: "architecture" });
                                window.dispatchEvent(evt);
                            }}
                            className="inline-flex items-center gap-2 px-8 py-4 border border-white/[0.15] text-white/70 text-[15px] font-medium tracking-wide transition-all hover:border-white/30 hover:text-white"
                        >
                            Architecture
                        </button>
                    </div>

                    {/* ── Mockup Card (Real Dashboard) ── */}
                    <div
                        className="animate-reveal delay-3 w-full max-w-[820px]"
                        style={{
                            WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                            maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                        }}
                    >
                        <div
                            className="w-full border border-white/[0.08] bg-[#111111]/95 backdrop-blur-md overflow-hidden"
                            style={{ boxShadow: "0 12px 60px rgba(0,0,0,0.5)" }}
                        >
                            {/* ─ Status Bar ─ */}
                            <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/[0.06]">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse-dot" />
                                    <span className="text-[11px] font-mono text-gray-400 tracking-wider">SWITCH STATUS: <span className="text-white font-bold">ACTIVE</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-gray-600 px-3 py-1 border border-white/[0.06]">Refresh</span>
                                    <span className="text-[10px] font-mono text-red-400/60 px-3 py-1 border border-red-400/10">Reset Vault</span>
                                </div>
                            </div>

                            {/* ─ Two-Column Body ─ */}
                            <div className="grid grid-cols-[1.2fr_1fr]">
                                {/* LEFT: Timer + Ping */}
                                <div className="p-6 pr-4">
                                    {/* Timer */}
                                    <div className="text-center mb-6 pt-4">
                                        <div className="flex items-baseline justify-center gap-1">
                                            <div className="text-center">
                                                <span className="text-[48px] font-bold font-mono text-white leading-none">24</span>
                                                <p className="text-[9px] font-mono text-gray-600 tracking-wider mt-1">HOURS</p>
                                            </div>
                                            <span className="text-[32px] font-mono text-gray-600 mx-1">:</span>
                                            <div className="text-center">
                                                <span className="text-[48px] font-bold font-mono text-white leading-none">00</span>
                                                <p className="text-[9px] font-mono text-gray-600 tracking-wider mt-1">MINUTES</p>
                                            </div>
                                            <span className="text-[32px] font-mono text-gray-600 mx-1">:</span>
                                            <div className="text-center">
                                                <span className="text-[48px] font-bold font-mono text-white leading-none">00</span>
                                                <p className="text-[9px] font-mono text-gray-600 tracking-wider mt-1">SECONDS</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Trigger / Reset */}
                                    <div className="flex justify-between text-[9px] font-mono text-gray-600 tracking-wider mb-3 border-t border-white/[0.04] pt-3">
                                        <span>TRIGGER</span>
                                        <span>RESET</span>
                                    </div>

                                    {/* Ping Card */}
                                    <div className="border border-white/[0.08] bg-white/[0.02] p-4 flex items-center gap-4">
                                        <div className="w-9 h-9 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                                            <Activity className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-semibold text-white">Ping</p>
                                            <p className="text-[11px] text-gray-500">Send a heartbeat to reset your countdown timer.</p>
                                        </div>
                                        <span className="text-gray-600 text-[14px]">›</span>
                                    </div>
                                </div>

                                {/* RIGHT: Vault + Settings */}
                                <div className="border-l border-white/[0.06] p-5 space-y-4">
                                    {/* Vault Balance */}
                                    <div>
                                        <p className="text-[9px] font-mono text-gray-600 tracking-wider mb-2">VAULT BALANCE</p>
                                        <p className="text-[28px] font-bold font-mono text-white leading-none">
                                            0.0000 <span className="text-[14px] text-gray-500">NEAR</span>
                                        </p>
                                        <div className="flex gap-2 mt-3">
                                            <div className="flex-1 border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[11px] font-mono text-gray-600">0.0</div>
                                            <div className="px-4 py-2 border border-white/[0.08] text-[11px] font-mono text-white">Deposit</div>
                                        </div>
                                        <div className="border border-white/[0.06] text-center py-2 mt-2 text-[11px] font-mono text-gray-500">Withdraw All</div>
                                    </div>

                                    {/* Settings rows */}
                                    <div className="space-y-0 border-t border-white/[0.06] pt-3">
                                        <div className="flex items-center justify-between py-2.5">
                                            <span className="text-[12px] text-gray-400">Interval</span>
                                            <span className="text-[12px] font-mono font-bold text-white">1d</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2.5">
                                            <span className="text-[12px] text-gray-400">Grace Period</span>
                                            <span className="text-[12px] font-mono font-bold text-red-400">1d</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2.5">
                                            <span className="text-[12px] text-gray-400">Beneficiary</span>
                                            <span className="text-[12px] font-mono font-bold text-white">firmmask5591.near</span>
                                        </div>
                                    </div>

                                    {/* Secret Payload */}
                                    <div className="border-t border-white/[0.06] pt-3">
                                        <p className="text-[13px] font-semibold text-white mb-2">Secret Payload</p>
                                        <div className="border border-white/[0.06] text-center py-2 text-[11px] font-mono text-gray-500">Reveal</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ POWERED BY ═══ */}
            <div className="border-t border-b border-white/[0.06] bg-white/[0.02]">
                <div className="px-8 py-6 flex items-center justify-center gap-0">
                    <span className="text-[11px] font-mono font-bold text-gray-400 tracking-[0.3em] uppercase mr-6">Powered By</span>
                    <div className="w-[1px] h-4 bg-white/[0.12] mr-6" />
                    {["NEAR PROTOCOL", "NOVA IPFS", "AES-256-GCM", "WEB CRYPTO API", "NEXT.JS", "TELEGRAM BOT"].map((name, i, arr) => (
                        <span key={name} className="flex items-center">
                            <span className="text-[12px] font-mono font-bold text-gray-400 hover:text-white transition-colors cursor-default tracking-wide">{name}</span>
                            {i < arr.length - 1 && <span className="text-gray-600 mx-5">·</span>}
                        </span>
                    ))}
                </div>
            </div>

            {/* ═══ HOW IT WORKS ═══ */}
            <div id="how-it-works" className="border-t border-white/[0.06]">
                <div className="max-w-[1200px] mx-auto px-8 py-28">
                    <div className="grid md:grid-cols-[1fr_1.4fr] gap-16 items-start">

                        {/* LEFT: Big heading */}
                        <div className="animate-reveal sticky top-28">
                            <span className="text-[11px] font-mono text-gray-500 tracking-[0.25em] uppercase">How it works</span>
                            <h2 className="text-[clamp(2.2rem,4vw,3.2rem)] font-bold text-white mt-4 leading-[1.1]">
                                Deposit.<br />Heartbeat.<br />Inherit.
                            </h2>
                            <div className="w-10 h-[2px] bg-white/20 mt-6" />
                        </div>

                        {/* RIGHT: Vertical step list */}
                        <div className="space-y-0">
                            {[
                                {
                                    step: "01",
                                    title: "Lock Assets",
                                    desc: "Deposit NEAR into your personal smart contract vault. Add an optional, zero-knowledge encrypted message or private keys for your beneficiary.",
                                },
                                {
                                    step: "02",
                                    title: "Prove You're Alive",
                                    desc: "Ping the contract periodically to reset your custom timer. A Telegram bot will warn you before the grace period expires.",
                                },
                                {
                                    step: "03",
                                    title: "Autonomous Execution",
                                    desc: "If the timer hits zero, the smart contract trustlessly transfers your entire vault balance and reveals the encrypted payload to your designated heir.",
                                },
                            ].map((item, i) => (
                                <div
                                    key={i}
                                    className={`animate-reveal delay-${i + 1} group border-t border-white/[0.08] py-12 flex gap-8 items-start cursor-default hover:bg-white/[0.02] transition-colors duration-500 px-6 -mx-6`}
                                >
                                    <span className="text-[14px] font-mono text-gray-500 pt-1 flex-shrink-0">{item.step}</span>
                                    <div className="flex-1">
                                        <h3 className="text-[24px] font-bold text-white mb-3 group-hover:text-gray-100 transition-colors tracking-tight">{item.title}</h3>
                                        <p className="text-[16px] text-gray-400 leading-[1.8] max-w-[500px]">{item.desc}</p>
                                    </div>
                                    <span className="text-gray-600 text-[20px] pt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-4 group-hover:translate-x-0 transform ease-out">→</span>
                                </div>
                            ))}
                            <div className="border-t border-white/[0.08]" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
