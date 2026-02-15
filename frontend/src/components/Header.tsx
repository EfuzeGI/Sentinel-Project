"use client";

import { useNear } from "@/contexts/NearContext";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut } from "lucide-react";

export type TabId = "protocol" | "dashboard" | "create" | "access" | "architecture" | "about";

interface HeaderProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
}

interface NavItem {
    id: TabId;
    label: string;
    requiresAuth?: boolean;
    requiresVault?: boolean;
    requiresNoVault?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { id: "protocol", label: "Home" },
    { id: "dashboard", label: "Dashboard", requiresAuth: true, requiresVault: true },
    { id: "create", label: "Create", requiresAuth: true, requiresNoVault: true },
    { id: "access", label: "Access", requiresAuth: true },
    { id: "architecture", label: "Architecture" },
    { id: "about", label: "About" },
];

export function Header({ activeTab, onTabChange }: HeaderProps) {
    const { accountId, isConnected, isLoading, connect, disconnect, vaultStatus } = useNear();
    const hasVault = vaultStatus !== null && vaultStatus.is_initialized;

    const visibleTabs = NAV_ITEMS.filter(item => {
        if (item.requiresAuth && !isConnected) return false;
        if (item.requiresVault && !hasVault) return false;
        if (item.requiresNoVault && hasVault) return false;
        return true;
    });

    return (
        <header className="sticky top-0 z-50 w-full border-b border-[var(--border)]" style={{ backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
            <div className="max-w-[1200px] mx-auto flex h-14 items-center justify-between px-8">
                {/* Logo */}
                <button
                    onClick={() => onTabChange("protocol")}
                    className="flex items-center gap-2.5 hover:opacity-70 transition-opacity"
                >
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                    <span className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
                        KeepAlive
                    </span>
                </button>

                {/* Center Nav */}
                <nav className="hidden md:flex items-center gap-1">
                    {visibleTabs.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`px-4 py-1.5 text-[14px] transition-colors ${activeTab === item.id
                                    ? "text-[var(--text)] font-medium"
                                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                                }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Right: Wallet */}
                <div className="flex items-center gap-3">
                    {isLoading ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border border-[var(--border)] border-t-[var(--text-muted)]" />
                    ) : isConnected ? (
                        <div className="flex items-center gap-3">
                            <span className="text-[14px] font-mono text-[var(--text)]">
                                {accountId}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={disconnect}
                                className="text-[var(--text-dim)] hover:text-[var(--text)] h-8 w-8 p-0"
                            >
                                <LogOut className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <button
                            onClick={connect}
                            className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] hover:border-[var(--border-hover)] text-[var(--text)] text-[13px] font-medium transition-colors"
                        >
                            <Wallet className="h-3.5 w-3.5" />
                            Connect
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
