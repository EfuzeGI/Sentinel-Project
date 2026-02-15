import { NextResponse } from "next/server";
import { NovaSdk } from "nova-sdk-js";

export const runtime = "nodejs";

const GROUP_NAME = "sentinel_storage_v1";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { cid } = body;

        if (!cid || typeof cid !== "string") {
            return NextResponse.json({ error: "Missing cid field" }, { status: 400 });
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

        const result = await sdk.retrieve(GROUP_NAME, cid);
        const text = result.data.toString("utf-8");

        return NextResponse.json({ data: text, status: "real_success" });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
