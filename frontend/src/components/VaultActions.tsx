"use client";

import { useState } from "react";
import { useNear } from "@/contexts/NearContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Heart,
    Plus,
    Minus,
    Settings,
    Zap,
    Send,
    RefreshCw,
    Clock,
    User,
    AlertCircle,
    AlertTriangle,
    ExternalLink,
    Loader2
} from "lucide-react";

export function VaultActions() {
    const {
        accountId,
        vaultStatus,
        isConnected,
        isTransactionPending,
        isSyncing,
        connectionError,
        contractId,
        ping,
        deposit,
        withdraw,
        setupVault,
        updateBeneficiary,
        updateInterval,
        updateGracePeriod,
        resetVault,
        checkPulse,
        refreshStatus
    } = useNear();

    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [depositAmount, setDepositAmount] = useState("");
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [initBeneficiary, setInitBeneficiary] = useState("");
    const [initInterval, setInitInterval] = useState("2");
    const [intervalUnit, setIntervalUnit] = useState<"minutes" | "days">("minutes");
    const [newBeneficiary, setNewBeneficiary] = useState("");
    const [newInterval, setNewInterval] = useState("");
    const [selectedGracePeriod, setSelectedGracePeriod] = useState<string>("");

    const handleAction = async (action: string, fn: () => Promise<unknown>, successMessage?: string) => {
        setIsLoading(action);
        setError(null);
        setSuccess(null);
        try {
            await fn();
            if (successMessage) {
                setSuccess(successMessage);
                // Clear success message after 3 seconds
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
            console.error(`${action} failed:`, err);
            setError(`${action} failed: ${errorMessage}`);
        } finally {
            setIsLoading(null);
        }
    };

    // Disable all buttons if any transaction is pending
    const isAnyLoading = isLoading !== null || isTransactionPending;

    if (!isConnected) {
        return null;
    }

    const isOwner = vaultStatus?.owner_id === accountId;
    const isInitialized = vaultStatus?.is_initialized;
    const isCompleted = vaultStatus?.is_completed;

    // Show loading spinner while syncing with blockchain (only if no cached data)
    if (isSyncing && !vaultStatus) {
        return (
            <Card className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 border-slate-800/50 backdrop-blur-xl">
                <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                        <Loader2 className="relative h-12 w-12 text-emerald-400 animate-spin" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-white">
                            {connectionError ? "Connection issues, retrying..." : "Syncing with Blockchain..."}
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">
                            {connectionError || "Loading your vault data"}
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Show initialization form if vault not initialized
    if (!isInitialized) {
        return (
            <Card className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 border-slate-800/50 backdrop-blur-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-lg rounded-full" />
                            <Zap className="relative h-6 w-6 text-emerald-400" />
                        </div>
                        <span className="text-white">Initialize Your Vault</span>
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                        Set up your vault by configuring your beneficiary and heartbeat interval.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Contract Info */}
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>Contract:</span>
                            <code className="px-2 py-0.5 rounded bg-black/30 text-emerald-400 font-mono">
                                {contractId}
                            </code>
                            <a
                                href={`https://testnet.nearblocks.io/address/${contractId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-400 hover:text-cyan-300"
                            >
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <Alert variant="destructive" className="bg-red-900/20 border-red-500/30">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription className="text-sm">
                                {error}
                                {error.includes("RPC error") && (
                                    <p className="mt-2 text-slate-400">
                                        The contract may not be deployed yet. Please deploy the contract first.
                                    </p>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label className="text-slate-300">Beneficiary Account ID</Label>
                        <Input
                            placeholder="beneficiary.testnet"
                            value={initBeneficiary}
                            onChange={(e) => setInitBeneficiary(e.target.value)}
                            className="bg-black/30 border-slate-700 text-white placeholder:text-slate-500"
                        />
                        <p className="text-xs text-slate-500">
                            This account will receive your funds if the dead man&apos;s switch triggers.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-slate-300">Heartbeat Interval</Label>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                placeholder="2"
                                min="1"
                                value={initInterval}
                                onChange={(e) => setInitInterval(e.target.value)}
                                className="bg-black/30 border-slate-700 text-white placeholder:text-slate-500 flex-1"
                            />
                            <div className="flex rounded-lg overflow-hidden border border-slate-700">
                                <button
                                    type="button"
                                    onClick={() => setIntervalUnit("minutes")}
                                    className={`px-3 py-2 text-sm font-medium transition-colors ${intervalUnit === "minutes"
                                        ? "bg-emerald-500 text-black"
                                        : "bg-slate-800 text-slate-400 hover:text-white"
                                        }`}
                                >
                                    Minutes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIntervalUnit("days")}
                                    className={`px-3 py-2 text-sm font-medium transition-colors ${intervalUnit === "days"
                                        ? "bg-emerald-500 text-black"
                                        : "bg-slate-800 text-slate-400 hover:text-white"
                                        }`}
                                >
                                    Days
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500">
                            {intervalUnit === "minutes"
                                ? "⚡ Demo mode: Quick testing with minute intervals (min: 1 minute)"
                                : "You must ping at least once within this period to keep the vault active."}
                        </p>
                    </div>

                    <Button
                        onClick={() => handleAction("init", async () => {
                            const intervalValue = parseInt(initInterval);
                            const intervalMs = intervalUnit === "minutes"
                                ? intervalValue * 60 * 1000  // Minutes to ms
                                : intervalValue * 24 * 60 * 60 * 1000; // Days to ms
                            await setupVault(initBeneficiary, intervalMs);
                        })}
                        disabled={isLoading === "init" || !initBeneficiary}
                        className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-semibold"
                    >
                        {isLoading === "init" ? (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Initializing...
                            </>
                        ) : (
                            <>
                                <Zap className="mr-2 h-4 w-4" />
                                Initialize Vault
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 border-slate-800/50 backdrop-blur-xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-lg rounded-full" />
                        <Settings className="relative h-6 w-6 text-emerald-400" />
                    </div>
                    <span className="text-white">Vault Actions</span>
                </CardTitle>
                <CardDescription className="text-slate-400">
                    Manage your Sentinel Vault and funds.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="heartbeat" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-black/30">
                        <TabsTrigger value="heartbeat" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                            Heartbeat
                        </TabsTrigger>
                        <TabsTrigger value="deposit" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                            Deposit
                        </TabsTrigger>
                        <TabsTrigger value="withdraw" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                            Withdraw
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                            Settings
                        </TabsTrigger>
                    </TabsList>

                    {/* Heartbeat Tab */}
                    <TabsContent value="heartbeat" className="space-y-4 mt-6">
                        {/* Success Message */}
                        {success && (
                            <Alert className="bg-emerald-900/20 border-emerald-500/30">
                                <Heart className="h-4 w-4 text-emerald-400" />
                                <AlertTitle className="text-emerald-400">Success!</AlertTitle>
                                <AlertDescription className="text-emerald-300">
                                    {success}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Error Message */}
                        {error && (
                            <Alert variant="destructive" className="bg-red-900/20 border-red-500/30">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid gap-4">
                            {isCompleted ? (
                                /* Vault Completed - Show Create New Vault option */
                                <div className="space-y-4">
                                    <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                        <h4 className="text-lg font-semibold text-slate-300 mb-2">✓ Vault Task Completed</h4>
                                        <p className="text-sm text-slate-400">
                                            This vault task has been completed. To start a new task with fresh settings,
                                            delete this vault and create a new one.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={() => handleAction("reset", resetVault, "Vault deleted. You can now create a new one.")}
                                        disabled={isAnyLoading}
                                        variant="outline"
                                        className="h-14 text-lg border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                                    >
                                        {isLoading === "reset" ? (
                                            <>
                                                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                                Resetting...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="mr-3 h-5 w-5" />
                                                Create New Vault Task
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ) : isOwner && (
                                <Button
                                    onClick={() => handleAction("ping", ping, "Heartbeat sent successfully! Timer reset.")}
                                    disabled={isAnyLoading}
                                    className="h-20 text-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading === "ping" || (isTransactionPending && isLoading === "ping") ? (
                                        <>
                                            <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                                            Transaction Pending...
                                        </>
                                    ) : (
                                        <>
                                            <Heart className="mr-3 h-6 w-6" />
                                            PING - I&apos;m Alive!
                                        </>
                                    )}
                                </Button>
                            )}

                            <Button
                                onClick={() => handleAction("checkPulse", checkPulse)}
                                disabled={isAnyLoading}
                                variant="outline"
                                className="h-12 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                            >
                                {isLoading === "checkPulse" ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Checking...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Check Pulse (Trigger if Expired)
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={() => handleAction("refresh", refreshStatus)}
                                disabled={isAnyLoading}
                                variant="ghost"
                                className="text-slate-400 hover:text-white disabled:opacity-50"
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading === "refresh" ? "animate-spin" : ""}`} />
                                Refresh Status
                            </Button>
                        </div>
                    </TabsContent>

                    {/* Deposit Tab */}
                    <TabsContent value="deposit" className="space-y-4 mt-6">
                        <div className="space-y-2">
                            <Label className="text-slate-300">Amount (NEAR)</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="0.0"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    className="bg-black/30 border-slate-700 text-white placeholder:text-slate-500"
                                />
                                <Button
                                    onClick={() => handleAction("deposit", async () => {
                                        await deposit(depositAmount);
                                        setDepositAmount("");
                                    }, "Deposit successful!")}
                                    disabled={isAnyLoading || !depositAmount}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                                >
                                    {isLoading === "deposit" ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500">
                            Deposit NEAR into your vault. These funds will be protected by the dead man&apos;s switch.
                        </p>
                    </TabsContent>

                    {/* Withdraw Tab */}
                    <TabsContent value="withdraw" className="space-y-4 mt-6">
                        {isOwner ? (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Amount (NEAR) - Leave empty for full withdrawal</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            step="0.1"
                                            placeholder="All funds"
                                            value={withdrawAmount}
                                            onChange={(e) => setWithdrawAmount(e.target.value)}
                                            className="bg-black/30 border-slate-700 text-white placeholder:text-slate-500"
                                        />
                                        <Button
                                            onClick={() => handleAction("withdraw", async () => {
                                                await withdraw(withdrawAmount || undefined);
                                                setWithdrawAmount("");
                                            }, "Withdrawal successful!")}
                                            disabled={isAnyLoading || vaultStatus?.is_emergency}
                                            className="bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
                                        >
                                            {isLoading === "withdraw" ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Minus className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                                {vaultStatus?.is_emergency && (
                                    <p className="text-xs text-red-400">
                                        ⚠️ Withdrawals are blocked during emergency state.
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-slate-400 text-center py-4">
                                Only the vault owner can withdraw funds.
                            </p>
                        )}
                    </TabsContent>

                    {/* Settings Tab */}
                    <TabsContent value="settings" className="space-y-6 mt-6">
                        {isOwner ? (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-slate-300 flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        Update Beneficiary
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="new-beneficiary.testnet"
                                            value={newBeneficiary}
                                            onChange={(e) => setNewBeneficiary(e.target.value)}
                                            className="bg-black/30 border-slate-700 text-white placeholder:text-slate-500"
                                        />
                                        <Button
                                            onClick={() => handleAction("updateBeneficiary", async () => {
                                                await updateBeneficiary(newBeneficiary);
                                                setNewBeneficiary("");
                                            })}
                                            disabled={isLoading === "updateBeneficiary" || !newBeneficiary}
                                            variant="outline"
                                            className="border-slate-700 text-slate-300 hover:bg-slate-800"
                                        >
                                            {isLoading === "updateBeneficiary" ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                "Update"
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-slate-300 flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Update Interval (Days)
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            placeholder="30"
                                            value={newInterval}
                                            onChange={(e) => setNewInterval(e.target.value)}
                                            className="bg-black/30 border-slate-700 text-white placeholder:text-slate-500"
                                        />
                                        <Button
                                            onClick={() => handleAction("updateInterval", async () => {
                                                const intervalMs = parseInt(newInterval) * 24 * 60 * 60 * 1000;
                                                await updateInterval(intervalMs);
                                                setNewInterval("");
                                            })}
                                            disabled={isLoading === "updateInterval" || !newInterval}
                                            variant="outline"
                                            className="border-slate-700 text-slate-300 hover:bg-slate-800"
                                        >
                                            {isLoading === "updateInterval" ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                "Update"
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Warning Grace Period */}
                                <div className="space-y-2">
                                    <Label className="text-slate-300 flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        Warning Grace Period
                                    </Label>
                                    <p className="text-xs text-slate-500">
                                        Time owner has to respond after warning shot. Current: {vaultStatus?.grace_period_ms ?
                                            Number(vaultStatus.grace_period_ms) >= 86400000
                                                ? `${Math.round(Number(vaultStatus.grace_period_ms) / 86400000)} day(s)`
                                                : Number(vaultStatus.grace_period_ms) >= 3600000
                                                    ? `${Math.round(Number(vaultStatus.grace_period_ms) / 3600000)} hour(s)`
                                                    : `${Math.round(Number(vaultStatus.grace_period_ms) / 60000)} minute(s)`
                                            : "24 hours"}
                                    </p>
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedGracePeriod}
                                            onChange={(e) => setSelectedGracePeriod(e.target.value)}
                                            className="flex-1 h-10 px-3 rounded-md bg-black/30 border border-slate-700 text-white text-sm"
                                        >
                                            <option value="">Select period...</option>
                                            <option value="60000">1 Minute (Demo)</option>
                                            <option value="120000">2 Minutes (Demo)</option>
                                            <option value="300000">5 Minutes (Demo)</option>
                                            <option value="3600000">1 Hour</option>
                                            <option value="43200000">12 Hours</option>
                                            <option value="86400000">24 Hours (Default)</option>
                                            <option value="172800000">48 Hours</option>
                                        </select>
                                        <Button
                                            onClick={() => handleAction("updateGracePeriod", async () => {
                                                await updateGracePeriod(parseInt(selectedGracePeriod));
                                                setSelectedGracePeriod("");
                                            }, "Grace period updated!")}
                                            disabled={isLoading === "updateGracePeriod" || !selectedGracePeriod}
                                            variant="outline"
                                            className="border-slate-700 text-slate-300 hover:bg-slate-800"
                                        >
                                            {isLoading === "updateGracePeriod" ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                "Update"
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Connect Telegram */}
                                <div className="p-4 rounded-lg bg-cyan-900/20 border border-cyan-500/30">
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl mt-0.5">📱</span>
                                        <div className="space-y-3 flex-1">
                                            <div>
                                                <h4 className="text-cyan-400 font-medium">Connect Telegram</h4>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Link your Telegram account to receive instant alerts when your vault timer expires.
                                                </p>
                                            </div>
                                            <a
                                                href={`https://t.me/sentinel_near_bot?start=${accountId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center w-full h-10 px-4 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
                                            >
                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                Connect Telegram
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Reset Vault */}
                                <div className="pt-6 border-t border-slate-700/50">
                                    <div className="p-4 rounded-lg bg-amber-900/20 border border-amber-500/30">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                            <div className="space-y-3 flex-1">
                                                <div>
                                                    <h4 className="text-amber-400 font-medium">Reset Vault</h4>
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Reset your vault to create a new one with different settings.
                                                        Any remaining balance will be returned to you.
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={() => handleAction("resetVault", async () => {
                                                        await resetVault();
                                                    }, "Vault reset successfully! You can now create a new vault.")}
                                                    disabled={isAnyLoading}
                                                    variant="outline"
                                                    className="w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
                                                >
                                                    {isLoading === "resetVault" ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Resetting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <RefreshCw className="mr-2 h-4 w-4" />
                                                            Reset Vault & Create New
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-slate-400 text-center py-4">
                                Only the vault owner can modify settings.
                            </p>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
