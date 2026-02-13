import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GROUP_NAME = "sentinel-final-v1";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { data } = body;

        if (!data || typeof data !== "string") {
            return NextResponse.json({ error: "Missing data field" }, { status: 400 });
        }



        // ─── HARDCODED FOR MAINNET RELEASE ───
        const accountId = "keep-alive.nova-sdk.near";
        const apiKey = "nova_sk_XvJ7poWarK1zM3IahbchJCpfdEGdu6bf";

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

        // Register group (ignore if exists)
        try {
            await sdk.registerGroup(GROUP_NAME);
        } catch {
            // Group already exists — OK
        }

        const rawBuffer = Buffer.from(data, "utf-8");
        const filename = `sentinel_${Date.now()}.enc`;
        const result = await sdk.upload(GROUP_NAME, rawBuffer, filename);

        return NextResponse.json({ cid: result.cid, status: "real_success" });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
