# Sentinel

Dead Man's Switch on NEAR Protocol with **Yield/Resume Pattern** for async off-chain verification.

If the vault owner stops sending heartbeat pings, the contract enters a YIELD state and waits for a verification agent to check owner status before transferring funds.

## How it works

```
┌─────────┐    ping()     ┌──────────┐
│  Owner  │──────────────▶│ Contract │
└─────────┘               └──────────┘
                               │
                 check_pulse() │ (if expired)
                               ▼
                      ┌────────────────┐
                      │  YIELD STATE   │  ← Contract pauses
                      └────────────────┘
                               │
                      Agent verifies...
                               │
                 resume_pulse() │
                               ▼
              ┌─────────────────────────────┐
              │ ALIVE → Reset timer         │
              │ DEAD  → Transfer to beneficiary │
              └─────────────────────────────┘
```

### Yield/Resume Flow

1. Owner deploys contract, sets beneficiary + timeout interval
2. Owner calls `ping()` periodically to prove they're alive
3. If heartbeat expires → `check_pulse()` puts contract in **YIELD** state
4. Agent performs off-chain verification (scans Twitter, GitHub, Discord, etc.)
5. Agent calls `resume_pulse(confirm_death)`:
   - `false` → Owner verified alive, yield cancelled
   - `true` → No signs of life, funds transfer to beneficiary

## Project structure

```
contract/   NEAR smart contract (near-sdk-js)
frontend/   Next.js web interface
agent/      Node.js verification daemon
```

## Quick start

### 1. Deploy contract

```bash
cd contract && npm install && npm run build
near deploy <account>.testnet build/sentinel_vault.wasm
near call <contract> setup_vault '{"beneficiary":"friend.testnet","interval":120000}' --accountId <owner>
```

### 2. Run frontend

```bash
cd frontend && npm install
cp .env.example .env.local
npm run dev
```

### 3. Run agent

```bash
cd agent && npm install
cp .env.example .env   # add AGENT_PRIVATE_KEY
node index.js
```

## Contract API

| Method | Type | Description |
|--------|------|-------------|
| `setup_vault` | call | Initialize with beneficiary and interval |
| `ping` | call | Reset heartbeat (owner) |
| `check_pulse` | call | Check expiry, initiate YIELD |
| `resume_pulse` | call | Continue after verification |
| `deposit` | call | Add NEAR |
| `withdraw` | call | Withdraw (owner) |
| `get_status` | view | Full vault state |
| `reset_vault` | call | Clear vault |

### Status fields

- `is_expired` - Heartbeat deadline passed
- `is_yielding` - Contract waiting for agent verification
- `is_emergency` - Transfer executed

## Tech stack

- Smart contract: TypeScript + near-sdk-js
- Frontend: Next.js 16, React 19, TailwindCSS v4
- Agent: Node.js + near-api-js

## License

MIT
