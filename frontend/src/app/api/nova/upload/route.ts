import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GROUP_NAME = "sentinel-vault";

export async function POST(request: Request) {
    const steps: string[] = [];

    try {
        const body = await request.json();
        const { data } = body;
        steps.push("1_parsed_body");

        if (!data || typeof data !== "string") {
            return NextResponse.json({ error: "Missing data field", steps }, { status: 400 });
        }

        const accountId = process.env.NEXT_PUBLIC_NOVA_ACCOUNT_ID;
        const apiKey = process.env.NEXT_PUBLIC_NOVA_API_KEY;

        if (!accountId || !apiKey) {
            return NextResponse.json({ error: "NOVA env vars missing", steps }, { status: 500 });
        }

        steps.push(`2_config_ok:${accountId}`);

        // Use the SDK directly — configure for TESTNET
        const { NovaSdk } = require("nova-sdk-js");
        const sdk = new NovaSdk(accountId, {
            apiKey,
            rpcUrl: "https://rpc.testnet.near.org",
            contractId: "nova-sdk-5.testnet",
        });
        steps.push("3_sdk_created");

        // Verify network detection
        const netInfo = sdk.getNetworkInfo();
        steps.push(`4_network:${netInfo.networkId},contract:${netInfo.contractId}`);

        // Register group (ignore if exists)
        try {
            const regResult = await sdk.registerGroup(GROUP_NAME);
            steps.push(`5_group_registered:${regResult}`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            steps.push(`5_group_err:${msg.substring(0, 150)}`);
        }

        // Upload
        const rawBuffer = Buffer.from(data, "utf-8");
        const filename = `sentinel_${Date.now()}.enc`;
        steps.push("6_uploading");

        const result = await sdk.upload(GROUP_NAME, rawBuffer, filename);
        steps.push("7_uploaded");

        return NextResponse.json({ cid: result.cid, steps });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message, steps }, { status: 500 });
    }
}
