import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Diagnostic endpoint to check NOVA config on server-side.
 * GET /api/nova/health
 */
export async function GET() {
    const accountId = process.env.NEXT_PUBLIC_NOVA_ACCOUNT_ID || "";
    const apiKey = process.env.NEXT_PUBLIC_NOVA_API_KEY || "";

    const status = {
        accountId: accountId ? `${accountId.substring(0, 10)}...` : "MISSING",
        apiKeySet: apiKey.length > 0,
        apiKeyLength: apiKey.length,
        nodeEnv: process.env.NODE_ENV,
        runtime: "nodejs",
    };

    // Quick auth test
    if (accountId && apiKey) {
        try {
            const res = await fetch("https://nova-sdk.com/api/auth/session-token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": apiKey,
                },
                body: JSON.stringify({ account_id: accountId }),
            });

            const body = await res.text();

            return NextResponse.json({
                ...status,
                authTest: {
                    status: res.status,
                    ok: res.ok,
                    body: res.ok ? "token_received" : body.substring(0, 200),
                },
            });
        } catch (err) {
            return NextResponse.json({
                ...status,
                authTest: {
                    error: err instanceof Error ? err.message : "Unknown",
                },
            });
        }
    }

    return NextResponse.json(status);
}
