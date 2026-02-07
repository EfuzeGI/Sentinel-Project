"use client";

import { useNear } from "@/contexts/NearContext";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, Shield } from "lucide-react";

export function Header() {
    const { accountId, isConnected, isLoading, connect, disconnect } = useNear();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/50 backdrop-blur-xl">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
                        <Shield className="relative h-8 w-8 text-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            Sentinel
                        </span>
                        <span className="text-xs text-slate-500">Dead Man's Switch</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-6">
                    <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                        Dashboard
                    </a>
                    <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                        Docs
                    </a>
                    <a href="#" className="text-sm text-slate-400 hover:text-white transition-colors">
                        About
                    </a>
                </nav>

                {/* Wallet Connection */}
                <div className="flex items-center gap-4">
                    {isLoading ? (
                        <div className="flex items-center gap-2 text-slate-400">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
                            <span className="text-sm">Loading...</span>
                        </div>
                    ) : isConnected ? (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-sm text-emerald-400 font-medium">
                                    {accountId?.slice(0, 20)}...
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={disconnect}
                                className="text-slate-400 hover:text-white hover:bg-white/5"
                            >
                                <LogOut className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            onClick={connect}
                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-semibold"
                        >
                            <Wallet className="mr-2 h-4 w-4" />
                            Connect Wallet
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
