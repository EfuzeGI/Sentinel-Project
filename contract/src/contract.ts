// Sentinel - Multi-Vault Dead Man's Switch with Yield/Resume + Warning Protocol
// Using simple key-value storage to avoid collection serialization issues

import { NearBindgen, near, call, view } from "near-sdk-js";

const MS = 1_000_000n;
const MIN_INTERVAL_MS = 60_000; // 1 minute
const DEFAULT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_GRACE_PERIOD_MS = 60_000; // 1 minute

// Storage keys
const VAULT_PREFIX = "vault:";
const OWNERS_KEY = "owners";

// Agent account authorized to call agent_ping
const AGENT_ACCOUNT = "agent-keepalive.near";

interface VaultData {
  owner_id: string;
  beneficiary_id: string;
  vault_balance: string;
  heartbeat_interval_ms: string;
  grace_period_ms: string;
  last_active_ns: string;
  warning_triggered_at_ns: string;
  is_yielding: boolean;
  is_emergency: boolean;
  is_completed: boolean;
  telegram_chat_id: string;
  secure_payload: string | null; // Encrypted data (Proxy Contract logic)
}

@NearBindgen({})
export class SentinelRegistry {

  // Helper to get vault using raw storage
  private getVault(accountId: string): VaultData | null {
    const key = VAULT_PREFIX + accountId;
    const data = near.storageRead(key);
    if (!data) return null;
    return JSON.parse(data) as VaultData;
  }

  // Helper to save vault using raw storage
  private saveVault(accountId: string, vault: VaultData): void {
    const key = VAULT_PREFIX + accountId;
    near.storageWrite(key, JSON.stringify(vault));
  }

  // Helper to remove vault
  private removeVault(accountId: string): void {
    const key = VAULT_PREFIX + accountId;
    near.storageRemove(key);
  }

  // Helper to get owners list
  private getOwners(): string[] {
    const data = near.storageRead(OWNERS_KEY);
    if (!data) return [];
    return JSON.parse(data) as string[];
  }

  // Helper to save owners list
  private saveOwners(owners: string[]): void {
    near.storageWrite(OWNERS_KEY, JSON.stringify(owners));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Vault Setup
  // ═══════════════════════════════════════════════════════════════════

  @call({})
  setup_vault({ beneficiary, interval_ms, grace_period_ms, secure_payload }: {
    beneficiary: string;
    interval_ms?: number;
    grace_period_ms?: number;
    secure_payload?: string;
  }): { success: boolean; owner: string } {
    const caller = near.predecessorAccountId();

    // Check if vault already exists
    const existing = this.getVault(caller);
    if (existing) {
      throw new Error("Vault already exists. Use reset_vault to delete first.");
    }

    if (!beneficiary?.length) throw new Error("Beneficiary required");

    const actualInterval = interval_ms && interval_ms >= MIN_INTERVAL_MS
      ? interval_ms
      : DEFAULT_INTERVAL_MS;

    const actualGracePeriod = grace_period_ms && grace_period_ms >= MIN_GRACE_PERIOD_MS
      ? grace_period_ms
      : DEFAULT_GRACE_PERIOD_MS;

    const vault: VaultData = {
      owner_id: caller,
      beneficiary_id: beneficiary,
      vault_balance: "0",
      heartbeat_interval_ms: String(actualInterval),
      grace_period_ms: String(actualGracePeriod),
      last_active_ns: near.blockTimestamp().toString(),
      warning_triggered_at_ns: "0",
      is_yielding: false,
      is_emergency: false,
      is_completed: false,
      telegram_chat_id: "",
      secure_payload: secure_payload || null,
    };

    this.saveVault(caller, vault);

    // Track owner in storage
    const owners = this.getOwners();
    if (!owners.includes(caller)) {
      owners.push(caller);
      this.saveOwners(owners);
    }

    near.log(`Vault created: ${caller} -> ${beneficiary}, interval: ${actualInterval}ms, grace: ${actualGracePeriod}ms, payload: ${!!secure_payload}`);

    return { success: true, owner: caller };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Owner Actions (caller = owner)
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  //  Proxy Contract (NOVA Integration) - Secure Payload Access & Delayed Access
  // ═══════════════════════════════════════════════════════════════════

  @call({})
  reveal_payload({ account_id }: { account_id: string }): string | null {
    const caller = near.predecessorAccountId();
    const vault = this.getVault(account_id);

    if (!vault) {
      throw new Error("Vault not found");
    }

    // 1. Owner always has access
    if (caller === vault.owner_id) {
      return vault.secure_payload;
    }

    // 2. Beneficiary has access ONLY if vault is completed (DEAD state)
    // "Delayed Access" logic approved by NOVA
    if (caller === vault.beneficiary_id) {
      if (vault.is_completed) {
        return vault.secure_payload;
      } else {
        throw new Error("Vault is still active. Access denied.");
      }
    }

    // 3. No one else has access
    throw new Error("Unauthorized: Payload access denied");
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Agent Ping (Auto-Extend)
  // ═══════════════════════════════════════════════════════════════════

  @call({})
  agent_ping({ account_id }: { account_id: string }): { success: boolean; message: string } {
    const caller = near.predecessorAccountId();

    // Security: Only authorized agent can call this
    if (caller !== AGENT_ACCOUNT) {
      throw new Error(`Unauthorized: Only ${AGENT_ACCOUNT} can call agent_ping`);
    }

    const vault = this.getVault(account_id);
    if (!vault) throw new Error(`Vault not found for ${account_id}`);

    // Security: Cannot ping certain states
    if (vault.is_emergency) {
      throw new Error("Cannot ping vault in emergency state");
    }
    if (vault.is_yielding) {
      throw new Error("Cannot ping vault in yielding state");
    }
    if (vault.is_completed) {
      throw new Error("Cannot ping completed vault");
    }

    // Reset timer
    vault.last_active_ns = near.blockTimestamp().toString();

    // Clear warning if active
    if (vault.warning_triggered_at_ns !== "0") {
      vault.warning_triggered_at_ns = "0";
      near.log(`Warning cleared for ${account_id} via agent ping`);
    }

    this.saveVault(account_id, vault);
    near.log(`Agent auto-extended vault for ${account_id}`);

    return { success: true, message: "Agent auto-extend successful" };
  }

  @call({})
  ping(): { success: boolean; message: string } {
    const caller = near.predecessorAccountId();
    const vault = this.getVault(caller);
    if (!vault) throw new Error(`Vault not found for ${caller}. Call setup_vault first.`);

    // Block ping for completed vaults
    if (vault.is_completed) {
      throw new Error("Vault task completed. Create a new vault to start fresh.");
    }

    vault.last_active_ns = near.blockTimestamp().toString();
    vault.warning_triggered_at_ns = "0";

    if (vault.is_yielding) {
      vault.is_yielding = false;
      near.log("Yield cancelled - owner is alive");
    }
    if (vault.is_emergency) {
      vault.is_emergency = false;
      near.log("Emergency cancelled");
    }

    this.saveVault(caller, vault);
    near.log(`Heartbeat confirmed for ${caller}`);

    return { success: true, message: "Heartbeat confirmed" };
  }

  @call({ payableFunction: true })
  deposit(): { new_balance: string } {
    const caller = near.predecessorAccountId();
    const vault = this.getVault(caller);
    if (!vault) throw new Error(`Vault not found for ${caller}. Call setup_vault first.`);

    const amount = near.attachedDeposit();
    if (amount <= 0n) throw new Error("Deposit amount required");

    const currentBalance = BigInt(vault.vault_balance);
    vault.vault_balance = (currentBalance + amount).toString();

    this.saveVault(caller, vault);
    near.log(`Deposit: ${amount} yoctoNEAR. New balance: ${vault.vault_balance}`);

    return { new_balance: vault.vault_balance };
  }

  @call({})
  withdraw({ amount }: { amount?: string }): { withdrawn: string; remaining: string } {
    const caller = near.predecessorAccountId();
    const vault = this.getVault(caller);
    if (!vault) throw new Error(`Vault not found for ${caller}. Call setup_vault first.`);

    if (vault.is_emergency || vault.is_yielding) {
      throw new Error("Vault is locked during emergency/yield state");
    }

    const currentBalance = BigInt(vault.vault_balance);
    const withdrawAmount = amount ? BigInt(amount) : currentBalance;

    if (withdrawAmount <= 0n) throw new Error("Invalid amount");
    if (withdrawAmount > currentBalance) throw new Error("Insufficient balance");

    vault.vault_balance = (currentBalance - withdrawAmount).toString();
    this.saveVault(caller, vault);

    const promise = near.promiseBatchCreate(caller);
    near.promiseBatchActionTransfer(promise, withdrawAmount);

    near.log(`Withdraw: ${withdrawAmount} yoctoNEAR to ${caller}`);

    return { withdrawn: withdrawAmount.toString(), remaining: vault.vault_balance };
  }

  @call({})
  update_beneficiary({ new_beneficiary }: { new_beneficiary: string }): { success: boolean } {
    const caller = near.predecessorAccountId();
    const vault = this.getVault(caller);
    if (!vault) throw new Error(`Vault not found for ${caller}. Call setup_vault first.`);

    if (!new_beneficiary?.length) throw new Error("Beneficiary required");

    vault.beneficiary_id = new_beneficiary;
    this.saveVault(caller, vault);

    near.log(`Beneficiary updated to ${new_beneficiary} for vault ${caller}`);
    return { success: true };
  }

  @call({})
  update_interval({ new_interval_ms }: { new_interval_ms: number }): { success: boolean } {
    const caller = near.predecessorAccountId();
    const vault = this.getVault(caller);
    if (!vault) throw new Error(`Vault not found for ${caller}. Call setup_vault first.`);

    if (new_interval_ms < MIN_INTERVAL_MS) {
      throw new Error(`Interval must be >= ${MIN_INTERVAL_MS}ms`);
    }

    vault.heartbeat_interval_ms = String(new_interval_ms);
    this.saveVault(caller, vault);

    near.log(`Interval updated to ${new_interval_ms}ms for vault ${caller}`);
    return { success: true };
  }

  @call({})
  update_grace_period({ new_grace_period_ms }: { new_grace_period_ms: number }): { success: boolean } {
    const caller = near.predecessorAccountId();
    const vault = this.getVault(caller);
    if (!vault) throw new Error(`Vault not found for ${caller}. Call setup_vault first.`);

    if (new_grace_period_ms < MIN_GRACE_PERIOD_MS) {
      throw new Error(`Grace period must be >= ${MIN_GRACE_PERIOD_MS}ms`);
    }

    vault.grace_period_ms = String(new_grace_period_ms);
    this.saveVault(caller, vault);

    near.log(`Grace period updated to ${new_grace_period_ms}ms for vault ${caller}`);
    return { success: true };
  }

  @call({})
  reset_vault(): { returned_balance: string } {
    const caller = near.predecessorAccountId();
    const vault = this.getVault(caller);
    if (!vault) throw new Error(`Vault not found for ${caller}. Call setup_vault first.`);

    const balance = BigInt(vault.vault_balance);

    if (balance > 0n) {
      const promise = near.promiseBatchCreate(caller);
      near.promiseBatchActionTransfer(promise, balance);
    }

    this.removeVault(caller);

    // Remove from owners list
    const owners = this.getOwners();
    const idx = owners.indexOf(caller);
    if (idx >= 0) {
      owners.splice(idx, 1);
      this.saveOwners(owners);
    }

    near.log(`Vault ${caller} deleted. Returned ${balance} yoctoNEAR`);
    return { returned_balance: balance.toString() };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Agent Actions
  // ═══════════════════════════════════════════════════════════════════

  @call({})
  trigger_warning({ account_id }: { account_id: string }): {
    status: string;
    warning_sent: boolean;
    owner: string;
  } {
    const vault = this.getVault(account_id);
    if (!vault) {
      return { status: "VAULT_NOT_FOUND", warning_sent: false, owner: account_id };
    }

    const now = near.blockTimestamp();
    const lastActive = BigInt(vault.last_active_ns);
    const interval = BigInt(vault.heartbeat_interval_ms) * MS;
    const deadline = lastActive + interval;

    if (now <= deadline) {
      return { status: "NOT_EXPIRED", warning_sent: false, owner: account_id };
    }

    if (vault.warning_triggered_at_ns !== "0") {
      return { status: "WARNING_ALREADY_SENT", warning_sent: false, owner: account_id };
    }

    vault.warning_triggered_at_ns = now.toString();
    this.saveVault(account_id, vault);

    near.log(`EVENT_JSON:{"event": "warning_sent", "data": {"owner": "${account_id}", "timestamp": "${now.toString()}"}}`);
    near.log(`WARNING: Heartbeat expired for ${account_id}. Grace period started.`);

    return { status: "WARNING_TRIGGERED", warning_sent: true, owner: account_id };
  }

  @call({})
  check_pulse({ account_id }: { account_id: string }): {
    status: string;
    is_yielding: boolean;
    owner: string;
  } {
    const vault = this.getVault(account_id);
    if (!vault) {
      return { status: "VAULT_NOT_FOUND", is_yielding: false, owner: account_id };
    }

    const now = near.blockTimestamp();
    const lastActive = BigInt(vault.last_active_ns);
    const interval = BigInt(vault.heartbeat_interval_ms) * MS;
    const deadline = lastActive + interval;

    if (now <= deadline) {
      return { status: "ALIVE", is_yielding: false, owner: account_id };
    }

    if (vault.warning_triggered_at_ns === "0") {
      return { status: "WARNING_REQUIRED", is_yielding: false, owner: account_id };
    }

    const warningTriggered = BigInt(vault.warning_triggered_at_ns);
    const gracePeriod = BigInt(vault.grace_period_ms) * MS;
    const warningDeadline = warningTriggered + gracePeriod;

    if (now < warningDeadline) {
      return { status: "WARNING_GRACE_PERIOD", is_yielding: false, owner: account_id };
    }

    if (vault.is_yielding) {
      return { status: "YIELD_PENDING", is_yielding: true, owner: account_id };
    }

    vault.is_yielding = true;
    this.saveVault(account_id, vault);

    near.log(`YIELD: Grace period expired for ${account_id}. Waiting for agent verification.`);
    return { status: "YIELD_INITIATED", is_yielding: true, owner: account_id };
  }

  @call({})
  resume_pulse({ account_id, confirm_death }: { account_id: string; confirm_death: boolean }): {
    status: string;
    transferred: string;
    owner: string;
  } {
    const vault = this.getVault(account_id);
    if (!vault) {
      return { status: "VAULT_NOT_FOUND", transferred: "0", owner: account_id };
    }

    if (!vault.is_yielding) {
      throw new Error("Vault not in yield state");
    }

    vault.is_yielding = false;

    if (!confirm_death) {
      vault.warning_triggered_at_ns = "0";
      this.saveVault(account_id, vault);
      near.log(`RESUME: Owner ${account_id} verified alive. Yield cancelled.`);
      return { status: "RESUMED_ALIVE", transferred: "0", owner: account_id };
    }

    vault.is_emergency = true;
    vault.is_completed = true; // Mark vault as completed - cannot be restarted
    const balance = BigInt(vault.vault_balance);

    if (balance > 0n) {
      const promise = near.promiseBatchCreate(vault.beneficiary_id);
      near.promiseBatchActionTransfer(promise, balance);

      const hasPayload = vault.secure_payload ? true : false;
      const memoText = hasPayload
        ? "⚠️ SENTINEL LEGACY RECEIVED. Encrypted instructions await you. Visit sentinel-app.com and use 'Beneficiary Access' to reveal your secret message."
        : "⚠️ SENTINEL LEGACY RECEIVED. Dead Man's Switch triggered — funds transferred.";

      near.log(`MEMO: ${memoText}`);
      near.log(`EVENT_JSON:{"event": "transfer_complete", "data": {"owner": "${account_id}", "beneficiary": "${vault.beneficiary_id}", "amount": "${balance.toString()}", "has_payload": ${hasPayload}, "memo": "${memoText}"}}`);
      near.log(`TRANSFER: ${balance} yoctoNEAR -> ${vault.beneficiary_id}`);

      vault.vault_balance = "0";
    }

    this.saveVault(account_id, vault);
    return { status: "TRANSFER_COMPLETE", transferred: balance.toString(), owner: account_id };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Telegram Integration
  // ═══════════════════════════════════════════════════════════════════

  @call({})
  link_telegram({ account_id, chat_id }: { account_id: string; chat_id: string }): {
    success: boolean;
    message: string;
  } {
    const vault = this.getVault(account_id);
    if (!vault) {
      return { success: false, message: `Vault not found for ${account_id}` };
    }

    vault.telegram_chat_id = chat_id;
    this.saveVault(account_id, vault);

    near.log(`Telegram linked: ${account_id} -> chat ${chat_id}`);
    return { success: true, message: "Telegram linked successfully" };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  View Methods
  // ═══════════════════════════════════════════════════════════════════

  @view({})
  get_vault({ account_id }: { account_id: string }): {
    owner_id: string;
    beneficiary_id: string;
    vault_balance: string;
    heartbeat_interval_ms: string;
    grace_period_ms: string;
    time_remaining_ms: string;
    warning_triggered_at: string;
    warning_grace_remaining_ms: string;
    is_initialized: boolean;
    is_expired: boolean;
    is_warning_active: boolean;
    is_execution_ready: boolean;
    is_yielding: boolean;
    is_emergency: boolean;
    is_completed: boolean;
    telegram_chat_id: string;
  } | null {
    const vault = this.getVault(account_id);

    if (!vault) {
      return null;
    }

    const now = near.blockTimestamp();
    const lastActive = BigInt(vault.last_active_ns);
    const interval = BigInt(vault.heartbeat_interval_ms) * MS;
    const deadline = lastActive + interval;

    const remaining = deadline > now ? (deadline - now) / MS : 0n;
    const isExpired = now > deadline;

    let warningGraceRemaining = 0n;
    let isWarningActive = false;
    let isExecutionReady = false;

    if (vault.warning_triggered_at_ns !== "0") {
      isWarningActive = true;
      const warningTriggered = BigInt(vault.warning_triggered_at_ns);
      const gracePeriod = BigInt(vault.grace_period_ms) * MS;
      const warningDeadline = warningTriggered + gracePeriod;
      warningGraceRemaining = warningDeadline > now ? (warningDeadline - now) / MS : 0n;
      isExecutionReady = now >= warningDeadline && isExpired;
    }

    return {
      owner_id: vault.owner_id,
      beneficiary_id: vault.beneficiary_id,
      vault_balance: vault.vault_balance,
      heartbeat_interval_ms: vault.heartbeat_interval_ms,
      grace_period_ms: vault.grace_period_ms,
      time_remaining_ms: remaining.toString(),
      warning_triggered_at: vault.warning_triggered_at_ns,
      warning_grace_remaining_ms: warningGraceRemaining.toString(),
      is_initialized: true,
      is_expired: isExpired,
      is_warning_active: isWarningActive,
      is_execution_ready: isExecutionReady,
      is_yielding: vault.is_yielding,
      is_emergency: vault.is_emergency,
      is_completed: vault.is_completed ?? false,
      telegram_chat_id: vault.telegram_chat_id ?? "",
      // SECURE PAYLOAD IS NOT RETURNED HERE FOR PRIVACY
      // Use reveal_payload() with proper auth to access it
    };
  }

  @view({})
  get_all_vaults(): string[] {
    return this.getOwners();
  }

  @view({})
  get_vault_count(): number {
    return this.getOwners().length;
  }
}
