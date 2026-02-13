import { NextResponse } from "next/server";

export const runtime = "nodejs";

const isMainnet = process.env.NEXT_PUBLIC_NETWORK_ID === "mainnet";
const GROUP_NAME = "sentinel-final-v1";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { cid } = body;

        if (!cid || typeof cid !== "string") {
            return NextResponse.json({ error: "Missing cid field" }, { status: 400 });
        }

        if (!isMainnet) {
            return NextResponse.json({ error: "Mainnet only" }, { status: 403 });
        }

        // ─── REAL MODE (Mainnet) ───
        const accountId = process.env.NEXT_PUBLIC_NOVA_ACCOUNT_ID;
        const apiKey = process.env.NEXT_PUBLIC_NOVA_API_KEY;

        if (!accountId || !apiKey) {
            return NextResponse.json({ error: "NOVA env vars missing" }, { status: 500 });
        }

        const { NovaSdk } = require("nova-sdk-js");
        const sdk = new NovaSdk(accountId, {
            apiKey,
            rpcUrl: "https://rpc.mainnet.near.org",
            contractId: "nova-sdk.near",
            networkId: "mainnet",
        });

        const result = await sdk.retrieve(GROUP_NAME, cid);
        const text = result.data.toString("utf-8");

        return NextResponse.json({ data: text, status: "real_success" });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
