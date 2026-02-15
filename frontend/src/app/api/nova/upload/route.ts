import { NextResponse } from "next/server";
import { NovaSdk } from "nova-sdk-js";

export const runtime = "nodejs";

const GROUP_NAME = "sentinel_storage_v1";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { data } = body;

        if (!data || typeof data !== "string") {
            return NextResponse.json({ error: "Missing data field" }, { status: 400 });
        }



        // ─── MOVE TO ENVIRONMENT VARIABLES IN VERCEL ───
        const accountId = process.env.NOVA_ACCOUNT_ID || "keep-alive.nova-sdk.near";
        const apiKey = process.env.NOVA_API_KEY || "nova_sk_XvJ7poWarKlzM3IahbchJCpfdEGdu6bf";

        if (!accountId || !apiKey) {
            return NextResponse.json({ error: "NOVA env vars missing" }, { status: 500 });
        }


        const sdk = new NovaSdk(accountId, {
            apiKey,
            rpcUrl: "https://rpc.mainnet.near.org",
            contractId: "nova-sdk.near",
        });

        // Register group (ignore ONLY if strictly "already exists")
        try {
            await sdk.registerGroup(GROUP_NAME);
        } catch (err: any) {
            const msg = err.message || "";
            // If error is NOT about pre-existence, we must fail because upload will fail too
            if (!msg.toLowerCase().includes("exist") && !msg.toLowerCase().includes("duplicate")) {
                console.error("NOVA Register Group Failed:", msg);
                throw new Error(`Failed to register storage group: ${msg}`);
            }
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
