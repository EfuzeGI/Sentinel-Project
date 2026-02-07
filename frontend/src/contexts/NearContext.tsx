"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { setupWalletSelector, WalletSelector } from "@near-wallet-selector/core";
import { setupModal, WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { actionCreators } from "@near-js/transactions";
import { CONTRACT_ID, NETWORK_ID } from "@/config/near";
import "@near-wallet-selector/modal-ui/styles.css";

const { functionCall } = actionCreators;

// Multiple RPC endpoints for fallback - fastnear first for speed
const RPC_ENDPOINTS = [
    "https://testnet.rpc.fastnear.com",
    "https://near-testnet.drpc.org",
    "https://rpc.testnet.near.org",
];

// Polling interval (30 seconds)
const POLLING_INTERVAL = 30000;

// localStorage keys
const STORAGE_KEY_INITIALIZED = "sentinel_vault_initialized";
const STORAGE_KEY_CACHED_STATUS = "sentinel_vault_status";

// Types
interface VaultStatus {
    owner_id: string;
    beneficiary_id: string;
    last_active: string;
    heartbeat_interval_ms: string;
    grace_period_ms: string;
    vault_balance: string;
    is_emergency: boolean;
    is_initialized: boolean;
    time_remaining_ms: string;
    is_expired: boolean;
    // Warning Protocol fields
    warning_triggered_at: string;
    warning_grace_remaining_ms: string;
    is_warning_active: boolean;
    is_execution_ready: boolean;
    is_yielding: boolean;
}

interface NearContextType {
    selector: WalletSelector | null;
    modal: WalletSelectorModal | null;
    accountId: string | null;
    isConnected: boolean;
    isLoading: boolean;
    isSyncing: boolean;
    isTransactionPending: boolean;
    connectionError: string | null;
    vaultStatus: VaultStatus | null;
    contractId: string;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    ping: () => Promise<void>;
    checkPulse: () => Promise<{ status: string; time_remaining_ms: string; is_emergency: boolean } | null>;
    deposit: (amount: string) => Promise<void>;
    withdraw: (amount?: string) => Promise<void>;
    initVault: (beneficiary: string, interval: number) => Promise<void>;
    updateBeneficiary: (newBeneficiary: string) => Promise<void>;
    updateInterval: (newInterval: number) => Promise<void>;
    updateGracePeriod: (newGracePeriod: number) => Promise<void>;
    resetVault: () => Promise<void>;
    refreshStatus: () => Promise<void>;
}

const NearContext = createContext<NearContextType | null>(null);

// Helper to safely access localStorage
const safeLocalStorage = {
    getItem: (key: string): string | null => {
        if (typeof window === "undefined") return null;
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(key, value);
        } catch {
            // Ignore storage errors
        }
    },
    removeItem: (key: string): void => {
        if (typeof window === "undefined") return;
        try {
            localStorage.removeItem(key);
        } catch {
            // Ignore storage errors
        }
    }
};

// Call view method with RPC fallback - tries each endpoint until one works
async function callViewMethodWithFallback(methodName: string, args: object = {}): Promise<unknown> {
    const argsBase64 = btoa(JSON.stringify(args));
    let lastError: Error | null = null;

    for (const rpcUrl of RPC_ENDPOINTS) {
        console.log("Trying RPC:", rpcUrl);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(rpcUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: "dontcare",
                    method: "query",
                    params: {
                        request_type: "call_function",
                        finality: "optimistic",
                        account_id: CONTRACT_ID,
                        method_name: methodName,
                        args_base64: argsBase64,
                    },
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log("RPC Response from", rpcUrl, ":", data);

            if (data.error) {
                // Check if it's a "contract not found" error - this means vault doesn't exist
                const errorMessage = data.error.message || JSON.stringify(data.error);
                if (errorMessage.includes("doesn't exist") || errorMessage.includes("MethodNotFound")) {
                    console.log("Contract/method not found - vault not initialized");
                    return null;
                }
                throw new Error(errorMessage);
            }

            if (data.result?.result) {
                const bytes = new Uint8Array(data.result.result);
                const text = new TextDecoder().decode(bytes);
                console.log("Decoded result:", text);
                return JSON.parse(text);
            }

            return null;
        } catch (error) {
            console.error(`RPC ${rpcUrl} failed:`, error);
            lastError = error instanceof Error ? error : new Error(String(error));
            // Continue to next RPC endpoint
        }
    }

    // All endpoints failed
    throw lastError || new Error("All RPC endpoints failed");
}

export function NearProvider({ children }: { children: ReactNode }) {
    const [selector, setSelector] = useState<WalletSelector | null>(null);
    const [modal, setModal] = useState<WalletSelectorModal | null>(null);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isTransactionPending, setIsTransactionPending] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);

    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const hasLoadedCacheRef = useRef(false);
    const previousStatusRef = useRef<VaultStatus | null>(null);

    // Load cached status on mount (before RPC call completes)
    useEffect(() => {
        if (hasLoadedCacheRef.current) return;
        hasLoadedCacheRef.current = true;

        const cachedStatus = safeLocalStorage.getItem(STORAGE_KEY_CACHED_STATUS);
        const wasInitialized = safeLocalStorage.getItem(STORAGE_KEY_INITIALIZED) === "true";

        if (cachedStatus && wasInitialized) {
            try {
                const parsed = JSON.parse(cachedStatus) as VaultStatus;
                setVaultStatus(parsed);
                previousStatusRef.current = parsed;
                console.log("Loaded cached vault status - showing dashboard immediately");
            } catch {
                // Invalid cache, ignore
            }
        }
    }, []);

    // Initialize wallet selector
    useEffect(() => {
        const init = async () => {
            try {
                const _selector = await setupWalletSelector({
                    network: NETWORK_ID as "testnet" | "mainnet",
                    modules: [
                        setupMyNearWallet(),
                        setupHereWallet(),
                    ],
                });

                const _modal = setupModal(_selector, {
                    contractId: CONTRACT_ID,
                });

                const state = _selector.store.getState();
                const accounts = state.accounts;

                if (accounts.length > 0) {
                    setAccountId(accounts[0].accountId);
                }

                setSelector(_selector);
                setModal(_modal);

                // Subscribe to account changes
                _selector.store.observable.subscribe((state) => {
                    const accounts = state.accounts;
                    setAccountId(accounts.length > 0 ? accounts[0].accountId : null);
                });

            } catch (error) {
                console.error("Failed to initialize wallet selector:", error);
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, []);

    // Refresh vault status with fallback RPC
    const refreshStatus = useCallback(async (silent: boolean = false) => {
        if (!silent) {
            setIsSyncing(true);
        }
        setConnectionError(null);

        try {
            const status = await callViewMethodWithFallback("get_status") as VaultStatus | null;

            if (status) {
                setVaultStatus(status);
                previousStatusRef.current = status;

                // Cache to localStorage for instant load next time
                if (status.is_initialized) {
                    safeLocalStorage.setItem(STORAGE_KEY_INITIALIZED, "true");
                    safeLocalStorage.setItem(STORAGE_KEY_CACHED_STATUS, JSON.stringify(status));
                }
            } else {
                // Contract returned null - vault truly not initialized
                // But ONLY reset if we don't have previous state
                if (!previousStatusRef.current?.is_initialized) {
                    setVaultStatus({
                        owner_id: "",
                        beneficiary_id: "",
                        last_active: "0",
                        heartbeat_interval_ms: "0",
                        grace_period_ms: "0",
                        vault_balance: "0",
                        is_emergency: false,
                        is_initialized: false,
                        time_remaining_ms: "0",
                        is_expired: false,
                        warning_triggered_at: "0",
                        warning_grace_remaining_ms: "0",
                        is_warning_active: false,
                        is_execution_ready: false,
                        is_yielding: false,
                    });
                }
            }
        } catch (error) {
            console.error("Failed to fetch vault status:", error);
            setConnectionError("Connection issues, retrying...");

            // IMPORTANT: Keep previous state, don't reset to uninitialized
            // The vault is still there, we just can't reach it temporarily
            if (previousStatusRef.current) {
                console.log("Network error - keeping previous dashboard state");
            }
        } finally {
            setIsSyncing(false);
        }
    }, []);

    // Start polling when connected
    useEffect(() => {
        if (accountId) {
            // Initial fetch
            refreshStatus();

            // Start polling
            pollingRef.current = setInterval(() => {
                refreshStatus(true); // silent refresh
            }, POLLING_INTERVAL);

            return () => {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            };
        } else {
            // Clear polling when disconnected
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        }
    }, [accountId, refreshStatus]);

    // Call method helper with transaction pending state
    const callMethod = useCallback(async (
        methodName: string,
        args: object = {},
        gas: bigint = BigInt("30000000000000"),
        depositAmount: bigint = BigInt(0)
    ): Promise<void> => {
        if (!selector) throw new Error("Wallet not initialized");

        setIsTransactionPending(true);

        try {
            const wallet = await selector.wallet();
            const action = functionCall(methodName, args, gas, depositAmount);

            await wallet.signAndSendTransaction({
                receiverId: CONTRACT_ID,
                actions: [action],
            });
        } finally {
            setIsTransactionPending(false);
        }
    }, [selector]);

    // Connect wallet
    const connect = useCallback(async () => {
        if (modal) {
            modal.show();
        }
    }, [modal]);

    // Disconnect wallet
    const disconnect = useCallback(async () => {
        if (!selector) return;

        const wallet = await selector.wallet();
        await wallet.signOut();
        setAccountId(null);
        setVaultStatus(null);
        previousStatusRef.current = null;

        // Clear cache on disconnect
        safeLocalStorage.removeItem(STORAGE_KEY_INITIALIZED);
        safeLocalStorage.removeItem(STORAGE_KEY_CACHED_STATUS);
    }, [selector]);

    // Contract methods
    const ping = useCallback(async () => {
        await callMethod("ping", {});
        await refreshStatus();
    }, [callMethod, refreshStatus]);

    const checkPulse = useCallback(async () => {
        try {
            await callMethod("check_pulse", {}, BigInt("100000000000000"));
            await refreshStatus();
            return vaultStatus ? {
                status: vaultStatus.is_expired ? "TRIGGERED" : "SAFE",
                time_remaining_ms: vaultStatus.time_remaining_ms,
                is_emergency: vaultStatus.is_emergency,
            } : null;
        } catch (error) {
            console.error("check_pulse failed:", error);
            return null;
        }
    }, [callMethod, refreshStatus, vaultStatus]);

    const deposit = useCallback(async (amount: string) => {
        const nearAmount = parseFloat(amount);
        const yoctoAmount = BigInt(Math.floor(nearAmount * 1e24));
        await callMethod("deposit", {}, BigInt("30000000000000"), yoctoAmount);
        await refreshStatus();
    }, [callMethod, refreshStatus]);

    const withdraw = useCallback(async (amount?: string) => {
        const args = amount
            ? { amount: BigInt(Math.floor(parseFloat(amount) * 1e24)).toString() }
            : {};
        await callMethod("withdraw", args);
        await refreshStatus();
    }, [callMethod, refreshStatus]);

    const initVault = useCallback(async (beneficiary: string, interval: number) => {
        await callMethod(
            "setup_vault",
            { beneficiary, interval },
            BigInt("100000000000000"),
            BigInt(0)
        );

        // Mark as initialized in localStorage immediately
        safeLocalStorage.setItem(STORAGE_KEY_INITIALIZED, "true");
        await refreshStatus();
    }, [callMethod, refreshStatus]);

    const updateBeneficiary = useCallback(async (newBeneficiary: string) => {
        await callMethod("update_beneficiary", { new_beneficiary: newBeneficiary });
        await refreshStatus();
    }, [callMethod, refreshStatus]);

    const updateInterval = useCallback(async (newInterval: number) => {
        await callMethod("update_interval", { new_interval: newInterval });
        await refreshStatus();
    }, [callMethod, refreshStatus]);

    const updateGracePeriod = useCallback(async (newGracePeriod: number) => {
        await callMethod("update_grace_period", { new_grace_period: newGracePeriod });
        await refreshStatus();
    }, [callMethod, refreshStatus]);

    const resetVault = useCallback(async () => {
        await callMethod("reset_vault", {}, BigInt("100000000000000"));
        // Clear localStorage cache
        safeLocalStorage.removeItem(STORAGE_KEY_INITIALIZED);
        safeLocalStorage.removeItem(STORAGE_KEY_CACHED_STATUS);
        previousStatusRef.current = null;
        await refreshStatus();
    }, [callMethod, refreshStatus]);

    const value: NearContextType = {
        selector,
        modal,
        accountId,
        isConnected: !!accountId,
        isLoading,
        isSyncing,
        isTransactionPending,
        connectionError,
        vaultStatus,
        contractId: CONTRACT_ID,
        connect,
        disconnect,
        ping,
        checkPulse,
        deposit,
        withdraw,
        initVault,
        updateBeneficiary,
        updateInterval,
        updateGracePeriod,
        resetVault,
        refreshStatus,
    };

    return (
        <NearContext.Provider value={value}>
            {children}
        </NearContext.Provider>
    );
}

export function useNear() {
    const context = useContext(NearContext);
    if (!context) {
        throw new Error("useNear must be used within a NearProvider");
    }
    return context;
}
