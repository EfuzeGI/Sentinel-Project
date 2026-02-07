// Sentinel - Dead Man's Switch with Yield/Resume + Warning Protocol

import { NearBindgen, near, call, view } from "near-sdk-js";

const MS = 1_000_000n;
const MIN_INTERVAL = 60_000;
const DEFAULT_INTERVAL = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_GRACE_PERIOD = 24 * 60 * 60 * 1000; // 24 hours default
const MIN_GRACE_PERIOD = 60_000; // 1 minute minimum

@NearBindgen({})
export class SentinelVault {
  owner_id: string = "";
  beneficiary_id: string = "";
  last_active: bigint = 0n;
  heartbeat_interval: bigint = 0n;
  grace_period_ms: bigint = BigInt(DEFAULT_GRACE_PERIOD); // Configurable grace period
  is_emergency: boolean = false;
  is_initialized: boolean = false;
  is_yielding: boolean = false;
  warning_triggered_at: bigint = 0n;
  vault_balance: bigint = 0n;

  @call({})
  setup_vault({ beneficiary, interval, grace_period }: { beneficiary: string; interval: number; grace_period?: number }): void {
    if (!beneficiary?.length) throw new Error("Beneficiary required");
    const actualInterval = interval > 0 ? interval : DEFAULT_INTERVAL;
    if (actualInterval < MIN_INTERVAL) throw new Error(`Interval >= ${MIN_INTERVAL}ms`);

    const actualGracePeriod = grace_period && grace_period >= MIN_GRACE_PERIOD ? grace_period : DEFAULT_GRACE_PERIOD;

    this.owner_id = near.predecessorAccountId();
    this.beneficiary_id = beneficiary;
    this.heartbeat_interval = BigInt(actualInterval);
    this.grace_period_ms = BigInt(actualGracePeriod);
    this.last_active = near.blockTimestamp();
    this.is_initialized = true;
    this.is_emergency = false;
    this.is_yielding = false;
    this.warning_triggered_at = 0n;
    near.log(`Vault initialized: ${this.owner_id} -> ${beneficiary}, grace: ${actualGracePeriod}ms`);
  }

  @call({})
  ping(): void {
    this._check();
    if (near.predecessorAccountId() !== this.owner_id) throw new Error("Unauthorized");

    this.last_active = near.blockTimestamp();
    this.warning_triggered_at = 0n;  // Reset warning on ping

    if (this.is_yielding) {
      this.is_yielding = false;
      near.log("Yield cancelled - owner is alive");
    }
    if (this.is_emergency) {
      this.is_emergency = false;
      near.log("Emergency cancelled");
    }
    near.log("Heartbeat confirmed");
  }

  @call({})
  trigger_warning(): { status: string; warning_sent: boolean } {
    this._check();

    const now = near.blockTimestamp();
    const deadline = this.last_active + this.heartbeat_interval * MS;

    if (now <= deadline) {
      return { status: "NOT_EXPIRED", warning_sent: false };
    }

    if (this.warning_triggered_at > 0n) {
      return { status: "WARNING_ALREADY_SENT", warning_sent: false };
    }

    this.warning_triggered_at = now;

    // Emit event for indexer (Goldsky)
    near.log(`EVENT_JSON:{"event": "warning_sent", "data": {"owner": "${this.owner_id}", "timestamp": "${now.toString()}"}}`);
    near.log("WARNING: Heartbeat expired. Owner has 24h to respond before transfer.");

    return { status: "WARNING_TRIGGERED", warning_sent: true };
  }

  @call({})
  check_pulse(): { status: string; is_yielding: boolean } {
    this._check();

    const now = near.blockTimestamp();
    const deadline = this.last_active + this.heartbeat_interval * MS;

    if (now <= deadline) {
      return { status: "ALIVE", is_yielding: false };
    }

    // Check if warning grace period passed
    if (this.warning_triggered_at > 0n) {
      const warningDeadline = this.warning_triggered_at + this.grace_period_ms * MS;
      if (now < warningDeadline) {
        const remaining = (warningDeadline - now) / MS;
        near.log(`Warning active. ${remaining}ms until execution eligible.`);
        return { status: "WARNING_GRACE_PERIOD", is_yielding: false };
      }
    } else {
      // No warning sent yet - must trigger warning first
      return { status: "WARNING_REQUIRED", is_yielding: false };
    }

    if (this.is_yielding) {
      return { status: "YIELD_PENDING", is_yielding: true };
    }

    this.is_yielding = true;
    near.log("YIELD: Grace period expired. Waiting for Sentinel Agent verification.");

    return { status: "YIELD_INITIATED", is_yielding: true };
  }

  @call({})
  resume_pulse({ confirm_death }: { confirm_death: boolean }): { status: string; transferred: string } {
    this._check();

    if (!this.is_yielding) {
      throw new Error("Contract not in yield state");
    }

    this.is_yielding = false;

    if (!confirm_death) {
      this.warning_triggered_at = 0n;
      near.log("RESUME: Owner verified alive. Yield cancelled.");
      return { status: "RESUMED_ALIVE", transferred: "0" };
    }

    this.is_emergency = true;
    const balance = this.vault_balance;

    if (balance > 0n) {
      const promise = near.promiseBatchCreate(this.beneficiary_id);
      near.promiseBatchActionTransfer(promise, balance);
      this.vault_balance = 0n;
      near.log(`EVENT_JSON:{"event": "transfer_complete", "data": {"beneficiary": "${this.beneficiary_id}", "amount": "${balance.toString()}"}}`);
      near.log(`TRANSFER: ${balance} yoctoNEAR -> ${this.beneficiary_id}`);
      return { status: "TRANSFER_COMPLETE", transferred: balance.toString() };
    }

    near.log("TRANSFER: Vault empty");
    return { status: "TRANSFER_EMPTY", transferred: "0" };
  }

  @call({ payableFunction: true })
  deposit(): { new_balance: string } {
    this._check();
    const amt = near.attachedDeposit();
    if (amt <= 0n) throw new Error("Amount required");
    this.vault_balance += amt;
    return { new_balance: this.vault_balance.toString() };
  }

  @call({})
  withdraw({ amount }: { amount?: string }): { withdrawn: string } {
    this._check();
    this._onlyOwner();
    if (this.is_emergency || this.is_yielding) throw new Error("Vault locked");

    const amt = amount ? BigInt(amount) : this.vault_balance;
    if (amt <= 0n || amt > this.vault_balance) throw new Error("Invalid amount");

    this.vault_balance -= amt;
    const p = near.promiseBatchCreate(this.owner_id);
    near.promiseBatchActionTransfer(p, amt);
    return { withdrawn: amt.toString() };
  }

  @call({})
  update_beneficiary({ new_beneficiary }: { new_beneficiary: string }): void {
    this._check(); this._onlyOwner();
    if (!new_beneficiary?.length) throw new Error("Required");
    this.beneficiary_id = new_beneficiary;
  }

  @call({})
  update_interval({ new_interval }: { new_interval: number }): void {
    this._check(); this._onlyOwner();
    if (new_interval < MIN_INTERVAL) throw new Error(`Min ${MIN_INTERVAL}ms`);
    this.heartbeat_interval = BigInt(new_interval);
  }

  @call({})
  update_grace_period({ new_grace_period }: { new_grace_period: number }): void {
    this._check(); this._onlyOwner();
    if (new_grace_period < MIN_GRACE_PERIOD) throw new Error(`Min ${MIN_GRACE_PERIOD}ms`);
    this.grace_period_ms = BigInt(new_grace_period);
    near.log(`Grace period updated to ${new_grace_period}ms`);
  }

  @call({})
  reset_vault(): { returned_balance: string } {
    this._check(); this._onlyOwner();
    // Allow reset in any state - owner should be able to reset after emergency
    // if (this.is_emergency || this.is_yielding) throw new Error("Vault locked");

    const bal = this.vault_balance;
    if (bal > 0n) {
      const p = near.promiseBatchCreate(this.owner_id);
      near.promiseBatchActionTransfer(p, bal);
    }

    this.owner_id = "";
    this.beneficiary_id = "";
    this.last_active = 0n;
    this.heartbeat_interval = 0n;
    this.grace_period_ms = BigInt(DEFAULT_GRACE_PERIOD);
    this.vault_balance = 0n;
    this.is_emergency = false;
    this.is_yielding = false;
    this.warning_triggered_at = 0n;
    this.is_initialized = false;

    return { returned_balance: bal.toString() };
  }

  @view({})
  get_status(): {
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
  } {
    if (!this.is_initialized) {
      return {
        owner_id: "", beneficiary_id: "", vault_balance: "0",
        heartbeat_interval_ms: "0", grace_period_ms: "0", time_remaining_ms: "0",
        warning_triggered_at: "0", warning_grace_remaining_ms: "0",
        is_initialized: false, is_expired: false, is_warning_active: false,
        is_execution_ready: false, is_yielding: false, is_emergency: false,
      };
    }

    const now = near.blockTimestamp();
    const deadline = this.last_active + this.heartbeat_interval * MS;
    const remaining = deadline > now ? (deadline - now) / MS : 0n;
    const isExpired = now > deadline;

    let warningGraceRemaining = 0n;
    let isWarningActive = false;
    let isExecutionReady = false;

    if (this.warning_triggered_at > 0n) {
      isWarningActive = true;
      const warningDeadline = this.warning_triggered_at + this.grace_period_ms * MS;
      warningGraceRemaining = warningDeadline > now ? (warningDeadline - now) / MS : 0n;
      isExecutionReady = now >= warningDeadline && isExpired;
    }

    return {
      owner_id: this.owner_id,
      beneficiary_id: this.beneficiary_id,
      vault_balance: this.vault_balance.toString(),
      heartbeat_interval_ms: this.heartbeat_interval.toString(),
      grace_period_ms: this.grace_period_ms.toString(),
      time_remaining_ms: remaining.toString(),
      warning_triggered_at: this.warning_triggered_at.toString(),
      warning_grace_remaining_ms: warningGraceRemaining.toString(),
      is_initialized: true,
      is_expired: isExpired,
      is_warning_active: isWarningActive,
      is_execution_ready: isExecutionReady,
      is_yielding: this.is_yielding,
      is_emergency: this.is_emergency,
    };
  }

  @view({}) get_owner(): string { return this.owner_id; }
  @view({}) get_beneficiary(): string { return this.beneficiary_id; }
  @view({}) get_vault_balance(): string { return this.vault_balance.toString(); }
  @view({}) get_is_yielding(): boolean { return this.is_yielding; }
  @view({}) get_warning_triggered_at(): string { return this.warning_triggered_at.toString(); }

  private _check(): void { if (!this.is_initialized) throw new Error("Not initialized"); }
  private _onlyOwner(): void { if (near.predecessorAccountId() !== this.owner_id) throw new Error("Unauthorized"); }
}
