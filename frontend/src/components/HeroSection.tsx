"use client";

import { Shield, Clock, Wallet, Bot, ArrowRight, CheckCircle } from "lucide-react";

const features = [
    {
        icon: Shield,
        title: "Self-Custody",
        description: "Your funds remain under your control. No third party can access or move your assets.",
        color: "emerald",
    },
    {
        icon: Clock,
        title: "Dead Man's Switch",
        description: "If you don't ping within your set interval, funds automatically transfer to your beneficiary. Trustless and automatic.",
        color: "cyan",
    },
    {
        icon: Bot,
        title: "Automated Trigger",
        description: "Anyone can call check_pulse to verify and trigger the switch if heartbeat expires.",
        color: "purple",
    },
    {
        icon: Wallet,
        title: "NEAR Native",
        description: "Built on NEAR Protocol for fast, low-cost transactions. Deposit and withdraw NEAR tokens seamlessly.",
        color: "blue",
    },
];

const steps = [
    { step: 1, title: "Connect Wallet", description: "Link your NEAR wallet to get started" },
    { step: 2, title: "Initialize Vault", description: "Set your beneficiary and heartbeat interval" },
    { step: 3, title: "Deposit Funds", description: "Add NEAR tokens to your protected vault" },
    { step: 4, title: "Ping Regularly", description: "Stay active to maintain control of your funds" },
];

export function HeroSection() {
    return (
        <div className="relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />

            <div className="relative container mx-auto px-4 py-24">
                {/* Hero */}
                <div className="text-center max-w-4xl mx-auto mb-20">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 mb-8">
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm text-emerald-400">Built on NEAR Protocol</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold mb-6">
                        <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                            Dead Man&apos;s Switch
                        </span>
                    </h1>

                    <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                        Protect your crypto with an autonomous vault.
                        Funds transfer to your beneficiary if you stop responding.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a
                            href="#dashboard"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-semibold text-lg transition-all"
                        >
                            Get Started
                            <ArrowRight className="h-5 w-5" />
                        </a>
                        <a
                            href="#features"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-medium text-lg transition-all"
                        >
                            Learn More
                        </a>
                    </div>
                </div>

                {/* Features Grid */}
                <div id="features" className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="group relative p-6 rounded-2xl bg-slate-900/50 border border-slate-800/50 hover:border-emerald-500/30 transition-all duration-300"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                            <div className="relative">
                                <div className={`inline-flex p-3 rounded-xl bg-${feature.color}-500/10 mb-4`}>
                                    <feature.icon className={`h-6 w-6 text-${feature.color}-400`} />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">
                                    {feature.title}
                                </h3>
                                <p className="text-slate-400 text-sm">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* How It Works */}
                <div className="max-w-3xl mx-auto">
                    <h2 className="text-3xl font-bold text-white text-center mb-12">
                        How It Works
                    </h2>
                    <div className="grid gap-6">
                        {steps.map((step, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-6 p-6 rounded-2xl bg-slate-900/30 border border-slate-800/30"
                            >
                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-black font-bold text-lg">
                                    {step.step}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-1">
                                        {step.title}
                                    </h3>
                                    <p className="text-slate-400">
                                        {step.description}
                                    </p>
                                </div>
                                <CheckCircle className="ml-auto h-6 w-6 text-emerald-500/30" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
