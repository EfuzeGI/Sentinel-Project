import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GROUP_NAME = "sentinel-vault";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { cid } = body;

        if (!cid || typeof cid !== "string") {
            return NextResponse.json({ error: "Missing cid field" }, { status: 400 });
        }

        const accountId = process.env.NEXT_PUBLIC_NOVA_ACCOUNT_ID;
        const apiKey = process.env.NEXT_PUBLIC_NOVA_API_KEY;

        if (!accountId || !apiKey) {
            return NextResponse.json({ error: "NOVA env vars missing" }, { status: 500 });
        }

        // Use SDK with testnet config
        const { NovaSdk } = require("nova-sdk-js");
        const sdk = new NovaSdk(accountId, {
            apiKey,
            rpcUrl: "https://rpc.testnet.near.org",
            contractId: "nova-sdk-5.testnet",
        });

        const result = await sdk.retrieve(GROUP_NAME, cid);
        const text = result.data.toString("utf-8");

        return NextResponse.json({ data: text });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
