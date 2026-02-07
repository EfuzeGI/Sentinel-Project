#!/bin/bash
set -e

cd "$(dirname "${BASH_SOURCE[0]}")"

npm install
npx near-sdk-js build src/contract.ts build/sentinel_vault.wasm

echo "Built: build/sentinel_vault.wasm"
echo "Deploy: near deploy <account> build/sentinel_vault.wasm"
