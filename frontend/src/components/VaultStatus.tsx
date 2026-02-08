"use client";

import { useEffect, useState } from "react";
import { useNear } from "@/contexts/NearContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Heart,
    AlertTriangle,
    Clock,
    Wallet,
    Shield,
    Activity,
    User,
    ArrowRight
} from "lucide-react";

export function VaultStatus() {
    const { vaultStatus, accountId, isConnected } = useNear();
    const [timeRemaining, setTimeRemaining] = useState<string>("");
    const [progressValue, setProgressValue] = useState(100);

    // Format time remaining
    useEffect(() => {
        if (!vaultStatus?.time_remaining_ms) return;

        const updateTime = () => {
            const ms = parseInt(vaultStatus.time_remaining_ms);
            if (ms <= 0) {
                setTimeRemaining("EXPIRED");
                setProgressValue(0);
                return;
            }

            const intervalMs = parseInt(vaultStatus.heartbeat_interval_ms);
            const elapsed = intervalMs - ms;
            const progress = Math.max(0, Math.min(100, (ms / intervalMs) * 100));
            setProgressValue(progress);

            const days = Math.floor(ms / (1000 * 60 * 60 * 24));
            const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((ms % (1000 * 60)) / 1000);

            if (days > 0) {
                setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
            } else if (hours > 0) {
                setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
            } else {
                setTimeRemaining(`${minutes}m ${seconds}s`);
            }
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [vaultStatus]);

    // Format balance
    const formatBalance = (yoctoNear: string) => {
        const near = parseFloat(yoctoNear) / 1e24;
        return near.toFixed(4);
    };

    // Format interval
    const formatInterval = (ms: string) => {
        const totalMs = parseInt(ms);
        const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (days > 0) {
            return `${days} days ${hours} hours`;
        }
        return `${hours} hours`;
    };

    if (!isConnected) {
        return (
            <Card className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 border-slate-800/50 backdrop-blur-xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-slate-500/10 blur-2xl rounded-full" />
                        <Shield className="relative h-16 w-16 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-400 mb-2">
                        Connect Your Wallet
                    </h3>
                    <p className="text-slate-500 text-center max-w-md">
                        Connect your NEAR wallet to view your Sentinel Vault status.
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (!vaultStatus?.is_initialized) {
        return (
            <Card className="bg-gradient-to-br from-amber-900/20 to-slate-900/30 border-amber-800/30 backdrop-blur-xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-amber-500/10 blur-2xl rounded-full" />
                        <AlertTriangle className="relative h-16 w-16 text-amber-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-amber-400 mb-2">
                        Vault Not Initialized
                    </h3>
                    <p className="text-slate-400 text-center max-w-md">
                        Your Sentinel Vault has not been set up yet. Initialize it below to get started.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const isOwner = vaultStatus.owner_id === accountId;
    const isExpired = vaultStatus.is_expired;
    const isEmergency = vaultStatus.is_emergency;
    const isWarningActive = vaultStatus.is_warning_active;
    const isCompleted = vaultStatus.is_completed;
    const isExecutionReady = vaultStatus.is_execution_ready;
    const warningGraceMs = parseInt(vaultStatus.warning_grace_remaining_ms || "0");

    // Format warning grace time
    const formatWarningGrace = (ms: number) => {
        if (ms <= 0) return "0s";
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    return (
        <div className="grid gap-6">
            {/* Main Status Card */}
            <Card className={`relative overflow-hidden backdrop-blur-xl ${isCompleted
                ? "bg-gradient-to-br from-slate-800/30 to-slate-900/30 border-slate-600/30"
                : isEmergency
                    ? "bg-gradient-to-br from-red-900/30 to-slate-900/30 border-red-500/30"
                    : isExpired
                        ? "bg-gradient-to-br from-amber-900/30 to-slate-900/30 border-amber-500/30"
                        : "bg-gradient-to-br from-emerald-900/20 to-slate-900/30 border-emerald-500/20"
                }`}>
                {/* Animated background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className={`absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl ${isEmergency ? "bg-red-500/5" : isExpired ? "bg-amber-500/5" : "bg-emerald-500/5"
                        }`} />
                </div>

                <CardHeader className="relative">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <div className="relative">
                                    {isEmergency ? (
                                        <AlertTriangle className="h-8 w-8 text-red-400 animate-pulse" />
                                    ) : isExpired ? (
                                        <Clock className="h-8 w-8 text-amber-400" />
                                    ) : (
                                        <Heart className="h-8 w-8 text-emerald-400 animate-pulse" />
                                    )}
                                </div>
                                <span className="text-white">Vault Status</span>
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                {isOwner ? "Your vault" : "Viewing vault status"}
                            </CardDescription>
                        </div>
                        <Badge className={`text-sm px-4 py-2 ${isCompleted
                            ? "bg-slate-600/20 text-slate-300 border-slate-500/30"
                            : isEmergency
                                ? "bg-red-500/20 text-red-400 border-red-500/30"
                                : isExpired
                                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            }`}>
                            {isCompleted ? "✓ COMPLETED" : isEmergency ? "🚨 EMERGENCY" : isExpired ? "⚠️ EXPIRED" : "✓ ACTIVE"}
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="relative space-y-6">
                    {/* Time Remaining */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Time Until Switch
                            </span>
                            <span className={`text-xl font-mono font-bold ${isExpired ? "text-amber-400" : "text-emerald-400"
                                }`}>
                                {timeRemaining}
                            </span>
                        </div>
                        <Progress
                            value={progressValue}
                            className={`h-3 ${isExpired ? "bg-amber-950" : "bg-emerald-950"
                                }`}
                        />
                    </div>

                    {/* Warning Status Banner */}
                    {isWarningActive && (
                        <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-6 w-6 text-orange-400 animate-pulse" />
                                <div>
                                    <div className="text-orange-400 font-semibold">
                                        ⏳ WARNING ACTIVE
                                    </div>
                                    <div className="text-orange-300/80 text-sm">
                                        {formatWarningGrace(warningGraceMs)} until execution eligible
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 text-sm text-slate-400">
                                Ping now to cancel the warning and reset your timer.
                            </div>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                <Wallet className="h-4 w-4" />
                                Balance
                            </div>
                            <div className="text-xl font-bold text-white">
                                {formatBalance(vaultStatus.vault_balance)} Ⓝ
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                <Activity className="h-4 w-4" />
                                Interval
                            </div>
                            <div className="text-xl font-bold text-white">
                                {formatInterval(vaultStatus.heartbeat_interval_ms)}
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                <User className="h-4 w-4" />
                                Owner
                            </div>
                            <div className="text-sm font-medium text-white truncate">
                                {vaultStatus.owner_id.slice(0, 12)}...
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-black/30 border border-white/5">
                            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                                <ArrowRight className="h-4 w-4" />
                                Beneficiary
                            </div>
                            <div className="text-sm font-medium text-white truncate">
                                {vaultStatus.beneficiary_id.slice(0, 12)}...
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
