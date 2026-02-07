# Sentinel Frontend

Next.js UI for the Sentinel vault.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Config

`.env.local`:
```
NEXT_PUBLIC_NETWORK_ID=testnet
NEXT_PUBLIC_CONTRACT_ID=your-contract.testnet
```

## Build

```bash
npm run build && npm start
```
