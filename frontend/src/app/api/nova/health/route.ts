import { NextResponse } from "next/server";
import { NovaSdk } from "nova-sdk-js";

export const runtime = "nodejs";

export async function GET() {
    const accountId = "keep-alive.nova-sdk.near";
    const apiKey = "nova_sk_XvJ7poWarKlzM3IahbchJCpfdEGdu6bf";

    console.log("🔍 NOVA Diagnostic: testing auth for", accountId);

    try {
        const sdk = new NovaSdk(accountId, {
            apiKey,
            rpcUrl: "https://rpc.mainnet.near.org",
            contractId: "nova-sdk.near",
        });

        // Test auth by checking status instead of force-registering (prevents balance errors)
        const auth = await sdk.authStatus();

        return NextResponse.json({
            status: "ok",
            message: "NOVA API Key is VALID! 🔑",
            authenticated: auth.authenticated,
            details: "Your account is authenticated, but you may need to add ~1 NEAR to 'keep-alive.nova-sdk.near' to cover storage for new groups/files.",
            debug: {
                account: accountId,
                auth
            }
        });
    } catch (err: any) {
        // Parse the "Insufficient balance" error from the SDK
        const errorMsg = err.message || "Unknown error";
        if (errorMsg.includes("balance") && errorMsg.includes("cost")) {
            return NextResponse.json({
                status: "warning",
                message: "API Key is Correct, but Balance is Low",
                error: "Insufficient NEAR on account to perform storage operations.",
                instruction: "Please send 1-2 NEAR to 'keep-alive.nova-sdk.near' to enable decentralized storage.",
                debug: { account: accountId, raw_error: errorMsg }
            });
        }

        return NextResponse.json({
            status: "error",
            error: errorMsg,
            debug: { account: accountId }
        }, { status: 500 });
    }
}
